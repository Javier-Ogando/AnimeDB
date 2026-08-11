import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { fetchDescription, resolveFranchiseChain } from '@/lib/anilist'
import { db } from '@/lib/firebase'
import type {
  ItemStatus,
  ListDoc,
  ListItemDoc,
  ListRole,
  ListType,
  MediaSnapshot,
} from '@/types/models'
import type { FranchiseChain, MediaSummary } from '@/types/anilist'

/**
 * Acceso a las listas. Recordatorio de como se modela, porque no es SQL: la
 * relacion lista <-> anime ES la ruta del documento,
 * lists/{listId}/items/{anilistId}, y el ID del item es el id de AniList, lo
 * que da la unicidad gratis (anadir dos veces sobreescribe, no duplica).
 */

/**
 * La lista personal usa un ID derivado del uid en lugar de uno aleatorio: asi se
 * encuentra sin consultar y crearla dos veces es inofensivo.
 */
export function personalListId(uid: string): string {
  return `personal_${uid}`
}

/** Crea la lista personal si no existe. Idempotente. */
export async function ensurePersonalList(uid: string): Promise<string> {
  const listId = personalListId(uid)
  const ref = doc(db, 'lists', listId)
  const snap = await getDoc(ref)

  if (!snap.exists()) {
    await setDoc(ref, {
      name: 'Mis pendientes',
      type: 'personal' satisfies ListType,
      ownerUid: uid,
      memberUids: [uid],
      roles: { [uid]: 'owner' satisfies ListRole },
      itemCount: 0,
      joinOpen: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  return listId
}

/** Convierte un resultado de busqueda en el snapshot que se guarda en el item. */
function toSnapshot(
  media: MediaSummary,
  description: string | null,
  chain: FranchiseChain,
): MediaSnapshot {
  return {
    titlePreferred: media.titlePreferred,
    titleRomaji: media.titleRomaji,
    titleEnglish: media.titleEnglish,
    coverImage: media.coverImage,
    coverColor: media.coverColor,
    episodes: media.episodes,
    genres: media.genres ?? [],
    averageScore: media.averageScore ?? null,
    description,
    seasons: chain.seasons,
    totalEpisodes: chain.totalEpisodes,
  }
}

/** El snapshot guardado, de vuelta a la forma que consume AnimeCard. */
export function itemToMedia(item: ListItem): MediaSummary {
  const s = item.snapshot
  return {
    id: item.mediaId,
    titlePreferred: s.titlePreferred,
    titleRomaji: s.titleRomaji ?? s.titlePreferred,
    titleEnglish: s.titleEnglish ?? null,
    coverImage: s.coverImage ?? null,
    coverColor: s.coverColor ?? null,
    format: null,
    seasonYear: null,
    episodes: s.episodes ?? null,
    seasons: s.seasons ?? null,
    totalEpisodes: s.totalEpisodes ?? null,
    genres: s.genres ?? [],
    averageScore: s.averageScore ?? null,
    description: s.description ?? null,
    status: item.status ?? 'pending',
  }
}

/**
 * Cambia el estado de un anime y mantiene al dia media/{id}.watchedBy.
 *
 * Ese campo esta duplicado a proposito: es lo que permite a /general pintar
 * quien ha visto cada anime sin recorrer todas las listas que lo contienen.
 */
export async function updateItemStatus(
  listId: string,
  mediaId: number,
  status: ItemStatus,
  uid: string,
): Promise<void> {
  const batch = writeBatch(db)

  batch.update(doc(db, 'lists', listId, 'items', String(mediaId)), { status })

  // arrayUnion/arrayRemove son idempotentes: da igual si ya estaba o no, y no
  // hay que leer el array antes para decidir.
  batch.set(
    doc(db, 'media', String(mediaId)),
    { watchedBy: status === 'done' ? arrayUnion(uid) : arrayRemove(uid) },
    { merge: true },
  )

  await batch.commit()
}

/** Renombrar: owner y manager. */
export async function renameList(listId: string, name: string): Promise<void> {
  await updateDoc(doc(db, 'lists', listId), {
    name: name.trim() || 'Lista compartida',
    updatedAt: serverTimestamp(),
  })
}

/** Cambiar el rol de un miembro: solo el owner. */
export async function setMemberRole(
  listId: string,
  targetUid: string,
  role: ListRole,
): Promise<void> {
  await updateDoc(doc(db, 'lists', listId), { [`roles.${targetUid}`]: role })
}

/** Rol efectivo. Sin mapa de roles (listas anteriores) se asume manager. */
export function roleOf(list: ListDoc | null, uid: string | undefined): ListRole | null {
  if (!list || !uid) return null
  if (!list.memberUids?.includes(uid)) return null
  if (list.ownerUid === uid) return 'owner'
  return list.roles?.[uid] ?? 'manager'
}

export function canEdit(role: ListRole | null): boolean {
  return role === 'owner' || role === 'manager'
}

/**
 * Perfiles de varios uids, para pintar nombres y avatares.
 *
 * Devuelve el nombre y la foto EFECTIVOS, no los del proveedor: si el usuario se
 * ha puesto apodo o foto propia en /preferencias, mandan esos. Se resuelve aqui
 * y no en cada componente porque de esta funcion cuelgan las resenas, el hilo de
 * respuestas, los miembros de una lista y los avatares de /general: con la
 * preferencia aplicada en un solo sitio, no hay pantalla que se olvide.
 */
export async function fetchUserProfiles(
  uids: string[],
): Promise<Map<string, { displayName: string | null; photoURL: string | null }>> {
  const unique = [...new Set(uids)].filter(Boolean)
  const entries = await Promise.all(
    unique.map(async (uid) => {
      try {
        const snap = await getDoc(doc(db, 'users', uid))
        if (!snap.exists()) return null

        const data = snap.data() as {
          displayName?: string | null
          photoURL?: string | null
          nickname?: string | null
          photoOverride?: string | null
        }

        return [
          uid,
          {
            displayName: data.nickname?.trim() || data.displayName || null,
            photoURL: data.photoOverride?.trim() || data.photoURL || null,
          },
        ] as const
      } catch {
        return null
      }
    }),
  )

  return new Map(entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null))
}

/**
 * Alta de un anime en una lista. Los tres documentos van en un writeBatch: o
 * entran todos o no entra ninguno.
 */
export async function addAnimeToList(
  listId: string,
  media: MediaSummary,
  uid: string,
): Promise<void> {
  const mediaId = String(media.id)
  const mediaRef = doc(db, 'media', mediaId)

  /*
   * media/{anilistId} es una cache compartida: si otro usuario ya dio de alta
   * este titulo, la sinopsis y las temporadas estan ahi y no hay que volver a
   * pedirlas a AniList. Una lectura de Firestore es mas barata y mas rapida que
   * las hasta doce peticiones que cuesta recorrer una franquicia larga.
   *
   * En try/catch porque esto es solo un atajo: si la lectura falla, el alta debe
   * seguir adelante pidiendo los datos a AniList.
   */
  let cached:
    | { description?: string | null; seasons?: number | null; totalEpisodes?: number | null }
    | undefined
  try {
    cached = (await getDoc(mediaRef)).data() as typeof cached
  } catch {
    cached = undefined
  }

  // La sinopsis no viaja en los resultados de busqueda (ni en el indice local,
  // donde 5000 descripciones serian varios MB), asi que se pide aqui: es una
  // sola peticion y solo al dar de alta. Si falla, se guarda sin sinopsis.
  const description = media.description ?? cached?.description ?? (await fetchDescription(media.id))

  /*
   * Las temporadas se resuelven aqui por lo mismo, pero mas fuerte: AniList
   * modela cada temporada como una entrada aparte y hay que recorrer la cadena
   * SEQUEL/PREQUEL entera, una peticion por temporada. Contarlo desde el
   * buscador daba numeros distintos para la misma serie segun que entrada
   * coincidiese con lo teclado (ver la nota de SEARCH_QUERY en anilist.ts); en
   * el alta se calcula bien una vez y se guarda.
   *
   * `seasons` es lo que decide si hay cache: totalEpisodes puede ser null de
   * forma legitima cuando alguna temporada aun no se ha emitido.
   */
  const chain =
    typeof cached?.seasons === 'number'
      ? { seasons: cached.seasons, totalEpisodes: cached.totalEpisodes ?? null }
      : await resolveFranchiseChain(media.id)

  /*
   * Si el anime YA estaba en la lista, el set() de abajo lo sobreescribe (el ID
   * del documento es el id de AniList), asi que no hay duplicado... pero el
   * increment(1) del contador si se aplicaria, y itemCount acabaria diciendo
   * "7 titulos" en una lista de 4. De ahi esta lectura.
   */
  const itemRef = doc(db, 'lists', listId, 'items', mediaId)
  let alreadyThere = false
  try {
    alreadyThere = (await getDoc(itemRef)).exists()
  } catch {
    // Si no se puede comprobar, se asume que es nuevo: preferimos un contador
    // alto a bloquear el alta.
    alreadyThere = false
  }

  const batch = writeBatch(db)

  // 1. La relacion. El ID del documento es el id de AniList.
  batch.set(itemRef, {
    mediaId: media.id,
    addedBy: uid,
    addedAt: serverTimestamp(),
    status: 'pending',
    snapshot: toSnapshot(media, description, chain),
  })

  // 2. La cache compartida: es la que alimenta el catalogo de /general.
  batch.set(
    mediaRef,
    {
      anilistId: media.id,
      titles: {
        english: media.titleEnglish,
        romaji: media.titleRomaji,
        preferred: media.titlePreferred,
      },
      coverImage: media.coverImage,
      coverColor: media.coverColor ?? null,
      episodes: media.episodes,
      genres: media.genres ?? [],
      averageScore: media.averageScore ?? null,
      description,
      seasons: chain.seasons,
      totalEpisodes: chain.totalEpisodes,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )

  // 3. El contador. increment() suma en el servidor: dos altas simultaneas no
  //    se pisan, cosa que `actual + 1` desde el cliente si haria.
  batch.update(doc(db, 'lists', listId), {
    itemCount: increment(alreadyThere ? 0 : 1),
    updatedAt: serverTimestamp(),
  })

  await batch.commit()
}

export async function removeAnimeFromList(listId: string, mediaId: number): Promise<void> {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'lists', listId, 'items', String(mediaId)))
  batch.update(doc(db, 'lists', listId), {
    itemCount: increment(-1),
    updatedAt: serverTimestamp(),
  })
  await batch.commit()
}

export interface ListItem extends ListItemDoc {
  /** El id de AniList, que es tambien el ID del documento. */
  id: number
}

/** Suscripcion en tiempo real a los animes de una lista. */
export function watchListItems(
  listId: string,
  onChange: (items: ListItem[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(collection(db, 'lists', listId, 'items'), orderBy('addedAt', 'desc'))

  return onSnapshot(
    q,
    (snap) => {
      onChange(
        snap.docs.map((d) => ({ ...(d.data() as ListItemDoc), id: Number(d.id) })),
      )
    },
    (error) => onError?.(error),
  )
}

export interface ListWithId extends ListDoc {
  id: string
}

/** Mis listas de un tipo, en tiempo real. */
export function watchMyLists(
  uid: string,
  type: ListType,
  onChange: (lists: ListWithId[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  // Solo el array-contains: combinarlo con `where type ==` exigiria un indice
  // compuesto, y un usuario tiene pocas listas, asi que el tipo y el orden se
  // resuelven en cliente.
  const q = query(collection(db, 'lists'), where('memberUids', 'array-contains', uid))

  return onSnapshot(
    q,
    (snap) => {
      const lists = snap.docs
        .map((d) => ({ ...(d.data() as ListDoc), id: d.id }))
        .filter((list) => list.type === type)

      lists.sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0))
      onChange(lists)
    },
    (error) => onError?.(error),
  )
}

export async function getList(listId: string): Promise<ListWithId | null> {
  const snap = await getDoc(doc(db, 'lists', listId))
  return snap.exists() ? { ...(snap.data() as ListDoc), id: snap.id } : null
}

/**
 * Catalogo global: todo lo que alguien ha registrado en la aplicacion. Sale de
 * la coleccion `media`, que se rellena en cada alta, asi que no hace falta
 * duplicar nada para tenerlo.
 */
export async function fetchRegisteredMedia(max = 200): Promise<MediaSummary[]> {
  const q = query(collection(db, 'media'), orderBy('updatedAt', 'desc'), limit(max))
  const snap = await getDocs(q)

  return snap.docs.map((d) => {
    const data = d.data() as {
      anilistId: number
      titles?: { english?: string | null; romaji?: string | null; preferred?: string | null }
      coverImage?: string | null
      coverColor?: string | null
      episodes?: number | null
      genres?: string[]
      averageScore?: number | null
      watchedBy?: string[]
      seasons?: number | null
      totalEpisodes?: number | null
      description?: string | null
    }

    return {
      id: data.anilistId,
      titlePreferred: data.titles?.preferred ?? data.titles?.romaji ?? 'Sin título',
      titleRomaji: data.titles?.romaji ?? null,
      titleEnglish: data.titles?.english ?? null,
      coverImage: data.coverImage ?? null,
      coverColor: data.coverColor ?? null,
      format: null,
      seasonYear: null,
      episodes: data.episodes ?? null,
      // Resueltas en el alta y guardadas aqui: el catalogo las pinta sin tocar
      // AniList. Las altas anteriores a esto no las tienen y quedan en null.
      seasons: data.seasons ?? null,
      totalEpisodes: data.totalEpisodes ?? null,
      genres: data.genres ?? [],
      averageScore: data.averageScore ?? null,
      watchedBy: data.watchedBy ?? [],
      // addAnimeToList la guarda aqui desde el primer alta; faltaba mapearla y
      // por eso las cards de /general salian solo con el titulo.
      description: data.description ?? null,
    } satisfies MediaSummary
  })
}

export interface MyLibrary {
  /** Las listas del usuario, la personal incluida. */
  lists: ListWithId[]
  /** Ids de AniList que ya tiene guardados en alguna de ellas. */
  mediaIds: Set<number>
}

/**
 * Lo que el usuario ya tiene, de una sola pasada: /general lo necesita para no
 * ofrecer un alta que ya existe.
 *
 * Con getDocs y no con onSnapshot a proposito. Suscribirse a las listas y a los
 * items de cada una costaria las MISMAS lecturas iniciales y ademas dejaria N+1
 * escuchas abiertas para enterarse de cambios que esta pantalla ya conoce: las
 * altas las hace ella misma, asi que le basta con recordar el id en cliente.
 */
export async function fetchMyLibrary(uid: string): Promise<MyLibrary> {
  const listsSnap = await getDocs(
    query(collection(db, 'lists'), where('memberUids', 'array-contains', uid)),
  )
  const lists = listsSnap.docs.map((d) => ({ ...(d.data() as ListDoc), id: d.id }))

  // Las listas vacias se saltan: su subcoleccion no tiene nada que leer y
  // preguntarlo cuesta una consulta igualmente.
  const withItems = lists.filter((list) => (list.itemCount ?? 0) > 0)
  const itemSnaps = await Promise.all(
    withItems.map((list) => getDocs(collection(db, 'lists', list.id, 'items'))),
  )

  const mediaIds = new Set<number>()
  // El ID del documento ES el id de AniList, asi que no hay que mirar dentro.
  itemSnaps.forEach((snap) => snap.docs.forEach((d) => mediaIds.add(Number(d.id))))

  return { lists, mediaIds }
}

// ---------- listas compartidas e invitaciones ----------

/** Token largo y aleatorio: es el secreto del enlace de invitacion. */
function newToken(): string {
  return crypto.randomUUID().replaceAll('-', '')
}

/**
 * Crea una lista compartida y su invitacion de una vez, porque una lista
 * compartida sin enlace no sirve para nada.
 *
 * `joinOpen` es lo que permite a las reglas dejar que otro se anada a si mismo a
 * memberUids: sin ese campo, solo el propietario podria modificar la lista y
 * nadie podria aceptar la invitacion.
 */
export async function createSharedList(
  uid: string,
  name: string,
): Promise<{ listId: string; token: string }> {
  const listRef = doc(collection(db, 'lists'))
  const token = newToken()

  /*
   * Dos escrituras seguidas y NO un writeBatch, aunque lo atomico seria mas
   * bonito: la regla de invites comprueba que quien invita sea miembro de la
   * lista, y dentro de un lote los exists()/get() de las reglas ven el estado
   * ANTERIOR a aplicarlo. La lista todavia no existiria y la invitacion se
   * denegaria, tumbando el lote completo.
   *
   * El riesgo de partirlo es acabar con una lista sin enlace si falla la segunda
   * escritura, y eso ya esta cubierto: la pantalla de la lista ofrece "Generar
   * enlace" cuando no encuentra ninguno vigente.
   */
  await setDoc(listRef, {
    name: name.trim() || 'Lista compartida',
    type: 'shared' satisfies ListType,
    ownerUid: uid,
    memberUids: [uid],
    roles: { [uid]: 'owner' satisfies ListRole },
    itemCount: 0,
    joinOpen: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  await setDoc(doc(db, 'invites', token), {
    listId: listRef.id,
    createdBy: uid,
    createdAt: serverTimestamp(),
    expiresAt: null,
    revoked: false,
    uses: 0,
    maxUses: null,
  })

  return { listId: listRef.id, token }
}

export interface InviteInfo {
  token: string
  listId: string
  revoked: boolean
  listName: string | null
  alreadyMember: boolean
}

export async function resolveInvite(token: string, uid: string): Promise<InviteInfo | null> {
  const snap = await getDoc(doc(db, 'invites', token))
  if (!snap.exists()) return null

  const data = snap.data() as { listId: string; revoked?: boolean }
  const list = await getList(data.listId)

  return {
    token,
    listId: data.listId,
    revoked: Boolean(data.revoked),
    listName: list?.name ?? null,
    alreadyMember: Boolean(list?.memberUids?.includes(uid)),
  }
}

/**
 * Aceptar la invitacion. El invitado solo puede anadirse a si mismo: las reglas
 * comprueban que el cambio afecta unicamente a memberUids y que el uid que se
 * agrega es el suyo.
 */
export async function joinList(listId: string, uid: string): Promise<void> {
  const list = await getList(listId)
  if (!list) throw new Error('La lista ya no existe.')
  if (list.memberUids?.includes(uid)) return

  // Se entra como viewer: quien invita decide despues si sube el rol. Las
  // reglas comprueban que solo se anada a si mismo y con ese rol.
  await updateDoc(doc(db, 'lists', listId), {
    memberUids: [...(list.memberUids ?? []), uid],
    roles: { ...(list.roles ?? {}), [uid]: 'viewer' satisfies ListRole },
  })
}

/** El enlace absoluto que se comparte, respetando el subdirectorio de Pages. */
export function inviteUrl(token: string): string {
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`
  return `${base.replace(/\/$/, '')}/invitacion/${token}`
}

/** Invitacion vigente de una lista, si la hay. */
export async function findInviteForList(listId: string): Promise<string | null> {
  // Un solo filtro y el resto en cliente, por lo mismo: nada de indices
  // compuestos para una coleccion con un pufado de invitaciones por lista.
  const q = query(collection(db, 'invites'), where('listId', '==', listId), limit(10))
  const snap = await getDocs(q)
  const alive = snap.docs.find((d) => !(d.data() as { revoked?: boolean }).revoked)
  return alive?.id ?? null
}

/** Genera una invitacion nueva para una lista existente. */
export async function createInvite(listId: string, uid: string): Promise<string> {
  const token = newToken()

  /*
   * Se revocan las invitaciones vivas de esta lista antes de crear la nueva.
   * Sin esto el boton mentia: decia "invalida el anterior" y el enlace viejo
   * seguia admitiendo gente. Y ademas findInviteForList devuelve la primera no
   * revocada en orden arbitrario, asi que al reabrir la pantalla podia
   * aparecer el enlace antiguo en lugar del recien creado.
   */
  const previous = await getDocs(
    query(collection(db, 'invites'), where('listId', '==', listId), limit(20)),
  )

  const batch = writeBatch(db)

  previous.docs
    .filter((d) => !(d.data() as { revoked?: boolean }).revoked)
    .forEach((d) => batch.update(d.ref, { revoked: true }))

  batch.set(doc(db, 'invites', token), {
    listId,
    createdBy: uid,
    createdAt: serverTimestamp(),
    expiresAt: null,
    revoked: false,
    uses: 0,
    maxUses: null,
  })
  batch.update(doc(db, 'lists', listId), { joinOpen: true, updatedAt: serverTimestamp() })
  await batch.commit()

  return token
}

export async function deleteList(listId: string): Promise<void> {
  /*
   * Firestore no borra en cascada: los items quedarian huerfanos. Y un
   * writeBatch corta en 500 escrituras, asi que una lista con mas titulos
   * fallaria al borrarse y sobreviviria. De ahi los lotes.
   */
  const items = await getDocs(collection(db, 'lists', listId, 'items'))
  const CHUNK = 450

  for (let from = 0; from < items.docs.length; from += CHUNK) {
    const batch = writeBatch(db)
    items.docs.slice(from, from + CHUNK).forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }

  await deleteDoc(doc(db, 'lists', listId))
}
