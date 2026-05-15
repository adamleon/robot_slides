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

// Module-level cache of parsed Collada scenes, keyed by `${robot}/${file}`.
// First call to a given mesh parses; later calls return clone()s that share
// geometries and materials but get their own transforms. Big win when a
// deck has multiple <RobotCell> instances (each slide is its own mount):
// the heavy XML→geometry work runs once per mesh instead of per slide.
const meshCache = new Map<string, Object3D>();

/**
 * Parse a pre-bundled robot in-process — no fetch.
 *
 * Uses a custom mesh callback that:
 *   - looks each mesh up in the bundled map by filename
 *   - returns a clone of the cached Collada scene on subsequent hits
 *   - rewrites the Collada `<up_axis>` from Z_UP to Y_UP before parsing,
 *     which makes three.js's ColladaLoader skip its automatic Z→Y
 *     rotation. The URDF already lays things out in Z-up (ROS REP-103),
 *     and our render scene is Z-up too (DESIGN.md §6), so the loader's
 *     "helpful" rotation was wrong; previously we undid it per mesh with
 *     `quaternion.identity()` AND ate a console warning per parse.
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
    const cacheKey = `${bundled.name}/${filename}`;
    let cached = meshCache.get(cacheKey);
    if (!cached) {
      try {
        // Strip Collada's Z_UP hint so the loader doesn't rotate the
        // scene (and doesn't warn about it). Vertex data stays as-is.
        const yUpText = text.replace(
          /<up_axis>\s*Z_UP\s*<\/up_axis>/g,
          "<up_axis>Y_UP</up_axis>"
        );
        const collada = colladaLoader.parse(yUpText, "");
        cached = collada.scene;
        meshCache.set(cacheKey, cached);
      } catch (err) {
        onLoad(new Object3D(), err as Error);
        return;
      }
    }
    onLoad(cached.clone());
  };
  return loader.parse(bundled.urdfText);
}

/**
 * Parse a BundledRobot just for its joint structure — useful for widgets
 * that need joint names, limits, and types but don't render the robot
 * themselves (e.g. JointSliderPanel). The mesh callback is a no-op, so
 * none of the bundled .dae text is decoded.
 *
 * The returned URDFRobot has the full joint tree (link transforms,
 * joints[name].setJointValue, etc.) but every visual is an empty Object3D.
 */
export function parseJointInfo(robot: BundledRobot): URDFRobot {
  const loader = new URDFLoader();
  loader.loadMeshCb = (_url, _manager, onLoad) => onLoad(new Object3D());
  return loader.parse(robot.urdfText);
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
