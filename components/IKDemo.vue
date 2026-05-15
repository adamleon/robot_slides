<!--
  IKDemo.vue — drag the red target sphere; the arm follows via IK.

  Renders the bundled robot, a small draggable target sphere driven by
  three.js TransformControls, and a render loop that on each frame:
    1. writes target.position into the IK goal (lib/ik.ts createIKForRobot),
    2. runs one solver step, which copies the resulting joint angles back
       onto the URDFRobot the renderer is drawing,
    3. renders the scene.

  OrbitControls are also attached for camera framing; TransformControls
  disables them while a drag handle is in use so panning the gizmo doesn't
  also yank the camera.

  Props:
    robot         BundledRobot from lib/robots/<name>/index.ts.
    endEffector   Link name to drive (default "wrist_3_link" for UR5e).
    initialPose   Optional joint dict to seed a reachable starting pose;
                  the default zero pose puts the arm flat and singular.
-->

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import {
  createScene,
  resizeScene,
  type SceneBundle,
} from "../lib/three-scene";
import {
  loadUrdfBundled,
  type BundledRobot,
  type URDFRobot,
} from "../lib/urdf";
import { createIKForRobot, type IKHandle } from "../lib/ik";

const props = withDefaults(
  defineProps<{
    robot: BundledRobot;
    endEffector?: string;
    initialPose?: Record<string, number>;
  }>(),
  {
    endEffector: "wrist_3_link",
    initialPose: () => ({
      shoulder_lift_joint: -Math.PI / 2,
      elbow_joint: Math.PI / 2,
      wrist_1_joint: -Math.PI / 2,
    }),
  }
);

const canvasEl = ref<HTMLCanvasElement | null>(null);
const wrapperEl = ref<HTMLDivElement | null>(null);

let bundle: SceneBundle | null = null;
let robot: URDFRobot | null = null;
let ik: IKHandle | null = null;
let controls: OrbitControls | null = null;
let transformControls: TransformControls | null = null;
let target: THREE.Mesh | null = null;
let animationId: number | null = null;
let resizeObserver: ResizeObserver | null = null;
let disposed = false;

onMounted(() => {
  if (!canvasEl.value || !wrapperEl.value) return;

  const w = wrapperEl.value.clientWidth;
  const h = wrapperEl.value.clientHeight;
  bundle = createScene(canvasEl.value, w, h, 0x1b1416);

  bundle.camera.position.set(1.4, 1.4, 1.0);
  bundle.camera.lookAt(0, 0, 0.4);

  controls = new OrbitControls(bundle.camera, bundle.renderer.domElement);
  controls.target.set(0, 0, 0.4);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;

  const grid = new THREE.GridHelper(2, 10, 0x4a3a3a, 0x2a2024);
  grid.rotation.x = Math.PI / 2;
  bundle.scene.add(grid);

  const worldAxes = new THREE.AxesHelper(0.2);
  (worldAxes.material as THREE.LineBasicMaterial).transparent = true;
  (worldAxes.material as THREE.LineBasicMaterial).opacity = 0.6;
  bundle.scene.add(worldAxes);

  // Robot + a reachable seed pose so the IK doesn't start at the all-zero
  // singularity (arm flat along +X, wrist degenerate).
  robot = loadUrdfBundled(props.robot);
  bundle.scene.add(robot);
  for (const name in props.initialPose) {
    robot.joints[name]?.setJointValue(props.initialPose[name]);
  }
  robot.updateMatrixWorld(true);

  // IK
  ik = createIKForRobot(robot, props.endEffector);

  // Draggable target — sits at the current end-effector position so the
  // arm starts "in equilibrium" and only moves when the user drags.
  const tmpV = new THREE.Vector3();
  ik.getEndEffectorPosition(tmpV);
  const targetMat = new THREE.MeshStandardMaterial({
    color: 0xf26060,
    emissive: 0x442020,
    roughness: 0.4,
  });
  target = new THREE.Mesh(new THREE.SphereGeometry(0.035, 24, 12), targetMat);
  target.position.copy(tmpV);
  bundle.scene.add(target);

  // TransformControls puts an XYZ gizmo on the target. Suspend OrbitControls
  // while a handle is being dragged so the camera doesn't also pan.
  transformControls = new TransformControls(
    bundle.camera,
    bundle.renderer.domElement
  );
  transformControls.attach(target);
  transformControls.setSize(0.6);
  transformControls.addEventListener(
    "dragging-changed",
    (e: { value: boolean }) => {
      if (controls) controls.enabled = !e.value;
    }
  );
  // The TransformControls helper exposes its gizmo via getHelper() in r170+;
  // earlier versions add directly. We add via getHelper() if available.
  const helper =
    typeof (transformControls as unknown as { getHelper?: () => THREE.Object3D })
      .getHelper === "function"
      ? (
          transformControls as unknown as { getHelper: () => THREE.Object3D }
        ).getHelper()
      : (transformControls as unknown as THREE.Object3D);
  bundle.scene.add(helper);

  // Render loop: IK every frame, then render.
  const tick = () => {
    if (disposed || !bundle) return;
    controls?.update();
    if (ik && target) {
      ik.setGoal(target.position);
      ik.solve();
    }
    bundle.renderer.render(bundle.scene, bundle.camera);
    animationId = requestAnimationFrame(tick);
  };
  animationId = requestAnimationFrame(tick);

  resizeObserver = new ResizeObserver(() => {
    if (!bundle || !wrapperEl.value) return;
    const nw = wrapperEl.value.clientWidth;
    const nh = wrapperEl.value.clientHeight;
    if (nw > 0 && nh > 0) resizeScene(bundle, nw, nh);
  });
  resizeObserver.observe(wrapperEl.value);
});

onBeforeUnmount(() => {
  disposed = true;
  if (animationId !== null) cancelAnimationFrame(animationId);
  resizeObserver?.disconnect();
  controls?.dispose();
  transformControls?.dispose();
  bundle?.dispose();
  bundle = null;
  robot = null;
  ik = null;
  target = null;
});
</script>

<template>
  <div ref="wrapperEl" class="ik-wrapper">
    <canvas ref="canvasEl" class="three-canvas" />
  </div>
</template>

<style scoped>
.ik-wrapper {
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
