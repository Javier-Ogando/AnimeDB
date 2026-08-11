<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { usePreferences } from '@/composables/usePreferences'
import { useTheme } from '@/composables/useTheme'
import { useToast } from '@/composables/useToast'
import { LANGUAGES, useI18n } from '@/lib/i18n'
import AppHeader from '@/components/AppHeader.vue'
import PageHeader from '@/components/PageHeader.vue'
import type { Language } from '@/types/models'

/**
 * Preferencias del usuario: una sola pagina con scroll y un indice lateral.
 *
 * Es una pagina y no varias rutas porque son cuatro bloques cortos: partirlos en
 * rutas obligaria a navegar para ver algo que cabe de un tiron.
 */
const { user } = useAuth()
const { nickname, photoOverride, preferences, displayName, photo, saveProfile, savePreferences } =
  usePreferences()
const { theme, setTheme } = useTheme()
const { notify } = useToast()
const { t } = useI18n()

/** Copias locales: no se escribe en Firestore a cada pulsacion de tecla. */
const draftNickname = ref('')
const draftPhoto = ref('')
const isSaving = ref(false)

const SECTIONS = computed(() => [
  { id: 'perfil', label: t('prefs.profile') },
  { id: 'contenido', label: t('prefs.content') },
  { id: 'apariencia', label: t('prefs.appearance') },
  { id: 'cuentas', label: t('prefs.accounts') },
])

/** Seccion visible, para resaltarla en el indice lateral. */
const active = ref('perfil')
let observer: IntersectionObserver | null = null

onMounted(() => {
  draftNickname.value = nickname.value ?? ''
  draftPhoto.value = photoOverride.value ?? ''

  // Se resalta la seccion mas alta que este visible. Con scroll manual habria
  // que calcular posiciones en cada evento; el observer lo hace el navegador.
  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (visible?.target.id) active.value = visible.target.id
    },
    { rootMargin: '-20% 0px -70% 0px' },
  )

  SECTIONS.value.forEach((section) => {
    const el = document.getElementById(section.id)
    if (el) observer?.observe(el)
  })
})

onUnmounted(() => observer?.disconnect())

const providers = computed(
  () =>
    user.value?.providerData.map((provider) => ({
      id: provider.providerId,
      label: provider.providerId.replace('.com', ''),
      email: provider.email,
    })) ?? [],
)

async function onSaveProfile() {
  if (isSaving.value) return
  isSaving.value = true
  try {
    await saveProfile({ nickname: draftNickname.value, photoOverride: draftPhoto.value })
    notify(t('prefs.saved'))
  } catch {
    notify(t('prefs.saveError'), 'error')
  } finally {
    isSaving.value = false
  }
}

async function onToggleNsfw(value: boolean) {
  try {
    await savePreferences({ nsfw: value })
    notify(t('prefs.saved'))
  } catch {
    notify(t('prefs.saveError'), 'error')
  }
}

async function onLanguage(value: Language) {
  try {
    await savePreferences({ language: value })
  } catch {
    notify(t('prefs.saveError'), 'error')
  }
}
</script>

