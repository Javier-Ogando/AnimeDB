import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ReviewReactionDoc, ReviewReplyDoc } from '@/types/models'

/**
 * Conversacion y reacciones sobre una resena.
 *
 *   media/{anilistId}/reviews/{uid}/replies/{autoId}
 *   media/{anilistId}/reviews/{uid}/reactions/{reactorUid}
 *
 * Las dos colecciones cuelgan de la resena a proposito: se leen justo cuando se
 * pinta esa resena y desaparecen con ella si algun dia se borra.
 *
 * No se lleva ningun contador agregado (ni de respuestas ni de reacciones) en la
 * resena ni en media/{id}. Seria una escritura extra por respuesta y obligaria a
 * validar el increment() en las reglas; y aqui no aporta, porque el hilo se lee
 * entero de todas formas para pintarlo. El agregado de puntuacion existe por lo
 * contrario: alli hay que dar una media sin leer las miles de resenas.
 */

export interface ReviewReply extends ReviewReplyDoc {
  id: string
}

export interface ReviewReaction extends ReviewReactionDoc {
  /** Es el uid de quien reacciona: el ID del documento. */
  id: string
}

/**
 * Juego cerrado de reacciones. Fijo y corto a proposito: con un selector libre
 * de emojis el recuento se dispersa en decenas de columnas de uno y deja de
 * decir nada de un vistazo.
 *
 * Si se toca esta lista, revisar tambien firestore.rules.
 */
export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😢'] as const

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number]

/** Tope de longitud de una respuesta. El mismo numero esta en firestore.rules. */
export const MAX_REPLY_LENGTH = 1000

/**
 * Niveles de indentacion que se pintan.
 *
 * La profundidad REAL del hilo no tiene limite (parentId puede apuntar a
 * cualquier respuesta), pero la sangria si: cada nivel come ancho, y en un movil
 * de 360 px el cuarto nivel deja columnas de dos palabras. A partir de aqui las
 * respuestas se aplanan al ultimo nivel visible, que es lo que hacen Reddit o
 * GitHub: el hilo sigue leyendose en orden, solo se pierde el escalon.
 */
export const MAX_REPLY_DEPTH = 3

/** Clave del nivel raiz en el mapa de hijos: ninguna respuesta tiene ID vacio. */
const ROOT = ''

function repliesCollection(mediaId: number, reviewUid: string) {
  return collection(db, 'media', String(mediaId), 'reviews', reviewUid, 'replies')
}

function reactionRef(mediaId: number, reviewUid: string, reactorUid: string) {
  return doc(db, 'media', String(mediaId), 'reviews', reviewUid, 'reactions', reactorUid)
}

/**
 * El hilo de una resena, en tiempo real y de la mas antigua a la mas reciente.
 *
 * Ascendente porque una conversacion se lee en el orden en que ocurrio, al
 * contrario que la lista de resenas.
 *
 * Ojo: la respuesta que acabas de enviar aparece con createdAt a null durante un
 * instante (serverTimestamp() no tiene valor hasta que el servidor responde), asi
 * que puede colocarse arriba y saltar a su sitio al confirmarse. Se acepta: la
 * alternativa es estimar la marca de tiempo en el cliente y guardar una hora que
 * no es la buena.
 */
export function watchReplies(
  mediaId: number,
  reviewUid: string,
  onChange: (replies: ReviewReply[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(repliesCollection(mediaId, reviewUid), orderBy('createdAt', 'asc'))

  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ ...(d.data() as ReviewReplyDoc), id: d.id }))),
    (error) => onError?.(error),
  )
}

/**
 * Anade una respuesta al hilo. parentId a null es primer nivel.
 *
 * Es una sola escritura, sin writeBatch: nada mas que actualizar. Que sea un
 * unico documento tambien evita el problema de siempre con las reglas, que no
 * ven con get()/exists() lo que se escribe en el mismo lote.
 */
