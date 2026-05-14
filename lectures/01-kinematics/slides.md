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
layout: default
---

## Joint angles over time

<div class="plot-grid">
  <div class="arm-pane">
    <RobotCell :robot="ur5e" :jointAngles="q3" />
    <div class="actions">
      <button type="button" @click="playMotion" :disabled="playing">
        {{ playing ? "playing…" : "play recorded motion" }}
      </button>
    </div>
  </div>
  <div class="graph-pane">
    <JointAngleGraph :jointAngles="q3" :windowSeconds="6" />
  </div>
</div>

<script setup lang="ts">
import { ref } from "vue";
import RobotCell from "../../components/RobotCell.vue";
import JointAngleGraph from "../../components/JointAngleGraph.vue";
import { ur5e } from "../../lib/robots/ur5e";

// Six joints, seeded at zero so the plot has its full series from frame 1.
const q3 = ref<Record<string, number>>({
  shoulder_pan_joint: 0,
  shoulder_lift_joint: 0,
  elbow_joint: 0,
  wrist_1_joint: 0,
  wrist_2_joint: 0,
  wrist_3_joint: 0,
});
const playing = ref(false);

// A short choreography — step through three waypoints, each held briefly.
// The PID-driven arm settles between waypoints (no PID here, just direct
// setpoint assignment) — the JointAngleGraph captures the trace.
const waypoints: Array<{ at: number; q: Record<string, number> }> = [
  { at: 0.0, q: { shoulder_pan_joint: 0,    shoulder_lift_joint: 0,    elbow_joint: 0,    wrist_1_joint: 0,    wrist_2_joint: 0, wrist_3_joint: 0 } },
  { at: 1.0, q: { shoulder_pan_joint: 0.6,  shoulder_lift_joint: -1.2, elbow_joint: 1.2,  wrist_1_joint: -0.6, wrist_2_joint: 0, wrist_3_joint: 0 } },
  { at: 3.0, q: { shoulder_pan_joint: -0.8, shoulder_lift_joint: -0.4, elbow_joint: 0.8,  wrist_1_joint: 0.3,  wrist_2_joint: 0, wrist_3_joint: 0 } },
  { at: 5.0, q: { shoulder_pan_joint: 0,    shoulder_lift_joint: 0,    elbow_joint: 0,    wrist_1_joint: 0,    wrist_2_joint: 0, wrist_3_joint: 0 } },
];

function playMotion() {
  if (playing.value) return;
  playing.value = true;
  const start = performance.now();
  let i = 0;
  const tick = () => {
    const t = (performance.now() - start) / 1000;
    while (i + 1 < waypoints.length && waypoints[i + 1].at <= t) i++;
    if (i + 1 >= waypoints.length) {
      q3.value = { ...waypoints[waypoints.length - 1].q };
      playing.value = false;
      return;
    }
    // Linear interpolation between waypoint i and i+1.
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const u = (t - a.at) / (b.at - a.at);
    const next: Record<string, number> = {};
    for (const k of Object.keys(a.q)) {
      next[k] = a.q[k] + u * (b.q[k] - a.q[k]);
    }
    q3.value = next;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
</script>

<style>
.plot-grid {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 1rem;
  height: 460px;
  margin-top: 0.5rem;
}
.arm-pane {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 0;
}
.arm-pane > :first-child {
  flex: 1 1 auto;
  min-height: 0;
}
.actions {
  display: flex;
  justify-content: center;
}
.actions button {
  padding: 0.4em 1em;
  background: transparent;
  color: var(--cookbook-text, #e8d7b5);
  border: 1px solid var(--cookbook-red, #f26060);
  border-radius: 4px;
  cursor: pointer;
  font: inherit;
  font-family: monospace;
  font-size: 0.9rem;
}
.actions button:hover:not(:disabled) {
  background: rgba(242, 96, 96, 0.15);
}
.actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.graph-pane {
  background: var(--cookbook-surface, #261c1f);
  border: 1px solid rgba(242, 96, 96, 0.15);
  border-radius: 6px;
  padding: 0.5rem;
}
</style>

---
layout: center
class: text-center
---

## End of lecture 01

Forward kinematics, joint sliders with PID dynamics, live PID tuning,
and a recorded-motion plot. Inverse kinematics is M5.
