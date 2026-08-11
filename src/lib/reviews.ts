import {
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ReviewDoc } from '@/types/models'

/**
 * Valoraciones de la comunidad: media/{anilistId}/reviews/{uid}.
 *
 * El uid es el ID del documento, asi que un usuario solo puede tener una resena
 * por anime y volver a puntuar sobreescribe en vez de duplicar — el mismo truco
 * que con los items de una lista.
 */

export interface Review extends ReviewDoc {
  id: string
}

function reviewRef(mediaId: number, uid: string) {
  return doc(db, 'media', String(mediaId), 'reviews', uid)
}

export async function getMyReview(mediaId: number, uid: string): Promise<Review | null> {
  const snap = await getDoc(reviewRef(mediaId, uid))
  return snap.exists() ? { ...(snap.data() as ReviewDoc), id: snap.id } : null
}

/**
 * Guarda o actualiza la resena y ajusta el agregado del anime.
 *
 * El agregado se lleva como suma y numero de votos, nunca como media: asi la
 * escritura es un increment() en el servidor y dos usuarios puntuando a la vez
 * no se pisan. Al editar una resena existente se aplica solo la DIFERENCIA de
 * puntuacion y el contador no se toca.
 */
export async function saveReview(
  mediaId: number,
  uid: string,
  score: number,
  comment: string,
): Promise<void> {
  const previous = await getMyReview(mediaId, uid)
  const clamped = Math.min(Math.max(score, 0.5), 5)

  const batch = writeBatch(db)

  batch.set(
    reviewRef(mediaId, uid),
    {
      uid,
      score: clamped,
      comment: comment.trim().slice(0, 2000),
      ...(previous ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )

  batch.set(
    doc(db, 'media', String(mediaId)),
    {
      scoreSum: increment(clamped - (previous?.score ?? 0)),
      scoreCount: increment(previous ? 0 : 1),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )

  await batch.commit()
}

/** Todas las resenas de un anime, en tiempo real y de la mas reciente atras. */
export function watchReviews(
  mediaId: number,
  onChange: (reviews: Review[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'media', String(mediaId), 'reviews'),
    orderBy('updatedAt', 'desc'),
  )

  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ ...(d.data() as ReviewDoc), id: d.id }))),
    (error) => onError?.(error),
  )
}

/** Media de la comunidad sobre 5, o null si nadie ha puntuado. */
export function communityScore(
  scoreSum: number | undefined,
  scoreCount: number | undefined,
): number | null {
  if (!scoreCount) return null
  return (scoreSum ?? 0) / scoreCount
}
