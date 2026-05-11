<!--
  RobotCellLite.vue — static fallback for the single-file (lite) build.

  Per DESIGN.md §2.1, the lite tier replaces heavy three.js scenes with a
  pre-rendered still or video so the deck stays self-contained as a single
  HTML file. The previous attempt to load the URDF + .dae meshes live at
  runtime fetched external files that aren't inlined by vite-plugin-singlefile,
  which broke the lite tier (no 3D appeared, and even adjacent files would
  not have helped since file:// fetch is unreliable).

  For now we render the same schematic SVG as RobotCellStatic. A future
  iteration can swap in a pre-baked turntable .webm or PNG vendored in
  public/video/ (which Vite *can* inline as base64 below the lite
  asset-inline limit).

  Props are accepted for API parity with the Full variant but unused.
-->

<script setup lang="ts">
defineProps<{
  urdfUrl: string;
  jointAngles?: Record<string, number>;
}>();
</script>

<template>
  <div class="static-wrapper">
    <svg viewBox="0 0 200 200" class="placeholder-svg" aria-label="UR5e (rendered in the full deck)">
      <rect x="80" y="170" width="40" height="15" fill="#F26060" opacity="0.85" />
      <rect x="92" y="120" width="16" height="50" fill="#E8D7B5" opacity="0.6" />
      <circle cx="100" cy="120" r="6" fill="#F26060" />
      <rect x="100" y="80" width="48" height="14" fill="#E8D7B5" opacity="0.6" />
      <circle cx="148" cy="87" r="6" fill="#F26060" />
      <rect x="120" y="60" width="40" height="12" fill="#E8D7B5" opacity="0.6" />
      <circle cx="120" cy="66" r="5" fill="#F26060" />
    </svg>
    <p class="caption">UR5e — interactive on the full deck</p>
  </div>
</template>

<style scoped>
.static-wrapper {
  width: 100%;
  height: 100%;
  min-height: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #1b1416;
  border-radius: 6px;
}
.placeholder-svg {
  width: 50%;
  max-width: 240px;
  height: auto;
}
.caption {
  color: var(--cookbook-text-muted, #9c8c72);
  font-style: italic;
  margin-top: 0.5rem;
  font-size: 0.9rem;
}
</style>
