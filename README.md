# AnimeDB

Librería de anime **de consulta**: una aplicación web donde cada usuario lleva el control de qué anime tiene pendiente, qué le han sugerido y qué está siguiendo la comunidad.

> **AnimeDB no aloja, no sirve y no reproduce contenido audiovisual.** Es únicamente un catálogo y un gestor de listas. Los metadatos (títulos, portadas, sinopsis, episodios…) se obtienen de la API pública de [AniList](https://anilist.co).

## Objetivo

Resolver el "¿qué vemos ahora?" sin hojas de cálculo ni chats perdidos:

- El usuario entra con su cuenta de Google (Firebase Authentication).
- Ve su **lista de Pendientes** personal.
- Ve la **lista comunitaria**, una lista pública a la que cualquiera puede apuntarse o darse de baja libremente.
- Puede crear **listas compartidas** con otros usuarios mediante un **link de invitación**, y esas listas admiten tantos miembros como se invite (no hay límite de dos personas).
- Dentro de una lista se muestran las *cards* de los animes seleccionados y un buscador que autocompleta contra AniList mientras se escribe, contemplando los tres formatos de título: **english**, **romaji** y **preferred** (el que el propio usuario tiene configurado en AniList).

## Stack

| Pieza | Tecnología |
| --- | --- |
| UI | Vue 3 (Composition API + `<script setup>`) |
| Lenguaje | TypeScript |
| Bundler / dev server | Vite |
| Estilos | Tailwind CSS |
| Auth | Firebase Authentication (Google Sign-In) |
| Base de datos | Cloud Firestore |
| Datos de anime | API pública de AniList (GraphQL) |

Sin React ni Angular: Vue 3 es el único framework de UI del proyecto.

### Nota sobre la consulta a AniList

El autocompletado **no usa SQL**: la API de AniList es **GraphQL**. La consulta que dispara el input es del tipo:

```graphql
query ($search: String) {
  Page(perPage: 10) {
    media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
      id
      title { english romaji native userPreferred }
      coverImage { large color }
      seasonYear
      format
      episodes
    }
  }
}
```

`search` ya busca sobre los distintos títulos, y en la respuesta se devuelven `english`, `romaji` y `userPreferred` para poder mostrar el que corresponda en cada card. Las peticiones se lanzan con *debounce* y con caché en memoria para respetar el límite de peticiones de AniList (90 req/min).

## Modelo de datos (Firestore, propuesta inicial)

```
users/{uid}
  displayName, photoURL, email, createdAt

lists/{listId}
  name, type: 'pending' | 'community' | 'shared'
  ownerUid, memberUids: string[], createdAt

lists/{listId}/items/{anilistId}
  anilistId, titles { english, romaji, preferred }
  coverImage, addedBy, addedAt, status

invites/{token}
  listId, createdBy, expiresAt, revoked
```

Los animes se guardan **por referencia** (`anilistId` + los campos mínimos para pintar la card), no como copia del catálogo de AniList.

## Puesta en marcha

Requisitos: Node.js 20+ y un proyecto de Firebase con Authentication (proveedor Google) y Firestore activados.

```bash
npm install
cp .env.example .env   # rellena las claves de tu proyecto Firebase
npm run dev
```

### Variables de entorno

Solo se exponen al cliente las variables con prefijo `VITE_`:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

El archivo `.env` está en `.gitignore`. La protección real de los datos vive en las **reglas de seguridad de Firestore**, no en ocultar estas claves.

### Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo de Vite |
| `npm run build` | Build de producción en `dist/` |
| `npm run preview` | Sirve el build de producción en local |

## Estado del proyecto

Fase inicial: el andamiaje (Vite + Vue 3 + TS + Tailwind + Firebase) todavía está por montar. Hoja de ruta corta:

- [ ] Scaffolding del proyecto y configuración de Tailwind
- [ ] Login con Google y guarda de rutas
- [ ] Cliente de AniList + buscador con autocompletado
- [ ] Lista de Pendientes personal
- [ ] Lista comunitaria (alta y baja voluntaria)
- [ ] Listas compartidas con link de invitación
- [ ] Reglas de seguridad de Firestore

## Licencia

MIT — ver [LICENSE](./LICENSE).
