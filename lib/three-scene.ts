// lib/three-scene.ts
//
// Plain-functional wrappers around three.js setup. No classes, no globals.
// Each function returns a struct of the things you need; callers own the
// returned bundle and are responsible for calling dispose() on unmount.
//
// Coordinate convention for the whole deck (ROS REP-103):
//   +Z up, +X forward, +Y left. Distances in metres.
// urdf-loader handles its own ROS-Z-up vs three.js-Y-up swap; for raw
// three.js scenes built here, we orient the camera to make +Z visibly up.
//
// See docs/DESIGN.md §5.2 and §6.

import * as THREE from "three";

export interface SceneBundle {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Call in onBeforeUnmount — disposes GPU resources and walks the scene. */
  dispose: () => void;
}

/**
 * Create a three.js scene attached to a canvas element.
 *
 * canvas:     the <canvas> the renderer draws into.
 * width/height: pixel size; pass canvas.clientWidth/clientHeight for full size.
 * background: optional clear colour (THREE.Color or hex like 0x202020).
 *
 * Returns a SceneBundle with renderer, scene, camera, and dispose().
 */
export function createScene(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  background: THREE.ColorRepresentation = 0x202020
): SceneBundle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(window.devicePixelRatio);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);

  // +Z up to match ROS REP-103. Camera looks toward origin from +X+Y+Z octant.
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 100);
  camera.up.set(0, 0, 1);
  camera.position.set(2, 2, 1.5);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(3, 2, 5);
  scene.add(sun);

  const dispose = () => {
    renderer.dispose();
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m.dispose();
      }
    });
  };

  return { renderer, scene, camera, dispose };
}

/**
 * Resize a SceneBundle's renderer and update the camera aspect ratio.
 * Call when the host element changes size.
 */
export function resizeScene(
  bundle: SceneBundle,
  width: number,
  height: number
): void {
  bundle.renderer.setSize(width, height, false);
  bundle.camera.aspect = width / height;
  bundle.camera.updateProjectionMatrix();
}
