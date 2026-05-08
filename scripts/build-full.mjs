// scripts/build-full.mjs
//
// Build the full (lecture) tier — chunked dist folder, all features live.
// Usage: node scripts/build-full.mjs <path/to/slides.md>

import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");

const slideFile = process.argv[2];
if (!slideFile) {
  console.error("Usage: node scripts/build-full.mjs <path/to/slides.md>");
  process.exit(1);
}
const absSlide = path.resolve(slideFile);
if (!fs.existsSync(absSlide)) {
  console.error(`File not found: ${absSlide}`);
  process.exit(1);
}

const lectureName = path.basename(path.dirname(absSlide));
const outDir = path.resolve(projectRoot, "dist", lectureName);

const env = { ...process.env, VITE_BUILD_PROFILE: "full" };
const slidevBin = path.resolve(
  projectRoot,
  "node_modules/@slidev/cli/bin/slidev.mjs"
);

console.log(`Building full deck → ${outDir}/`);
const result = spawnSync(
  process.execPath,
  [slidevBin, "build", absSlide, "--out", outDir, "--base", "./"],
  { stdio: "inherit", env, cwd: projectRoot }
);

if (result.status !== 0) {
  console.error(
    `Slidev build failed (status=${result.status}, error=${result.error?.message ?? "none"}).`
  );
  process.exit(result.status ?? 1);
}

console.log(`\n✓ Full build at ${path.join(outDir, "index.html")}`);
