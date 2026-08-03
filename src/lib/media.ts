import type { MediaSummary } from '@/types/anilist'

/**
 * Linea de episodios de una card.
 *
 *   una temporada           -> "12 caps."
 *   varias                  -> "T3 · 50 caps."          (total sumado)
 *   varias, alguna sin datos -> "T3 · caps. sin confirmar"
 *   sin dato                -> "Episodios sin confirmar"
 */
export function formatEpisodes(media: MediaSummary): string {
  if (media.seasons && media.seasons > 1) {
    return media.totalEpisodes
      ? `T${media.seasons} · ${media.totalEpisodes} caps.`
      : `T${media.seasons} · caps. sin confirmar`
  }

  if (media.episodes) {
    return `${media.episodes} caps.`
  }

  return 'Episodios sin confirmar'
}
