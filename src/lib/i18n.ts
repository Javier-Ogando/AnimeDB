import { computed } from 'vue'
import { usePreferences } from '@/composables/usePreferences'
import type { Language } from '@/types/models'

/**
 * Traducciones de la interfaz.
 *
 * Sin vue-i18n a proposito: la aplicacion tiene pocas cadenas y una libreria
 * anadiria ~20 KB al bundle mas su propio ciclo de vida. Un diccionario plano y
 * una funcion t() cubren el caso, y migrar a vue-i18n despues seria sustituir
 * esta funcion sin tocar las plantillas.
 *
 * Convencion de claves: seccion.elemento, en minusculas la seccion y en
 * camelCase el elemento. La seccion es la pantalla (home, personal, general,
 * shared, invite, login, status, detail, prefs) o el componente reutilizable
 * (card, search, menu, theme, nav). Hay tres grupos transversales para no
 * repetir la misma cadena en cinco pantallas:
 *
 *   common.*  piezas sueltas que salen en varios sitios (Usuario, Cancelar...)
 *   unit.*    lo que cuenta la cifra de PageHeader, en singular y plural
 *   error.*   fallos de Firestore con el mismo texto en toda la aplicacion
 *
 * INTERPOLACION. Los huecos van entre llaves y se rellenan con el segundo
 * argumento de t():
 *
 *   t('shared.members', { count: 3 })   ->  'Miembros (3)'
 *
 * Un marcador sin valor se deja tal cual, igual que una clave que falta: se ve
 * el hueco en pantalla en vez de un texto a medias.
 *
 * PLURALES. No hay reglas de pluralizacion ni categorias CLDR. Cuando una cadena
 * cambia de forma segun la cifra se guardan DOS claves, con sufijo `One` y
 * `Many`, y elige quien la usa:
 *
 *   t(n === 1 ? 'detail.replyOne' : 'detail.replyMany', { count: n })
 *
 * Basta para es/en, que solo distinguen singular de plural. Si algun dia entra
 * un idioma con mas formas (ru, pl...), el cambio es en t() y no en el diccionario.
 */
