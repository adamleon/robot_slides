// scripts/build-lite.mjs
//
// Build the lite (single-file) tier. vite.config.ts injects vite-plugin-singlefile
// when VITE_BUILD_PROFILE=lite, producing a self-contained index.html. We then
// copy that file out of the build directory and rename it for distribution.
// Usage: node scripts/build-lite.mjs <path/to/slides.md>

import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");

const slideFile = process.argv[2];
if (!slideFile) {
  console.error("Usage: node scripts/build-lite.mjs <path/to/slides.md>");
  process.exit(1);
}
const absSlide = path.resolve(slideFile);
if (!fs.existsSync(absSlide)) {
  console.error(`File not found: ${absSlide}`);
  process.exit(1);
}

const lectureName = path.basename(path.dirname(absSlide));
const buildDir = path.resolve(projectRoot, "dist", `${lectureName}-lite-build`);
const outFile = path.resolve(projectRoot, "dist", `${lectureName}-lite.html`);

const env = { ...process.env, VITE_BUILD_PROFILE: "lite" };
const slidevBin = path.resolve(
  projectRoot,
  "node_modules/@slidev/cli/bin/slidev.mjs"
);

console.log(`Building lite deck → ${outFile}`);
const result = spawnSync(
  process.execPath,
  [slidevBin, "build", absSlide, "--out", buildDir, "--base", "./"],
  { stdio: "inherit", env, cwd: projectRoot }
);

if (result.status !== 0) {
  console.error("Slidev build failed.");
  process.exit(result.status ?? 1);
}

const builtIndex = path.join(buildDir, "index.html");
if (!fs.existsSync(builtIndex)) {
  console.error(`Expected ${builtIndex} not found after build.`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.copyFileSync(builtIndex, outFile);

const sizeMB = (fs.statSync(outFile).size / 1_048_576).toFixed(2);
console.log(`\n✓ Lite build at ${outFile} (${sizeMB} MB)`);
console.log(`  Build directory left at ${buildDir}/ for inspection.`);
