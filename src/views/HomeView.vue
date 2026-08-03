<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import BrandMark from '@/components/BrandMark.vue'

const { user, signOut, isBusy } = useAuth()
const router = useRouter()

const cards = [
  { title: 'Mis pendientes', hint: 'Tu lista personal' },
  { title: 'Lista comunitaria', hint: 'Pública, te apuntas si quieres' },
  { title: 'Listas compartidas', hint: 'Por link de invitación' },
]

async function onSignOut() {
  await signOut()
  await router.replace({ name: 'login' })
}
</script>

<template>
  <div class="min-h-dvh">
    <header class="border-b border-ink-800">
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <BrandMark class="text-lg" />

        <div class="flex items-center gap-3">
          <img
            v-if="user?.photoURL"
            :src="user.photoURL"
            :alt="user.displayName ?? 'Avatar'"
            class="size-8 rounded-full ring-1 ring-ink-800"
            referrerpolicy="no-referrer"
          />
          <span class="hidden text-sm text-slate-300 sm:inline">
            {{ user?.displayName ?? user?.email }}
          </span>
          <button
            type="button"
            :disabled="isBusy"
            class="cursor-pointer rounded-full border border-ink-800 px-3.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-magenta-500/60 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            @click="onSignOut"
          >
            Salir
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-5xl px-6 py-12">
      <h1 class="font-display text-3xl tracking-tight">
        Hola, {{ user?.displayName?.split(' ')[0] ?? 'usuario' }}
      </h1>
      <p class="mt-2 text-sm text-slate-400">Sesión iniciada correctamente.</p>

      <!-- Siguiente paso: estas tarjetas llevaran a las listas reales. -->
      <div class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="card in cards"
          :key="card.title"
          class="rounded-2xl border border-ink-800 bg-ink-900/60 p-5 transition hover:border-magenta-500/40"
        >
          <h2 class="text-sm font-medium">{{ card.title }}</h2>
          <p class="mt-1 text-xs text-slate-500">{{ card.hint }}</p>
          <p class="mt-6 text-xs text-slate-600">Pendiente de implementar</p>
        </article>
      </div>
    </main>
  </div>
</template>
