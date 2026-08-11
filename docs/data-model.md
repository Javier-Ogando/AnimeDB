# Modelo de datos (Cloud Firestore)

Firestore no es relacional: **no hay JOIN ni esquema declarado**. Una colección
existe cuando se escribe el primer documento dentro. Por eso este documento es
la única fuente de verdad del esquema, junto a los tipos de
[`src/types/models.ts`](../src/types/models.ts) y las reglas de
[`firestore.rules`](../firestore.rules).

## Colecciones

```
users/{uid}
  uid, displayName, photoURL, email, createdAt, lastLoginAt
  nickname?, photoOverride?            ← perfil propio de la app
  preferences?: { nsfw, language }

lists/{listId}
  name
  type: 'personal' | 'community' | 'shared'
  ownerUid
  memberUids: string[]                 ← solo 'personal' y 'shared'
  roles?: { [uid]: 'owner' | 'manager' | 'viewer' }
  joinOpen?: boolean                   ← hay una invitación vigente
  itemCount, createdAt, updatedAt

lists/{listId}/items/{anilistId}       ← la unión list ↔ media
  mediaId, addedBy, addedAt
  status: 'pending' | 'watching' | 'done'
  snapshot: { titlePreferred, titleRomaji, titleEnglish, coverImage,
              coverColor, episodes, genres, averageScore, description }

lists/community/members/{uid}          ← previsto para la comunitaria; sin uso hoy
  joinedAt

media/{anilistId}                      ← catálogo global de la app
  anilistId, titles, coverImage, coverColor, episodes,
  genres, averageScore, description, updatedAt
  watchedBy?: string[]                 ← quién lo ha terminado, en cualquier lista
  scoreSum?, scoreCount?               ← agregado de las reseñas

media/{anilistId}/reviews/{uid}        ← una reseña por usuario y anime
  uid, score (0.5–5), comment, createdAt, updatedAt

media/{anilistId}/reviews/{uid}/replies/{autoId}
  uid, text, parentId, createdAt

media/{anilistId}/reviews/{uid}/reactions/{reactorUid}
  uid, emoji, createdAt

invites/{token}
  listId, createdBy, createdAt, expiresAt, revoked, uses, maxUses
```

## Decisiones y por qué

**Una sola colección `lists` con discriminante `type`.** Las clases de lista
tienen la misma forma y las mismas operaciones; separarlas en varias colecciones
triplicaría el código de lectura sin ganar nada. El tipo se filtra en cliente
(`watchMyLists`) en lugar de en la consulta: cruzar
`array-contains` con `where('type','==',…)` exigiría un índice compuesto para
algo que devuelve un puñado de documentos.

**La relación es `list ↔ media`, no `user ↔ list ↔ media`.** Dentro de una
lista el contenido es del grupo: si un miembro añade un anime, lo ven todos.
Quién lo añadió es el campo `addedBy`, no parte de la clave. Y `status` es
estado compartido de la lista.

**El ID del documento hace de clave natural en casi todas partes**, y eso
resuelve gratis problemas que en SQL costarían un índice único:

| Ruta | ID | Qué gana |
| --- | --- | --- |
| `lists/personal_{uid}` | derivado del uid | La lista personal se encuentra sin consultar y crearla dos veces es inofensivo (`ensurePersonalList` es idempotente) |
| `lists/{listId}/items/{anilistId}` | el id de AniList | Añadir dos veces el mismo anime sobreescribe, no duplica |
| `media/{anilistId}/reviews/{uid}` | el uid del autor | Una reseña por persona y anime; volver a puntuar es un `set`, no un duplicado |
| `.../reactions/{reactorUid}` | el uid de quien reacciona | Nadie cuenta dos veces, alternar la reacción es escribir o borrar **ese** documento sin leer nada antes, y la regla se reduce a "solo tocas el documento que se llama como tú" |
| `invites/{token}` | el token del enlace | Quien tiene el link resuelve la invitación con una lectura directa |

