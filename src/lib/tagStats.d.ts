/** Coeficientes narrativos calculados por computeAnimeStats, escala 1-10. */
export interface AnimeStats {
  action: number
  drama: number
  mystery: number
  pacing: number
  depth: number
}

export interface AnimeStatsTag {
  name: string
  rank?: number | null
}

export function computeAnimeStats(
  genres: string[] | null | undefined,
  tags: AnimeStatsTag[] | null | undefined,
): AnimeStats | null
