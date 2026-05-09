---
theme: default
title: Hello, robot slides
info: |
  First deck — milestone M0 of the lecture framework.
  See docs/DESIGN.md.
class: text-center
highlighter: shiki
drawings:
  persist: false
transition: slide-left
mdc: true
# Hash routing is required so the built deck opens from file:// — Vue
# Router's default history mode treats the file path as a route and 404s.
routerMode: hash
# Dark mode: projector-safe (no large white surfaces). Palette and tweaks
# live in lectures/00-hello/style.css and reference "Den rødrutede kokeboka".
colorSchema: dark
---

# Hello, robot slides

Milestone M0 — the framework starts here.

<div class="abs-bl mx-14 my-8 text-sm opacity-50">
  Press <kbd>space</kbd> to advance.
</div>

---
layout: default
---

## Tier dispatch

The same `<SpinningCube />` tag below resolves to a different implementation
depending on `VITE_BUILD_PROFILE`:

- **full** — live three.js, animated.
- **lite** — single still frame from three.js.
- **pdf**  — pure SVG (no canvas).

<div class="cube-frame">
  <SpinningCube />
</div>

<style>
.cube-frame {
  width: 100%;
  height: 360px;
  margin-top: 0.5rem;
  border-radius: 8px;
  overflow: hidden;
}
</style>

---

## Spring-driven toggle

The knob position is the output of a critically-damped spring (response time
0.18 s) — not a CSS transition. Drive the same target back and forth quickly
and the knob still settles smoothly.

<div class="toggle-row">
  <SlidingToggle v-model="on" />
  <span class="state">state: {{ on ? "on" : "off" }}</span>
</div>

<script setup lang="ts">
import { ref } from "vue";
const on = ref(false);
</script>

<style>
.toggle-row {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-top: 2rem;
}
.state {
  font-family: monospace;
  font-size: 1.2rem;
  opacity: 0.8;
}
</style>

---
layout: center
class: text-center
---

## What's next

This deck verifies M0. M1 adds the rest of the control library (`usePID`,
`useSpring`, vec3 versions) wired through the shared driver.

See [docs/DESIGN.md](../../docs/DESIGN.md) §9 for the full milestone plan.