La excepción son las respuestas de un hilo (`replies/{autoId}`): ahí sí tiene
sentido que la misma persona escriba varias veces.

**`items` como subcolección.** La consulta dominante es "dame los animes de
esta lista", que sobre una subcolección es directa. La consulta inversa
("¿en qué listas está este anime?") sigue siendo posible con una
*collection group query*: `collectionGroup('items').where('mediaId','==',id)`.

### Roles dentro de una lista

Una lista compartida crece en cadena, así que no todos los miembros deben poder
lo mismo. El rol vive en un mapa `roles: { uid: rol }` **dentro del propio
documento de la lista**, y no en una subcolección, para que las reglas lo
comprueben sin lecturas extra: cuando evalúan un item ya tienen la lista
delante.

| Rol | Puede |
| --- | --- |
| `owner` | Todo: añadir y quitar animes, renombrar, invitar, cambiar roles y borrar la lista |
| `manager` | Añadir y quitar animes, renombrar e invitar. No toca roles |
| `viewer` | Ver |

Quien acepta una invitación entra como `viewer`; subirle el rol es decisión del
propietario, y las reglas lo reservan a él (`setMemberRole` escribe
`roles.{uid}`, que solo la primera rama del `allow update` permite).

**Las listas creadas antes de los roles no tienen el mapa.** En ese caso se
mantiene el comportamiento anterior —cualquier miembro edita— en lugar de
convertirlas de golpe en solo lectura:

```
// firestore.rules
function canEditList(listId) {
  let list = get(listPath(listId)).data;
  return isMemberOf(listId) && (
    list.ownerUid == request.auth.uid ||
    !('roles' in list) ||
    list.roles.get(request.auth.uid, 'manager') in ['owner', 'manager']
  );
}
```

El mismo criterio se aplica a un miembro que falte del mapa habiendo mapa: el
`.get(uid, 'manager')` le da `manager` por defecto, y `roleOf()` en
[`src/lib/lists.ts`](../src/lib/lists.ts) repite ese default para que la
interfaz y las reglas no discrepen.

Dos matices que conviene tener presentes al leer las reglas:

- El contador `itemCount` (junto a `updatedAt` y `joinOpen`) lo puede mover
  **cualquier miembro**, incluido un `viewer`. Es el precio de que el alta de un
  anime sea un lote de tres escrituras: sin esa vía, en una lista compartida solo
  el propietario podría añadir. Lo peor que consigue un cliente rebelde es
  desajustar un número que solo se usa para decidir si merece la pena leer la
  subcolección.
- Borrar un item exige poder editar **y** ser quien lo añadió o el propietario.

### `joinOpen`: sin él nadie podría aceptar una invitación

Aceptar un enlace es, en Firestore, que el invitado se añada a `memberUids`. Y
ahí está la trampa del huevo y la gallina: **todavía no es miembro**, así que
para las reglas es un desconocido y solo el propietario podría modificar la
lista. El propietario no está delante cuando el invitado pulsa el botón.

`joinOpen: true` marca que la lista tiene una invitación vigente y es lo que
habilita la segunda vía del `allow update`: cualquier autenticado puede añadirse
**a sí mismo**, y solo a sí mismo, comprobando que el array nuevo es exactamente
el anterior más su uid y que en `roles` únicamente aparece su clave con el valor
`viewer`.

El mismo campo abre la lectura de la ficha de la lista a quien no es miembro:
el invitado necesita ver a qué se está uniendo antes de unirse. Solo se expone el
nombre y los miembros; el contenido sigue cerrado, porque `items/` exige
pertenencia, y el `listId` no es adivinable.

Lo pone a `true` la creación de una lista compartida y cada `createInvite`.
Hoy nada lo vuelve a poner a `false`: revocar el acceso pasa por borrar la lista
o dejar de compartir el enlace (ver más abajo, sobre las invitaciones).

