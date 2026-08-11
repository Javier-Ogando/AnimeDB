# AnimeDB

Librería de anime **de consulta**: una aplicación web donde cada usuario lleva el control de qué anime tiene pendiente, qué le han sugerido y qué está siguiendo la comunidad.

> **AnimeDB no aloja, no sirve y no reproduce contenido audiovisual.** Es únicamente un catálogo y un gestor de listas. Los metadatos (títulos, portadas, sinopsis, episodios…) se obtienen de la API pública de [AniList](https://anilist.co).

## Objetivo

Resolver el "¿qué vemos ahora?" sin hojas de cálculo ni chats perdidos. El usuario
entra con Google o GitHub, lleva su **lista de pendientes** personal, crea **listas
compartidas** por link de invitación (tantos miembros como se invite, con roles) y
ve en **General** todo lo que alguien ha registrado en la aplicación, con quién lo
ha terminado ya y qué nota le ha puesto la gente.

En cualquier lista se pintan las *cards* de los animes y un buscador que
autocompleta mientras se escribe, contemplando los tres formatos de título:
**english**, **romaji** y **preferred** (el que el propio usuario tiene
configurado en AniList).

### Rutas

| Ruta | Qué es |
| --- | --- |
| `/login` | Acceso con Google o GitHub. La única ruta pública |
| `/` | Portada: los tres accesos y el buscador, que ya añade a la lista que elijas |
| `/personal` | La lista de pendientes propia |
| `/general` | Catálogo global: todo lo registrado en la app, de lo más reciente atrás |
| `/compartidas` | Mis listas compartidas, y el formulario para crear una |
| `/compartidas/:listId` | Una lista compartida: contenido, miembros, enlace y ajustes según el rol |
| `/invitacion/:token` | Aceptar una invitación. Es privada: sin sesión, el guardián manda al login con `?redirect` y vuelve aquí después |
| `/anime/:id` | Ficha del anime, la nota de la comunidad y las reseñas con su hilo |
| `/preferencias` | Apodo, foto, filtro de contenido, tema e idioma |
| `/estado` | Estado del índice local. Restringida a `VITE_ADMIN_UIDS` |

Cualquier otra ruta redirige a `/`. Todas menos `/login` exigen sesión, y el
guardián espera a que Firebase diga si había sesión previa antes de decidir: sin
eso, un F5 en `/` rebotaría al login por un instante.

## Stack

| Pieza | Tecnología |
| --- | --- |
| UI | Vue 3 (Composition API + `<script setup>`) |
| Lenguaje | TypeScript |
| Bundler / dev server | Vite |
| Estilos | Tailwind CSS |
| Auth | Firebase Authentication (Google y GitHub) |
| Base de datos | Cloud Firestore |
| Datos de anime | API pública de AniList (GraphQL) |
| Traducciones | Diccionario propio (`src/lib/i18n.ts`), sin vue-i18n |

Sin React ni Angular: Vue 3 es el único framework de UI del proyecto.

### Acceso: Google y GitHub

Los dos proveedores usan el mismo popup y el mismo `users/{uid}`; lo único que
cambia es el botón. Hay que habilitarlos en **Firebase → Authentication → Sign-in
method**, y en el caso de GitHub crear además una *OAuth App* en GitHub y pegar
su *Client ID* y *Client secret* en Firebase.

La **URL de retorno que pide GitHub la sirve Firebase**, no la app: es el
`__/auth/handler` del dominio de autenticación del proyecto.

```
https://animedb-efe00.firebaseapp.com/__/auth/handler
```

Es decir, `https://<VITE_FIREBASE_AUTH_DOMAIN>/__/auth/handler`. Poner ahí la URL
de GitHub Pages es el error típico y falla con un `redirect_uri_mismatch`: el
popup lo abre y lo cierra Firebase, y solo al final devuelve el resultado a la
página.

Firebase **no une cuentas del mismo correo por su cuenta**: entrar con GitHub
usando un correo que ya se dio de alta con Google falla con
`auth/account-exists-with-different-credential`, y la app lo traduce a "entra con
el proveedor que usaste la primera vez" en lugar de dejar un código a secas.

### Nota sobre la consulta a AniList

El autocompletado **no usa SQL**: la API de AniList es **GraphQL**. La consulta que dispara el input es del tipo:

```graphql
query Search($search: String!, $perPage: Int!, $isAdult: Boolean) {
  Page(perPage: $perPage) {
    media(
      search: $search
      type: ANIME
      sort: SEARCH_MATCH
      genre_not_in: ["Hentai"]
      isAdult: $isAdult
    ) {
      id
      episodes
      format
      seasonYear
      averageScore
      genres
      title { romaji english userPreferred }
      coverImage { large color }
    }
  }
}
```

`search` ya busca sobre los distintos títulos, y en la respuesta se devuelven `english`, `romaji` y `userPreferred` para poder mostrar el que corresponda en cada card. Las peticiones se lanzan con *debounce*, cancelando la anterior, y con caché en memoria para no gastar el límite de peticiones por minuto. La clave de esa caché incluye el filtro de contenido: si no, cambiar la preferencia seguiría devolviendo los resultados de antes.

No se piden `relations`. AniList modela cada temporada como una entrada
independiente encadenada por SEQUEL/PREQUEL, y contar la cadena desde aquí da
números falsos: *Shingeki no Kyojin* encadena siete nodos, así que cada entrada ve
una ventana distinta y devuelve un total distinto (T3/49, T4/59, T5/75 para la
misma serie). El total real de una franquicia se resolverá recorriendo la cadena
al añadir a una lista, cacheado en `media/{anilistId}`, no en cada pulsación del
teclado.

### El filtro de contenido: `genre_not_in`, no `isAdult: false`

El catálogo se recorta por **género** (`genre_not_in: ["Hentai"]`) y no cerrando
`isAdult: false` a secas, porque AniList marca como adulto cualquier cosa subida
de tono, incluido el ecchi corriente. Con `isAdult: false` como único filtro se
quedaban fuera del catálogo títulos como *Isekai Meikyuu de Harem wo*
(Drama/Ecchi/Fantasy), que no es hentai ni de lejos.

El resultado son dos niveles distintos:

- **El hentai queda fuera siempre**, en la búsqueda y en el generador del índice.
  No es una preferencia: es la consulta.
- **El ecchi se muestra u oculta según el usuario.** La preferencia `nsfw` de
  `/preferencias` viaja como `isAdult: null` (deja pasar todo) o `isAdult: false`
  (oculta lo marcado como adulto). Por defecto está desactivada, que es lo prudente
  cuando la aplicación la puede abrir cualquiera con un enlace de invitación.

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
  títulos, los episodios, la portada, el color dominante, la nota (`averageScore`), los géneros y un
  **flag de contenido para adultos**. La nota y los géneros están ahí para que una card salida del
  índice se vea igual que una salida de la API, con sus estrellas y sus chips, sin pedir nada más.
- **El flag de adulto se filtra en el cliente**, no en el archivo: el JSON es el mismo para todos y
  se sirve como estático, así que no puede venir recortado según quién lo pida. `searchAnimeIndex`
  descarta esas entradas salvo que la preferencia `nsfw` del usuario diga lo contrario. El hentai no
  entra en el archivo de partida, porque el generador usa el mismo `genre_not_in` que la búsqueda.
- El archivo está optimizado a conciencia, porque son 5000 entradas: cada una es un **array** y no
  un objeto (repetir los nombres de campo costaría más de 200 KB), `romaji`/`english` van a `null`
  cuando coinciden con el preferido, de la portada solo se guarda el nombre del fichero —el prefijo
  del CDN va una vez en la cabecera—, los géneros son **índices a una tabla compartida**, así que
  cada uno ocupa 1 o 2 bytes en lugar de doce, y el flag de adulto es `1`/`0` y no `true`/`false`.
  Las dos últimas posiciones son opcionales al leer, para que un índice generado antes de que
  existieran siga cargando (la card se pinta sin estrellas ni chips).
- El buscador lo descarga **en la primera pulsación**, no al abrir la página, y lo deja en memoria.
- Ordena por calidad de coincidencia: título exacto, empieza por, empieza una palabra
  (`tensei` en *Mushoku Tensei*), aparece en cualquier posición (`shoku` en *Mushoku*). A igualdad,
  manda la popularidad.
- **AniList sigue como respaldo**: si el índice da menos de 5 resultados, se consulta la API y se
  fusiona, así no se pierde el catálogo de nicho ni los estrenos posteriores al índice.
- Se refresca con el workflow [`refresh-anime-index.yml`](.github/workflows/refresh-anime-index.yml),
  mensual, que solo commitea si el archivo ha cambiado.

Si el índice no existe, la aplicación no se rompe: avisa una vez por consola y busca solo contra la API.

## Estado de la app (`/estado`)

Pantalla **de solo lectura** para vigilar el índice: número de títulos, antigüedad, peso, géneros
distintos, recuento de entradas con datos incompletos (sin valoración, sin género, sin portada…) con
filtro sobre el listado completo, y el estado de la última ejecución del workflow que lo regenera.

No permite modificar nada, y por eso el control de acceso es deliberadamente sencillo:
**`VITE_ADMIN_UIDS`** (UIDs separados por comas; se ven en la consola de Firebase →
*Authentication* → *Users*). En producción hay que añadirla también como secret del repositorio, o
`/estado` quedará inaccesible.

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

## Internacionalización

Las traducciones son un **diccionario propio** en [`src/lib/i18n.ts`](src/lib/i18n.ts) y una función
`t()`, en lugar de vue-i18n. El motivo es el tamaño: la aplicación tiene unas pocas decenas de
cadenas de interfaz y la librería añadiría del orden de **20 KB al bundle** más su propio ciclo de
vida (plugin, instancia, mensajes reactivos) para resolver un `Record<string, string>`.

Las claves siguen la convención `sección.elemento` en minúsculas, y una clave que falte devuelve la
clave misma: se ve el hueco en pantalla en vez de un texto vacío. El idioma sale de las preferencias
del usuario (`preferences.language`, `es` o `en`), que viven en Firestore para que viajen entre
dispositivos.

Migrar a vue-i18n más adelante sería sustituir esa función sin tocar las plantillas, así que la
decisión no cierra ninguna puerta.

Ahora mismo **solo `/preferencias` pasa por `t()`**. El diccionario ya tiene las claves `nav.*`, pero
la cabecera y el resto de pantallas llevan el texto en español fijo, así que cambiar el idioma se
nota en esa página y poco más. Es trabajo pendiente de recorrer plantillas, no una decisión.

## Modelo de datos (Firestore)

Está documentado, con el porqué de cada decisión, en **[`docs/data-model.md`](docs/data-model.md)**;
los tipos viven en [`src/types/models.ts`](src/types/models.ts) y las reglas de acceso en
[`firestore.rules`](firestore.rules). En resumen:

```
users/{uid}                              perfil, apodo, foto y preferencias
lists/{listId}                           name, type, ownerUid, memberUids, roles, joinOpen, itemCount
lists/{listId}/items/{anilistId}         la unión list ↔ media: status + snapshot para pintar la card
media/{anilistId}                        catálogo global, watchedBy y el agregado de notas
media/{anilistId}/reviews/{uid}          una reseña por usuario y anime, con replies y reactions
invites/{token}                          el token es el ID: quien tiene el link resuelve la lista
```

Los animes se guardan **por referencia** (`anilistId` como ID del documento) más un `snapshot` con
lo necesario para pintar la card sin leer nada más, no como copia del catálogo de AniList.

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

El login funciona en local sin configurar nada más: `localhost` viene entre los dominios autorizados
de Firebase Authentication por defecto, y la URL de retorno de GitHub es la de Firebase, no la de la
app, así que tampoco cambia al pasar de local a producción.

### Variables de entorno

Solo se exponen al cliente las variables con prefijo `VITE_`:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_ADMIN_UIDS=            # opcional: UIDs con acceso a /estado, separados por comas
```

El archivo `.env` está en `.gitignore`. La protección real de los datos vive en las **reglas de seguridad de Firestore**, no en ocultar estas claves.

### Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo de Vite |
| `npm run build` | Comprueba tipos con `vue-tsc` y compila a `dist/` |
| `npm run preview` | Sirve el build de producción en local |
| `npm run build:index` | Regenera `public/anime-index.json` contra AniList (2-3 min) |

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

Hecho:

- [x] Scaffolding del proyecto y configuración de Tailwind
- [x] Login con Google y con GitHub, con guarda de rutas que espera a la sesión restaurada
- [x] Cliente de AniList + buscador con autocompletado, índice local de 5000 títulos y respaldo
      contra la API cuando el índice se queda corto
- [x] Modo claro / oscuro, aplicado antes del primer pintado para no ver el fogonazo del tema
      equivocado al recargar
- [x] Alta de un anime en una lista, con el `snapshot` que evita 50 lecturas por lista
- [x] Lista de pendientes personal, con ID derivado del uid
- [x] Listas compartidas con link de invitación, **roles** (propietario / gestor / visor) y ajustes
      por lista (renombrar, regenerar enlace, cambiar roles, borrar)
- [x] Catálogo `/general` a partir de la colección `media`, con los avatares de quién ha terminado
      cada anime
- [x] Ficha de anime `/anime/:id`: nota de la comunidad, reseñas, hilo de respuestas anidadas y
      reacciones
- [x] Preferencias `/preferencias`: apodo, foto propia, filtro de contenido, tema e idioma
- [x] Panel `/estado` para vigilar el índice y la última ejecución de su workflow
- [x] Reglas de seguridad de Firestore escritas y versionadas en `firestore.rules`

Falta:

- [ ] **Traducir el resto de la interfaz.** El diccionario existe, pero solo `/preferencias` lo usa
- [ ] **La lista comunitaria.** Sigue en los tipos y en las reglas (`ListType`, `COMMUNITY_LIST_ID`,
      `lists/community/members`), pero ningún flujo de la app la toca: quien hace de "comunidad" hoy
      es `/general` leyendo `media`. Decidir si se retoma o se retira el esquema
- [ ] **Cerrar las invitaciones.** `expiresAt`, `uses` y `maxUses` se escriben y nadie los lee ni los
      valida en las reglas, nada pone `revoked: true`, y `joinOpen` no vuelve a `false`: mientras haya
      una invitación creada, cualquiera con el enlace puede entrar
- [ ] **Editar respuestas del hilo.** Las reglas ya lo permiten (solo el autor, sin mover `parentId`),
      pero no hay ni función en `src/lib/threads.ts` ni botón en la interfaz
- [ ] **Cuadrar `MediaDoc`** con lo que realmente se escribe en `media/{id}`: declara `format` y
      `seasonYear`, que no se guardan, y le faltan `coverColor`, `genres`, `averageScore` y
      `description`, que sí
- [ ] **Total de episodios de una franquicia.** `seasons` y `totalEpisodes` viajan siempre a `null`;
      el plan es recorrer la cadena SEQUEL/PREQUEL al dar de alta y cachearlo en `media/{id}`
- [ ] **Refrescar los `snapshot` desfasados.** No hay ningún mecanismo: una nota o una portada que
      cambien en AniList se quedan como estaban en las listas que ya tienen el anime

Y una comprobación que no se puede hacer desde el repositorio: **si las reglas están desplegadas en
el proyecto de Firebase**. Se despliegan con `npx firebase deploy --only firestore:rules` y, mientras
no lo estén, todas las pantallas fallan con el mismo aviso y el comando en el mensaje.

## Licencia

MIT — ver [LICENSE](./LICENSE).
