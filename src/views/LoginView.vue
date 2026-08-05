<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import BrandMark from '@/components/BrandMark.vue'
import BrandShowcase from '@/components/BrandShowcase.vue'

const { signInWithGoogle, isBusy, error } = useAuth()
const route = useRoute()
const router = useRouter()

async function onSignIn() {
  await signInWithGoogle()
  if (!error.value) {
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(redirect)
  }
}
</script>

<template>
  <div class="min-h-dvh lg:grid lg:grid-cols-2">
    <!-- ── Columna de acceso ─────────────────────────────────────────── -->
    <!-- En claro la columna se hunde un paso (surface-2) para separarse del
         panel derecho, que es casi blanco. En oscuro no hace falta: ahi el
         panel ya es mas claro que el fondo. El salto de luminosidad (dL 0.055)
         iguala el que separa fondo y panel en modo oscuro (dL 0.045). -->
    <section
      class="relative isolate flex min-h-dvh flex-col overflow-hidden bg-surface-2 px-6 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-10 lg:px-14 xl:px-20 dark:bg-canvas"
    >
      <!-- En movil no hay panel derecho, asi que el halo vive aqui para que
           la pantalla no sea un negro plano. -->
      <div
        class="drift pointer-events-none absolute -top-32 -right-24 size-96 rounded-full bg-accent/10 blur-[100px] lg:hidden dark:bg-accent/20"
        aria-hidden="true"
      />

      <header class="relative">
        <BrandMark class="text-xl" />
      </header>

      <div class="relative flex flex-1 items-center justify-center py-12">
        <div class="w-full max-w-sm">
          <h1 class="rise font-display text-4xl leading-[1.15] tracking-tight text-balance">
            Entra en tu
            <span class="text-accent">biblioteca</span>
          </h1>
          <p class="rise mt-4 text-sm leading-relaxed text-muted" style="animation-delay: 60ms">
            Sin contraseñas. Usamos tu cuenta de Google para saber cuáles son tus listas.
          </p>

          <button
            type="button"
            :disabled="isBusy"
            :aria-busy="isBusy"
            class="rise group mt-9 flex w-full cursor-pointer items-center justify-center gap-3 rounded-full border border-line bg-surface/70 px-5 py-3.5 text-sm font-medium transition-all duration-300 hover:border-accent/60 hover:bg-surface-2 hover:shadow-[0_0_32px_-8px] hover:shadow-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-none"
            style="animation-delay: 120ms"
            @click="onSignIn"
          >
            <svg class="size-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51Z"
              />
            </svg>
            <span>{{ isBusy ? 'Conectando…' : 'Continuar con Google' }}</span>
          </button>

          <p
            v-if="error"
            role="alert"
            class="mt-4 rounded-xl border border-red-900/40 bg-red-500/10 px-4 py-3 text-xs leading-relaxed text-red-400"
          >
            {{ error }}
          </p>

          <p
            class="rise mt-6 text-center text-xs leading-relaxed text-faint"
            style="animation-delay: 180ms"
          >
            Al continuar guardamos únicamente tu nombre, avatar y correo para identificarte dentro
            de tus listas.
          </p>
        </div>
      </div>

      <!-- pb-14 en movil: deja hueco al boton de tema flotante, que en pantallas
           estrechas se solaparia con este texto. -->
      <footer class="relative pb-14 text-center text-xs leading-relaxed text-faint sm:pb-0">
        AnimeDB es un catálogo de consulta: no aloja ni reproduce contenido.
        <span class="block">Metadatos de AniList.</span>
      </footer>
    </section>

    <!-- ── Panel de marca (solo desktop) ─────────────────────────────── -->
    <BrandShowcase />
  </div>
</template>
