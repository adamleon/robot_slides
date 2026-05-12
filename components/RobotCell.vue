<!--
  RobotCell.vue — tier-dispatcher for a URDF-loaded robot in a 3D scene.

  Slide authors write <RobotCell :robot="ur5e" :jointAngles="..." /> once.
  The build profile picks the live, lite, or static variant. See
  docs/DESIGN.md §2.2 for the dispatch pattern and §6 for the component
  contract.

  Props (forwarded to whichever variant runs):
    robot       BundledRobot from lib/robots/<name>/index.ts. URDF + meshes
                are imported as text at build time so the deck renders from
                file:// without a server (see lib/urdf.ts).
    jointAngles Optional dict of {joint-name: radians} updates.
    showFrames  Optional toggle (full only) — draws joint frame axes.
-->

<script setup lang="ts">
import { BUILD_PROFILE } from "../setup/build-profile";
import type { BundledRobot } from "../lib/urdf";
import RobotCellFull from "./internal/RobotCellFull.vue";
import RobotCellLite from "./internal/RobotCellLite.vue";
import RobotCellStatic from "./internal/RobotCellStatic.vue";

defineProps<{
  robot: BundledRobot;
  jointAngles?: Record<string, number>;
  showFrames?: boolean;
}>();
</script>

<template>
  <RobotCellFull
    v-if="BUILD_PROFILE === 'full'"
    :robot="robot"
    :jointAngles="jointAngles"
    :showFrames="showFrames"
  />
  <RobotCellLite
    v-else-if="BUILD_PROFILE === 'lite'"
    :robot="robot"
    :jointAngles="jointAngles"
  />
  <RobotCellStatic v-else />
</template>
