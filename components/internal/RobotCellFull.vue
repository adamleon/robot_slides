<!--
  RobotCellFull.vue — live three.js render of a URDF robot with orbit controls.

  Parses a pre-bundled robot (URDF + meshes inlined as text via
  lib/robots/<name>/index.ts), mounts the URDFRobot in a fresh scene, and
  runs a render loop. No runtime fetch — works from file://.

  Props:
    robot       BundledRobot — URDF text + mesh texts imported at build time.
    jointAngles Watched: when the parent updates the dict, joints follow.
    showFrames  Draws RGB axes at every joint frame (debug toggle).
-->

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  createScene,
  resizeScene,
  type SceneBundle,
} from "../../lib/three-scene";
import {
  loadUrdfBundled,
  applyJointAngles,
  type BundledRobot,
  type URDFRobot,
} from "../../lib/urdf";

const props = defineProps<{
  robot: BundledRobot;
  jointAngles?: Record<string, number>;
  showFrames?: boolean;
}>();

// --- State (reactive) -----------------------------------------------------
const canvasEl = ref<HTMLCanvasElement | null>(null);
const wrapperEl = ref<HTMLDivElement | null>(null);

// --- three.js handles (not reactive) -------------------------------------
let bundle: SceneBundle | null = null;
let robot: URDFRobot | null = null;
let controls: OrbitControls | null = null;
let animationId: number | null = null;
let resizeObserver: ResizeObserver | null = null;
const frameHelpers: THREE.AxesHelper[] = [];
let disposed = false;

onMounted(() => {
  if (!canvasEl.value || !wrapperEl.value) return;

  const w = wrapperEl.value.clientWidth;
  const h = wrapperEl.value.clientHeight;
  bundle = createScene(canvasEl.value, w, h, 0x1b1416);

  // Camera framed on a ~1.5 m work envelope; UR5e reach is ~0.85 m.
  bundle.camera.position.set(1.4, 1.4, 1.0);
  bundle.camera.lookAt(0, 0, 0.4);

  // Orbit controls so the lecturer can rotate the view live.
  controls = new OrbitControls(bundle.camera, bundle.renderer.domElement);
  controls.target.set(0, 0, 0.4);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.update();

  // Ground grid (XY plane — Z is up per ROS REP-103).
  const grid = new THREE.GridHelper(2, 10, 0x4a3a3a, 0x2a2024);
  grid.rotation.x = Math.PI / 2;
  bundle.scene.add(grid);

  // World axes at the robot base for orientation cues.
  const worldAxes = new THREE.AxesHelper(0.2);
  (worldAxes.material as THREE.LineBasicMaterial).transparent = true;
  (worldAxes.material as THREE.LineBasicMaterial).opacity = 0.6;
  bundle.scene.add(worldAxes);

  // Parse the bundled URDF in-process — no fetch. loadUrdfBundled
  // neutralises ColladaLoader's Z→Y auto-rotation per mesh so the robot
  // ends up in the native Z-up frame our scene expects.
  robot = loadUrdfBundled(props.robot);
  bundle.scene.add(robot);
  if (props.jointAngles) applyJointAngles(robot, props.jointAngles);

  if (props.showFrames) attachFrameHelpers();

  // Render loop.
  const tick = () => {
    if (disposed || !bundle) return;
    controls?.update();
    bundle.renderer.render(bundle.scene, bundle.camera);
    animationId = requestAnimationFrame(tick);
  };
  animationId = requestAnimationFrame(tick);

  // Resize on container size changes.
  resizeObserver = new ResizeObserver(() => {
    if (!bundle || !wrapperEl.value) return;
    const nw = wrapperEl.value.clientWidth;
    const nh = wrapperEl.value.clientHeight;
    if (nw > 0 && nh > 0) resizeScene(bundle, nw, nh);
  });
  resizeObserver.observe(wrapperEl.value);
});

function attachFrameHelpers(): void {
  if (!robot) return;
  for (const name in robot.joints) {
    const helper = new THREE.AxesHelper(0.08);
    (helper.material as THREE.LineBasicMaterial).transparent = true;
    (helper.material as THREE.LineBasicMaterial).opacity = 0.8;
    robot.joints[name].add(helper);
    frameHelpers.push(helper);
  }
}

watch(
  () => props.jointAngles,
  (angles) => {
    if (robot && angles) applyJointAngles(robot, angles);
  },
  { deep: true }
);

onBeforeUnmount(() => {
  // CLEANUP: cancel rAF, disconnect observers, dispose GPU resources.
  disposed = true;
  if (animationId !== null) cancelAnimationFrame(animationId);
  resizeObserver?.disconnect();
  controls?.dispose();
  for (const h of frameHelpers) {
    h.geometry.dispose();
    (h.material as THREE.LineBasicMaterial).dispose();
  }
  bundle?.dispose();
  bundle = null;
  robot = null;
});
</script>

<template>
  <div ref="wrapperEl" class="robot-wrapper">
    <canvas ref="canvasEl" class="three-canvas" />
  </div>
</template>

<style scoped>
.robot-wrapper {
  width: 100%;
  height: 100%;
  min-height: 360px;
  position: relative;
}
.three-canvas {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