const MESSAGES: Record<Language, Record<string, string>> = {
  es: {
    'nav.pending': 'Pendientes',
    'nav.general': 'General',
    'nav.shared': 'Compartidas',
    'nav.status': 'Estado',
    'nav.preferences': 'Preferencias',
    'nav.signOut': 'Salir',
    'nav.back': 'Volver',

    'common.loading': 'Cargando…',
    'common.user': 'Usuario',
    'common.userLowercase': 'usuario',
    'common.you': '(tú)',
    'common.cancel': 'Cancelar',
    'common.yes': 'Sí',
    'common.no': 'No',
    'common.dismiss': 'Cerrar aviso',

    'unit.titleOne': 'título',
    'unit.titleMany': 'títulos',
    'unit.listOne': 'lista',
    'unit.listMany': 'listas',
    'unit.memberOne': 'miembro',
    'unit.memberMany': 'miembros',

    'error.permissionRead':
      'Firestore ha denegado el acceso. Despliega las reglas: npx firebase deploy --only firestore:rules',
    'error.permissionWrite':
      'Firestore ha denegado la escritura. Despliega las reglas: npx firebase deploy --only firestore:rules',
    'error.permissionRole':
      'Firestore ha denegado la operación. Puede que tu rol en esta lista no lo permita.',
    'error.generic': 'No se ha podido completar la operación.',

    'theme.toLight': 'Cambiar a modo claro',
    'theme.toDark': 'Cambiar a modo oscuro',
    'theme.light': 'Modo claro',
    'theme.dark': 'Modo oscuro',

    'home.pendingHint': 'Tu lista personal',
    'home.generalHint': 'Todo lo registrado en la app',
    'home.sharedHint': 'Por link de invitación',
    'home.open': 'Abrir →',
    'home.destinationPersonal': 'Personal',
    'home.added': '«{title}» añadido a {target}.',
    'home.defaultTarget': 'tu lista',
    'home.addError': 'No se ha podido añadir.',

    'personal.kicker': 'Tu lista',
    'personal.title': 'Mis pendientes',
    'personal.hint':
      'Solo la ves tú. Busca cualquier anime y guárdalo aquí para no perderle la pista.',
    'personal.empty': 'Busca un anime arriba y añádelo a tus pendientes.',
    'personal.loadError': 'No se ha podido cargar la lista.',

    'general.kicker': 'Catálogo común',
    'general.title': 'General',
    'general.hint':
      'Todo lo que alguien ha registrado en AnimeDB, sin importar en qué lista lo guardara.',
    'general.empty': 'Nadie ha añadido nada todavía. Empieza por tus pendientes.',
    'general.filterLabel': 'Filtrar por categoría',
    'general.filterAll': 'Todas',
    'general.noMatches': 'Ningún título con esa categoría.',
    'general.added': 'Añadido a {target}.',
    'general.defaultTarget': 'la lista',
    'general.addError': 'No se ha podido añadir. Inténtalo de nuevo.',
    'general.loadError': 'No se ha podido cargar el catálogo.',

    'shared.kicker': 'Con quien quieras',
    'shared.title': 'Listas compartidas',
    'shared.hint':
      'Cada lista tiene su propio enlace de invitación. Quien lo abra entra y puede añadir.',
    'shared.new': 'Nueva lista',
    'shared.name': 'Nombre de la lista',
    'shared.creating': 'Creando…',
    'shared.create': 'Crear',
    'shared.empty':
      'No tienes ninguna lista compartida. Crea una con el botón de arriba y comparte su enlace.',
    'shared.own': 'Tuya',
    'shared.loadError': 'No se han podido cargar las listas.',
    'shared.listFallback': 'Lista compartida',
    'shared.notFound': 'Esta lista no existe o ya no tienes acceso.',
    'shared.readOnly': 'Tu rol en esta lista es solo de lectura.',
    'shared.itemsEmpty': 'Aún no hay nada en esta lista. Busca un anime arriba.',
    'shared.added': '«{title}» añadido.',
    'shared.renamed': 'Nombre actualizado.',
    'shared.roleUpdated': 'Rol actualizado.',
    'shared.linkRegenerated': 'Enlace nuevo generado.',
    'shared.settings': 'Ajustes',
    'shared.settingsAria': 'Ajustes de la lista',
    'shared.invite': 'Invitación',
    'shared.inviteLink': 'Enlace de invitación',
    'shared.copy': 'Copiar',
    'shared.copied': '¡Hecho!',
    'shared.regenerate': 'Generar uno nuevo (invalida el anterior)',
    'shared.generateLink': 'Generar enlace',
    'shared.members': 'Miembros ({count})',
    'shared.roleOwner': 'Propietario',
    'shared.roleOwnerHint': 'Todo, incluidos roles y borrar',
    'shared.roleManager': 'Gestor',
    'shared.roleManagerHint': 'Añadir, quitar, renombrar, invitar',
    'shared.roleViewer': 'Visor',
    'shared.roleViewerHint': 'Solo ver',
    'shared.roleOf': 'Rol de {name}',
    'shared.deleteList': 'Eliminar la lista',
    'shared.deleteConfirm': '¿Seguro? No se puede deshacer.',
    'shared.viewerNoteBefore': 'Tu rol es ',
    'shared.viewerNoteAfter':
      ': puedes ver la lista, pero no añadir ni quitar. Pide a quien te invitó que te suba a Gestor.',

    'invite.checking': 'Comprobando la invitación…',
    'invite.invalidTitle': 'Invitación no válida',
    'invite.invalidBody':
      'Este enlace no existe. Puede que se haya generado uno nuevo, que invalida el anterior.',
    'invite.expiredTitle': 'Invitación caducada',
    'invite.expiredBody': 'Quien te invitó ha desactivado este enlace. Pídele uno nuevo.',
    'invite.memberTitle': 'Ya estás en esta lista',
    'invite.open': 'Abrir la lista',
    'invite.title': 'Te han invitado a',
    'invite.listFallback': 'una lista compartida',
    'invite.body':
      'Al unirte podrás ver y añadir animes a esta lista, igual que el resto de miembros.',
    'invite.joining': 'Uniéndote…',
    'invite.join': 'Unirme a la lista',
    'invite.error': 'No se ha podido usar la invitación.',

    'login.titleBefore': 'Entra en tu',
    'login.titleAccent': 'biblioteca',
    'login.subtitle': 'Sin contraseñas. Entra con Google o GitHub y recuperamos tus listas.',
    'login.connecting': 'Conectando…',
    'login.google': 'Continuar con Google',
    'login.github': 'Continuar con GitHub',
    'login.privacy':
      'Al continuar guardamos únicamente tu nombre, avatar y correo para identificarte dentro de tus listas.',
    'login.footer': 'AnimeDB es un catálogo de consulta: no aloja ni reproduce contenido.',
    'login.footerMeta': 'Metadatos de AniList.',
    'login.edge': 'Catálogo · AniList',
    'login.showcaseTitle': 'Un catálogo. Tres formas de buscar el mismo título.',
    'login.showcaseBody':
      'Tus pendientes, la lista comunitaria y las listas que abres con quien quieras. Los datos vienen de AniList; aquí solo se consultan.',

    'status.kicker': 'Estado de la app',
    'status.title': 'Índice de títulos',
    'status.intro':
      'El archivo estático que permite buscar por subcadena. Se genera desde AniList y se sirve con la aplicación.',
    'status.loading': 'Cargando el índice…',
    'status.missingBefore': 'No se ha podido cargar',
    'status.missingAfter': '. Genéralo con',
    'status.statTitles': 'Títulos',
    'status.statGenerated': 'Generado',
    'status.statSize': 'Peso',
    'status.statGenres': 'Géneros',
    'status.today': 'hoy',
    'status.daysAgoOne': 'hace {count} día',
    'status.daysAgoMany': 'hace {count} días',
    'status.gaps': 'Datos incompletos',
    'status.checkScore': 'Sin valoración',
    'status.checkScoreHint': 'Estrenos sin votos suficientes en AniList',
    'status.checkGenres': 'Sin género',
    'status.checkGenresHint': 'Entradas incompletas en AniList',
    'status.checkCover': 'Sin portada',
    'status.checkCoverHint': 'Se pintan con el color dominante',
    'status.checkEnglish': 'Sin título inglés',
    'status.checkEnglishHint': 'Solo se pueden buscar por romaji',
    'status.checkEpisodes': 'Sin nº de capítulos',
    'status.checkEpisodesHint': 'En emisión o sin anunciar',
    'status.clearFilter': 'Quitar filtro',
    'status.view': 'Ver',
    'status.refresh': 'Actualizar el índice',
    'status.refreshBody':
      'El generador es un script de Node y esta página es estática, así que el navegador no puede ejecutarlo. Se lanza desde GitHub Actions —tarda unos tres minutos y son cien peticiones a AniList— o en local.',
    'status.lastRun': 'Última ejecución:',
    'status.runRateLimit': 'Límite de la API de GitHub alcanzado',
    'status.runUnavailable': 'No se ha podido consultar GitHub',
    'status.runNever': 'Nunca se ha ejecutado',
    'status.runOngoing': 'En marcha desde {when}',
    'status.runOk': 'Correcta · {when}',
    'status.runFailed': '{conclusion} · {when}',
    'status.runFailedFallback': 'fallida',
    'status.launch': 'Lanzar en GitHub Actions ↗',
    'status.tableTitle': 'Títulos registrados',
    'status.filterPlaceholder': 'Filtrar por título o id…',
    'status.colTitle': 'Título',
    'status.colScore': 'Nota',
    'status.colEpisodes': 'Caps.',
    'status.noRows': 'Nada que mostrar con este filtro.',
    'status.prev': 'Anterior',
    'status.next': 'Siguiente',

    'detail.loading': 'Cargando la ficha…',
    'detail.notFound': 'No se ha encontrado este anime en AniList.',
    'detail.noSynopsis': 'Sin sinopsis.',
    'detail.noVotes': 'Sin votos',
    'detail.myRating': 'Tu valoración',
    'detail.editRating': 'Editar valoración',
    'detail.ratingSavedHint': 'Ya has puntuado este anime. Solo se admite una valoración por persona.',
    'detail.score': 'Puntuación',
    'detail.commentPlaceholder': '¿Qué te ha parecido? (opcional)',
    'detail.saving': 'Guardando…',
    'detail.saveRating': 'Guardar valoración',
    'detail.saved': 'Valoración guardada.',
    'detail.savePermission': 'Firestore ha denegado la escritura de la reseña.',
    'detail.saveError': 'No se ha podido guardar la valoración.',
    'detail.reviews': 'Reseñas',
    'detail.reviewsEmpty': 'Nadie ha escrito nada todavía. Sé el primero.',
    'detail.reviewsError': 'No se han podido cargar las reseñas.',
    'detail.replyOne': '{count} respuesta',
    'detail.replyMany': '{count} respuestas',
    'detail.showMoreOne': 'Ver {count} respuesta más',
    'detail.showMoreMany': 'Ver {count} respuestas más',
    'detail.reply': 'Responder',
    'detail.delete': 'Borrar',
    'detail.replyPlaceholder': 'Tu respuesta…',
    'detail.writeReply': 'Escribir una respuesta',
    'detail.writeReplyPlaceholder': 'Escribe una respuesta…',
    'detail.sending': 'Enviando…',
    'detail.send': 'Enviar',
    'detail.now': 'ahora mismo',
    'detail.repliesError': 'No se han podido cargar las respuestas.',
    'detail.replyPermission': 'Firestore ha denegado la respuesta.',
    'detail.replyError': 'No se ha podido enviar la respuesta.',
    'detail.replyDeleteError': 'No se ha podido borrar la respuesta.',
    'detail.react': 'Reaccionar',
    'detail.reactionRemove': 'Quitar tu reacción',
    'detail.reactionPermission': 'Firestore ha denegado la reacción.',
    'detail.reactionError': 'No se ha podido guardar la reacción.',

    'card.empty': 'Todavía no hay nada por aquí.',
    'card.allGenres': 'Todas las categorías',
    'card.follow': 'Seguir',
    'card.unfollow': 'Dejar de seguir',
    'card.finish': 'Terminar',
    'card.backToPending': 'Volver a pendiente',
    'card.remove': 'Eliminar',
    'card.watchedBy': 'Lo han visto: {names}',
    'card.statusPending': 'Pendiente',
    'card.statusWatching': 'En seguimiento',
    'card.statusDone': 'Terminado',
    'card.statusAria': 'Estado: {status}',
    'card.ratingAria': 'Valoración {value} de {max}',

    'search.ariaLabel': 'Buscar un anime en AniList por título en romaji, inglés o preferido',
    'search.placeholder': 'Busca por título: romaji, inglés o preferido…',
    'search.clear': 'Limpiar búsqueda',
    'search.results': '{count} resultados para {term}',
    'search.searching': 'Buscando en AniList…',
    'search.noMatches': 'Sin coincidencias para «{term}».',
    'search.saveTo': 'Guardar en',
    'search.add': 'Añadir',

    'menu.options': 'Opciones',
    'menu.review': 'Reseñar',

    'prefs.title': 'Preferencias',
    'prefs.kicker': 'Tu cuenta',
    'prefs.profile': 'Perfil',
    'prefs.profileHint':
      'Cómo te ven los demás en AnimeDB. No cambia nada en tu cuenta de Google ni de GitHub.',
    'prefs.nickname': 'Apodo',
    'prefs.nicknamePlaceholder': 'Cómo quieres que te llamen',
    'prefs.nicknameHint':
      'Si lo dejas vacío se usa el nombre de tu proveedor de acceso.',
    'prefs.photo': 'Foto',
    'prefs.photoPlaceholder': 'https://…',
    'prefs.photoHint':
      'Pega la dirección de una imagen. Si lo dejas vacío se usa la de tu proveedor.',
    'prefs.content': 'Contenido',
    'prefs.contentHint': 'Qué aparece en las búsquedas y en el catálogo.',
    'prefs.nsfw': 'Mostrar contenido para adultos',
    'prefs.nsfwHint':
      'Desactivado, se ocultan los títulos que AniList marca como adultos. El hentai queda fuera en ambos casos.',
    'prefs.appearance': 'Apariencia',
    'prefs.appearanceHint': 'El tema también se puede cambiar desde el botón flotante.',
    'prefs.theme': 'Tema',
    'prefs.themeDark': 'Oscuro',
    'prefs.themeLight': 'Claro',
    'prefs.language': 'Idioma',
    'prefs.languageHint': 'Idioma de la interfaz.',
    'prefs.accounts': 'Cuentas',
    'prefs.accountsHint': 'Proveedores con los que has entrado.',
    'prefs.save': 'Guardar',
    'prefs.saved': 'Cambios guardados.',
    'prefs.saveError': 'No se han podido guardar los cambios.',
  },
  en: {
    'nav.pending': 'Watchlist',
    'nav.general': 'Catalogue',
    'nav.shared': 'Shared',
    'nav.status': 'Status',
    'nav.preferences': 'Preferences',
    'nav.signOut': 'Sign out',
    'nav.back': 'Back',

    'common.loading': 'Loading…',
    'common.user': 'User',
    'common.userLowercase': 'user',
    'common.you': '(you)',
    'common.cancel': 'Cancel',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.dismiss': 'Dismiss notification',

    'unit.titleOne': 'title',
    'unit.titleMany': 'titles',
    'unit.listOne': 'list',
    'unit.listMany': 'lists',
    'unit.memberOne': 'member',
    'unit.memberMany': 'members',

    'error.permissionRead':
      'Firestore denied access. Deploy the rules: npx firebase deploy --only firestore:rules',
    'error.permissionWrite':
      'Firestore denied the write. Deploy the rules: npx firebase deploy --only firestore:rules',
    'error.permissionRole':
      'Firestore denied the operation. Your role in this list may not allow it.',
    'error.generic': 'The operation could not be completed.',

    'theme.toLight': 'Switch to light mode',
    'theme.toDark': 'Switch to dark mode',
    'theme.light': 'Light mode',
    'theme.dark': 'Dark mode',

    'home.pendingHint': 'Your personal list',
    'home.generalHint': 'Everything logged in the app',
    'home.sharedHint': 'Through an invite link',
    'home.open': 'Open →',
    'home.destinationPersonal': 'Personal',
    'home.added': '“{title}” added to {target}.',
    'home.defaultTarget': 'your list',
    'home.addError': 'It could not be added.',

    'personal.kicker': 'Your list',
    'personal.title': 'My watchlist',
    'personal.hint':
      'Only you can see it. Search for any anime and keep it here so you never lose track of it.',
    'personal.empty': 'Search for an anime above and add it to your watchlist.',
    'personal.loadError': 'The list could not be loaded.',

    'general.kicker': 'Shared catalogue',
    'general.title': 'Catalogue',
    'general.hint':
      'Everything anyone has logged in AnimeDB, no matter which list they saved it to.',
    'general.empty': 'Nobody has added anything yet. Start with your watchlist.',
    'general.filterLabel': 'Filter by genre',
    'general.filterAll': 'All',
    'general.noMatches': 'No titles in that genre.',
    'general.added': 'Added to {target}.',
    'general.defaultTarget': 'the list',
    'general.addError': 'It could not be added. Try again.',
    'general.loadError': 'The catalogue could not be loaded.',

    'shared.kicker': 'With whoever you like',
    'shared.title': 'Shared lists',
    'shared.hint':
      'Every list has its own invite link. Anyone who opens it joins and can add titles.',
    'shared.new': 'New list',
    'shared.name': 'List name',
    'shared.creating': 'Creating…',
    'shared.create': 'Create',
    'shared.empty':
      'You have no shared lists yet. Create one with the button above and share its link.',
    'shared.own': 'Yours',
    'shared.loadError': 'The lists could not be loaded.',
    'shared.listFallback': 'Shared list',
    'shared.notFound': 'This list does not exist, or you no longer have access to it.',
    'shared.readOnly': 'Your role in this list is read-only.',
    'shared.itemsEmpty': 'Nothing in this list yet. Search for an anime above.',
    'shared.added': '“{title}” added.',
    'shared.renamed': 'Name updated.',
    'shared.roleUpdated': 'Role updated.',
    'shared.linkRegenerated': 'New link generated.',
    'shared.settings': 'Settings',
    'shared.settingsAria': 'List settings',
    'shared.invite': 'Invite',
    'shared.inviteLink': 'Invite link',
    'shared.copy': 'Copy',
    'shared.copied': 'Copied!',
    'shared.regenerate': 'Generate a new one (invalidates the old link)',
    'shared.generateLink': 'Generate a link',
    'shared.members': 'Members ({count})',
    'shared.roleOwner': 'Owner',
    'shared.roleOwnerHint': 'Everything, roles and deleting included',
    'shared.roleManager': 'Manager',
    'shared.roleManagerHint': 'Add, remove, rename, invite',
    'shared.roleViewer': 'Viewer',
    'shared.roleViewerHint': 'View only',
    'shared.roleOf': 'Role for {name}',
    'shared.deleteList': 'Delete the list',
    'shared.deleteConfirm': 'Are you sure? This cannot be undone.',
    'shared.viewerNoteBefore': 'Your role is ',
    'shared.viewerNoteAfter':
      ': you can see the list, but not add or remove titles. Ask whoever invited you to make you a Manager.',

    'invite.checking': 'Checking the invite…',
    'invite.invalidTitle': 'Invalid invite',
    'invite.invalidBody':
      'This link does not exist. A new one may have been generated, which invalidates the old one.',
    'invite.expiredTitle': 'Invite expired',
    'invite.expiredBody': 'Whoever invited you has disabled this link. Ask them for a new one.',
    'invite.memberTitle': 'You are already in this list',
    'invite.open': 'Open the list',
    'invite.title': 'You have been invited to',
    'invite.listFallback': 'a shared list',
    'invite.body':
      'Once you join you can see and add anime to this list, just like every other member.',
    'invite.joining': 'Joining…',
    'invite.join': 'Join the list',
    'invite.error': 'The invite could not be used.',

    'login.titleBefore': 'Step into your',
    'login.titleAccent': 'library',
    'login.subtitle': 'No passwords. Sign in with Google or GitHub and we bring your lists back.',
    'login.connecting': 'Connecting…',
    'login.google': 'Continue with Google',
    'login.github': 'Continue with GitHub',
    'login.privacy':
      'By continuing we store only your name, avatar and email address, to identify you inside your lists.',
    'login.footer': 'AnimeDB is a reference catalogue: it neither hosts nor plays any content.',
    'login.footerMeta': 'Metadata from AniList.',
    'login.edge': 'Catalogue · AniList',
    'login.showcaseTitle': 'One catalogue. Three ways to find the same title.',
    'login.showcaseBody':
      'Your watchlist, the community catalogue and the lists you open with whoever you like. The data comes from AniList; here it is only read.',

    'status.kicker': 'App status',
    'status.title': 'Title index',
    'status.intro':
      'The static file that makes substring search possible. It is generated from AniList and shipped with the app.',
    'status.loading': 'Loading the index…',
    'status.missingBefore': 'Could not load',
    'status.missingAfter': '. Generate it with',
    'status.statTitles': 'Titles',
    'status.statGenerated': 'Generated',
    'status.statSize': 'Size',
    'status.statGenres': 'Genres',
    'status.today': 'today',
    'status.daysAgoOne': '{count} day ago',
    'status.daysAgoMany': '{count} days ago',
    'status.gaps': 'Incomplete data',
    'status.checkScore': 'No score',
    'status.checkScoreHint': 'New releases without enough votes on AniList',
    'status.checkGenres': 'No genre',
    'status.checkGenresHint': 'Incomplete entries on AniList',
    'status.checkCover': 'No cover art',
    'status.checkCoverHint': 'Drawn with the dominant colour instead',
    'status.checkEnglish': 'No English title',
    'status.checkEnglishHint': 'Can only be found by romaji',
    'status.checkEpisodes': 'No episode count',
    'status.checkEpisodesHint': 'Still airing or unannounced',
    'status.clearFilter': 'Clear filter',
    'status.view': 'View',
    'status.refresh': 'Update the index',
    'status.refreshBody':
      'The generator is a Node script and this page is static, so the browser cannot run it. Launch it from GitHub Actions — it takes about three minutes and a hundred requests to AniList — or run it locally.',
    'status.lastRun': 'Last run:',
    'status.runRateLimit': 'GitHub API rate limit reached',
    'status.runUnavailable': 'GitHub could not be reached',
    'status.runNever': 'Never run',
    'status.runOngoing': 'Running since {when}',
    'status.runOk': 'Successful · {when}',
    'status.runFailed': '{conclusion} · {when}',
    'status.runFailedFallback': 'failed',
    'status.launch': 'Run it on GitHub Actions ↗',
    'status.tableTitle': 'Registered titles',
    'status.filterPlaceholder': 'Filter by title or id…',
    'status.colTitle': 'Title',
    'status.colScore': 'Score',
    'status.colEpisodes': 'Eps.',
    'status.noRows': 'Nothing to show with this filter.',
    'status.prev': 'Previous',
    'status.next': 'Next',

    'detail.loading': 'Loading the details…',
    'detail.notFound': 'This anime was not found on AniList.',
    'detail.noSynopsis': 'No synopsis.',
    'detail.noVotes': 'No votes',
    'detail.myRating': 'Your rating',
    'detail.editRating': 'Edit rating',
    'detail.ratingSavedHint': 'You have already rated this anime. One rating per person.',
    'detail.score': 'Score',
    'detail.commentPlaceholder': 'What did you think? (optional)',
    'detail.saving': 'Saving…',
    'detail.saveRating': 'Save rating',
    'detail.saved': 'Rating saved.',
    'detail.savePermission': 'Firestore denied the review write.',
    'detail.saveError': 'The rating could not be saved.',
    'detail.reviews': 'Reviews',
    'detail.reviewsEmpty': 'Nobody has written anything yet. Be the first.',
    'detail.reviewsError': 'The reviews could not be loaded.',
    'detail.replyOne': '{count} reply',
    'detail.replyMany': '{count} replies',
    'detail.showMoreOne': 'Show {count} more reply',
    'detail.showMoreMany': 'Show {count} more replies',
    'detail.reply': 'Reply',
    'detail.delete': 'Delete',
    'detail.replyPlaceholder': 'Your reply…',
    'detail.writeReply': 'Write a reply',
    'detail.writeReplyPlaceholder': 'Write a reply…',
    'detail.sending': 'Sending…',
    'detail.send': 'Send',
    'detail.now': 'just now',
    'detail.repliesError': 'The replies could not be loaded.',
    'detail.replyPermission': 'Firestore denied the reply.',
    'detail.replyError': 'The reply could not be sent.',
    'detail.replyDeleteError': 'The reply could not be deleted.',
    'detail.react': 'React',
    'detail.reactionRemove': 'Remove your reaction',
    'detail.reactionPermission': 'Firestore denied the reaction.',
    'detail.reactionError': 'The reaction could not be saved.',

    'card.empty': 'There is nothing here yet.',
    'card.allGenres': 'All genres',
    'card.follow': 'Start watching',
    'card.unfollow': 'Stop watching',
    'card.finish': 'Mark as finished',
    'card.backToPending': 'Back to the watchlist',
    'card.remove': 'Remove',
    'card.watchedBy': 'Watched by: {names}',
    'card.statusPending': 'Pending',
    'card.statusWatching': 'Watching',
    'card.statusDone': 'Finished',
    'card.statusAria': 'Status: {status}',
    'card.ratingAria': 'Rated {value} out of {max}',

    'search.ariaLabel': 'Search AniList for an anime by romaji, English or preferred title',
    'search.placeholder': 'Search by title: romaji, English or preferred…',
    'search.clear': 'Clear search',
    'search.results': '{count} results for {term}',
    'search.searching': 'Searching AniList…',
    'search.noMatches': 'No matches for “{term}”.',
    'search.saveTo': 'Save to',
    'search.add': 'Add',

    'menu.options': 'Options',
    'menu.review': 'Review',

    'prefs.title': 'Preferences',
    'prefs.kicker': 'Your account',
    'prefs.profile': 'Profile',
    'prefs.profileHint':
      'How others see you on AnimeDB. Nothing changes in your Google or GitHub account.',
    'prefs.nickname': 'Nickname',
    'prefs.nicknamePlaceholder': 'What should we call you',
    'prefs.nicknameHint': 'Leave it empty to use the name from your sign-in provider.',
    'prefs.photo': 'Photo',
    'prefs.photoPlaceholder': 'https://…',
    'prefs.photoHint':
      "Paste an image address. Leave it empty to use your provider's picture.",
    'prefs.content': 'Content',
    'prefs.contentHint': 'What shows up in search and in the catalogue.',
    'prefs.nsfw': 'Show adult content',
    'prefs.nsfwHint':
      'When off, titles AniList flags as adult are hidden. Hentai is excluded either way.',
    'prefs.appearance': 'Appearance',
    'prefs.appearanceHint': 'The theme can also be changed from the floating button.',
    'prefs.theme': 'Theme',
    'prefs.themeDark': 'Dark',
    'prefs.themeLight': 'Light',
    'prefs.language': 'Language',
    'prefs.languageHint': 'Interface language.',
    'prefs.accounts': 'Accounts',
    'prefs.accountsHint': 'Providers you have signed in with.',
    'prefs.save': 'Save',
    'prefs.saved': 'Changes saved.',
    'prefs.saveError': 'Changes could not be saved.',
  },
}

export const LANGUAGES: Array<{ id: Language; label: string }> = [
  { id: 'es', label: 'Español' },
  { id: 'en', label: 'English' },
]

/** Valores que rellenan los marcadores {…} de una cadena. */
export type MessageParams = Record<string, string | number>

/** Etiqueta BCP 47 por idioma, para Intl (fechas, numeros, tiempo relativo). */
const LOCALES: Record<Language, string> = {
  es: 'es-ES',
  en: 'en-GB',
}

const PLACEHOLDER = /\{(\w+)\}/g

/** Un marcador sin valor se queda escrito: delata el dato que falta. */
function fill(message: string, params?: MessageParams): string {
  if (!params) return message
  return message.replace(PLACEHOLDER, (match, name: string) =>
    name in params ? String(params[name]) : match,
  )
}

export function useI18n() {
  const { language } = usePreferences()

  /** Si falta una clave devuelve la clave: se ve el hueco en vez de un vacio. */
  const t = (key: string, params?: MessageParams): string =>
    fill(MESSAGES[language.value]?.[key] ?? MESSAGES.es[key] ?? key, params)

  return {
    t,
    language: computed(() => language.value),
    locale: computed(() => LOCALES[language.value] ?? LOCALES.es),
  }
}
