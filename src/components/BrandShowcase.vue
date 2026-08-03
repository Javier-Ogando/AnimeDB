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
  <aside class="relative isolate hidden overflow-hidden bg-ink-900 lg:block">
    <!-- Atmosfera: dos halos desenfocados en deriva lenta + grano. -->
    <div
      class="drift pointer-events-none absolute -top-[15%] -right-1/4 size-[38rem] rounded-full bg-magenta-500/25 blur-[110px]"
      aria-hidden="true"
    />
    <div
      class="drift pointer-events-none absolute -bottom-[20%] -left-1/4 size-[32rem] rounded-full bg-ice-400/10 blur-[120px]"
      style="animation-delay: -9s"
      aria-hidden="true"
    />
    <div class="grain pointer-events-none absolute inset-0 opacity-[0.16]" aria-hidden="true" />
    <div
      class="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent"
      aria-hidden="true"
    />

    <!-- Etiqueta vertical en el canto: detalle editorial. -->
    <span
      class="pointer-events-none absolute top-1/2 right-6 -translate-y-1/2 text-[10px] tracking-[0.42em] text-white/25 uppercase [writing-mode:vertical-rl]"
      aria-hidden="true"
    >
      Catálogo · AniList
    </span>

    <div class="relative flex h-full flex-col justify-center gap-14 px-14 py-16 xl:px-20">
      <!-- Mazo de cards: dos fantasma detras para dar profundidad. -->
      <div class="relative mx-auto grid place-items-center" aria-hidden="true">
        <div
          class="rise absolute h-80 w-56 translate-x-16 rotate-[14deg] rounded-2xl border border-white/5 bg-ink-850/60"
          style="animation-delay: 60ms"
        />
        <div
          class="rise absolute h-80 w-56 -translate-x-16 -rotate-[11deg] rounded-2xl border border-white/5 bg-ink-850/40"
          style="animation-delay: 30ms"
        />

        <article
          class="rise relative w-64 -rotate-[3deg] rounded-2xl border border-white/10 bg-ink-900/80 p-3 shadow-2xl shadow-black/70 backdrop-blur-sm"
          style="animation-delay: 140ms"
        >
          <div
            class="relative grid aspect-2/3 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-magenta-500/45 via-ink-850 to-ink-950"
          >
            <!-- Hueco del logo: sustituir este glifo cuando exista el real. -->
            <span class="font-display text-7xl leading-none text-white/10">A</span>
            <span
              class="absolute bottom-2 left-2 rounded-md bg-black/45 px-2 py-0.5 text-[10px] font-medium tracking-wider text-magenta-300 uppercase backdrop-blur-sm"
            >
              Pendiente
            </span>
          </div>

          <dl class="mt-4 space-y-2.5 px-1 pb-1">
            <div v-for="t in titles" :key="t.label">
              <dt class="text-[10px] font-medium tracking-[0.18em] text-magenta-300/70 uppercase">
                {{ t.label }}
              </dt>
              <dd class="truncate text-[13px] leading-snug text-slate-200">{{ t.value }}</dd>
            </div>
          </dl>
        </article>
      </div>

      <div class="mx-auto max-w-sm text-center">
        <p class="font-display text-2xl leading-snug text-balance text-slate-100">
          Un catálogo. Tres formas de buscar el mismo título.
        </p>
        <p class="mt-4 text-sm leading-relaxed text-slate-400">
          Tus pendientes, la lista comunitaria y las listas que abres con quien quieras. Los datos
          vienen de AniList; aquí solo se consultan.
        </p>
      </div>
    </div>
  </aside>
</template>
