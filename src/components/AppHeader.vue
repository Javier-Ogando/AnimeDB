<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { isAdmin } from '@/lib/admin'
import BrandMark from './BrandMark.vue'

/**
 * Cabecera comun de las pantallas con sesion.
 *
 * No es una barra: son tres pastillas flotando sobre el contenido (logo,
 * navegacion y acciones). Por eso no lleva borde inferior — una linea continua
 * delataria que hay una barra debajo y romperia el efecto.
 */
const { user, signOut, isBusy } = useAuth()
const router = useRouter()

const canSeeStatus = computed(() => isAdmin(user.value?.uid))

const NAV = [
  { to: '/personal', label: 'Pendientes' },
  { to: '/general', label: 'General' },
  { to: '/compartidas', label: 'Compartidas' },
]

async function onSignOut() {
  await signOut()
  await router.replace({ name: 'login' })
}
</script>

<template>
  <header class="relative">
    <div class="relative mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-5">
      <RouterLink to="/" class="float-pill shrink-0 px-4 py-2">
        <BrandMark class="text-lg" />
      </RouterLink>

      <!-- Navegacion centrada respecto al header completo.
           En movil va en su propia linea (order-last + w-full); desde md pasa a
           posicionamiento absoluto, porque con flex normal la anchura del logo y
           de las acciones —que cambian, el boton de estado solo sale para
           admins— la descentrarian. -->
      <nav
        class="order-last w-full md:order-none md:absolute md:top-1/2 md:left-1/2 md:w-auto md:-translate-x-1/2 md:-translate-y-1/2"
      >
        <div class="float-pill flex items-center justify-center gap-1 p-1">
          <RouterLink
            v-for="item in NAV"
            :key="item.to"
            :to="item.to"
            class="rounded-full px-3.5 py-1.5 text-sm text-muted transition hover:text-body"
            active-class="bg-accent/12 text-body"
          >
            {{ item.label }}
          </RouterLink>
        </div>
      </nav>

      <!-- Acciones en una sola pastilla: los botones de dentro no llevan borde
           propio, o se veria un doble contorno. -->
      <div class="float-pill ml-auto flex items-center gap-1 p-1">
        <RouterLink
          v-if="canSeeStatus"
          to="/estado"
          class="rounded-full px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-surface-2/70 hover:text-body"
          active-class="bg-accent/12 text-body"
        >
          Estado
        </RouterLink>

        <img
          v-if="user?.photoURL"
          :src="user.photoURL"
          :alt="user.displayName ?? 'Avatar'"
          :title="user.displayName ?? user.email ?? ''"
          class="size-7 rounded-full ring-1 ring-line"
          referrerpolicy="no-referrer"
        />

        <button
          type="button"
          :disabled="isBusy"
          class="cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-surface-2/70 hover:text-body disabled:cursor-not-allowed disabled:opacity-60"
          @click="onSignOut"
        >
          Salir
        </button>
      </div>
    </div>
  </header>
</template>
