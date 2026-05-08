<!--
  SpinningCubeLite.vue — single-frame three.js render for the lite (single-file) build.

  Renders one frame and stops. The bundle ships as static pixels — no rAF
  loop, so the lite HTML is cheap to load on phones. A future iteration can
  swap this for a pre-rendered .webm stored in public/video/.
-->

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import * as THREE from "three";
import { createScene, type SceneBundle } from "../../lib/three-scene";

const canvasEl = ref<HTMLCanvasElement | null>(null);
const wrapperEl = ref<HTMLDivElement | null>(null);

let bundle: SceneBundle | null = null;

onMounted(() => {
  if (!canvasEl.value || !wrapperEl.value) return;
  const w = wrapperEl.value.clientWidth;
  const h = wrapperEl.value.clientHeight;
  bundle = createScene(canvasEl.value, w, h, 0x202024);

  const geometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
  const materials = [
    new THREE.MeshStandardMaterial({ color: 0xff4444 }),
    new THREE.MeshStandardMaterial({ color: 0x44ff44 }),
    new THREE.MeshStandardMaterial({ color: 0x4488ff }),
    new THREE.MeshStandardMaterial({ color: 0xffaa22 }),
    new THREE.MeshStandardMaterial({ color: 0xaa44ff }),
    new THREE.MeshStandardMaterial({ color: 0xffffff }),
  ];
  const cube = new THREE.Mesh(geometry, materials);
  // Rotate to a pleasing isometric-ish pose.
  cube.rotation.set(0.6, 0.8, 0.2);
  bundle.scene.add(cube);

  const grid = new THREE.GridHelper(2, 10, 0x444444, 0x303030);
  grid.rotation.x = Math.PI / 2;
  bundle.scene.add(grid);

  // Single render. No animation loop.
  bundle.renderer.render(bundle.scene, bundle.camera);
});

onBeforeUnmount(() => {
  bundle?.dispose();
  bundle = null;
});
</script>

<template>
  <div ref="wrapperEl" class="cube-wrapper">
    <canvas ref="canvasEl" class="three-canvas" />
  </div>
</template>

<style scoped>
.cube-wrapper {
  width: 100%;
  height: 100%;
  min-height: 320px;
  position: relative;
}
.three-canvas {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
