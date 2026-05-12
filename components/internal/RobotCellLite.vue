<!--
  RobotCellLite.vue — live render for the single-file (lite) build.

  Identical render path to RobotCellFull. The lite tier already inlines
  the URDF + mesh strings into the JS bundle (via lib/robots/<name>/),
  so the heavy work is the same; reusing the live component means
  archive-share decks keep working orbit controls and joint sliders.

  A future iteration may swap in decimated meshes (public/urdf-lite/ or
  lib/robots/<name>/meshes/visual-lite/) and drop OrbitControls to
  shrink the inlined HTML; for that we'd diverge this file. Until then
  this is a pure passthrough.
-->

<script setup lang="ts">
import RobotCellFull from "./RobotCellFull.vue";
import type { BundledRobot } from "../../lib/urdf";

const props = defineProps<{
  robot: BundledRobot;
  jointAngles?: Record<string, number>;
}>();
</script>

<template>
  <RobotCellFull :robot="props.robot" :jointAngles="props.jointAngles" />
</template>
