<script setup lang="ts">
import { RouterView } from 'vue-router'
import ThemeToggle from '@/components/ThemeToggle.vue'
import ToastStack from '@/components/ToastStack.vue'
</script>

<template>
  <!-- Atmosfera de toda la aplicacion: dos halos en deriva lenta y grano en
       modo oscuro. Va aqui y no en cada vista para no repetirla cinco veces, y
       en -z-10 para quedar por detras de todo el contenido. Las pantallas con
       fondo opaco (el login) simplemente la tapan. -->
  <div class="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
    <div
      class="drift absolute -top-40 -right-32 size-[36rem] rounded-full bg-accent/8 blur-[120px] dark:bg-accent/15"
    />
    <div
      class="drift absolute -bottom-48 -left-32 size-[30rem] rounded-full bg-ice-400/6 blur-[130px] dark:bg-ice-400/10"
      style="animation-delay: -9s"
    />
    <div class="grain absolute inset-0 opacity-0 dark:opacity-[0.1]" />
  </div>

  <RouterView />

  <!-- El cambio de tema vive aqui y no en las cabeceras: es una preferencia de
       la aplicacion, no una accion de cada pantalla. -->
  <ThemeToggle
    class="float-pill fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-6 z-50"
  />

  <ToastStack />
</template>
