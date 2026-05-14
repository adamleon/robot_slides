---
theme: default
title: Persistent shared scene
info: |
  Lecture 02 — one three.js scene lives across every slide; the camera
  is driven by a spring controller toward each slide's declared pose.
  See docs/DESIGN.md §5.4.
class: text-center
highlighter: shiki
drawings:
  persist: false
transition: slide-left
mdc: true
routerMode: hash
colorSchema: dark
---

# Persistent shared scene

The same robot. The camera does the moving.

---
sceneState:
  camera:
    position: [3.0, 3.0, 2.0]
    lookAt: [0, 0, 0.4]
---

## The full cell

A workstation-distance view. The camera sits far enough back that the whole
arm fits comfortably in frame.

---
sceneState:
  camera:
    position: [0.8, 0.6, 0.6]
    lookAt: [0, 0, 0.4]
---

## Zooming in on the arm

The camera glides toward the manipulator under a mass-spring controller —
no scene reload, just a smoothly-interpolated viewpoint. Notice the soft
follow-through at the end.

---
sceneState:
  camera:
    position: [0.4, -1.2, 0.4]
    lookAt: [0, 0, 0.3]
  springStiffness: 200
  springDamping: 28
---

## Side-on, tighter spring

Same mechanism, retuned. `springStiffness: 200` and `springDamping: 28`
give the camera a snappier, near-critically-damped response. Same
controller as `lib/control-vec.ts:useSpringVec3` — just different gains.

---
sceneState:
  camera:
    position: [0.4, 0.4, 2.0]
    lookAt: [0, 0, 0.4]
  transition: snap
---

## Bird's eye, snapped

`transition: snap` skips the interpolation entirely — the camera jumps to
the new pose with no easing. Useful when the audience shouldn't wait for
the pan, or when consecutive slides intentionally cut.

---
layout: center
class: text-center
---

## End of lecture 02

A persistent scene + a spring-driven camera is the minimum the framework
needs for cinematic slide transitions. Visibility toggles and overlay
components are the next layer.
