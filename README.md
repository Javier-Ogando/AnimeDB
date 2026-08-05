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

`search` ya busca sobre los distintos títulos, y en la respuesta se devuelven `english`, `romaji` y `userPreferred` para poder mostrar el que corresponda en cada card. Las peticiones se lanzan con *debounce*, cancelando la anterior, y con caché en memoria para no gastar el límite de peticiones por minuto.

### Por qué hay además un índice local de títulos

`search` de AniList indexa **palabras completas** y tolera erratas, pero **no hace prefijos ni
subcadenas**. Comprobado contra la API:

```
"jobless"  -> 5 resultados (es una palabra del título inglés de Mushoku Tensei)
"mushoku"  -> 5 resultados
"musho"    -> 0 resultados      ← no es una palabra de nada
"frier"    -> 0 resultados
```

No hay parámetro que lo cambie: se probó con y sin `sort`, y con y sin `type: ANIME`. Y Firestore
tampoco resolvería esto, porque no tiene `LIKE`/`CONTAINS`: solo permite rangos, que dan búsqueda
por prefijo, no por subcadena.

La solución es un índice propio, donde `%texto%` es un `includes` de JavaScript:

- `npm run build:index` recorre AniList por popularidad y escribe `public/anime-index.json`
  (5000 títulos, es el techo de paginación de AniList por consulta). Guarda por entrada el id, los
  títulos, los episodios, la portada, el color dominante, la nota (`averageScore`) y los géneros.
- El archivo está optimizado a conciencia, porque son 5000 entradas: cada una es un **array** y no
  un objeto (repetir los nombres de campo costaría más de 200 KB), `romaji`/`english` van a `null`
  cuando coinciden con el preferido, de la portada solo se guarda el nombre del fichero —el prefijo
  del CDN va una vez en la cabecera— y los géneros son **índices a una tabla compartida**, así que
  cada uno ocupa 1 o 2 bytes en lugar de doce.
- El buscador lo descarga **en la primera pulsación**, no al abrir la página, y lo deja en memoria.
- Ordena por calidad de coincidencia: título exacto, empieza por, empieza una palabra
  (`tensei` en *Mushoku Tensei*), aparece en cualquier posición (`shoku` en *Mushoku*). A igualdad,
  manda la popularidad.
- **AniList sigue como respaldo**: si el índice da menos de 5 resultados, se consulta la API y se
  fusiona, así no se pierde el catálogo de nicho ni los estrenos posteriores al índice.
- Se refresca con el workflow [`refresh-anime-index.yml`](.github/workflows/refresh-anime-index.yml),
  mensual, que solo commitea si el archivo ha cambiado.

Si el índice no existe, la aplicación no se rompe: avisa una vez por consola y busca solo contra la API.

## Estado de la app (`/admin`)

Pantalla **de solo lectura** para vigilar el índice: número de títulos, antigüedad, peso, géneros
distintos, recuento de entradas con datos incompletos (sin valoración, sin género, sin portada…) con
filtro sobre el listado completo, y el estado de la última ejecución del workflow que lo regenera.

No permite modificar nada, y por eso el control de acceso es deliberadamente sencillo:
**`VITE_ADMIN_UIDS`** (UIDs separados por comas; se ven en la consola de Firebase →
*Authentication* → *Users*). En producción hay que añadirla también como secret del repositorio, o
`/admin` quedará inaccesible.

> Esa comprobación **solo oculta la pantalla**: la lista de UIDs viaja en el bundle, como cualquier
> variable `VITE_`, y el guardián del router se ejecuta en el navegador. Es aceptable porque todo lo
> que muestra ya es público —el índice está en el repositorio y el estado del workflow sale de la
> API pública de GitHub—. Si algún día muestra datos de otros usuarios o permite escribir, la
> autorización tendrá que vivir en las reglas de Firestore o en un *custom claim* del token.

**El botón de regenerar no ejecuta el script.** El generador es Node y la página es estática, así
que el navegador no puede lanzarlo: el panel enlaza al workflow en GitHub Actions (*Run workflow*,
un clic) y muestra el comando local. El estado de la última ejecución se lee de la API pública de
GitHub, sin token, lo que implica un límite de 60 peticiones por hora y por IP — el panel distingue
ese caso y lo dice.

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

Requisito: **Node.js `^20.19` o `>=22.12`** (lo exige Vite 8; con un 20.10 la instalación
funciona pero el servidor no arranca). Compruébalo con `node -v`.

```bash
npm ci                 # respeta package-lock.json; npm install podría subir versiones
cp .env.example .env   # rellena las claves de tu proyecto Firebase
npm run dev            # http://localhost:5173
```

El `.env` **no está en el repositorio** (lo ignora `.gitignore`), así que hay que crearlo en cada
equipo. Sin él la app compila, pero al arrancar aborta con un mensaje explícito en la consola del
navegador en lugar de fallar con un `auth/invalid-api-key` difícil de rastrear.

Los valores salen de la consola de Firebase → *Configuración del proyecto* → *General* → *Tus apps*.
No son secretos (viajan en el bundle de cualquier app web), así que se pueden pasar por el canal
interno del equipo; lo que protege los datos son las reglas de Firestore.

El login con Google funciona en local sin configurar nada más: `localhost` viene entre los dominios
autorizados de Firebase Authentication por defecto.

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

## Despliegue (GitHub Pages)

El sitio se publica en <https://javier-ogando.github.io/AnimeDB/> con el workflow
[`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml), que compila con Vite
y sube `dist/` en cada push a `main`.

Requisitos de configuración, una sola vez:

1. **Settings → Pages → Source: GitHub Actions.** Con el modo por defecto (*Deploy from a branch*),
   Pages sirve el repositorio en crudo y el navegador recibe el `index.html` de desarrollo, que
   apunta a `/src/main.ts`: página en blanco.
2. **Settings → Secrets and variables → Actions**, las seis `VITE_FIREBASE_*` de tu `.env`.
   No son secretos reales — viajan en el bundle como en cualquier app web — pero así no quedan
   escritas en el repositorio.
3. **Firebase → Authentication → Settings → Dominios autorizados**: añadir `javier-ogando.github.io`,
   o el login fallará con `auth/unauthorized-domain`.

Dos detalles que el subdirectorio `/AnimeDB/` obliga a tener en cuenta:

- `base` en `vite.config.ts` prefija los assets del build (y `BASE_PATH` lo sobreescribe si algún
  día hay dominio propio). El router lee ese valor de `import.meta.env.BASE_URL`.
- Pages no tiene reescrituras, así que el build publica también `404.html` como copia de
  `index.html`: es lo que permite entrar directamente a una ruta como `/AnimeDB/login`.

## Estado del proyecto

- [x] Scaffolding del proyecto y configuración de Tailwind
- [x] Login con Google y guarda de rutas
- [x] Cliente de AniList + buscador con autocompletado
- [x] Modo claro / oscuro
- [ ] Alta de un anime en una lista
- [ ] Lista de Pendientes personal
- [ ] Lista comunitaria (alta y baja voluntaria)
- [ ] Listas compartidas con link de invitación
- [ ] Desplegar las reglas de seguridad de Firestore

## Licencia

MIT — ver [LICENSE](./LICENSE).
