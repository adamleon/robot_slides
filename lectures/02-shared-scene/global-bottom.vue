<!--
  Per-lecture global-bottom.vue shim.

  Slidev auto-loads global-bottom.vue from each slide file's directory
  (userRoot, not the project root) — the same Slidev quirk as the
  vite.config.ts shim. This file wraps and renders the canonical
  global-bottom.vue at the project root so all decks get the same
  shared-scene host without duplicating the implementation.
-->

<script setup lang="ts">
import GlobalBottom from "../../global-bottom.vue";
</script>

<template>
  <GlobalBottom />
</template>
