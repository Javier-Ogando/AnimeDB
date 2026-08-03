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

lists/{listId}
  name
  type: 'personal' | 'community' | 'shared'
  ownerUid
  memberUids: string[]        ← solo 'personal' y 'shared'
  itemCount, createdAt, updatedAt

lists/{listId}/items/{anilistId}        ← la unión list ↔ media
  mediaId, addedBy, addedAt
  status: 'pending' | 'watching' | 'done'
  snapshot: { titlePreferred, titleEnglish, coverImage }

lists/community/members/{uid}           ← solo la comunitaria
  joinedAt

media/{anilistId}                       ← caché de AniList (opcional)
  anilistId, titles, coverImage, format, episodes, seasonYear, updatedAt

invites/{token}
  listId, createdBy, createdAt, expiresAt, revoked, uses, maxUses
```

## Decisiones y por qué

**Una sola colección `lists` con discriminante `type`.** Las tres clases de
lista (personal, comunitaria, compartida) tienen la misma forma y las mismas
operaciones; separarlas en tres colecciones triplicaría el código de lectura
sin ganar nada.

**La relación es `list ↔ media`, no `user ↔ list ↔ media`.** Dentro de una
lista el contenido es del grupo: si un miembro añade un anime, lo ven todos.
Quién lo añadió es el campo `addedBy`, no parte de la clave. Y `status` es
estado compartido de la lista.

> Si en el futuro se quiere que cada miembro marque lo suyo por separado,
> el cambio es añadir `watchedBy: string[]` al item, no rehacer el esquema.

**`items` como subcolección.** La consulta dominante es "dame los animes de
esta lista", que sobre una subcolección es directa. La consulta inversa
("¿en qué listas está este anime?") sigue siendo posible con una
*collection group query*: `collectionGroup('items').where('mediaId','==',id)`.

**`snapshot` duplica título y portada a propósito.** Pintar 50 cards sin
snapshot serían 1 query + 50 lecturas de `media`; con snapshot es 1 query.
Firestore se factura por lectura de documento, así que la desnormalización es
la práctica correcta aquí. El coste es que la copia puede quedar desfasada,
irrelevante para títulos y carátulas.

**Membresía con dos mecanismos distintos:**

| Tipo de lista | Mecanismo | Motivo |
| --- | --- | --- |
| `personal`, `shared` | array `memberUids` en el propio doc | Las reglas validan la pertenencia **sin lecturas extra**, y "mis listas" es un solo `where('memberUids','array-contains',uid)` |
| `community` | subcolección `members/{uid}` | Un documento tope a 1 MiB: con miles de apuntados un array reventaría el doc y encarecería cada lectura de la lista |

**La lista comunitaria tiene ID fijo `community`.** Es un singleton: no hace
falta buscarla, su ruta siempre es `lists/community`. Se crea una vez a mano
(ningún flujo de la app la crea) y no se borra.

**`media` es diferible.** Con `snapshot` en los items ya se pinta todo. `media`
gana valor cuando exista la vista de detalle del anime o haga falta refrescar
snapshots viejos; añadirla después no obliga a migrar nada.

**Los tokens de invitación son el ID del documento.** `invites/{token}`: quien
tiene el link puede leer a qué lista lleva. El secreto es el token; por eso
conviene generarlo largo y aleatorio, con `expiresAt` y `revoked` para poder
cortarlo.

## Despliegue de las reglas

Las reglas **no se editan en la consola**: viven en `firestore.rules` y se
despliegan desde el repo, para que queden versionadas.

```bash
npx firebase login          # una vez
npx firebase deploy --only firestore:rules
```

Mientras no se despliegan, la base de datos deniega todo (modo producción). El
login con Google funciona igualmente porque Authentication y Firestore son
servicios independientes; lo único que falla es la escritura de `users/{uid}`,
y la app lo avisa por consola sin romperse.
