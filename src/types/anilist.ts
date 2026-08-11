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
 * Un nodo de la cadena de temporadas, tal y como llega de AniList: la entrada y
 * las aristas que salen de ella. `type` distingue ANIME de MANGA, porque las
 * relaciones de un anime tambien apuntan al manga original.
 */
export interface AniListChainMedia {
  id: number
  episodes: number | null
  format: string | null
  relations: {
    edges: Array<{
      relationType: string | null
      node: { id: number; type: string | null; format: string | null } | null
    } | null> | null
  } | null
}

/**
 * Resultado de recorrer la cadena SEQUEL/PREQUEL de una franquicia.
 *
 * Los dos campos son independientes: se pueden conocer las temporadas y no el
 * total de episodios, porque una temporada anunciada pero sin emitir llega con
 * `episodes: null` y sumarla como cero daria un total falso.
 */
export interface FranchiseChain {
  /** Temporadas encontradas, o null si no se ha podido recorrer la cadena. */
  seasons: number | null
  /** Suma de episodios, solo si TODAS las temporadas los tienen conocidos. */
  totalEpisodes: number | null
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
   * Uid de quienes lo han terminado. Vive en media/{id} y solo lo trae el
   * catalogo general, que es donde se pintan los avatares.
   */
  watchedBy?: string[]
  /**
   * Temporadas de la franquicia, o null si no se han podido determinar. Un 1 es
   * un dato valido (serie de una sola temporada) y se guarda como tal para no
   * volver a recorrer la cadena; formatEpisodes lo ignora al pintar.
   */
  seasons: number | null
  /** Suma de episodios de las temporadas detectadas, o null. */
  totalEpisodes: number | null
}
