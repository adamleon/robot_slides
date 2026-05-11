<!--
  RobotCellStatic.vue — pure-SVG placeholder for the PDF export.

  No three.js, no canvas. A future iteration can pre-render the URDF to
  an SVG/PNG via a Node-side three.js + jsdom pipeline; for now this
  placeholder keeps the PDF build valid while making it obvious that
  the interactive widget belongs here.
-->

<script setup lang="ts">
// No props, no state.
</script>

<template>
  <div class="static-wrapper">
    <svg viewBox="0 0 200 200" class="placeholder-svg" aria-label="Robot (interactive on slide deck)">
      <!-- Schematic robot arm: base, segments, joint dots. -->
      <rect x="80" y="170" width="40" height="15" fill="#F26060" opacity="0.85" />
      <rect x="92" y="120" width="16" height="50" fill="#E8D7B5" opacity="0.6" />
      <circle cx="100" cy="120" r="6" fill="#F26060" />
      <rect x="100" y="80" width="48" height="14" fill="#E8D7B5" opacity="0.6" />
      <circle cx="148" cy="87" r="6" fill="#F26060" />
      <rect x="120" y="60" width="40" height="12" fill="#E8D7B5" opacity="0.6" />
      <circle cx="120" cy="66" r="5" fill="#F26060" />
    </svg>
    <p class="caption">UR5e — interactive on the live deck</p>
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
