// scripts/build-pdf.mjs
//
// Build the PDF tier. Slidev's export command uses Playwright Chromium to
// render each click-step to a vector PDF page. We set VITE_BUILD_PROFILE=pdf
// so components render their static fallback variants.
//
// First run requires Playwright's chromium binary; if missing, run:
//   npx playwright install chromium
//
// Usage: node scripts/build-pdf.mjs <path/to/slides.md>

import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");

const slideFile = process.argv[2];
if (!slideFile) {
  console.error("Usage: node scripts/build-pdf.mjs <path/to/slides.md>");
  process.exit(1);
}
const absSlide = path.resolve(slideFile);
if (!fs.existsSync(absSlide)) {
  console.error(`File not found: ${absSlide}`);
  process.exit(1);
}

const lectureName = path.basename(path.dirname(absSlide));
const outFile = path.resolve(projectRoot, "dist", `${lectureName}.pdf`);

const env = { ...process.env, VITE_BUILD_PROFILE: "pdf" };
const slidevBin = path.resolve(
  projectRoot,
  "node_modules/@slidev/cli/bin/slidev.mjs"
);

fs.mkdirSync(path.dirname(outFile), { recursive: true });

console.log(`Building PDF → ${outFile}`);
const result = spawnSync(
  process.execPath,
  [slidevBin, "export", absSlide, "--output", outFile, "--with-clicks"],
  { stdio: "inherit", env, cwd: projectRoot }
);

if (result.status !== 0) {
  console.error("Slidev export failed.");
  console.error("If this is the first PDF build, you may need to install chromium:");
  console.error("  npx playwright install chromium");
  process.exit(result.status ?? 1);
}

console.log(`\n✓ PDF at ${outFile}`);
