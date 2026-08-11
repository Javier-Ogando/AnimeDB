<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useI18n } from '@/lib/i18n'
import { joinList, resolveInvite, type InviteInfo } from '@/lib/lists'
import AppHeader from '@/components/AppHeader.vue'

/**
 * Aceptar una invitacion. La ruta es privada, asi que si el enlace se abre sin
 * sesion el guardian manda al login con ?redirect y se vuelve aqui despues.
 */
const route = useRoute()
const router = useRouter()
const { user } = useAuth()
const { t } = useI18n()

const token = String(route.params.token)

const invite = ref<InviteInfo | null>(null)
const isLoading = ref(true)
const isJoining = ref(false)
const error = ref<string | null>(null)

function describe(e: Error): string {
  return e.message.includes('permission') ? t('error.permissionRead') : t('invite.error')
}

async function load() {
  const uid = user.value?.uid
  if (!uid) return

  try {
    invite.value = await resolveInvite(token, uid)
  } catch (e) {
    error.value = describe(e as Error)
  } finally {
    isLoading.value = false
  }
}

void load()

async function onJoin() {
  if (!invite.value || !user.value || isJoining.value) return

  isJoining.value = true
  error.value = null
  try {
    await joinList(invite.value.listId, user.value.uid)
    await router.replace({ name: 'shared-list', params: { listId: invite.value.listId } })
  } catch (e) {
    error.value = describe(e as Error)
  } finally {
    isJoining.value = false
  }
}
</script>

<template>
  <div class="min-h-dvh">
    <AppHeader />

    <main class="mx-auto flex max-w-xl flex-col px-6 py-16">
      <p v-if="isLoading" class="text-sm text-muted">{{ t('invite.checking') }}</p>

      <template v-else-if="!invite">
        <h1 class="font-display text-2xl tracking-tight">{{ t('invite.invalidTitle') }}</h1>
        <p class="mt-3 text-sm leading-relaxed text-muted">
          {{ t('invite.invalidBody') }}
        </p>
      </template>

      <template v-else-if="invite.revoked">
        <h1 class="font-display text-2xl tracking-tight">{{ t('invite.expiredTitle') }}</h1>
        <p class="mt-3 text-sm leading-relaxed text-muted">
          {{ t('invite.expiredBody') }}
        </p>
      </template>

      <template v-else-if="invite.alreadyMember">
        <h1 class="font-display text-2xl tracking-tight">{{ t('invite.memberTitle') }}</h1>
        <p class="mt-3 text-sm text-muted">{{ invite.listName ?? t('shared.listFallback') }}</p>
        <RouterLink
          :to="{ name: 'shared-list', params: { listId: invite.listId } }"
          class="mt-6 self-start rounded-full border border-accent/50 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/10"
        >
          {{ t('invite.open') }}
        </RouterLink>
      </template>

      <template v-else>
        <h1 class="font-display text-2xl tracking-tight">
          {{ t('invite.title') }}
          <span class="text-accent">{{ invite.listName ?? t('invite.listFallback') }}</span>
        </h1>
        <p class="mt-3 text-sm leading-relaxed text-muted">
          {{ t('invite.body') }}
        </p>

        <button
          type="button"
          :disabled="isJoining"
          class="mt-6 self-start cursor-pointer rounded-full border border-accent/50 px-5 py-2.5 text-sm font-medium text-accent transition hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
          @click="onJoin"
        >
          {{ isJoining ? t('invite.joining') : t('invite.join') }}
        </button>
      </template>

      <p
        v-if="error"
        role="alert"
        class="mt-6 rounded-xl border border-line bg-surface/60 px-4 py-3 text-sm text-muted"
      >
        {{ error }}
      </p>
    </main>
  </div>
</template>
