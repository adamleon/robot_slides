<!--
  SpinningCube.vue — tier dispatcher for the hello-world spinning cube.

  Slide authors write <SpinningCube /> once. The build profile picks the
  right variant: live three.js (full), single still frame (lite), or a
  pure-SVG cube (static / pdf).

  See docs/DESIGN.md §2.2 for the dispatch pattern.
-->

<script setup lang="ts">
import { BUILD_PROFILE } from "../setup/build-profile";
import SpinningCubeFull from "./internal/SpinningCubeFull.vue";
import SpinningCubeLite from "./internal/SpinningCubeLite.vue";
import SpinningCubeStatic from "./internal/SpinningCubeStatic.vue";
</script>

<template>
  <SpinningCubeFull v-if="BUILD_PROFILE === 'full'" />
  <SpinningCubeLite v-else-if="BUILD_PROFILE === 'lite'" />
  <SpinningCubeStatic v-else />
</template>
