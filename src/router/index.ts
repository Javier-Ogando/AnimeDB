import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { authReady, useAuth } from '@/composables/useAuth'
import { isAdmin } from '@/lib/admin'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
  },
  {
    path: '/preferencias',
    name: 'preferences',
    component: () => import('@/views/PreferencesView.vue'),
  },
  {
    path: '/estado',
    name: 'estado',
    component: () => import('@/views/StatusView.vue'),
    meta: { admin: true },
  },
  {
    path: '/personal',
    name: 'personal',
    component: () => import('@/views/PersonalListView.vue'),
  },
  {
    path: '/general',
    name: 'general',
    component: () => import('@/views/GeneralView.vue'),
  },
  {
    path: '/anime/:id',
    name: 'anime',
    component: () => import('@/views/AnimeDetailView.vue'),
  },
  {
    path: '/compartidas',
    name: 'shared-lists',
    component: () => import('@/views/SharedListsView.vue'),
  },
  {
    path: '/compartidas/:listId',
    name: 'shared-list',
    component: () => import('@/views/SharedListView.vue'),
  },
  {
    path: '/invitacion/:token',
    name: 'invite',
    component: () => import('@/views/InviteView.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

export const router = createRouter({
  // BASE_URL lo inyecta Vite desde `base`: en GitHub Pages la app vive en
  // /AnimeDB/, y sin esto el router creeria que /AnimeDB/login es una ruta
  // desconocida.
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(async (to) => {
  // Sin esto, un F5 en / rebotaria al login antes de que Firebase
  // restaure la sesion guardada.
  await authReady

  const { isSignedIn, user } = useAuth()

  if (!to.meta.public && !isSignedIn.value) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  // La guarda solo oculta la pantalla: la lista de admins viaja en el bundle.
  // Vale mientras administracion solo lea el indice publico; en cuanto toque
  // datos ajenos, la autorizacion tiene que estar en las reglas de Firestore.
  if (to.meta.admin && !isAdmin(user.value?.uid)) {
    return { name: 'home' }
  }

  if (to.name === 'login' && isSignedIn.value) {
    return { name: 'home' }
  }

  return true
})
