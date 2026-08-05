/**
 * Utilidades del panel de administracion.
 *
 * OJO con el alcance de esta comprobacion: la lista de administradores viaja en
 * el bundle, asi que solo OCULTA la pantalla, no protege nada. Vale porque el
 * panel unicamente lee el indice publico y enlaza a GitHub. En el momento en que
 * exponga datos de otros usuarios o permita escribir, la autorizacion tiene que
 * vivir en las reglas de Firestore o en un custom claim del token.
 */

const REPO = 'Javier-Ogando/AnimeDB'
const INDEX_WORKFLOW = 'refresh-anime-index.yml'

/** UIDs con acceso, en VITE_ADMIN_UIDS separados por comas. */
export function adminUids(): string[] {
  return (import.meta.env.VITE_ADMIN_UIDS ?? '')
    .split(',')
    .map((uid) => uid.trim())
    .filter(Boolean)
}

export function isAdmin(uid: string | null | undefined): boolean {
  if (!uid) return false
  return adminUids().includes(uid)
}

/** Pagina del workflow: desde ahi se lanza con "Run workflow". */
export const indexWorkflowUrl = `https://github.com/${REPO}/actions/workflows/${INDEX_WORKFLOW}`

export interface WorkflowRun {
  /** queued | in_progress | completed */
  status: string
  /** success | failure | cancelled… solo cuando status es completed */
  conclusion: string | null
  createdAt: string
  htmlUrl: string
  runNumber: number
}

/**
 * Ultima ejecucion del workflow del indice. El repositorio es publico, asi que
 * no hace falta token; a cambio, GitHub limita a 60 peticiones por hora y por
 * IP, y ese caso se distingue del resto de errores.
 */
export async function fetchLastIndexRun(): Promise<
  { run: WorkflowRun | null } | { error: 'rate-limit' | 'unavailable' }
> {
  const url = `https://api.github.com/repos/${REPO}/actions/workflows/${INDEX_WORKFLOW}/runs?per_page=1`

  try {
    const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } })

    if (response.status === 403 || response.status === 429) return { error: 'rate-limit' }
    if (!response.ok) return { error: 'unavailable' }

    const payload = (await response.json()) as {
      workflow_runs?: Array<{
        status: string
        conclusion: string | null
        created_at: string
        html_url: string
        run_number: number
      }>
    }

    const first = payload.workflow_runs?.[0]
    if (!first) return { run: null }

    return {
      run: {
        status: first.status,
        conclusion: first.conclusion,
        createdAt: first.created_at,
        htmlUrl: first.html_url,
        runNumber: first.run_number,
      },
    }
  } catch {
    return { error: 'unavailable' }
  }
}
