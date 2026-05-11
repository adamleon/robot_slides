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
layout: center
class: text-center
---

## More on the way

Joint sliders with PID-soft binding, live PID tuning against the arm,
and a joint-angle plot are the next three slides in this lecture.
