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
layout: center
class: text-center
---

## More on the way

Live PID tuning against the arm and a joint-angle plot are the next
two slides in this lecture.
