---
theme: default
title: Forward kinematics
info: |
  Lecture 01 — forward kinematics of a 6-DOF arm.
  See docs/DESIGN.md.
class: text-center
highlighter: shiki
drawings:
  persist: false
transition: slide-left
mdc: true
routerMode: hash
colorSchema: dark
---

# Forward kinematics

A 6-DOF arm in motion.

---
layout: default
---

## The UR5e in its default pose

<div class="robot-frame">
  <RobotCell :robot="ur5e" />
</div>

Click and drag to orbit the camera. The world frame at the base shows
+X (red), +Y (green), +Z (blue).

<script setup lang="ts">
// unplugin-vue-components occasionally misses auto-import inside slides that
// have a script-setup block — being explicit here is safer.
import RobotCell from "../../components/RobotCell.vue";
import { ur5e } from "../../lib/robots/ur5e";
</script>

<style>
.robot-frame {
  width: 100%;
  height: 420px;
  margin-top: 0.5rem;
  border-radius: 8px;
  overflow: hidden;
}
</style>

---
layout: default
---

## Move the joints

<div class="kinematics-grid">
  <RobotCell :robot="ur5e" :jointAngles="q" />
  <JointSliderPanel :robot="ur5e" @update:jointAngles="q = $event" />
</div>

<p class="hint">
  Drag a slider quickly — the joint follows with the same second-order
  dynamics from the previous lecture's PID demo (defaults Kp=40, Kd=8,
  ζ ≈ 0.63 — visibly underdamped).
</p>

<script setup lang="ts">
import { ref } from "vue";
import RobotCell from "../../components/RobotCell.vue";
import JointSliderPanel from "../../components/JointSliderPanel.vue";
import { ur5e } from "../../lib/robots/ur5e";

const q = ref<Record<string, number>>({});
</script>

<style>
.kinematics-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 1rem;
  height: 440px;
  margin-top: 0.5rem;
}
.hint {
  margin-top: 0.5rem;
  text-align: center;
  font-size: 0.85rem;
  color: var(--cookbook-text-muted);
  font-style: italic;
}
</style>

---
layout: default
---

## PID tuning, live — against the arm

Same controller as the previous lecture, now driving every joint. Pick
a preset, then drag a slider quickly to see the regime in geometry.

<div class="kinematics-grid">
  <RobotCell :robot="ur5e" :jointAngles="q2" />
  <div class="tuning-stack">
    <JointSliderPanel :robot="ur5e" :Kp="Kp" :Kd="Kd" @update:jointAngles="q2 = $event" />
    <div class="gains-row">
      <label>Kp</label>
      <input type="range" min="1" max="200" step="1" v-model.number="Kp" />
      <span class="val">{{ Kp }}</span>
    </div>
    <div class="gains-row">
      <label>Kd</label>
      <input type="range" min="0" max="30" step="0.1" v-model.number="Kd" />
      <span class="val">{{ Kd.toFixed(1) }}</span>
    </div>
    <div class="presets">
      <span class="preset-label">presets:</span>
      <button type="button" @click="Kp = 40; Kd = 3">underdamped</button>
      <button type="button" @click="Kp = 40; Kd = 12.6">critical</button>
      <button type="button" @click="Kp = 40; Kd = 22">overdamped</button>
    </div>
  </div>
</div>

<script setup lang="ts">
import { ref } from "vue";
import RobotCell from "../../components/RobotCell.vue";
import JointSliderPanel from "../../components/JointSliderPanel.vue";
import { ur5e } from "../../lib/robots/ur5e";

const Kp = ref(40);
const Kd = ref(8);
const q2 = ref<Record<string, number>>({});
</script>

<style>
/* Slidev scopes per-slide styles, so slide 3's .kinematics-grid rule
   doesn't reach us — redeclare here. */
.kinematics-grid {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 1rem;
  height: 440px;
  margin-top: 0.5rem;
}
.tuning-stack {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.gains-row {
  display: grid;
  grid-template-columns: 4em 1fr 3.5em;
  align-items: center;
  gap: 0.6rem;
  font-family: monospace;
  font-size: 0.85rem;
}
.gains-row label {
  color: var(--cookbook-text-muted, #9c8c72);
}
.gains-row .val {
  color: var(--cookbook-text-bold, #f4e5c2);
  text-align: right;
}
.gains-row input[type="range"] {
  -webkit-appearance: none;
          appearance: none;
  background: rgba(232, 215, 181, 0.08);
  height: 5px;
  border-radius: 3px;
  outline: none;
}
.gains-row input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
          appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--cookbook-red, #f26060);
  cursor: pointer;
}
.gains-row input[type="range"]::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border: none;
  border-radius: 50%;
  background: var(--cookbook-red, #f26060);
  cursor: pointer;
}
.presets {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  font-family: monospace;
  font-size: 0.85rem;
  margin-top: 0.2rem;
}
.preset-label {
  color: var(--cookbook-text-muted, #9c8c72);
  margin-right: 0.2rem;
}
.presets button {
  padding: 0.25em 0.7em;
  background: transparent;
  color: var(--cookbook-text, #e8d7b5);
  border: 1px solid var(--cookbook-red, #f26060);
  border-radius: 4px;
  cursor: pointer;
  font: inherit;
}
.presets button:hover {
  background: rgba(242, 96, 96, 0.15);
}
</style>

---
layout: center
class: text-center
---

## More on the way

A joint-angle plot driven by a recorded motion is the next slide.
