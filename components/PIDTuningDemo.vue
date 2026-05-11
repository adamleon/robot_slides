<!--
  PIDTuningDemo.vue — live PID tuning over a 3-second response plot.

  Three sliders (setpoint, Kp, Kd) feed straight into usePID. The PID
  helper reads Kp and Kd via unref() each frame, so dragging the gain
  sliders changes the dynamics with no controller reset.

  The plot is a plain inline SVG — two polylines (setpoint dashed,
  actual solid) over a 3-second sliding window. Sample buffer is a
  shift-on-overflow ring built on a reactive array.

  Three preset buttons seed standard tuning regimes (underdamped,
  critical, overdamped) matching the table in DESIGN.md §5.5.6.
-->

<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from "vue";
import { usePID } from "../lib/control";
import { registerController } from "../setup/control-driver";

// --- Refs the user drives ---------------------------------------------------
// Defaults seed the "critical" regime: with m=1 and Kp=40, ω_n = √40 ≈ 6.32
// rad/s, so critical damping needs Kd = 2·√Kp ≈ 12.6.
const setpoint = ref(0);
const Kp = ref(40);
const Kd = ref(12.6);

// usePID reads Kp/Kd via unref() each frame, so the slider refs are live.
const actual = usePID(setpoint, { Kp, Kd });

// --- Sample buffer for the response plot ------------------------------------
const PLOT_WINDOW_SEC = 3;
const PLOT_W = 600;
const PLOT_H = 200;
// value [-Y_RANGE .. +Y_RANGE] maps to y [PLOT_H .. 0]; the 1.5 leaves
// room above the ±1 setpoint extremes so overshoot is visible.
const Y_RANGE = 1.5;

interface Sample {
  t: number;
  sp: number;
  a: number;
}
const samples = ref<Sample[]>([]);
let elapsed = 0;

const stopSampler = registerController((dt) => {
  elapsed += dt;
  samples.value.push({ t: elapsed, sp: setpoint.value, a: actual.value });
  // Drop samples older than the visible window.
  while (
    samples.value.length > 0 &&
    elapsed - samples.value[0].t > PLOT_WINDOW_SEC
  ) {
    samples.value.shift();
  }
});

onBeforeUnmount(() => stopSampler());

// --- Plot point helpers -----------------------------------------------------
function pointsFor(field: "sp" | "a"): string {
  const t0 = elapsed - PLOT_WINDOW_SEC;
  return samples.value
    .map((s) => {
      const x = ((s.t - t0) / PLOT_WINDOW_SEC) * PLOT_W;
      const y = PLOT_H / 2 - (s[field] / Y_RANGE) * (PLOT_H / 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

const setpointPath = computed(() => pointsFor("sp"));
const actualPath = computed(() => pointsFor("a"));

// Pre-compute y of the ±1 reference lines (constant; not reactive).
const yPlus1 = PLOT_H / 2 - (1 / Y_RANGE) * (PLOT_H / 2);
const yMinus1 = PLOT_H / 2 + (1 / Y_RANGE) * (PLOT_H / 2);
const yZero = PLOT_H / 2;

// --- Presets ----------------------------------------------------------------
function applyPreset(kp: number, kd: number): void {
  Kp.value = kp;
  Kd.value = kd;
}
</script>

<template>
  <div class="pid-demo">
    <svg
      :viewBox="`0 0 ${PLOT_W} ${PLOT_H}`"
      preserveAspectRatio="none"
      class="plot"
    >
      <!-- ±1 reference lines (faint, dashed) -->
      <line :x1="0" :y1="yPlus1"  :x2="PLOT_W" :y2="yPlus1"  class="grid-ref" />
      <line :x1="0" :y1="yMinus1" :x2="PLOT_W" :y2="yMinus1" class="grid-ref" />
      <!-- Zero line (more visible) -->
      <line :x1="0" :y1="yZero"   :x2="PLOT_W" :y2="yZero"   class="grid-zero" />
      <!-- Setpoint trace (dashed cream) -->
      <polyline :points="setpointPath" class="trace-setpoint" />
      <!-- Actual trace (solid red) -->
      <polyline :points="actualPath"   class="trace-actual" />
    </svg>

    <div class="controls">
      <div class="slider-row">
        <label>setpoint</label>
        <input
          type="range"
          min="-1"
          max="1"
          step="0.05"
          v-model.number="setpoint"
        />
        <span class="val">{{ setpoint.toFixed(2) }}</span>
      </div>

      <div class="slider-row">
        <label>Kp</label>
        <input
          type="range"
          min="1"
          max="200"
          step="1"
          v-model.number="Kp"
        />
        <span class="val">{{ Kp }}</span>
      </div>

      <div class="slider-row">
        <label>Kd</label>
        <input
          type="range"
          min="0"
          max="30"
          step="0.1"
          v-model.number="Kd"
        />
        <span class="val">{{ Kd.toFixed(1) }}</span>
      </div>

      <!--
        Presets fix Kp=40 (ω_n = √40 ≈ 6.32 rad/s) and vary Kd so the regime
        differences are about damping, not stiffness. Critical damping at
        Kp=40, m=1 needs Kd = 2·√Kp ≈ 12.6.
      -->
      <div class="presets">
        <span class="preset-label">presets:</span>
        <button type="button" @click="applyPreset(40, 3)">underdamped</button>
        <button type="button" @click="applyPreset(40, 12.6)">critical</button>
        <button type="button" @click="applyPreset(40, 22)">overdamped</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pid-demo {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}

.plot {
  width: 100%;
  height: 220px;
  background: var(--cookbook-surface, #261C1F);
  border: 1px solid rgba(242, 96, 96, 0.15);
  border-radius: 6px;
}

.grid-zero {
  stroke: rgba(232, 215, 181, 0.25);
  stroke-width: 1;
}
.grid-ref {
  stroke: rgba(232, 215, 181, 0.08);
  stroke-width: 1;
  stroke-dasharray: 4 4;
}
.trace-setpoint {
  fill: none;
  stroke: rgba(232, 215, 181, 0.55);
  stroke-width: 1.5;
  stroke-dasharray: 6 4;
}
.trace-actual {
  fill: none;
  stroke: var(--cookbook-red, #F26060);
  stroke-width: 2.5;
  stroke-linejoin: round;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-family: monospace;
  font-size: 0.95rem;
}

.slider-row {
  display: grid;
  grid-template-columns: 6em 1fr 4em;
  align-items: center;
  gap: 0.8rem;
}
.slider-row label {
  color: var(--cookbook-text-muted, #9C8C72);
}
.slider-row .val {
  color: var(--cookbook-text-bold, #F4E5C2);
  text-align: right;
}

.slider-row input[type="range"] {
  -webkit-appearance: none;
          appearance: none;
  background: var(--cookbook-surface, #261C1F);
  height: 6px;
  border-radius: 3px;
  outline: none;
}
.slider-row input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
          appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--cookbook-red, #F26060);
  cursor: pointer;
}
.slider-row input[type="range"]::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 50%;
  background: var(--cookbook-red, #F26060);
  cursor: pointer;
}

.presets {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.25rem;
}
.preset-label {
  color: var(--cookbook-text-muted, #9C8C72);
  margin-right: 0.25rem;
}
.presets button {
  padding: 0.3em 0.8em;
  background: transparent;
  color: var(--cookbook-text, #E8D7B5);
  border: 1px solid var(--cookbook-red, #F26060);
  border-radius: 4px;
  cursor: pointer;
  font: inherit;
}
.presets button:hover {
  background: rgba(242, 96, 96, 0.15);
}
</style>
