# Interactive Lecture Slide Framework — Design Document

**Audience:** Claude Code, plus the project owner (senior developer experienced in
non-web languages, new to JavaScript / Vue / web tooling).

**Project goal:** A reusable framework for building interactive lecture slide decks
for a robotics and computer vision course. Slides must support 3D scenes, live
physics, parameter sliders bound to graphs and 3D scenes, LaTeX, SVG, video, code
highlighting, and smooth transitions between scenes (e.g. zoom from full robot
cell to one arm while the rest fades and a joint-angle plot draws in).

This document is the source of truth for architecture and conventions. It is
written to be read top-to-bottom by Claude Code at the start of every work
session, and to be used as a checklist when reviewing generated code.

---

## 0. Conventions for Claude Code

These rules exist because the project owner is new to JavaScript and the modern
web ecosystem. Generated code should look as close to "ordinary procedural code
in any language" as possible.

1. **Plain over magic.** Prefer explicit, imperative code over framework magic.
   Specifically:
   - Use plain `three.js` directly. Do **not** use TresJS or react-three-fiber.
   - Use Vue's Composition API with `<script setup>` (this is the closest
     thing Vue has to "write a normal function and export it"). Avoid Options
     API, mixins, render functions, and JSX.
   - Avoid clever destructuring, point-free style, or one-liner reactive chains
     when a 5-line for-loop is clearer.
2. **TypeScript on, but lightly typed.** Use `.ts` and `.vue` (`<script setup
   lang="ts">`). Annotate function signatures and component props. Do not write
   conditional types, mapped types, or generic gymnastics. `any` is acceptable
   when wrapping a third-party library that doesn't ship types — leave a
   comment.
3. **Comment intent, not syntax.** Every Vue component file starts with a
   header comment explaining what the component is for and what props it
   accepts. Every non-trivial three.js function has a docstring-style comment
   describing inputs/outputs in plain English.
4. **No abbreviations in names.** `robotCell`, not `rc`. `jointAngles`, not
   `q`. (Math symbols inside formula comments are fine: `// q is the joint
   vector`.)
5. **One concept per file.** A `RobotCell.vue` file should not also contain a
   plotting widget. Compose at the slide level, not inside leaf components.
6. **Lifecycle is explicit.** Every component that allocates GPU resources
   (geometries, materials, textures, render targets) **must** dispose them in
   `onBeforeUnmount`. Add a `// CLEANUP` comment block listing what is freed.
7. **Errors loud, not swallowed.** Prefer `throw new Error("…")` over silent
   fallbacks. The build should fail loudly if a URDF or texture is missing.
8. **No network at runtime.** The compiled deck must run from `file://` with
   no internet. Never use a CDN URL at runtime. All assets are local.
9. **Ask before adding dependencies.** Each new npm package is an additional
   thing the owner has to understand. Justify it in a PR/commit message
   (1–2 sentences) before installing.
10. **Commit messages explain the "why".** "Add joint slider component"
    is too thin. "Add JointSlider; needed because RobotCell.vue had inline
    sliders that couldn't be reused on the IK demo slide" is right.
11. **Animate with physics, not with CSS easing.** This project is a
    robotics and control-theory course; the UI itself should exhibit the
    same second-order dynamics it is teaching. When a value needs to move
    over time — a knob sliding, a parameter responding to a slider, a
    camera repositioning — the **default** is to drive it through the
    helpers in `lib/control.ts` (PID setpoint, mass-spring-damper, or
    critically-damped spring) rather than through a CSS `transition`,
    a tween library, or `gsap.to()`. CSS transitions are reserved for
    pure cosmetic effects (fades, colour changes) where dynamics would
    add nothing. When in doubt, ask "would a real physical system snap
    to the new value, or would it have inertia?" — if it has inertia,
    use `lib/control.ts`. See §5.5 for the patterns and helpers.

---

## 1. Stack — what and why

### 1.1 Locked-in choices

