/** Forma cruda que devuelve la API de AniList (solo los campos que pedimos). */
export interface AniListMedia {
  id: number
  episodes: number | null
  format: string | null
  seasonYear: number | null
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
 * MediaCard sirva en los dos sitios.
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
  /**
   * Temporadas detectadas en la franquicia, o null si no se han podido
   * determinar. 1 no se usa: si solo hay una, queda en null.
   */
  seasons: number | null
  /** Suma de episodios de las temporadas detectadas, o null. */
  totalEpisodes: number | null
}
