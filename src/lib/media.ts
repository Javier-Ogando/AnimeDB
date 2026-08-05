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

/**
 * AniList nombra los generos en ingles y con una lista cerrada, asi que el
 * indice y la API los guardan tal cual (canonicos) y se traducen al pintar.
 * Un genero desconocido se muestra como venga, para no tragarse novedades.
 */
const GENRE_ES: Record<string, string> = {
  Action: 'Acción',
  Adventure: 'Aventura',
  Comedy: 'Comedia',
  Drama: 'Drama',
  Ecchi: 'Ecchi',
  Fantasy: 'Fantasía',
  Hentai: 'Hentai',
  Horror: 'Terror',
  'Mahou Shoujo': 'Mahou Shoujo',
  Mecha: 'Mecha',
  Music: 'Música',
  Mystery: 'Misterio',
  Psychological: 'Psicológico',
  Romance: 'Romance',
  'Sci-Fi': 'Ciencia ficción',
  'Slice of Life': 'Recuentos de la vida',
  Sports: 'Deportes',
  Supernatural: 'Sobrenatural',
  Thriller: 'Suspense',
}

export function translateGenre(genre: string): string {
  return GENRE_ES[genre] ?? genre
}

/** El averageScore de AniList (0-100) en estrellas de 0 a 5. */
export function scoreToStars(score: number | null | undefined): number | null {
  return score == null ? null : score / 20
}