| Layer | Choice | Why this and not alternatives |
|---|---|---|
| Slide engine | **Slidev** | Markdown for content, Vue components for custom widgets, Vite build, presenter mode, KaTeX, Shiki, PDF/PPTX export — all out of the box. The closest thing to "PowerPoint with real code embedding". |
| 3D | **three.js (raw)** | Industry standard, huge example corpus, imperative API similar to other scene-graph libraries (Open3D, OpenSceneGraph). Easy to read. |
| Robot models | **`urdf-loader`** (gkjohnson) | Loads ROS URDF + STL/Collada meshes into a three.js scene graph. Used by NASA JPL. |
| Inverse kinematics | **`closed-chain-ik-js`** (gkjohnson) | Pure-JS IK solver, supports closed chains and multiple end-effectors. |
| Physics (rigid body / dynamics) | **Rapier.js** | Rust + WASM, MIT, actively maintained, ~600 KB. Sufficient for kinematics, dynamics, contacts. |
| Plotting | **uPlot** | Tiny (~40 KB), fast, canvas-based. Plain JavaScript API, no React/Vue magic. |
| Math typesetting | **KaTeX** (built into Slidev) | Faster than MathJax, fully offline. |
| TikZ → static figure | **`dvisvgm`** at authoring time | Run at build, output SVG into `public/figures/`. Slides import the SVG file, not the TikZ source. |
| Code highlighting | **Shiki** (built into Slidev) | VS Code-quality highlighting, fully static. |
| Single-file build | **`vite-plugin-singlefile`** | Inlines JS/CSS/fonts into one HTML for archive distribution. |
| Build tool | **Vite** (Slidev's default) | Fast dev server, HMR, ESM-native. |
| Language | **TypeScript** | Catches the kind of typo errors that JavaScript would let through. Light typing only. |

### 1.2 Explicitly rejected

- **TresJS / react-three-fiber.** Both are "declarative wrappers" around
  three.js. They work well for people fluent in Vue/React but for someone new
  to web frameworks they hide *what* three.js is doing. We use raw three.js so
  every line corresponds to a documented three.js method.
- **threepp + WASM.** Excellent C++ port of three.js, but the full deck plus
  Vue plus KaTeX cannot share state with a C++ canvas without painful glue
  code. We keep the option open *only* for a separate C++ kinematics math
  library that the JS side could call later (see §10), not as the renderer.
- **Reveal.js, Spectacle, MDX-deck.** Reveal is the strongest competitor but
  its slides are HTML strings — Claude Code is much more productive in Vue
  components. Spectacle and MDX-deck are slow-moving / archived.
- **Marp, PowerPoint.** Cannot host live three.js + sliders + reactive plots.

### 1.3 Browser target

- **Lecture target:** Latest Microsoft Edge on Windows (Chromium, classroom
  PC). WebGL2 must work. WebGPU is opportunistic only — never required.
- **Lite/archive target:** Any Chromium-based browser, Firefox 141+, Safari
  17+. Phones acceptable but not guaranteed.
- **PDF target:** static, no interactivity.

### 1.4 Operating system

- **Authoring:** Windows 11 (primary), Linux/Docker (secondary). Node.js 20+
  required.
- **Repository:** all paths use forward slashes; Vite handles cross-platform.
- **Avoid:** any tool that requires WSL-only or Linux-only at runtime.

---

## 2. Three output tiers — what is shipped

The same source compiles to three artifacts. Tier choice is controlled by the
`BUILD_PROFILE` environment variable (`full`, `lite`, `pdf`).

| Tier | Format | Use case | Who runs it |
|---|---|---|---|
| **Full (lecture)** | Folder (`dist/`) with `index.html` + chunked JS/CSS/assets | In-classroom lecture, all features enabled | Lecturer on Windows classroom PC |
| **Lite (archive)** | Single `lecture.html` (everything inlined except long videos) | Share with students, archive on course site, run on phones | Anyone, including phones |
| **PDF** | Static `lecture.pdf` | Reading offline, printing, accessibility | Anyone |

### 2.1 Tier behaviour rules

- **Full:** every component renders its full interactive form. three.js scenes
  use full meshes, physics enabled, all sliders live.
- **Lite:** components fall back to a static-or-lower-fidelity form. Heavy
  three.js scenes are replaced by a pre-rendered `.webm` clip or a still PNG
  with a slider that still works on a low-poly version. Monaco editor / live
  code editing is disabled.
- **PDF:** components render their *current default* state to the page.
  Sliders disappear; what the viewer sees is whatever the slider's default
  value produces.

### 2.2 How tier dispatch works in code

A single helper exposes the build profile to every component:

```ts
// setup/build-profile.ts
// Build-tier flag, set via the BUILD_PROFILE env var at compile time.
// Components branch on this so the same source produces three artifacts.

export type BuildProfile = "full" | "lite" | "pdf";

export const BUILD_PROFILE: BuildProfile =
  (import.meta.env.VITE_BUILD_PROFILE as BuildProfile) ?? "full";

export const isFull = BUILD_PROFILE === "full";
export const isLite = BUILD_PROFILE === "lite";
export const isPdf  = BUILD_PROFILE === "pdf";
```

Components branch like this:

```vue
<!-- components/RobotCell.vue (excerpt) -->
<script setup lang="ts">
import { BUILD_PROFILE } from "../setup/build-profile";
import RobotCellFull from "./internal/RobotCellFull.vue";
import RobotCellLite from "./internal/RobotCellLite.vue";
import RobotCellStatic from "./internal/RobotCellStatic.vue";
</script>

<template>
  <RobotCellFull   v-if="BUILD_PROFILE === 'full'" />
  <RobotCellLite   v-else-if="BUILD_PROFILE === 'lite'" />
  <RobotCellStatic v-else />
</template>
```

The slide author writes `<RobotCell />` once. The build picks the right
variant.

---

## 3. Project layout

```
robotics-cv-lectures/
├── README.md
├── DESIGN.md                       # this document
├── package.json
├── tsconfig.json
├── vite.config.ts                  # Slidev's config, extended for tier builds
├── slidev.config.ts                # Slidev-level config (theme, addons, etc.)
│
├── lectures/
│   ├── 01-kinematics/
│   │   ├── slides.md               # Markdown + Vue component tags
│   │   └── notes.md                # Lecturer notes, compiled into PDF
│   ├── 02-dynamics/
│   ├── 03-camera-models/
│   └── …
│
├── components/                     # Reusable lecture widgets
│   ├── RobotCell.vue               # tier-dispatcher
│   ├── JointSliderPanel.vue        # joint angle sliders
│   ├── JointAngleGraph.vue         # uPlot wrapper
│   ├── PinholeCamera.vue           # CV: 3D scene with image plane
│   ├── EpipolarDemo.vue
│   ├── KinematicsExplainer.vue
│   └── internal/                   # tier-specific implementations
│       ├── RobotCellFull.vue
│       ├── RobotCellLite.vue
│       └── RobotCellStatic.vue
│
├── lib/                            # Plain TypeScript (no Vue)
│   ├── three-scene.ts              # createScene(), createRenderer(), …
│   ├── urdf.ts                     # wrappers around urdf-loader
│   ├── ik.ts                       # closed-chain-ik wrappers
│   ├── physics.ts                  # Rapier wrappers
│   ├── camera-models.ts            # pinhole math, distortion shaders
│   ├── control.ts                  # PID, spring, critical-spring helpers (§5.5)
│   └── control-vec.ts              # Vec3 versions of the control helpers
│
├── setup/
│   ├── build-profile.ts
│   ├── shared-three.ts             # singleton renderer for cross-slide reuse
│   ├── control-driver.ts           # single rAF loop driving every controller
│   └── globals.ts                  # Slidev addon hooks
│
├── public/                         # static assets, served verbatim
│   ├── urdf/                       # robot URDFs + meshes (.stl, .dae, .gltf)
│   │   └── ur5e/
│   │       ├── ur5e.urdf
│   │       └── meshes/
│   ├── figures/                    # pre-rendered SVG (TikZ output, diagrams)
│   ├── video/                      # short MP4/WebM demos for the lite build
│   └── images/
│
├── scripts/
│   ├── build-full.mjs              # wraps `slidev build` with profile=full
│   ├── build-lite.mjs              # wraps slidev build + viteSingleFile
│   ├── build-pdf.mjs               # wraps `slidev export`
│   └── tikz-to-svg.mjs             # batch-converts .tex → .svg via dvisvgm
│
├── global-bottom.vue               # Slidev hook: persistent canvas overlay
└── global-top.vue                  # Slidev hook: top overlay (titles, etc.)
```

### 3.1 Where new code goes

- A new robotics widget (e.g. trajectory planner): `components/Trajectory.vue`,
  with internal full/lite split if needed.
- A new pure-math helper (e.g. quaternion utilities): `lib/quaternions.ts`.
- A new motion controller (e.g. an LQR-flavoured helper, a second-order
  filter for sensor smoothing): `lib/control.ts` (extend the existing file)
  or `lib/control-<name>.ts` if it's a substantial new family. Keep the
  signature consistent with `usePID` / `useSpring` (take a setpoint ref,
  return a converged read-only ref, register with `control-driver`).
- A new lecture: `lectures/NN-topic/slides.md` plus per-lecture assets in
  `lectures/NN-topic/assets/` (Slidev resolves these automatically).
- A new robot URDF: `public/urdf/<robot-name>/`.

---

## 4. Build pipeline

### 4.1 Authoring loop (Windows / Linux / Docker)

```bash
# install once
npm install

# author a lecture (HMR, opens browser at http://localhost:3030)
npm run dev -- lectures/01-kinematics/slides.md
```

`npm run dev` runs `slidev` against the given lecture file. Save the markdown
or any `.vue` component, the page reloads.

### 4.2 Production builds

```bash
# Full lecture build (folder, recommended for classroom)
npm run build:full -- lectures/01-kinematics/slides.md
# output: dist/01-kinematics/   (copy whole folder to OneDrive)

# Lite single-file build (one .html for sharing)
npm run build:lite -- lectures/01-kinematics/slides.md
# output: dist/01-kinematics-lite.html

# PDF
npm run build:pdf -- lectures/01-kinematics/slides.md
# output: dist/01-kinematics.pdf
```

All three scripts live in `scripts/` and just invoke Slidev with the right
environment variables and post-processing.

### 4.3 Single-file mechanics (lite build)

The lite build sets `VITE_BUILD_PROFILE=lite`, then runs `slidev build`, then
runs a post-processing pass that:

1. Inlines all chunked JS/CSS/fonts into the resulting `index.html` via
   `vite-plugin-singlefile`.
2. Inlines small images (≤ 100 KB) as base64; leaves larger ones external
   (and the lite build is expected to avoid those — slide author's choice).
3. Inlines short videos (≤ 5 MB) as base64; longer ones must be cut or
   pre-rendered as a still.
4. Bakes Rapier's WASM as a base64 data URL (Rapier supports this via its
   `compat` build).

If a slide uses an asset that breaks single-file (e.g. a 50 MB video), the
build script logs a warning and the lite build excludes that slide (replaces
with a placeholder image).

### 4.4 PDF build

`slidev export --with-clicks` produces a vector PDF where each click-step is
its own page. Vue components render to whatever they look like at default
state (sliders disabled, three.js renders a single frame). Lecturer notes are
included in the PDF if `notes.md` exists.

### 4.5 OneDrive deployment

The full build is a folder. Steps for the lecturer:

1. `robocopy dist/01-kinematics OneDrive/Lectures/01-kinematics /MIR`
2. On the classroom PC, open `OneDrive/Lectures/01-kinematics/index.html` in
   Edge.
3. Press `F` for fullscreen, arrow keys for navigation, `O` for overview, `P`
   for presenter mode.

OneDrive's local-cache means the folder is available offline as long as it has
been opened once on the classroom machine.

---

## 5. Component conventions

### 5.1 Vue component skeleton

Every component starts from this template:

```vue
<!--
  ComponentName.vue — one-line description.

  Props:
    propA: type — what it controls.
    propB: type — what it controls.

  Notes:
    - Allocates a three.js renderer; disposes in onBeforeUnmount.
    - Lite-build behaviour: …
-->

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import * as THREE from "three";

// --- Props ----------------------------------------------------------------
const props = defineProps<{
  jointAngles: number[];   // radians, length = number of joints
  showOverlay?: boolean;
}>();

// --- State (reactive) -----------------------------------------------------
const canvasEl = ref<HTMLCanvasElement | null>(null);

// --- three.js handles (NOT reactive — refs not needed) --------------------
let renderer: THREE.WebGLRenderer | null = null;
let scene:    THREE.Scene          | null = null;
let camera:   THREE.PerspectiveCamera | null = null;
let animationId: number | null = null;

// --- Lifecycle ------------------------------------------------------------
onMounted(() => {
  // Build scene, start render loop. Pure three.js — no Vue magic.
  // …
});

onBeforeUnmount(() => {
  // CLEANUP: dispose GPU resources, cancel animation frame.
  if (animationId !== null) cancelAnimationFrame(animationId);
  scene?.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
      else obj.material.dispose();
    }
  });
  renderer?.dispose();
});
</script>

<template>
  <canvas ref="canvasEl" class="three-canvas" />
</template>

<style scoped>
.three-canvas {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
```

### 5.2 Three.js wrapper helpers

To keep components free of boilerplate, `lib/three-scene.ts` provides a
small set of imperative helpers:

```ts
// lib/three-scene.ts
//
// Plain-functional wrappers around three.js setup. No classes, no globals.
// Each function returns a struct of the things you need.

import * as THREE from "three";

export interface SceneBundle {
  renderer: THREE.WebGLRenderer;
  scene:    THREE.Scene;
  camera:   THREE.PerspectiveCamera;
  dispose:  () => void;   // call in onBeforeUnmount
}

/**
 * Create a three.js scene attached to a canvas element.
 *
 * canvas: the <canvas> the renderer draws into.
 * width / height: pixel size; pass canvas.clientWidth/Height for full size.
 * background: optional clear colour (THREE.Color or hex like 0x202020).
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

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 100);
  camera.position.set(2, 1.5, 2);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(3, 5, 2);
  scene.add(sun);

  const dispose = () => {
    renderer.dispose();
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m.dispose());
      }
    });
  };

  return { renderer, scene, camera, dispose };
}
```

Components call `createScene` and own the returned bundle. No singletons, no
hidden state — this is the pattern the project owner asked for.

### 5.3 Sliders ↔ three.js binding

Vue's reactivity is the only "magic" we accept, and only at the boundary
between sliders and three.js state. The simplest form is a *hard* binding —
slider value goes straight into the joint:

```vue
<script setup lang="ts">
import { ref, watch } from "vue";

const angle = ref(0);   // radians, driven by a <input type="range">

// When the slider moves, update the joint. No event listeners needed.
watch(angle, (newAngle) => {
  if (robot && robot.joints["shoulder_pan_joint"]) {
    robot.joints["shoulder_pan_joint"].setJointValue(newAngle);
  }
});
</script>

<template>
  <input type="range" min="-3.14" max="3.14" step="0.01" v-model.number="angle" />
  <span>{{ angle.toFixed(2) }} rad</span>
</template>
```

The same `angle` ref can drive a uPlot data array — push to a buffer in the
`watch` callback, call `plot.setData(buffer)`.

**However, the hard binding above is the *exception*, not the default.** Per
convention §0.11, parameters that represent physical quantities should follow
their slider through a PID or spring helper from `lib/control.ts` so that
moving the slider quickly produces the overshoot/lag a real actuator would
exhibit. The soft-binding pattern is in §5.5 — read it before writing any
new slider-driven widget.

### 5.4 Cross-slide persistent 3D canvas (the "zoom from cell to arm" effect)

This is the most architecturally interesting feature. It uses Slidev's
`global-bottom.vue` hook, which renders once across all slides.

Pattern:

1. `setup/shared-three.ts` exports a `getSharedScene()` function that
   lazily builds a single `SceneBundle` and returns it. All slides share
   one scene, one renderer, one camera.
2. `global-bottom.vue` mounts a `<canvas>` and starts the render loop on
   `getSharedScene()`.
3. Each slide declares its desired camera pose, visible objects, and overlay
   in front-matter or via a small `<SceneState>` component.
4. A `useNav()` watcher in `global-bottom.vue` reads the current slide's
   declared state and **drives the camera with a mass-spring controller from
   `lib/control.ts`** (see §5.5). The slide's declared pose becomes the
   spring's target; the camera has inertia and damping. Snap motion is also
   available for slides that need it — opt-in via `transition: snap` in the
   front-matter.

Slide-author syntax (in markdown):

```md
---
sceneState:
  camera: { position: [3, 2, 3], lookAt: [0, 0, 0] }
  visible: [robotCell, conveyor]
  overlay: null
---

# The full robot cell

The cell consists of a UR5e arm, a conveyor, and a vision station.
```

Next slide:

```md
---
sceneState:
  camera: { position: [0.5, 0.3, 0.5], lookAt: [0, 0.3, 0] }
  visible: [robotArm]
  overlay: jointAnglePlot
transition: spring          # spring | critical | snap; default: critical
springStiffness: 80         # optional override; default in lib/control.ts
springDamping: 12
---

# Zooming in on the arm

(slide content here)
```

`global-bottom.vue` runs the spring step every animation frame (the camera
position is the *actual*, the front-matter pose is the *setpoint*), fades
non-visible objects, and mounts the overlay component when the slide
changes. Slide authors do not write three.js code at all in the simple case.

This requires custom plumbing — see milestone M3 in §9.

### 5.5 Motion through control theory (the project's signature pattern)

This is one of the things that makes the framework worth building rather than
buying. Every motion in the UI — knobs sliding, parameters responding to
sliders, the camera repositioning between slides, an end-effector target
following the cursor — flows through a small set of helpers in
`lib/control.ts`. The result is a course where the *user interface itself*
exhibits the dynamics the lectures are teaching, before students have read
a single equation.

#### 5.5.1 Three primitives, picked by what the motion should feel like

| Helper | Use when | Tunables | Behaviour |
|---|---|---|---|
| `usePID(setpoint, opts)` | Slider drives a setpoint, you want classic PID response with optional overshoot. Best for parameters that map to a physical quantity in a robot/control demo. | `Kp`, `Ki`, `Kd`, `mass` (defaults to 1) | Underdamped values overshoot; overdamped lag. Tunable on a per-component basis. |
| `useSpring(target, opts)` | Things should move smoothly with inertia but you don't need PID semantics. Camera, knob position, anything visual. | `stiffness`, `damping`, `mass` | Critically-damped (default) gives the snappy-but-soft feel of native macOS controls; reduce damping for a bouncier knob. |
| `useCriticalSpring(target, opts)` | You want "no overshoot, fastest convergence" — UI elements where overshoot would look like a bug. | `responseTime` (seconds) | Computes stiffness/damping for critical damping at the given response time; ignores all other tuning. |

All three return a **read-only ref** that converges toward the target ref
over time. Component code reads the converged ref to drive three.js or DOM.

#### 5.5.2 The shared driver (frame loop)

A single `requestAnimationFrame` loop in `setup/control-driver.ts` advances
every active controller per frame with the actual `dt`. Components register
controllers via the helpers; the driver owns the loop. This means:

- One `rAF` for the whole deck, not one per slider.
- Pausing the page (tab hidden) automatically pauses controllers.
- `dt` is real wall-clock time, so behaviour is frame-rate independent.

#### 5.5.3 Reference implementation sketch

```ts
// lib/control.ts
//
// Control-theoretic motion primitives. Every animated parameter in the deck
// flows through one of these. See DESIGN.md §0.11 and §5.5.

import { ref, type Ref } from "vue";
import { registerController } from "../setup/control-driver";

// --- PID ------------------------------------------------------------------
//
// setpoint: ref the user (or another controller) writes to.
// returns: read-only ref carrying the controlled value.
//
// State is per-call (closures), so two PIDs don't share state.

export interface PIDOptions {
  Kp: number;          // proportional gain
  Ki?: number;         // integral gain  (default 0)
  Kd?: number;         // derivative gain (default 0)
  mass?: number;       // virtual mass    (default 1)
  initial?: number;    // initial value of the controlled variable
  integralClamp?: number; // anti-windup limit (default Infinity)
}

export function usePID(setpoint: Ref<number>, opts: PIDOptions): Readonly<Ref<number>> {
  const Ki = opts.Ki ?? 0;
  const Kd = opts.Kd ?? 0;
  const mass = opts.mass ?? 1;
  const clamp = opts.integralClamp ?? Infinity;

  const actual = ref(opts.initial ?? setpoint.value);
  let velocity = 0;
  let integral = 0;
  let prevError = 0;

  registerController((dt) => {
    const error = setpoint.value - actual.value;
    integral += error * dt;
    if (integral >  clamp) integral =  clamp;
    if (integral < -clamp) integral = -clamp;
    const derivative = (error - prevError) / Math.max(dt, 1e-6);
    const force = opts.Kp * error + Ki * integral + Kd * derivative;
    const acceleration = force / mass;
    velocity += acceleration * dt;
    actual.value += velocity * dt;
    prevError = error;
  });

  return actual;
}

// --- Mass-spring-damper ---------------------------------------------------
//
// Simpler model than PID, no integral term. Good default for visual motion.

export interface SpringOptions {
  stiffness?: number;  // k    (default 100)
  damping?: number;    // c    (default 20  → roughly critically damped at m=1)
  mass?: number;       //      (default 1)
  initial?: number;
}

export function useSpring(target: Ref<number>, opts: SpringOptions = {}): Readonly<Ref<number>> {
  const k = opts.stiffness ?? 100;
  const c = opts.damping ?? 20;
  const m = opts.mass ?? 1;

  const actual = ref(opts.initial ?? target.value);
  let velocity = 0;

  registerController((dt) => {
    const displacement = actual.value - target.value;
    const springForce  = -k * displacement;
    const dampingForce = -c * velocity;
    const acceleration = (springForce + dampingForce) / m;
    velocity += acceleration * dt;
    actual.value += velocity * dt;
  });

  return actual;
}

// --- Critically-damped spring -------------------------------------------
//
// "Settle to target in roughly responseTime seconds, no overshoot."

export function useCriticalSpring(
  target: Ref<number>,
  opts: { responseTime?: number; initial?: number } = {}
): Readonly<Ref<number>> {
  const tau = opts.responseTime ?? 0.25;
  // For critical damping: c² = 4·k·m. Pick m=1, k from desired settling time.
  const m = 1;
  const k = (4 / (tau * tau)) * m;
  const c = 2 * Math.sqrt(k * m);
  return useSpring(target, { stiffness: k, damping: c, mass: m, initial: opts.initial });
}

// --- Vector versions -----------------------------------------------------
// useSpringVec3, usePIDVec3 etc. follow the same pattern componentwise.
// See lib/control-vec.ts.
```

#### 5.5.4 Using the helpers — the three motion examples

**Sliding toggle (visual motion, critically damped):**

```vue
<!-- components/SlidingToggle.vue -->
<script setup lang="ts">
import { ref, computed } from "vue";
import { useCriticalSpring } from "../lib/control";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();

// Target knob position: 0 (left) or 1 (right). The actual position is
// the spring output; CSS reads it via a custom property.
const target = computed(() => (props.modelValue ? 1 : 0));
const knob   = useCriticalSpring(target, { responseTime: 0.18 });
</script>

<template>
  <button
    class="toggle"
    :style="{ '--knob': knob }"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span class="knob" />
  </button>
</template>

<style scoped>
.toggle { width: 48px; height: 24px; border-radius: 12px; position: relative; }
.knob   {
  position: absolute; top: 2px; left: 2px; width: 20px; height: 20px;
  border-radius: 50%; background: white;
  transform: translateX(calc(var(--knob) * 24px));
  /* No CSS transition — the spring drives the position every frame. */
}
</style>
```

**Slider drives a setpoint, parameter follows via PID:**

```vue
<!-- usage in any robotics widget -->
<script setup lang="ts">
import { ref, watch } from "vue";
import { usePID } from "../lib/control";

const setpoint = ref(0);                                   // what the slider writes
const actual   = usePID(setpoint, { Kp: 40, Kd: 6 });      // what the joint follows

watch(actual, (q) => {
  robot?.joints["shoulder_pan_joint"]?.setJointValue(q);
});
</script>

<template>
  <input type="range" min="-3.14" max="3.14" step="0.01" v-model.number="setpoint" />
  <span>setpoint: {{ setpoint.toFixed(2) }} rad</span>
  <span>actual:   {{ actual.value.toFixed(2) }} rad</span>
</template>
```

Reduce `Kd` to make the joint overshoot. Increase `Kp` to make it snappy.
This *is* the lecture content for the day on PID tuning — students drag
the slider and watch the response.

**Camera with mass, moved by force:**

```ts
// inside global-bottom.vue render-loop setup
import { ref } from "vue";
import { useSpringVec3 } from "../lib/control-vec";

const cameraTarget = ref(new THREE.Vector3(3, 2, 3));   // setpoint, set by slide front-matter
const cameraPos    = useSpringVec3(cameraTarget, {      // actual, drives three.js camera
  stiffness: 80,
  damping: 12,
  mass: 1,
});

// in the render loop:
camera.position.copy(cameraPos.value);
```

Setting `damping` low gives a bouncy "swooping" camera. Critical damping
(default) gives a smooth glide. Snap behaviour is `useSpring(target, {
stiffness: 1e6, damping: 1e3 })` or just write `camera.position.copy(target)`
and skip the helper — but then comment why the snap is intentional.

#### 5.5.5 When *not* to use this

Three cases where CSS or a hard binding is correct:

1. **Pure cosmetic effects:** fade in/out of a slide background, a colour
   change on hover, an opacity transition. Use CSS `transition`.
2. **Discrete state changes:** a checkbox checked/unchecked indicator that
   shouldn't have inertia (a tick mark appearing). Conditional render.
3. **Determinism matters:** PDF export, automated screenshots, reproducible
   acceptance tests. The helpers all support a `snap()` method that fast-
   forwards to the target instantly; the PDF build invokes it before render.

In all other cases, default to `lib/control.ts`. If you find yourself
writing `transition: transform 200ms ease-out` on something that represents
a physical or simulated quantity, stop and pick a controller instead.

#### 5.5.6 Tuning guidance for Claude Code

When generating a new component, pick controller parameters from this
starting table and tune from there. Don't invent values from nowhere.

| Motion type | Helper | Starting tune |
|---|---|---|
| UI knob, switch, toggle position | `useCriticalSpring` | `responseTime: 0.18` |
| Camera glide between slides | `useSpringVec3` | `stiffness: 80, damping: 12, mass: 1` |
| Slider → joint angle (snappy realistic) | `usePID` | `Kp: 40, Kd: 6` (Ki: 0) |
| Slider → joint angle (visibly underdamped, for teaching) | `usePID` | `Kp: 60, Kd: 2` |
| Slider → joint angle (overdamped, sluggish) | `usePID` | `Kp: 10, Kd: 8` |
| End-effector target follows cursor | `useSpringVec3` | `stiffness: 200, damping: 28` |
| Plot cursor / readout chasing live value | `useCriticalSpring` | `responseTime: 0.08` |

These are starting points only. Lecture authors should override per slide
when the lecture is *about* the dynamics — e.g. a slide titled "What does
underdamping look like?" sets `Kd: 1` deliberately.

---

## 6. Required widgets (component library scope)

These are the building blocks lectures will compose. Each is a single Vue
component (with internal full/lite split where applicable). All are in
`components/`.

| Component | Purpose | Lite fallback |
|---|---|---|
| `RobotCell` | URDF-loaded robot in a 3D scene with orbit controls. Props: `urdfUrl`, `jointAngles`, `showFrames`. | Pre-rendered turntable WebM, joint sliders still work on low-poly. |
| `JointSliderPanel` | Auto-generates a slider per movable joint from a URDF. Two-way bound to a `jointAngles` ref. | Same (no GPU). |
| `JointAngleGraph` | uPlot line chart of joint angles over time. Props: `data`, `labels`. | Same. |
| `IKDemo` | End-effector target manipulator + IK solve, draws solution path. | Static SVG. |
| `PinholeCamera` | 3D world + image plane projection visualisation. Props: `fx`, `fy`, `cx`, `cy`, `distortion`. | Pre-rendered slider sweep video. |
| `EpipolarDemo` | Two cameras, click a point in image A, draw epipolar line in image B. | Static SVG. |
| `TransformChain` | Visualise a chain of homogeneous transforms (DH parameters). | SVG. |
| `LatexBlock` | Wrapper around KaTeX with click-to-step reveal of equation parts. | Same (text). |
| `ObjectScene` | Generic three.js scene that loads a glTF and lets the user rotate. | Static turntable. |
| `CodeBlock` | Slidev's built-in `<<<` code block (Shiki). | Same. |

Robotics conventions to honour:

- Joint angles in **radians** internally, displayed in degrees if appropriate.
  Always include the unit in the slider label.
- Coordinate frames: **+Z up**, +X forward, +Y left (ROS REP-103). Configure
  three.js camera and grid accordingly. Document this once in
  `lib/three-scene.ts`; do not re-debate per-component.
- URDF poses follow ROS conventions; `urdf-loader` already handles the
  three.js Y-up vs ROS Z-up swap.
- Distances in **metres**.

---

## 7. Lecture authoring (what the slide writer sees)

A lecture is one Markdown file. Slidev parses `---` separators as slide
boundaries. Vue components are imported automatically from `components/`.

```md
---
theme: default
title: Forward Kinematics
---

# Forward kinematics for a 6-DOF arm

We use the Denavit–Hartenberg convention.

---

## DH parameters of the UR5e

<div class="grid grid-cols-2 gap-4">
  <LatexBlock>
    $$ T_{i-1}^i = R_z(\theta_i)\,T_z(d_i)\,T_x(a_i)\,R_x(\alpha_i) $$
  </LatexBlock>
  <RobotCell urdfUrl="/urdf/ur5e/ur5e.urdf" :jointAngles="[0,0,0,0,0,0]" />
</div>

---

## Try it: move each joint

<div class="grid grid-cols-2 gap-4">
  <RobotCell urdfUrl="/urdf/ur5e/ur5e.urdf" :jointAngles="q" />
  <JointSliderPanel urdfUrl="/urdf/ur5e/ur5e.urdf" v-model="q" />
</div>

<script setup lang="ts">
import { ref } from "vue";
const q = ref([0, 0, 0, 0, 0, 0]);
</script>

---

## End-effector trajectory

<JointAngleGraph :data="trajectory" />

<script setup lang="ts">
import { ref, onMounted } from "vue";
const trajectory = ref<number[][]>([[], []]);
onMounted(() => {
  // populate trajectory…
});
</script>
```

Slide authors write Markdown + the occasional `<script setup>`. They don't
write three.js directly except when prototyping a new effect.

---

## 8. Performance and resource discipline

Lectures may have 50+ slides. Memory management is non-optional.

1. **One renderer total.** The shared three.js renderer in `global-bottom.vue`
   is the only `WebGLRenderer` in the deck. Slide-local components that need a
   small inline scene (e.g. a tiny coordinate-frame visualiser) use a separate
   renderer but **must** dispose it in `onBeforeUnmount`.
2. **Geometry caching.** URDFs and glTFs are cached by URL in
   `lib/urdf.ts` / `lib/three-scene.ts`. Reload-on-revisit is forbidden.
3. **Texture limits.** No texture > 2048×2048 in the lite build, > 4096×4096
   in the full build. Build script enforces this.
4. **Physics worlds.** Rapier worlds are created lazily and disposed on slide
   leave unless a `keep-alive` flag is set on the slide.
5. **Animation frames.** Every `requestAnimationFrame` loop must check a
   `disposed` flag and exit; never let an orphaned loop keep running.
6. **Mesh decimation.** STL meshes from `urdf-loader` are often raw CAD
   exports with millions of triangles. The build script optionally runs
   `gltf-transform simplify` and writes decimated copies into
   `public/urdf-lite/` for the lite tier.

---

## 9. Implementation milestones

Each milestone is independently demonstrable and committable. Estimated
half-time-developer effort assuming Claude Code does most of the typing.

### M0 — Project skeleton (1–2 days)

- `npm init`, install Slidev, three.js, TypeScript, vite-plugin-singlefile.
- Create the file layout in §3 with stub files.
- A "hello world" slide deck (`lectures/00-hello/slides.md`) with one
  Markdown slide and one slide containing a spinning three.js cube
  (component: `components/SpinningCube.vue`).
- `npm run dev`, `npm run build:full`, `npm run build:lite`,
  `npm run build:pdf` all produce something.
- **Acceptance:** all three artifacts open offline (full from a folder, lite
  from a single HTML, PDF as a PDF) on a Windows machine without internet.

### M1 — Core three.js wrappers, control helpers, and tier dispatch (3–4 days)

- `lib/three-scene.ts` (createScene, createRenderer, dispose helpers).
- `lib/control.ts` and `lib/control-vec.ts` (`usePID`, `useSpring`,
  `useCriticalSpring`, plus Vec3 versions; see §5.5).
- `setup/control-driver.ts` (single rAF loop driving every controller).
- `setup/build-profile.ts` and the `RobotCell` tier-dispatcher pattern.
- `components/SpinningCube.vue` with full/lite/pdf variants
  (full: live three.js; lite: pre-rendered WebM; pdf: still PNG).
- `components/SlidingToggle.vue` — first end-to-end demo of a control
  helper driving a UI element, per §5.5.4.
- **Acceptance:** the same slide source produces three correct renderings of
  the spinning cube across the three artifacts; the sliding toggle visibly
  springs (not CSS-eases) into place; PDF build calls `snap()` on every
  controller before rendering and produces a static page.

### M2 — URDF + soft-bound sliders + plot (5–7 days)

- `lib/urdf.ts` wrapping `urdf-loader`.
- `components/RobotCell.vue`, `components/JointSliderPanel.vue`,
  `components/JointAngleGraph.vue`. The slider panel **uses `usePID`**
  per joint so dragging fast produces visible overshoot or lag — this is
  not optional, see §0.11 and §5.5.
- A second lecture (`lectures/01-kinematics/slides.md`) with at least:
  - a slide showing the UR5e in default pose,
  - a slide with sliders that move the joints (PID-soft binding visible),
  - a slide titled "PID tuning live" where students see Kp/Kd sliders
    affect the joint response in real time,
  - a slide showing a joint-angle-vs-time plot driven by a recorded motion.
- **Acceptance:** sliders change the arm in real time with visible second-
  order dynamics; PID tuning slide visually demonstrates over/critical/
  under-damped responses; the plot updates smoothly; lite build still runs
  sliders against a low-poly arm.

### M3 — Persistent shared scene + spring-driven camera (5–7 days)

This is the architecturally tricky one.

- `setup/shared-three.ts` (singleton scene), `global-bottom.vue`
  (canvas mount + render loop + slide-state watcher).
- Front-matter `sceneState` parser in `setup/globals.ts`.
- The camera position and lookAt are driven by `useSpringVec3` from
  `lib/control-vec.ts` — the slide's declared pose is the *setpoint*, the
  camera carries inertia. Per-slide overrides for `springStiffness`,
  `springDamping`, and `transition: snap` are honoured (see §5.4).
- A demo slide sequence: full robot cell → zoom into arm (spring-driven
  camera glide, fade non-visible objects) → overlay joint-angle plot.
- **Acceptance:** the camera moves smoothly between slides with the soft,
  inertial feel of a real physical pan/dolly; FPS stays > 30 on the
  classroom PC; the scene is not re-created across slides.

### M4 — Physics (Rapier integration) (3–5 days)

- `lib/physics.ts` wrapping Rapier.
- A `DynamicsDemo` component: a robot arm dropping a payload, with a Rapier
  world running in the slide. World disposed on slide leave.
- **Acceptance:** simulation runs at 60 Hz on classroom PC; reset button
  works; lite build falls back to a recorded clip.

### M5 — IK demo (3–5 days)

- `lib/ik.ts` wrapping `closed-chain-ik-js`.
- `components/IKDemo.vue`: drag a target sphere in 3D, IK solves the joint
  configuration, the arm follows.
- **Acceptance:** target manipulator works with mouse and touch; solver
  converges in < 16 ms per step on classroom PC.

### M6 — Computer vision components (5–7 days)

- `components/PinholeCamera.vue`: configurable fx, fy, cx, cy, distortion;
  shows a 3D scene and the projected image side-by-side.
- `components/EpipolarDemo.vue`: two camera frustums, click to draw epipolar
  lines.
- A `lectures/03-camera-models/slides.md` lecture demonstrating both.
- **Acceptance:** distortion sliders match real lens behaviour
  (k1, k2, p1, p2 OpenCV convention).

### M7 — Authoring polish (ongoing)

- TikZ → SVG batch script (`scripts/tikz-to-svg.mjs`).
- Lecturer-notes pipeline (notes appear on PDF only).
- Hot-key cheatsheet in `README.md`.
- Pre-flight check script that verifies a built deck runs from `file://`
  with no console errors.

Total to "production" (M0–M7): **~6–8 weeks of half-time work**.

---

## 10. Future work (out of scope for v1)

- **Native threepp module for shared C++ kinematics math.** If a separate
  goal arises (writing a robotics math library that's also useful in C++
  desktop tools or ROS 2), expose just the math functions via a small
  Emscripten WASM module that `lib/ik.ts` can call. Keep the renderer in
  three.js. Defer until there is a concrete second consumer.
- **WebGPU renderer.** Three.js's WebGPURenderer is now stable, but for
  classroom hardware WebGL2 is the safe choice. Revisit when WebGPU has
  fewer driver blocklist exclusions.
- **Multi-window presenter view.** Slidev supports it; not in scope for v1
  per the user's preference. Easy to enable later (`slidev` already
  supports `?presenter` URL parameter).
