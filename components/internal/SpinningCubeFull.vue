<!--
  SpinningCubeFull.vue — live three.js cube, classroom (full) build.

  Allocates a WebGLRenderer; rotates a textured cube around the diagonal axis.
  Disposes everything in onBeforeUnmount. No external assets.
-->

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import * as THREE from "three";
import { createScene, resizeScene, type SceneBundle } from "../../lib/three-scene";

// --- State ----------------------------------------------------------------
const canvasEl = ref<HTMLCanvasElement | null>(null);
const wrapperEl = ref<HTMLDivElement | null>(null);

// --- three.js handles (NOT reactive) --------------------------------------
let bundle: SceneBundle | null = null;
let cube: THREE.Mesh | null = null;
let animationId: number | null = null;
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (!canvasEl.value || !wrapperEl.value) return;

  const w = wrapperEl.value.clientWidth;
  const h = wrapperEl.value.clientHeight;
  bundle = createScene(canvasEl.value, w, h, 0x202024);

  // Cube: 0.4m on a side, six face colours so rotation is obvious.
  const geometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
  const materials = [
    new THREE.MeshStandardMaterial({ color: 0xff4444 }),
    new THREE.MeshStandardMaterial({ color: 0x44ff44 }),
    new THREE.MeshStandardMaterial({ color: 0x4488ff }),
    new THREE.MeshStandardMaterial({ color: 0xffaa22 }),
    new THREE.MeshStandardMaterial({ color: 0xaa44ff }),
    new THREE.MeshStandardMaterial({ color: 0xffffff }),
  ];
  cube = new THREE.Mesh(geometry, materials);
  bundle.scene.add(cube);

  // Floor grid for orientation cues.
  const grid = new THREE.GridHelper(2, 10, 0x444444, 0x303030);
  // GridHelper is XZ-plane in three.js; rotate to lie on XY (Z up).
  grid.rotation.x = Math.PI / 2;
  bundle.scene.add(grid);

  // Render loop.
  const tick = () => {
    if (!bundle || !cube) return;
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.013;
    cube.rotation.z += 0.005;
    bundle.renderer.render(bundle.scene, bundle.camera);
    animationId = requestAnimationFrame(tick);
  };
  animationId = requestAnimationFrame(tick);

  // Resize on container changes.
  resizeObserver = new ResizeObserver(() => {
    if (!bundle || !wrapperEl.value) return;
    const nw = wrapperEl.value.clientWidth;
    const nh = wrapperEl.value.clientHeight;
    if (nw > 0 && nh > 0) resizeScene(bundle, nw, nh);
  });
  resizeObserver.observe(wrapperEl.value);
});

onBeforeUnmount(() => {
  // CLEANUP: cancel the rAF, disconnect observer, dispose GPU resources.
  if (animationId !== null) cancelAnimationFrame(animationId);
  resizeObserver?.disconnect();
  bundle?.dispose();
  bundle = null;
  cube = null;
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
