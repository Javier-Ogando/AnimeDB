import type { Timestamp } from 'firebase/firestore'

/** Titulos tal y como los devuelve AniList. */
export interface AnimeTitles {
  english: string | null
  romaji: string | null
  preferred: string
}

/** users/{uid} */
export interface UserDoc {
  uid: string
  displayName: string | null
  photoURL: string | null
  email: string | null
  createdAt: Timestamp
  lastLoginAt: Timestamp
}

export type ListType = 'personal' | 'community' | 'shared'

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
  updatedAt: Timestamp
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