- **Live audience polling.** Could be added as a separate Slidev addon.
  Out of scope.
- **Interactive code execution inside slides.** Slidev supports Monaco; the
  lite build disables it. Could be wired into a Pyodide cell for live Python
  CV demos. Out of scope for v1.

---

## 11. References (offline copies should be archived)

- Slidev guide: <https://sli.dev/guide/>
- Slidev addon authoring: <https://sli.dev/guide/write-addon>
- Slidev global layers: <https://sli.dev/features/global-layers>
- three.js manual: <https://threejs.org/manual/>
- urdf-loader: <https://github.com/gkjohnson/urdf-loaders>
- closed-chain-ik-js: <https://github.com/gkjohnson/closed-chain-ik-js>
- Rapier.js: <https://rapier.rs>
- uPlot: <https://github.com/leeoniya/uPlot>
- vite-plugin-singlefile: <https://github.com/richardtallent/vite-plugin-singlefile>
- KaTeX: <https://katex.org>
- ROS REP-103 (coordinate frames): <https://www.ros.org/reps/rep-0103.html>
- threepp (kept for reference, not used as renderer): <https://github.com/markaren/threepp>

---

## 12. Open questions for the project owner

These should be answered before M3:

1. Should the shared cross-slide scene be **mandatory** (every slide
   participates) or **opt-in** (only slides with `sceneState:` front-matter)?
   Default: opt-in, because slides like a title page don't need 3D.
2. What are the first three lectures to actually deliver? This determines
   which widgets are highest priority and may reorder M2/M5/M6.
3. URDF source: is there a preferred robot for the course (UR5e? Franka?
   Custom lab arm?), and is its URDF + meshes already available locally?
4. Is the classroom PC's GPU known? (Integrated Intel UHD vs discrete NVIDIA
   matters for the lite-tier mesh budget.)
5. Mathematical notation style: ROS / textbook / paper-specific? Affects
   default LaTeX macros in `lib/latex-macros.ts`.
