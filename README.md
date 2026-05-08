# robot_slides

Interactive lecture slide framework for a robotics and computer vision
course. Source of truth for design and conventions: [docs/DESIGN.md](docs/DESIGN.md).

This README is the practical "how do I run it" guide. Read DESIGN.md before
writing new components.

---

## Status

**Milestone M0 (project skeleton) and the start of M1 (core lib helpers) are
in place.** A hello-world deck builds in all three tiers (full, lite, pdf).

What works:
- Project layout per DESIGN.md §3.
- `setup/build-profile.ts` — tier flag wired through Vite env.
- `setup/control-driver.ts` — single rAF loop driving all controllers.
- `lib/three-scene.ts` — plain-functional three.js wrappers.
- `lib/control.ts`, `lib/control-vec.ts` — `usePID`, `useSpring`,
  `useCriticalSpring` (scalar and Vec3 versions).
- `components/SpinningCube.vue` — tier-dispatch demo (full / lite / pdf).
- `components/SlidingToggle.vue` — first end-to-end demo of a control helper
  driving a UI element (DESIGN.md §5.5.4).
- `lectures/00-hello/slides.md` — the verifying deck.

Still to do for M1:
- A live PID-tuning slide (with sliders for Kp/Kd) — needs a small
  `JointSliderPanel` precursor or inline sliders.
- PDF build tested end-to-end with `snapAll()` invoked before render.

For M2 onward, see DESIGN.md §9.

---

## Prerequisites

- Node.js 20+ (24 LTS works). Verify with `node --version`.
- For PDF export: Playwright Chromium. First-time setup:

  ```bash
  npx playwright install chromium
  ```

---

## Install

```bash
npm install
```

This pulls Slidev, three.js, vite-plugin-singlefile, and Playwright Chromium
(the binary is downloaded by the install hook).

---

## Author a deck (live reload)

```bash
npm run dev -- lectures/00-hello/slides.md
```

The Slidev dev server opens at <http://localhost:3030>. Edit the `.md` file
or any `.vue` component — the page updates.

Hotkeys in the dev server / built deck:
- `space` / `→` — next click step.
- `←` — previous step.
- `f` — fullscreen.
- `o` — slide overview.
- `p` — presenter mode (separate window with notes).

---

## Build the three artifacts

```bash
# Full — chunked dist folder, all features live.
npm run build:full -- lectures/00-hello/slides.md
# → dist/00-hello/index.html

# Lite — single self-contained .html, runs from file://.
npm run build:lite -- lectures/00-hello/slides.md
# → dist/00-hello-lite.html

# PDF — vector, one page per click step.
npm run build:pdf -- lectures/00-hello/slides.md
# → dist/00-hello.pdf
```

---

## Repository layout

```
robot_slides/
├── docs/DESIGN.md                  source-of-truth design document
├── lectures/                       one folder per lecture
│   └── 00-hello/
│       ├── slides.md
│       └── vite.config.ts          1-line shim, see "Per-lecture vite shim"
├── components/                     reusable lecture widgets (Vue)
│   ├── SpinningCube.vue            tier dispatcher
│   ├── SlidingToggle.vue           spring-driven UI demo
│   └── internal/                   tier-specific implementations
├── lib/                            plain TypeScript (no Vue)
│   ├── three-scene.ts
│   ├── control.ts
│   └── control-vec.ts
├── setup/
│   ├── build-profile.ts
│   └── control-driver.ts
├── public/                         static assets, served verbatim
│   ├── urdf/   figures/   video/   images/
├── scripts/
│   ├── build-full.mjs
│   ├── build-lite.mjs
│   └── build-pdf.mjs
├── package.json
├── tsconfig.json
└── vite.config.ts
```

DESIGN.md §3.1 lists which directory new code goes in.

---

## Per-lecture `vite.config.ts` shim

Slidev v0.50 only loads `vite.config.ts` from the slide file's own directory
(plus addon/theme roots) — it does **not** walk up to find a project-root
config. To make our shared `components/`, lite-build plugin, and other Vite
config apply to every lecture, each lecture folder contains a 1-line shim:

```ts
// lectures/<NN-name>/vite.config.ts
export { default } from "../../vite.config";
```

When you add a new lecture, copy this file alongside `slides.md`. All real
Vite config lives in the project-root [vite.config.ts](vite.config.ts).

---

## Conventions in 30 seconds

1. Plain three.js, no TresJS or react-three-fiber.
2. `<script setup lang="ts">`. Annotate prop types and function signatures;
   skip generics unless required.
3. Every GPU-allocating component disposes in `onBeforeUnmount`. Tag the
   block with `// CLEANUP`.
4. **Animate physical quantities through `lib/control.ts`, not CSS.** CSS
   transitions are reserved for cosmetic effects (fade, color). See
   DESIGN.md §0.11 and §5.5.
5. Errors loud — `throw new Error(...)`, no silent fallbacks.
6. No CDN URLs at runtime. Lite and full builds must run from `file://`.

Full list: DESIGN.md §0.
