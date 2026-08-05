import {
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
import { fetchDescription } from '@/lib/anilist'
import { db } from '@/lib/firebase'
import type { ListDoc, ListItemDoc, ListType, MediaSnapshot } from '@/types/models'
import type { MediaSummary } from '@/types/anilist'

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
      itemCount: 0,
      joinOpen: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  return listId
}

/** Convierte un resultado de busqueda en el snapshot que se guarda en el item. */
function toSnapshot(media: MediaSummary, description: string | null): MediaSnapshot {
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
    seasons: null,
    totalEpisodes: null,
    genres: s.genres ?? [],
    averageScore: s.averageScore ?? null,
    description: s.description ?? null,
  }
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

  // La sinopsis no viaja en los resultados de busqueda (ni en el indice local,
  // donde 5000 descripciones serian varios MB), asi que se pide aqui: es una
  // sola peticion y solo al dar de alta. Si falla, se guarda sin sinopsis.
  const description = media.description ?? (await fetchDescription(media.id))

  const batch = writeBatch(db)

  // 1. La relacion. El ID del documento es el id de AniList.
  batch.set(doc(db, 'lists', listId, 'items', mediaId), {
    mediaId: media.id,
    addedBy: uid,
    addedAt: serverTimestamp(),
    status: 'pending',
    snapshot: toSnapshot(media, description),
  })

  // 2. La cache compartida: es la que alimenta el catalogo de /general.
  batch.set(
    doc(db, 'media', mediaId),
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
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )

  // 3. El contador. increment() suma en el servidor: dos altas simultaneas no
  //    se pisan, cosa que `actual + 1` desde el cliente si haria.
  batch.update(doc(db, 'lists', listId), {
    itemCount: increment(1),
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
      seasons: null,
      totalEpisodes: null,
      genres: data.genres ?? [],
      averageScore: data.averageScore ?? null,
    } satisfies MediaSummary
  })
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

  await updateDoc(doc(db, 'lists', listId), {
    memberUids: [...(list.memberUids ?? []), uid],
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

  const batch = writeBatch(db)
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
  // Firestore no borra en cascada: los items quedarian huerfanos. Se borran
  // antes, en lotes, porque no hay operacion recursiva desde el cliente.
  const items = await getDocs(collection(db, 'lists', listId, 'items'))
  const batch = writeBatch(db)
  items.docs.forEach((d) => batch.delete(d.ref))
  await batch.commit()

  await deleteDoc(doc(db, 'lists', listId))
}
