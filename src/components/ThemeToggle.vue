<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'
import { useI18n } from '@/lib/i18n'

const { isDark, toggle } = useTheme()
const { t } = useI18n()
</script>

<template>
  <button
    type="button"
    class="grid size-9 cursor-pointer place-items-center rounded-full border border-line text-muted transition hover:border-accent/60 hover:text-body"
    :aria-label="isDark ? t('theme.toLight') : t('theme.toDark')"
    :aria-pressed="!isDark"
    :title="isDark ? t('theme.light') : t('theme.dark')"
    @click="toggle"
  >
    <!-- Sol: se ofrece pasar a claro. -->
    <svg
      v-if="isDark"
      class="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
    </svg>

    <!-- Luna: se ofrece pasar a oscuro. -->
    <svg
      v-else
      class="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </svg>
  </button>
</template>
