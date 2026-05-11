// lib/urdf.ts
//
// Two loading paths around `urdf-loader` (gkjohnson):
//
//   loadUrdf         — fetches the URDF + meshes by URL at runtime.
//                      Only works over http:// (e.g. dev server, slidev preview);
//                      browser security blocks fetch from file:// pages.
//
//   loadUrdfBundled  — accepts a BundledRobot whose URDF text and mesh
//                      contents were imported at build time via Vite's `?raw`
//                      mechanism. Parses everything in-process. Works from
//                      file:// because no fetch is involved — required for
//                      the offline-archive runtime promised by DESIGN.md §0.8.
//
// urdf-loader handles the ROS-Z-up to three.js-Y-up swap automatically;
// joints are accessible on the returned URDFRobot via
// robot.joints[<name>].setJointValue(<radians>) or in bulk via
// robot.setJointValues({ name: value, ... }).
//
// See DESIGN.md §6 for the RobotCell component contract.

import { LoadingManager, Object3D } from "three";
import { ColladaLoader } from "three/examples/jsm/loaders/ColladaLoader.js";
import URDFLoader from "urdf-loader";
import type { URDFRobot } from "urdf-loader";

export type { URDFRobot } from "urdf-loader";

// -----------------------------------------------------------------------------
// Bundled-robot path (file://-safe)
// -----------------------------------------------------------------------------

/**
 * A robot whose URDF and meshes have been imported as text at build time.
 * Produced by per-robot modules under lib/robots/<name>/index.ts.
 */
export interface BundledRobot {
  /** Human-readable name; appears in error messages. */
  name: string;
  /** Raw URDF XML text. */
  urdfText: string;
  /** Mesh file name (e.g. "base.dae") -> raw Collada XML text. */
  meshesByName: Record<string, string>;
}

/**
 * Parse a pre-bundled robot in-process — no fetch.
 *
 * The loader is configured with a custom mesh callback that looks each mesh
 * up in the bundled map (by filename) and parses it via three.js's
 * ColladaLoader. Throws (loud) if a mesh referenced by the URDF isn't in
 * the bundle.
 */
export function loadUrdfBundled(bundled: BundledRobot): URDFRobot {
  const colladaLoader = new ColladaLoader();
  const loader = new URDFLoader();
  loader.loadMeshCb = (url, _manager, onLoad) => {
    const filename = url.split("/").pop() ?? url;
    const text = bundled.meshesByName[filename];
    if (!text) {
      // Loud failure per DESIGN.md §0.7.
      throw new Error(
        `Mesh "${filename}" is referenced by ${bundled.name}.urdf but not in the bundle. ` +
          `Add it to lib/robots/<name>/meshes/visual/ and re-build.`
      );
    }
    try {
      const collada = colladaLoader.parse(text, "");
      // ColladaLoader auto-rotates Z_UP assets onto Y-up by setting the
      // returned scene's quaternion. Our render scene stays Z-up (ROS
      // REP-103, DESIGN.md §6) and the URDF specifies positions in Z-up,
      // so we undo the loader's rotation to keep the mesh in its native
      // frame.
      collada.scene.quaternion.identity();
      onLoad(collada.scene);
    } catch (err) {
      // The mesh loader's onLoad signature accepts (object, error). Pass an
      // empty Object3D as the placeholder and surface the parse error.
      onLoad(new Object3D(), err as Error);
    }
  };
  return loader.parse(bundled.urdfText);
}

// -----------------------------------------------------------------------------
// URL-fetch path (http:// only)
// -----------------------------------------------------------------------------

export interface LoadURDFOptions {
  /** URL of the URDF file (relative or absolute). */
  url: string;
  /** Optional override for the working path used to resolve mesh URLs. */
  workingPath?: string;
}

/**
 * Load a URDF asynchronously by fetching the URDF + mesh files.
 *
 * Requires an http:// origin — fails over file:// because of browser security.
 * Use loadUrdfBundled for file://-safe loading.
 */
export async function loadUrdf(opts: LoadURDFOptions): Promise<URDFRobot> {
  const manager = new LoadingManager();
  let firstError: Error | null = null;
  manager.onError = (failedUrl: string) => {
    if (!firstError) {
      firstError = new Error(`URDF asset failed to load: ${failedUrl}`);
    }
  };
  const loader = new URDFLoader(manager);
  if (opts.workingPath) {
    loader.workingPath = opts.workingPath;
  }
  const robot = await loader.loadAsync(opts.url);
  if (firstError) {
    throw firstError;
  }
  return robot;
}

// -----------------------------------------------------------------------------
// Joint helpers (work on either path's URDFRobot)
// -----------------------------------------------------------------------------

/**
 * Set every revolute / continuous / prismatic joint to zero.
 */
export function zeroAllJoints(robot: URDFRobot): void {
  for (const name in robot.joints) {
    robot.joints[name].setJointValue(0);
  }
}

/**
 * Apply a partial joint-angle map. Joints not in the dict are left alone;
 * names that don't exist on the robot are silently ignored so slide authors
 * can drive a subset without enumerating every joint.
 */
export function applyJointAngles(
  robot: URDFRobot,
  angles: Record<string, number>
): void {
  for (const name in angles) {
    const joint = robot.joints[name];
    if (joint) joint.setJointValue(angles[name]);
  }
}
