import type { Timestamp } from 'firebase/firestore'

/** Titulos tal y como los devuelve AniList. */
export interface AnimeTitles {
  english: string | null
  romaji: string | null
  preferred: string
}

/** Idiomas de la interfaz. */
export type Language = 'es' | 'en'

/** Ajustes del usuario. Viven dentro de users/{uid}. */
export interface UserPreferences {
  /** false oculta el contenido para adultos en las busquedas. */
  nsfw: boolean
  language: Language
}

/** users/{uid} */
export interface UserDoc {
  uid: string
  displayName: string | null
  photoURL: string | null
  email: string | null
  createdAt: Timestamp
  lastLoginAt: Timestamp
  /**
   * Apodo dentro de la aplicacion. Si esta puesto, sustituye al nombre que da
   * Google o GitHub en todas las pantallas.
   */
  nickname?: string | null
  /**
   * Foto propia de la aplicacion. No se sobreescribe photoURL —que lo gestiona
   * el proveedor y se refresca en cada login— sino que se guarda aparte y manda
   * cuando existe.
   */
  photoOverride?: string | null
  preferences?: UserPreferences
}

export type ListType = 'personal' | 'community' | 'shared'

/**
 * Rol dentro de una lista compartida.
 *   owner   todo, incluido cambiar roles y borrar la lista
 *   manager anadir/quitar animes, renombrar, invitar
 *   viewer  solo ver
 */
export type ListRole = 'owner' | 'manager' | 'viewer'

/** lists/{listId} */
export interface ListDoc {
  name: string
  type: ListType
  ownerUid: string
  /** Solo en 'personal' y 'shared'. La comunitaria usa la subcoleccion members. */
  memberUids?: string[]
  itemCount: number
  /**
   * Hay una invitacion vigente. Es lo que permite a las reglas dejar que un
   * invitado se anada a si mismo a memberUids: sin este campo solo el
   * propietario podria modificar la lista y nadie podria aceptar el enlace.
   */
  joinOpen?: boolean
  /**
   * Rol por uid. Va en el propio documento y no en una subcoleccion para que las
   * reglas lo comprueben sin lecturas extra: ya tienen la lista delante.
   *
   * Ausente en las listas creadas antes de los roles; en ese caso se aplica el
   * comportamiento anterior (cualquier miembro puede editar).
   */
  roles?: Record<string, ListRole>
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type ItemStatus = 'pending' | 'watching' | 'done'

/**
 * Copia de los datos necesarios para pintar una card. Duplicado a proposito:
 * asi una lista de 50 animes es UNA consulta en vez de una consulta mas 50
 * lecturas de media/{id}. Incluye genero y nota porque, sin ellos, las cards de
 * una lista se verian mas pobres que las del buscador.
 */
export interface MediaSnapshot {
  titlePreferred: string
  titleRomaji: string | null
  titleEnglish: string | null
  coverImage: string | null
  coverColor: string | null
  episodes: number | null
  genres: string[]
  averageScore: number | null
  /** Sinopsis en texto plano, recortada. Se pide a AniList al dar de alta. */
  description: string | null
  /**
   * Temporadas de la franquicia y suma de sus episodios, resueltas recorriendo
   * la cadena SEQUEL/PREQUEL de AniList al dar de alta (ver resolveFranchiseChain
   * en lib/anilist.ts). Se guardan en el snapshot y no se recalculan al pintar
   * porque cada calculo cuesta una peticion por temporada.
   *
   * Opcionales: las altas anteriores a esto no los tienen. `totalEpisodes` puede
   * ser null con `seasons` conocido, cuando alguna temporada no se ha emitido.
   */
  seasons?: number | null
  totalEpisodes?: number | null
}

/** lists/{listId}/items/{anilistId} — la union list <-> media */
export interface ListItemDoc {
  mediaId: number
  addedBy: string
  addedAt: Timestamp
  status: ItemStatus
  snapshot: MediaSnapshot
}

/** lists/community/members/{uid} */
export interface ListMemberDoc {
  joinedAt: Timestamp
}

/** media/{anilistId} — cache de AniList */
export interface MediaDoc {
  anilistId: number
  titles: AnimeTitles
  coverImage: string | null
  format: string | null
  episodes: number | null
  seasonYear: number | null
  /**
   * Temporadas de la franquicia y su total de episodios. Se calculan en el alta
   * y viven aqui como cache compartida: el siguiente usuario que anada el mismo
   * titulo los reutiliza en lugar de volver a recorrer la cadena de AniList.
   */
  seasons?: number | null
  totalEpisodes?: number | null
  /**
   * Quien ha terminado este anime, en cualquier lista. Desnormalizado a
   * proposito: sin esto, saber quien lo ha visto exigiria una consulta de grupo
   * de colecciones por cada anime del catalogo.
   */
  watchedBy?: string[]
  /**
   * Agregado de la valoracion de la comunidad. Se guardan suma y numero de
   * votos, no la media: asi cada resena nueva es un increment() en el servidor y
   * no hay que leer todas las resenas para recalcular.
   */
  scoreSum?: number
  scoreCount?: number
  updatedAt: Timestamp
}

/**
 * media/{anilistId}/reviews/{uid} — una resena por usuario y anime.
 *
 * El uid como ID del documento da la unicidad gratis: volver a puntuar
 * sobreescribe en lugar de duplicar.
 */
export interface ReviewDoc {
  uid: string
  /** De 1 a 5, en medios puntos. */
  score: number
  comment: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

/**
 * media/{anilistId}/reviews/{uid}/replies/{autoId} — el hilo de una resena.
 *
 * El anidamiento se guarda en un campo parentId y NO como subcolecciones dentro
 * de subcolecciones: Firestore no sabe consultar a profundidad arbitraria, asi
 * que con subcolecciones de verdad cada nivel del hilo costaria una consulta
 * mas. Con parentId el hilo entero es UNA consulta y el arbol se arma en el
 * cliente.
 *
 * El ID es automatico, no el uid: aqui si tiene sentido que la misma persona
 * escriba varias veces, al contrario que en la resena.
 */
export interface ReviewReplyDoc {
  uid: string
  text: string
  /** null = respuesta de primer nivel; si no, el ID de otra respuesta. */
  parentId: string | null
  createdAt: Timestamp
}

/**
 * media/{anilistId}/reviews/{uid}/reactions/{reactorUid} — una reaccion por
 * persona y resena.
 *
 * Mismo truco que con las resenas: el uid de quien reacciona es el ID del
 * documento. Eso da tres cosas gratis: nadie puede contar dos veces, alternar
 * es escribir o borrar ESE documento (sin leer nada antes) y la regla se reduce
 * a "solo tocas el documento que se llama como tu".
 */
export interface ReviewReactionDoc {
  uid: string
  emoji: string
  createdAt: Timestamp
}

/** invites/{token} */
export interface InviteDoc {
  listId: string
  createdBy: string
  createdAt: Timestamp
  expiresAt: Timestamp | null
  revoked: boolean
  uses: number
  maxUses: number | null
}

/** ID fijo de la lista comunitaria: es un singleton. */
export const COMMUNITY_LIST_ID = 'community'
