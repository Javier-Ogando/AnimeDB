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
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type ItemStatus = 'pending' | 'watching' | 'done'

/** lists/{listId}/items/{anilistId} — la union list <-> media */
export interface ListItemDoc {
  mediaId: number
  addedBy: string
  addedAt: Timestamp
  status: ItemStatus
  /** Duplicado a proposito: pinta la card sin leer media/{id}. */
  snapshot: {
    titlePreferred: string
    titleEnglish: string | null
    coverImage: string | null
  }
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
