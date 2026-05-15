<!--
  global-bottom.vue — persistent shared three.js scene host.

  Slidev mounts this file once per deck (it's the bottom layer of the slide
  stack — z-index below slide content). We use it as the single home for the
  shared scene from setup/shared-three.ts: one canvas, one render loop, one
  WebGLRenderer for the whole deck.

  Each slide can declare a `sceneState` in its front-matter; this component
  watches the current slide via Slidev's useNav() and pipes the declared
  pose into a spring controller (lib/control-vec.ts → useSpringVec3) so the
  camera glides with inertia instead of jump-cutting.

  Per-slide overrides honoured:
    sceneState.camera.position    [x, y, z]
    sceneState.camera.lookAt      [x, y, z]
    sceneState.transition         "spring" (default) | "critical" | "snap"
    sceneState.springStiffness    spring constant override
    sceneState.springDamping      damping coefficient override

  Slides without a sceneState leave the camera target where it is; the spring
  keeps animating toward the last setpoint. See DESIGN.md §5.4 and §12.1
  ("opt-in" — title pages without 3D can simply omit sceneState).
-->

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import * as THREE from "three";
import { useNav } from "@slidev/client";
import {
  ensureSharedScene,
  type SharedScene,
} from "./setup/shared-three";
import { useSpringVec3 } from "./lib/control-vec";

interface SceneState {
  camera?: {
    position?: [number, number, number];
    lookAt?: [number, number, number];
  };
  visible?: string[];
  transition?: "spring" | "critical" | "snap";
  springStiffness?: number;
  springDamping?: number;
}

/** How the shared scene disappears on slides that have no sceneState.
 *  "hard": instant cut. "soft" (default): 400 ms opacity fade.
 *  Set per-slide via front-matter `sceneHide: hard | soft`. */
type SceneHide = "hard" | "soft";

const wrapperEl = ref<HTMLDivElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);

// Camera spring targets and gains — slide-state watcher writes; render loop
// reads the spring actuals each frame.
const targetPosition = ref(new THREE.Vector3(1.4, 1.4, 1.0));
const targetLookAt = ref(new THREE.Vector3(0, 0, 0.4));
const stiffness = ref(80);
const damping = ref(12);
// Bump this to make both springs jump to their current target instantly.
// We use the snap signal (lib/control.ts SpringOptions.snapKey) rather
// than huge gains — explicit-Euler is unstable for k > ~1e4 at 60fps.
const snapKey = ref(0);

const springPosition = useSpringVec3(targetPosition, {
  stiffness,
  damping,
  snapKey,
});
const springLookAt = useSpringVec3(targetLookAt, {
  stiffness,
  damping,
  snapKey,
});

// Slidev's nav composable: reactive current-slide info including front-matter.
const nav = useNav();

function readFrontmatter(): Record<string, unknown> | undefined {
  const slide = nav.currentSlideRoute?.value;
  if (!slide) return undefined;
  const meta = slide.meta as Record<string, unknown> | undefined;
  // Slidev's front-matter is stashed on the route meta. Different Slidev
  // versions have used slightly different shapes; check both known paths.
  return (
    (meta?.slide as { frontmatter?: Record<string, unknown> })?.frontmatter ??
    (meta as { frontmatter?: Record<string, unknown> } | undefined)?.frontmatter
  );
}

const sceneStateOfCurrentSlide = computed<SceneState | undefined>(() => {
  return readFrontmatter()?.sceneState as SceneState | undefined;
});

const hideModeOfCurrentSlide = computed<SceneHide>(() => {
  const v = readFrontmatter()?.sceneHide;
  return v === "hard" ? "hard" : "soft";
});

// Canvas is visible when the current slide has a sceneState. When it
// doesn't, we either fade or cut the wrap based on the slide's sceneHide
// setting. The transition is set on the wrap so leaving/arriving slides
// both contribute their mode to the animation timing.
const wrapStyle = computed(() => {
  const showing = !!sceneStateOfCurrentSlide.value;
  if (showing) {
    return { opacity: 1, transition: "opacity 0.4s ease" };
  }
  if (hideModeOfCurrentSlide.value === "hard") {
    return { opacity: 0, transition: "none" };
  }
  return { opacity: 0, transition: "opacity 0.4s ease" };
});

watch(
  sceneStateOfCurrentSlide,
  (state) => {
    if (!state) return;
    if (state.camera?.position) {
      targetPosition.value = new THREE.Vector3(...state.camera.position);
    }
    if (state.camera?.lookAt) {
      targetLookAt.value = new THREE.Vector3(...state.camera.lookAt);
    }
    // Spring tuning per slide.
    if (state.transition === "snap") {
      // Bump the snap key — both springs will copy target → actual on the
      // next frame and zero their velocity. Gains stay at safe defaults
      // so any subsequent non-snap slide animates normally.
      stiffness.value = 80;
      damping.value = 12;
      snapKey.value += 1;
    } else if (state.transition === "critical") {
      // No-overshoot glide, faster than the soft default.
      const k = state.springStiffness ?? 150;
      stiffness.value = k;
      damping.value = state.springDamping ?? 2 * Math.sqrt(k);
    } else {
      // Spring default — soft, inertial camera with a hint of follow-through.
      stiffness.value = state.springStiffness ?? 80;
      damping.value = state.springDamping ?? 12;
    }
  },
  { immediate: true }
);

let scene: SharedScene | null = null;
let animationId: number | null = null;
let resizeObserver: ResizeObserver | null = null;
let disposed = false;

onMounted(() => {
  if (!canvasEl.value || !wrapperEl.value) return;
  const w = wrapperEl.value.clientWidth;
  const h = wrapperEl.value.clientHeight;
  scene = ensureSharedScene(canvasEl.value, w, h);

  const tick = () => {
    if (disposed || !scene) return;
    scene.camera.position.copy(springPosition.value);
    scene.camera.lookAt(springLookAt.value);
    scene.renderer.render(scene.scene, scene.camera);
    animationId = requestAnimationFrame(tick);
  };
  animationId = requestAnimationFrame(tick);

  resizeObserver = new ResizeObserver(() => {
    if (!scene || !wrapperEl.value) return;
    const nw = wrapperEl.value.clientWidth;
    const nh = wrapperEl.value.clientHeight;
    if (nw > 0 && nh > 0) scene.resize(nw, nh);
  });
  resizeObserver.observe(wrapperEl.value);
});

onBeforeUnmount(() => {
  // global-bottom.vue lives for the whole deck — unmount only happens on
  // page reload or HMR. We cancel the render loop but leave GPU resources;
  // the browser cleans them up on page exit. Re-mount on HMR creates a new
  // singleton via ensureSharedScene (the existing one was disposed by HMR
  // unloading the module).
  disposed = true;
  if (animationId !== null) cancelAnimationFrame(animationId);
  resizeObserver?.disconnect();
});
</script>

<template>
  <div ref="wrapperEl" class="shared-canvas-wrap" :style="wrapStyle">
    <canvas ref="canvasEl" class="shared-canvas" />
  </div>
</template>

<style>
.shared-canvas-wrap {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}
.shared-canvas {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
