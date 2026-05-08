<!--
  SpinningCubeStatic.vue — pure-SVG cube for the PDF export.

  No three.js, no canvas. Just an isometric cube drawn in SVG so the PDF
  has crisp vector geometry on every page. The static tier never animates.
-->

<script setup lang="ts">
// No props, no state.
</script>

<template>
  <div class="cube-wrapper">
    <svg viewBox="-1.2 -1.2 2.4 2.4" class="cube-svg" aria-label="Static cube">
      <!-- Three visible faces of an axonometric cube. -->
      <!-- Top face (white). -->
      <polygon
        points="0,-1 0.866,-0.5 0,0 -0.866,-0.5"
        fill="#ffffff"
        stroke="#202024"
        stroke-width="0.02"
      />
      <!-- Right face (blue). -->
      <polygon
        points="0.866,-0.5 0.866,0.5 0,1 0,0"
        fill="#4488ff"
        stroke="#202024"
        stroke-width="0.02"
      />
      <!-- Left face (red). -->
      <polygon
        points="-0.866,-0.5 -0.866,0.5 0,1 0,0"
        fill="#ff4444"
        stroke="#202024"
        stroke-width="0.02"
      />
    </svg>
  </div>
</template>

<style scoped>
.cube-wrapper {
  width: 100%;
  height: 100%;
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #202024;
}
.cube-svg {
  width: 60%;
  height: 60%;
  max-width: 320px;
  max-height: 320px;
}
</style>