export async function addReply(
  mediaId: number,
  reviewUid: string,
  uid: string,
  text: string,
  parentId: string | null = null,
): Promise<void> {
  const clean = text.trim().slice(0, MAX_REPLY_LENGTH)
  if (!clean) return

  await addDoc(repliesCollection(mediaId, reviewUid), {
    uid,
    text: clean,
    parentId,
    createdAt: serverTimestamp(),
  })
}

/**
 * Borra una respuesta. Solo su autor, y lo vuelven a comprobar las reglas.
 *
 * Sus hijas no se tocan: buildThread las sube a primer nivel al ver que el padre
 * ya no esta, asi que borrar el mensaje de en medio no se lleva por delante la
 * conversacion que colgaba de el.
 */
export async function deleteReply(
  mediaId: number,
  reviewUid: string,
  replyId: string,
): Promise<void> {
  await deleteDoc(doc(repliesCollection(mediaId, reviewUid), replyId))
}

/** Las reacciones de una resena, en tiempo real. */
export function watchReactions(
  mediaId: number,
  reviewUid: string,
  onChange: (reactions: ReviewReaction[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const col = collection(db, 'media', String(mediaId), 'reviews', reviewUid, 'reactions')

  return onSnapshot(
    col,
    (snap) => onChange(snap.docs.map((d) => ({ ...(d.data() as ReviewReactionDoc), id: d.id }))),
    (error) => onError?.(error),
  )
}

/**
 * Pone, cambia o quita tu reaccion.
 *
 * Al ser el uid el ID del documento no hace falta leer nada para saber si ya
 * habias reaccionado: pulsar la misma la borra, pulsar otra sobreescribe. De ahi
 * que sea imposible contar doble aunque se pulse a lo loco, y que no haya
 * carrera entre dos pestanas del mismo usuario.
 *
 * currentEmoji es lo que la interfaz ya tiene en pantalla por la suscripcion, no
 * una lectura extra.
 */
export async function toggleReaction(
  mediaId: number,
  reviewUid: string,
  reactorUid: string,
  emoji: ReactionEmoji,
  currentEmoji: string | null,
): Promise<void> {
  const ref = reactionRef(mediaId, reviewUid, reactorUid)

  if (currentEmoji === emoji) {
    await deleteDoc(ref)
    return
  }

  await setDoc(ref, { uid: reactorUid, emoji, createdAt: serverTimestamp() })
}

export interface ThreadNode {
  reply: ReviewReply
  /** 0 = primer nivel. Nunca pasa de MAX_REPLY_DEPTH - 1. */
  depth: number
}

/**
 * Convierte la lista plana de respuestas en el hilo ya ordenado para pintar:
 * cada padre seguido de sus hijas, con el nivel de sangria ya calculado y
 * recortado a MAX_REPLY_DEPTH.
 *
 * Se devuelve una lista plana con `depth` en vez de un arbol anidado para poder
 * pintarla con un v-for normal, sin componente recursivo.
 */
export function buildThread(replies: ReviewReply[]): ThreadNode[] {
  const existing = new Set(replies.map((reply) => reply.id))
  const children = new Map<string, ReviewReply[]>()

  for (const reply of replies) {
    // Una respuesta cuyo padre ya no existe (su autor lo borro) pasa a primer
    // nivel; si no, se quedaria colgada y no se pintaria nunca.
    const parent =
      reply.parentId && existing.has(reply.parentId) && reply.parentId !== reply.id
        ? reply.parentId
        : ROOT

    const siblings = children.get(parent)
    if (siblings) siblings.push(reply)
    else children.set(parent, [reply])
  }

  const nodes: ThreadNode[] = []
  // El parentId lo escribe el cliente, asi que un ciclo (A padre de B y B de A)
  // es posible desde fuera de la app y colgaria el navegador. Se corta aqui.
  const visited = new Set<string>()

  function walk(parent: string, depth: number) {
    for (const reply of children.get(parent) ?? []) {
      if (visited.has(reply.id)) continue
      visited.add(reply.id)
      nodes.push({ reply, depth: Math.min(depth, MAX_REPLY_DEPTH - 1) })
      walk(reply.id, depth + 1)
    }
  }

  walk(ROOT, 0)
  return nodes
}
