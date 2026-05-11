// lib/robots/ur5e/index.ts
//
// Bundled UR5e robot — the URDF and every visual mesh are inlined into the JS
// bundle at build time via Vite's ?raw imports. No runtime fetch, so the deck
// can render the arm from file:// without a local web server.
//
// To add a new robot:
//   1. Drop ur<name>.urdf and meshes/visual/*.dae alongside this index.ts
//      under lib/robots/<name>/.
//   2. Copy this file's structure (URDF import + meshes glob + named export).
//   3. Import the named export from a slide or component.

import urdfText from "./ur5e.urdf?raw";
import type { BundledRobot } from "../../urdf";

// Vite import.meta.glob: eager-load every .dae as raw text, keyed by source
// path. We rekey by filename so URDF mesh refs like "meshes/visual/base.dae"
// resolve by simply taking the basename.
const meshModules = import.meta.glob<string>(
  "./meshes/visual/*.dae",
  { query: "?raw", import: "default", eager: true }
);

const meshesByName: Record<string, string> = {};
for (const filePath in meshModules) {
  const filename = filePath.split("/").pop();
  if (filename) {
    meshesByName[filename] = meshModules[filePath];
  }
}

export const ur5e: BundledRobot = {
  name: "UR5e",
  urdfText,
  meshesByName,
};