### El `snapshot` de los items ya no es mínimo

Empezó siendo título y portada; hoy lleva además géneros, nota, sinopsis y
número de episodios. El motivo es el mismo que al principio, solo que llevado
hasta el final: **una lista de 50 animes es UNA consulta en vez de una consulta
más 50 lecturas de `media/{id}`**. Firestore factura por documento leído, así
que la desnormalización es la práctica correcta aquí.

Si el snapshot se hubiera quedado en título y carátula, las cards de una lista se
verían más pobres que las del buscador —sin estrellas ni chips de género— o
habría que pagar esas 50 lecturas para igualarlas.

El coste es que la copia puede quedar desfasada. Es irrelevante para títulos,
carátulas y géneros; la nota de AniList sí se mueve, y se acepta: es un adorno de
la card, no un dato del que dependa nada.

La sinopsis es el único campo que no viaja en los resultados de búsqueda —ni en
el índice local, donde 5000 descripciones serían varios MB—, así que
`addAnimeToList` la pide a AniList en ese momento: una sola petición, y solo al
dar de alta. Si falla, el item se guarda sin sinopsis.

### `watchedBy`: quién ha visto qué

Marcar un anime como visto escribe en dos sitios: el `status` del item y
`media/{id}.watchedBy`, en el mismo lote. El array duplicado es lo que permite a
`/general` pintar los avatares de quién ha terminado cada anime **sin recorrer
todas las listas que lo contienen**: sin él, cada anime del catálogo costaría una
*collection group query*.

Se usan `arrayUnion` y `arrayRemove` y no un array calculado en cliente: son
idempotentes y no hay que leer el valor anterior para decidir.

> La nota que estaba aquí antes decía que el reparto por miembro se resolvería
> con un `watchedBy` **en el item**. Al final el campo vive en `media/{id}` y
> significa otra cosa: es global a la aplicación, no por lista. El `status` del
> item sigue siendo estado del grupo.

### El agregado de valoraciones: suma y votos, nunca la media

`media/{id}` guarda `scoreSum` y `scoreCount`, y la media se calcula al pintar
(`communityScore`). Guardar directamente la media obligaría a leerla, hacer la
cuenta y escribirla, y dos personas puntuando a la vez se pisarían: la última en
escribir borraría el voto de la otra.

Con suma y contador, cada voto es un `increment()` que se aplica **en el
servidor**, así que las escrituras concurrentes se acumulan en lugar de
sobreescribirse. Editar una reseña existente aplica solo la **diferencia** de
puntuación y no toca el contador.

Las reglas validan el rango de `score` (0.5 a 5) en la reseña. No es cosmético:
al SDK de Firestore se le habla desde la consola del navegador sin pasar por la
app, y un 500 reventaría la media de por vida.

### Reseñas, respuestas y reacciones

Las tres colecciones cuelgan de `media/{anilistId}` porque se leen justo cuando
se pinta la ficha del anime, y desaparecen con ella si algún día se borra.

| Ruta | ID | Campos |
| --- | --- | --- |
| `media/{id}/reviews/{uid}` | uid del autor | `uid`, `score`, `comment` (≤ 2000), `createdAt`, `updatedAt` |
| `.../reviews/{uid}/replies/{autoId}` | automático | `uid`, `text` (1–1000), `parentId`, `createdAt` |
| `.../reviews/{uid}/reactions/{reactorUid}` | uid de quien reacciona | `uid`, `emoji`, `createdAt` |

**El anidamiento del hilo es un campo `parentId`, no subcolecciones dentro de
subcolecciones.** Firestore no sabe consultar a profundidad arbitraria: con
subcolecciones de verdad, cada nivel del hilo costaría una consulta más. Con
`parentId` el hilo entero es UNA consulta y el árbol se arma en el cliente
(`buildThread`). `null` es primer nivel.

