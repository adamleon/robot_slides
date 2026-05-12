<!--
  JointSliderPanel.vue — one slider per movable joint of a URDF, with each
  slider bound to a PID controller so dragging shows the second-order
  dynamics DESIGN.md §0.11 requires (drag fast → overshoot or lag).

  Usage:

    <JointSliderPanel :robot="ur5e" v-model:jointAngles="q" />
    <RobotCell        :robot="ur5e" :jointAngles="q" />

  The panel reads the URDF for joint names, types, and position limits
  via parseJointInfo (no mesh decoding). For each revolute / continuous
  / prismatic joint it owns:
    - a setpoint ref the slider writes into;
    - a usePID actual ref the setpoint flows through.
  The emitted update:jointAngles dict carries the *actual* values so the
  arm follows the smoothed motion, not the raw slider position.

  Defaults to mildly underdamped (Kp=40, Kd=8, ζ≈0.63) — fast enough to
  feel responsive, slow enough to show overshoot when dragged sharply.
  Both gains accept MaybeRef<number> so a parent slide (e.g. the live
  PID-tuning slide) can re-tune the dynamics in real time.
-->

<script setup lang="ts">
import { ref, watch, computed, type Ref } from "vue";
import { usePID } from "../lib/control";
import { parseJointInfo, type BundledRobot } from "../lib/urdf";

type Tunable = number | Ref<number>;

const props = withDefaults(
  defineProps<{
    robot: BundledRobot;
    Kp?: Tunable;
    Kd?: Tunable;
  }>(),
  { Kp: 40, Kd: 8 }
);

const emit = defineEmits<{
  "update:jointAngles": [angles: Record<string, number>];
}>();

// One URDFRobot, joints only — no meshes parsed here.
const parsed = parseJointInfo(props.robot);

interface Row {
  name: string;
  lower: number;
  upper: number;
  setpoint: Ref<number>;
  actual: Readonly<Ref<number>>;
}

const rows: Row[] = [];
for (const name in parsed.joints) {
  const j = parsed.joints[name];
  if (
    j.jointType !== "revolute" &&
    j.jointType !== "continuous" &&
    j.jointType !== "prismatic"
  ) {
    continue;
  }
  const setpoint = ref(0);
  const actual = usePID(setpoint, { Kp: props.Kp, Kd: props.Kd });
  rows.push({
    name,
    // Continuous joints have no URDF limits; clamp the slider range to ±π
    // so the user can still drive them.
    lower: j.jointType === "continuous" ? -Math.PI : j.limit.lower,
    upper: j.jointType === "continuous" ? Math.PI : j.limit.upper,
    setpoint,
    actual,
  });
}

// A computed dict of {name: actual} re-evaluates whenever any actual
// changes; the watcher then fires update:jointAngles. The parent's ref
// gets a fresh object each frame the PID is converging.
const allAngles = computed(() => {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.name] = r.actual.value;
  return out;
});

watch(allAngles, (v) => emit("update:jointAngles", v), { immediate: true });
</script>

<template>
  <div class="slider-panel">
    <div v-for="row in rows" :key="row.name" class="slider-row">
      <label :title="row.name">{{ row.name }}</label>
      <input
        type="range"
        :min="row.lower"
        :max="row.upper"
        step="0.01"
        v-model.number="row.setpoint.value"
      />
      <span class="val">{{ row.actual.value.toFixed(2) }}</span>
    </div>
  </div>
</template>

<style scoped>
.slider-panel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-family: monospace;
  font-size: 0.85rem;
  padding: 0.5rem;
  background: var(--cookbook-surface, #261c1f);
  border: 1px solid rgba(242, 96, 96, 0.15);
  border-radius: 6px;
}

.slider-row {
  display: grid;
  grid-template-columns: 9.5em 1fr 3.5em;
  align-items: center;
  gap: 0.6rem;
}
.slider-row label {
  color: var(--cookbook-text-muted, #9c8c72);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.slider-row .val {
  color: var(--cookbook-text-bold, #f4e5c2);
  text-align: right;
}

.slider-row input[type="range"] {
  -webkit-appearance: none;
          appearance: none;
  background: rgba(232, 215, 181, 0.08);
  height: 5px;
  border-radius: 3px;
  outline: none;
}
.slider-row input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
          appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--cookbook-red, #f26060);
  cursor: pointer;
}
.slider-row input[type="range"]::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border: none;
  border-radius: 50%;
  background: var(--cookbook-red, #f26060);
  cursor: pointer;
}
</style>
