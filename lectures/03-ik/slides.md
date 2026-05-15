---
theme: default
title: Inverse kinematics
info: |
  Lecture 03 — closed-chain IK on the UR5e. Drag the target, the arm
  follows. See docs/DESIGN.md §9 M5.
class: text-center
highlighter: shiki
drawings:
  persist: false
transition: slide-left
mdc: true
routerMode: hash
colorSchema: dark
---

# Inverse kinematics

The arm follows the target — every frame.

---
layout: default
---

## Drag the target, watch the arm

<div class="ik-frame">
  <IKDemo :robot="ur5e" />
</div>

The red sphere is the IK goal. Closed-chain IK from
[`closed-chain-ik`](https://github.com/gkjohnson/closed-chain-ik-js) runs
five Jacobian-pseudoinverse iterations per frame and writes the resulting
joint angles back onto the URDF — the same `URDFRobot` we used for
forward kinematics in lecture 01.

<script setup lang="ts">
import IKDemo from "../../components/IKDemo.vue";
import { ur5e } from "../../lib/robots/ur5e";
</script>

<style>
.ik-frame {
  width: 100%;
  height: 460px;
  margin-top: 0.5rem;
  border-radius: 8px;
  overflow: hidden;
}
</style>

---
layout: center
class: text-center
---

## End of lecture 03

Position-only goal here — 3 constraint DoFs against the 6 joint DoFs leaves
3 of redundancy, which the damped-least-squares solver picks a smooth
path through. Adding orientation constraints (`Goal.setGoalDoF(DOF.X,
DOF.Y, DOF.Z, DOF.EX, DOF.EY, DOF.EZ)`) determines the system fully.