Ese cliente asume que el `parentId` puede venir de cualquiera, porque lo escribe
el navegador: una respuesta cuyo padre ya no existe sube a primer nivel en vez de
quedarse colgada, y los ciclos (A padre de B y B de A) se cortan al recorrer el
árbol. La profundidad real no tiene límite; la **sangría** sí (`MAX_REPLY_DEPTH`),
porque en un móvil de 360 px el cuarto nivel deja columnas de dos palabras.

**No se lleva ningún contador agregado de respuestas ni de reacciones**, al
contrario que con la puntuación. Sería una escritura extra por respuesta y habría
que validar el `increment()` en las reglas, y no aporta: el hilo se lee entero de
todas formas para pintarlo. El agregado de puntuación existe justo por lo
contrario, porque hay que dar una media sin leer todas las reseñas.

Las reglas del hilo **no comprueban que la reseña padre exista**, y es
deliberado: sería una lectura extra por respuesta, y `get()`/`exists()` no ven lo
que se escribe en el mismo lote, así que un `writeBatch` que creara reseña y
respuesta juntas se caería aunque todo estuviese bien. Escribir en el hilo de una
reseña inexistente deja documentos huérfanos que la app no lee nunca.

El emoji se valida por longitud y no con una lista blanca de los cuatro
literales: el corazón es una secuencia de varios puntos de código (lleva selector
de variación) y exigir que el archivo de reglas y el bundle coincidan byte a byte
es frágil para algo que, al fallar, falla como un `permission-denied` silencioso.
El juego cerrado lo pone la interfaz (`REACTION_EMOJIS` en
[`src/lib/threads.ts`](../src/lib/threads.ts)).

### Perfil y preferencias del usuario

`users/{uid}` mezcla dos cosas: lo que da el proveedor de acceso
(`displayName`, `photoURL`, `email`) y lo que el usuario decide dentro de
AnimeDB.

| Campo | Para qué |
| --- | --- |
| `nickname` | Apodo dentro de la app. Si está puesto, sustituye al nombre de Google o GitHub en todas las pantallas |
| `photoOverride` | Foto propia de la app, por URL |
| `preferences` | `{ nsfw, language }`: filtro de contenido para adultos e idioma de la interfaz |

**`photoOverride` va aparte y no sobreescribe `photoURL`** porque `photoURL` lo
gestiona el proveedor: `syncUserDoc` lo reescribe en cada login, y se llevaría por
delante la foto elegida aquí. Guardándolo en otro campo, la precedencia se decide
al pintar (manda `photoOverride` si existe) y ninguna de las dos fuentes pisa a la
otra.

Estos ajustes viven en Firestore y no en `localStorage` porque tienen que viajar
entre dispositivos: el apodo lo ven los demás, y el filtro de contenido debe
aplicar igual desde el móvil que desde el portátil.

`preferences` se escribe siempre como objeto completo, nunca campo anidado a
campo anidado, para que la lista blanca de las reglas solo tenga que contemplar
la clave `preferences`. Y esa lista blanca es lo que impide que alguien escriba
cualquier cosa en su propio documento: los perfiles son legibles por cualquier
usuario autenticado —hacen falta para mostrar quién comparte lista contigo—, así
que un documento propio sin restricciones sería un campo libre que leen los
demás.

### Qué queda de la lista comunitaria

El diseño inicial preveía una lista singleton `lists/community` con
subcolección `members/{uid}`, y esa parte **sigue en las reglas y en los tipos**
(`ListType` incluye `'community'`, existe la constante `COMMUNITY_LIST_ID`).

Pero **ningún flujo de la aplicación la lee ni la escribe hoy.** La constante no
se importa en ninguna parte, y la pantalla `/general` —lo que hace de "catálogo
de la comunidad"— lee la colección `media`:

```ts
// src/lib/lists.ts
query(collection(db, 'media'), orderBy('updatedAt', 'desc'), limit(max))
```

