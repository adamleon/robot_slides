// setup/shared-three.ts
//
// One three.js scene shared across every slide of a deck — built lazily on
// the first call to ensureSharedScene(canvas, w, h), reused on every later
// getSharedScene() lookup. The persistent scene is what gives the camera
// glide its "no reload, just a moving viewpoint" feel: the robot, the grid,
// the lights are all the same Object3Ds across slides.
//
// Lifecycle:
//   - global-bottom.vue calls ensureSharedScene() in onMounted with its
//     canvas + initial size.
//   - Any component that needs read access (e.g. a future shared overlay)
//     calls getSharedScene() and reads scene/camera/objects.
//   - global-bottom.vue runs the render loop and copies the spring-driven
//     camera position/lookAt into scene.camera each frame.
//
// See DESIGN.md §5.4 and §8 (one renderer total).

import * as THREE from "three";
import { ur5e } from "../lib/robots/ur5e";
import { loadUrdfBundled, type URDFRobot } from "../lib/urdf";

export interface SharedScene {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** The robot is a first-class citizen; slides update its joints via the
   *  scene's APIs. Future: a per-deck registry instead of a single robot. */
  robot: URDFRobot;
  /** Named scene-graph entries that slide front-matter can show/hide via
   *  `sceneState.visible`. */
  objects: Record<string, THREE.Object3D>;
  /** Adjust renderer + camera aspect after the host element resizes. */
  resize: (width: number, height: number) => void;
  /** Tear down GPU resources. Only used in test harness — production
   *  leaves the scene alive for the whole tab lifetime. */
  dispose: () => void;
}

let instance: SharedScene | null = null;

/**
 * Build the shared scene if it doesn't exist, attaching to the given canvas.
 * Returns the singleton. Idempotent: later calls return the existing scene
 * and ignore the canvas/size args (one renderer total per DESIGN.md §8).
 */
export function ensureSharedScene(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): SharedScene {
  if (instance) return instance;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(window.devicePixelRatio);

  const scene = new THREE.Scene();
  // Opaque cookbook-dark background. The canvas itself fills the slide
  // area — no transparency dance required; slide text (set in slides.md)
  // sits on top via the normal Slidev layout.
  scene.background = new THREE.Color(0x1b1416);

  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(3, 2, 5);
  scene.add(sun);

  // Ground grid on the XY plane (Z up, ROS REP-103).
  const grid = new THREE.GridHelper(2, 10, 0x4a3a3a, 0x2a2024);
  grid.rotation.x = Math.PI / 2;
  scene.add(grid);

  // World-frame axes at origin.
  const worldAxes = new THREE.AxesHelper(0.2);
  (worldAxes.material as THREE.LineBasicMaterial).transparent = true;
  (worldAxes.material as THREE.LineBasicMaterial).opacity = 0.6;
  scene.add(worldAxes);

  // The UR5e — bundled from lib/robots/ur5e (no fetch, file://-safe).
  const robot = loadUrdfBundled(ur5e);
  scene.add(robot);

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 100);
  camera.up.set(0, 0, 1);
  camera.position.set(1.4, 1.4, 1.0);
  camera.lookAt(0, 0, 0.4);

  const objects: Record<string, THREE.Object3D> = {
    robot,
    grid,
    worldAxes,
  };

  instance = {
    renderer,
    scene,
    camera,
    robot,
    objects,
    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    dispose() {
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) m.dispose();
        }
      });
      instance = null;
    },
  };

  return instance;
}

/**
 * Look up the already-initialised shared scene.
 * Throws if ensureSharedScene() hasn't run yet — slides that consume the
 * shared scene must guarantee global-bottom.vue mounted first.
 */
export function getSharedScene(): SharedScene {
  if (!instance) {
    throw new Error(
      "Shared scene not yet initialised — global-bottom.vue must mount before consumers call getSharedScene()."
    );
  }
  return instance;
}
