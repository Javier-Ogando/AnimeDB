import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { authReady, useAuth } from '@/composables/useAuth'

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

  const { isSignedIn } = useAuth()

  if (!to.meta.public && !isSignedIn.value) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.name === 'login' && isSignedIn.value) {
    return { name: 'home' }
  }

  return true
})