Y funciona porque `media/{id}` se rellena en cada alta a **cualquier** lista, así
que ya es el registro global de todo lo que alguien ha guardado en la aplicación,
sin duplicar nada ni pedirle a nadie que se apunte a nada.

El razonamiento que justificaba la subcolección `members` sigue siendo válido si
algún día se retoma —un documento tope a 1 MiB, y un array con miles de apuntados
reventaría el documento y encarecería cada lectura de la lista—, pero por ahora es
esquema reservado, no esquema en uso.

### `media` ya no es diferible

En la primera versión de este documento `media` era una caché opcional de AniList
que el `snapshot` hacía innecesaria. Ya no: es donde viven el catálogo de
`/general`, `watchedBy`, el agregado de puntuaciones y las tres colecciones de
reseñas. Es una pieza central del modelo.

Las reglas dejan que **cualquier autenticado** cree y actualice `media/{id}`.
Son datos públicos de AniList, no hay nada que proteger, y es lo que permite que
el alta de un anime y los `increment()` del agregado salgan del cliente sin una
Cloud Function de por medio.

La ficha de anime (`/anime/:id`) pide los datos del título a **AniList** y no a
`media`, para que funcione también con animes que nadie ha guardado todavía. De
Firestore sale solo lo nuestro: el agregado y las reseñas.

> Discrepancia conocida: la interfaz `MediaDoc` de
> [`src/types/models.ts`](../src/types/models.ts) declara `format` y `seasonYear`,
> que `addAnimeToList` no escribe, y no declara `coverColor`, `genres`,
> `averageScore` ni `description`, que sí escribe. Lo que hay realmente en la
> base de datos es la lista de campos del árbol de arriba.

### Invitaciones

**El token es el ID del documento.** `invites/{token}`: quien tiene el link
resuelve de una lectura a qué lista lleva. El secreto es el token, y por eso se
genera largo y aleatorio (`crypto.randomUUID()` sin guiones).

Cualquier **miembro** puede invitar, no solo quien creó la lista: la idea es que
una lista compartida crezca en cadena. Revocar o contar usos queda reservado a
quien creó la invitación.

La lista compartida y su primera invitación se crean con **dos escrituras
seguidas y no con un `writeBatch`**, aunque lo atómico sería más bonito: la regla
de `invites` comprueba que quien invita sea miembro de la lista, y dentro de un
lote los `get()`/`exists()` de las reglas ven el estado **anterior** a aplicarlo.
La lista todavía no existiría, la invitación se denegaría y el lote entero se
caería. El riesgo de partirlo —acabar con una lista sin enlace si falla la segunda
escritura— ya está cubierto: la pantalla de la lista ofrece generar un enlace
nuevo cuando no encuentra ninguno vigente.

De los campos del documento, hoy **solo se consulta `revoked`**. `expiresAt`,
`uses` y `maxUses` se escriben (a `null`, `0` y `null`) y nadie los lee ni los
incrementa todavía: son el sitio ya reservado para caducidad y límite de usos,
que las reglas tendrán que validar cuando se implementen. Y nada en la interfaz
pone `revoked: true` por ahora; "regenerar enlace" crea una invitación nueva y
deja viva la anterior.

## Despliegue de las reglas

Las reglas **no se editan en la consola**: viven en `firestore.rules` y se
despliegan desde el repo, para que queden versionadas.

```bash
npx firebase login          # una vez
npx firebase deploy --only firestore:rules
```

Mientras no se despliegan, la base de datos deniega todo (modo producción). El
login funciona igualmente porque Authentication y Firestore son servicios
independientes; lo que falla es todo lo que toque datos, y la app lo distingue:
cuando el error trae `permission`, las pantallas lo dicen con el comando de
despliegue en el mensaje en lugar de un fallo genérico.

No hay índices compuestos que desplegar (`firestore.indexes.json` está vacío), y
es a propósito: todas las consultas se han dejado en un solo filtro, resolviendo
el resto —tipo de lista, orden, invitación vigente— en el cliente.
