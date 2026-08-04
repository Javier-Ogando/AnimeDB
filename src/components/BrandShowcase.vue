<script setup lang="ts">
/**
 * Panel derecho del login. Ocupa el sitio del futuro arte de marca y mientras
 * tanto adelanta el lenguaje visual de la app: la card de un anime con sus
 * tres formatos de titulo, que es el corazon del buscador.
 *
 * Sin imagenes externas a proposito: el login no debe depender de la red mas
 * alla de Firebase.
 */
const titles = [
  { label: 'Romaji', value: 'Sousou no Frieren' },
  { label: 'English', value: 'Frieren: Beyond Journey’s End' },
  { label: 'Preferred', value: 'Sousou no Frieren' },
]
</script>

<template>
  <aside class="relative isolate hidden overflow-hidden bg-surface lg:block">
    <!-- Atmosfera: dos halos desenfocados en deriva lenta + grano.
         Sobre blanco el magenta pesa mas que sobre tinta, asi que en claro va
         a la mitad de opacidad. -->
    <div
      class="drift pointer-events-none absolute -top-[15%] -right-1/4 size-[38rem] rounded-full bg-accent/12 blur-[110px] dark:bg-accent/25"
      aria-hidden="true"
    />
    <div
      class="drift pointer-events-none absolute -bottom-[20%] -left-1/4 size-[32rem] rounded-full bg-ice-400/8 blur-[120px] dark:bg-ice-400/10"
      style="animation-delay: -9s"
      aria-hidden="true"
    />
    <!-- El grano se ve sucio sobre papel claro: solo en modo oscuro. -->
    <div
      class="grain pointer-events-none absolute inset-0 opacity-0 dark:opacity-[0.16]"
      aria-hidden="true"
    />
    <div
      class="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-overlay to-transparent"
      aria-hidden="true"
    />

    <!-- Etiqueta vertical en el canto: detalle editorial. -->
    <span
      class="pointer-events-none absolute top-1/2 right-6 -translate-y-1/2 text-[10px] tracking-[0.42em] text-faint/60 uppercase [writing-mode:vertical-rl]"
      aria-hidden="true"
    >
      Catálogo · AniList
    </span>

    <div class="relative flex h-full flex-col justify-center gap-14 px-14 py-16 xl:px-20">
      <!-- Mazo de cards horizontales: dos fantasma detras para dar profundidad.
           Misma orientacion que la card de una lista guardada, para que el
           login adelante la forma real de la app. -->
      <div
        class="relative mx-auto grid w-full max-w-[26rem] place-items-center"
        aria-hidden="true"
      >
        <div
          class="rise absolute h-44 w-full translate-x-8 rotate-[7deg] rounded-2xl border border-overlay bg-surface-2/60"
          style="animation-delay: 60ms"
        />
        <div
          class="rise absolute h-44 w-full -translate-x-8 -rotate-[5deg] rounded-2xl border border-overlay bg-surface-2/40"
          style="animation-delay: 30ms"
        />

        <article
          class="rise relative flex w-full -rotate-[2deg] items-center gap-5 rounded-2xl border border-overlay bg-surface/80 p-3 shadow-2xl shadow-shade backdrop-blur-sm"
          style="animation-delay: 140ms"
        >
          <div
            class="relative grid aspect-2/3 w-28 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-accent/25 via-surface-2 to-canvas dark:from-accent/40"
          >
            <!-- Hueco del logo: sustituir este glifo cuando exista el real. -->
            <span class="font-display text-5xl leading-none text-body/10">A</span>
            <span
              class="absolute bottom-1.5 left-1.5 rounded-md bg-canvas/50 px-1.5 py-0.5 text-[9px] font-medium tracking-wider text-accent uppercase backdrop-blur-sm"
            >
              Pendiente
            </span>
          </div>

          <dl class="min-w-0 flex-1 space-y-2.5 pr-1">
            <div v-for="t in titles" :key="t.label">
              <dt class="text-[10px] font-medium tracking-[0.18em] text-accent/70 uppercase">
                {{ t.label }}
              </dt>
              <dd class="text-[13px] leading-snug text-muted">{{ t.value }}</dd>
            </div>
          </dl>
        </article>
      </div>

      <div class="mx-auto max-w-sm text-center">
        <p class="font-display text-2xl leading-snug text-balance text-body">
          Un catálogo. Tres formas de buscar el mismo título.
        </p>
        <p class="mt-4 text-sm leading-relaxed text-muted">
          Tus pendientes, la lista comunitaria y las listas que abres con quien quieras. Los datos
          vienen de AniList; aquí solo se consultan.
        </p>
      </div>
    </div>
  </aside>
</template>
