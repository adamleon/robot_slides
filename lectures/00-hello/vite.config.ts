// Per-lecture vite.config.ts shim.
//
// Slidev v0.50 only loads a vite.config.ts from each "root" (the slide file's
// directory, plus addon/theme roots). It does not walk up to find a project-
// root config. So every lecture needs this 1-line re-export to pick up the
// shared Vite config (component auto-import, lite/single-file plugin, etc.).
//
// Do NOT add lecture-specific Vite config here — put it in the project-root
// vite.config.ts so all lectures share it.

export { default } from "../../vite.config";