<template>
  <div class="min-h-dvh">
    <AppHeader />

    <main class="mx-auto max-w-6xl px-6 pt-10 pb-28">
      <PageHeader :kicker="t('prefs.kicker')" />

      <div class="mt-8 flex flex-col gap-10 lg:flex-row lg:gap-12">
        <!-- Indice lateral. Pegajoso en escritorio; en movil se queda arriba
             como fila de accesos, que ocupa menos que una columna. -->
        <nav class="lg:sticky lg:top-6 lg:h-max lg:w-52 lg:shrink-0">
          <ul class="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            <li v-for="section in SECTIONS" :key="section.id" class="shrink-0">
              <a
                :href="`#${section.id}`"
                class="block rounded-full px-3.5 py-1.5 text-sm transition lg:rounded-xl"
                :class="
                  active === section.id
                    ? 'bg-accent/12 text-body'
                    : 'text-muted hover:bg-surface-2/60 hover:text-body'
                "
              >
                {{ section.label }}
              </a>
            </li>
          </ul>
        </nav>

        <div class="min-w-0 flex-1 space-y-12">
          <!-- ── Perfil ──────────────────────────────────────────────── -->
          <section id="perfil" class="scroll-mt-8">
            <h2 class="font-display text-2xl tracking-tight">{{ t('prefs.profile') }}</h2>
            <p class="mt-2 max-w-prose text-sm leading-relaxed text-muted">
              {{ t('prefs.profileHint') }}
            </p>

            <div class="mt-6 rounded-2xl border border-line bg-surface/60 p-5">
              <div class="flex items-center gap-4">
                <img
                  v-if="photo"
                  :src="photo"
                  alt=""
                  class="size-14 rounded-full ring-1 ring-line"
                  referrerpolicy="no-referrer"
                />
                <span v-else class="size-14 rounded-full bg-surface-2" aria-hidden="true" />
                <div class="min-w-0">
                  <p class="truncate font-medium text-body">{{ displayName }}</p>
                  <p class="truncate text-xs text-faint">{{ user?.email }}</p>
                </div>
              </div>

              <label class="mt-6 block text-xs text-faint" for="nickname">
                {{ t('prefs.nickname') }}
              </label>
              <input
                id="nickname"
                v-model="draftNickname"
                type="text"
                maxlength="40"
                :placeholder="t('prefs.nicknamePlaceholder')"
                class="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-body placeholder:text-faint focus:border-accent/60 focus:outline-none"
              />
              <p class="mt-1.5 text-xs text-faint">{{ t('prefs.nicknameHint') }}</p>

              <label class="mt-4 block text-xs text-faint" for="photo">
                {{ t('prefs.photo') }}
              </label>
              <input
                id="photo"
                v-model="draftPhoto"
                type="url"
                :placeholder="t('prefs.photoPlaceholder')"
                class="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-body placeholder:text-faint focus:border-accent/60 focus:outline-none"
              />
              <p class="mt-1.5 text-xs text-faint">{{ t('prefs.photoHint') }}</p>

              <button
                type="button"
                :disabled="isSaving"
                class="mt-5 cursor-pointer rounded-full border border-accent/50 px-4 py-2 text-xs font-medium text-accent transition hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
                @click="onSaveProfile"
              >
                {{ t('prefs.save') }}
              </button>
            </div>
          </section>

          <!-- ── Contenido ───────────────────────────────────────────── -->
          <section id="contenido" class="scroll-mt-8">
            <h2 class="font-display text-2xl tracking-tight">{{ t('prefs.content') }}</h2>
            <p class="mt-2 max-w-prose text-sm leading-relaxed text-muted">
              {{ t('prefs.contentHint') }}
            </p>

            <label
              class="mt-6 flex cursor-pointer items-start gap-4 rounded-2xl border border-line bg-surface/60 p-5"
            >
              <input
                type="checkbox"
                :checked="preferences.nsfw"
                class="mt-0.5 size-4 shrink-0 cursor-pointer accent-accent"
                @change="onToggleNsfw(($event.target as HTMLInputElement).checked)"
              />
              <span class="min-w-0">
                <span class="block text-sm text-body">{{ t('prefs.nsfw') }}</span>
                <span class="mt-1 block text-xs leading-relaxed text-faint">
                  {{ t('prefs.nsfwHint') }}
                </span>
              </span>
            </label>
          </section>

          <!-- ── Apariencia ──────────────────────────────────────────── -->
          <section id="apariencia" class="scroll-mt-8">
            <h2 class="font-display text-2xl tracking-tight">{{ t('prefs.appearance') }}</h2>
            <p class="mt-2 max-w-prose text-sm leading-relaxed text-muted">
              {{ t('prefs.appearanceHint') }}
            </p>

            <div class="mt-6 space-y-4 rounded-2xl border border-line bg-surface/60 p-5">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <span class="text-sm text-body">{{ t('prefs.theme') }}</span>
                <div class="flex gap-1 rounded-full border border-line p-1">
                  <button
                    v-for="option in [
                      { id: 'dark' as const, label: t('prefs.themeDark') },
                      { id: 'light' as const, label: t('prefs.themeLight') },
                    ]"
                    :key="option.id"
                    type="button"
                    class="cursor-pointer rounded-full px-3 py-1 text-xs transition"
                    :class="theme === option.id ? 'bg-accent/12 text-body' : 'text-muted'"
                    @click="setTheme(option.id)"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>

              <div class="flex flex-wrap items-center justify-between gap-3">
                <span class="min-w-0">
                  <span class="block text-sm text-body">{{ t('prefs.language') }}</span>
                  <span class="block text-xs text-faint">{{ t('prefs.languageHint') }}</span>
                </span>
                <div class="flex gap-1 rounded-full border border-line p-1">
                  <button
                    v-for="option in LANGUAGES"
                    :key="option.id"
                    type="button"
                    class="cursor-pointer rounded-full px-3 py-1 text-xs transition"
                    :class="
                      preferences.language === option.id ? 'bg-accent/12 text-body' : 'text-muted'
                    "
                    @click="onLanguage(option.id)"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <!-- ── Cuentas ─────────────────────────────────────────────── -->
          <section id="cuentas" class="scroll-mt-8">
            <h2 class="font-display text-2xl tracking-tight">{{ t('prefs.accounts') }}</h2>
            <p class="mt-2 max-w-prose text-sm leading-relaxed text-muted">
              {{ t('prefs.accountsHint') }}
            </p>

            <ul class="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line">
              <li
                v-for="provider in providers"
                :key="provider.id"
                class="flex items-center justify-between gap-4 bg-surface/60 px-5 py-4"
              >
                <span class="text-sm text-body capitalize">{{ provider.label }}</span>
                <span class="truncate text-xs text-faint">{{ provider.email }}</span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </main>
  </div>
</template>
