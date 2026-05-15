// Vite config picked up by Slidev at build/dev time.
//
// Two responsibilities:
//
// 1. Auto-import our project-root components/ directory.
//    Slidev's userRoot defaults to the slide file's directory, so its built-in
//    auto-import would only scan lectures/<NN-name>/components/. We add our own
//    unplugin-vue-components instance pointing at the absolute project-root
//    components/ folder so shared widgets (RobotCell, SpinningCube, …) resolve
//    no matter which lecture is being built.
//
//    Slidev v0.50 only loads vite.config.ts from each "root" (userRoot,
//    addons, themes); it does NOT walk up. To make per-lecture builds pick
//    up this config, lectures/<NN-name>/vite.config.ts re-exports this file.
//
// 2. Inject vite-plugin-singlefile when VITE_BUILD_PROFILE=lite, producing a
//    self-contained single-HTML deck. Full and pdf builds use chunked output.

import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import Components from "unplugin-vue-components/vite";
import { resolve } from "node:path";

// process.cwd() is the project root: build scripts (and `npm run dev`) always
// invoke slidev from there. We can't use import.meta.url because Vite bundles
// this config via esbuild — the bundled URL points at a temp file, not source.
const projectRoot = process.cwd();

const profile = process.env.VITE_BUILD_PROFILE ?? "full";
const isLite = profile === "lite";

// closed-chain-ik 0.0.3 ships two three.js helpers — IKRootsHelper.js and
// IKJointHelper.js — that import BoxBufferGeometry / CylinderBufferGeometry /
// SphereBufferGeometry from three. Those names were removed from three years
// ago, so the import lines fail Vite/Rollup resolution before our code even
// runs. We don't use either helper, so this plugin intercepts the resolve
// step and points both files at an empty-class stub. Relative imports
// (./IKJointHelper.js from IKRootsHelper.js) can't be matched by
// `resolve.alias`, hence the resolveId hook.
const stubClosedChainIkHelpers = {
  name: "robot-slides:closed-chain-ik-helper-stubs",
  enforce: "pre" as const,
  resolveId(id: string, importer?: string) {
    if (!/IK(Roots|Joint)Helper\.js$/.test(id)) return null;
    if (!importer || !importer.includes("closed-chain-ik")) return null;
    return resolve(projectRoot, "shims/closed-chain-ik-helpers.js");
  },
};

// Strip Slidev's `manualChunks` from the resolved config when building lite.
// vite-plugin-singlefile sets `inlineDynamicImports: true`, which Rollup
// rejects in combination with any manualChunks. Slidev's own vite config
// hook adds a manualChunks function for monaco/shiki splitting; Vite's
// mergeConfig keeps it through user-config merge. configResolved runs after
// all merging, so this is the reliable place to delete it.
const stripManualChunksForSinglefile = {
  name: "robot-slides:strip-manual-chunks",
  enforce: "post" as const,
  configResolved(config: { build?: { rollupOptions?: { output?: unknown } } }) {
    const output = config.build?.rollupOptions?.output;
    if (!output) return;
    const outputs = Array.isArray(output) ? output : [output];
    for (const o of outputs) {
      // any-cast: Rollup's typed OutputOptions doesn't allow delete cleanly.
      delete (o as { manualChunks?: unknown }).manualChunks;
    }
  },
};

export default defineConfig({
  // Slidev's default publicDir is <slide-file-dir>/public, which means each
  // lecture would need its own copy of public/urdf/ur5e/ etc. Override to the
  // project-root public/ so shared assets are vendored once.
  publicDir: resolve(projectRoot, "public"),
  plugins: [
    stubClosedChainIkHelpers,
    Components({
      dirs: [resolve(projectRoot, "components")],
      extensions: ["vue"],
      include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
      dts: false,
      directoryAsNamespace: false,
    }),
    ...(isLite
      ? [
          viteSingleFile({ removeViteModuleLoader: true }),
          stripManualChunksForSinglefile,
        ]
      : []),
  ],
  // Empty the output directory at the start of every build. The default is
  // off when outDir is outside Vite's project root (our dist/ is two levels
  // up from the per-lecture userRoot), which leaves stale hashed chunks
  // around between builds — confusing diagnostics and bloating archives.
  build: isLite
    ? {
        emptyOutDir: true,
        // Inline all assets (≤100MB cap) so the lite build is one .html file.
        assetsInlineLimit: 100_000_000,
        cssCodeSplit: false,
        chunkSizeWarningLimit: 100_000,
        rollupOptions: {
          output: {
            // vite-plugin-singlefile sets inlineDynamicImports, which is
            // incompatible with Slidev's default manualChunks. Force a single
            // chunk so all JS ends up in the inlined index.html.
            manualChunks: undefined,
            inlineDynamicImports: true,
          },
        },
      }
    : { emptyOutDir: true },
});
