/** Forma cruda que devuelve la API de AniList (solo los campos que pedimos). */
export interface AniListMedia {
  id: number
  episodes: number | null
  format: string | null
  seasonYear: number | null
  averageScore: number | null
  genres: string[] | null
  title: {
    romaji: string | null
    english: string | null
    userPreferred: string | null
  }
  coverImage: {
    large: string | null
    color: string | null
  } | null
}

/**
 * Forma normalizada que consume la UI. La usan tanto los resultados de AniList
 * como los items ya guardados en Firestore (que traen menos campos), para que
 * AnimeCard sirva en los dos sitios.
 */
export interface MediaSummary {
  id: number
  titlePreferred: string
  titleEnglish: string | null
  titleRomaji: string | null
  coverImage: string | null
  coverColor: string | null
  format: string | null
  seasonYear: number | null
  /** Episodios de esta entrada concreta de AniList. */
  episodes: number | null
  /** Generos en ingles, tal como los nombra AniList. Se traducen al pintar. */
  genres?: string[]
  /** averageScore de AniList (0-100). El cliente lo pasa a estrellas (0-5). */
  averageScore?: number | null
  /** Sinopsis en texto plano. Solo la traen los items ya guardados. */
  description?: string | null
  /** Estado dentro de la lista. Solo lo traen los items ya guardados. */
  status?: 'pending' | 'watching' | 'done'
  /**
   * Temporadas detectadas en la franquicia, o null si no se han podido
   * determinar. 1 no se usa: si solo hay una, queda en null.
   */
  seasons: number | null
  /** Suma de episodios de las temporadas detectadas, o null. */
  totalEpisodes: number | null
}
