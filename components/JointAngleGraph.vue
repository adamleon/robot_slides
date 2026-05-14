<!--
  JointAngleGraph.vue — sliding-window plot of joint angles over time.

  Wraps uPlot. Reads the current `jointAngles` dict every animation frame
  (sampled by lib/control's shared rAF driver) and pushes a sample per
  joint into a ring buffer the plot renders. The window slides forward as
  time elapses, so an N-second history is always visible.

  Slide-author usage:

    <JointAngleGraph :joint-angles="q" />

  The component infers the joint set from the keys of the first non-empty
  jointAngles dict it sees and locks them in — meant for steady joint
  rosters (one URDF, six joints) rather than dynamically changing dicts.
-->

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { registerController } from "../setup/control-driver";

const props = withDefaults(
  defineProps<{
    jointAngles: Record<string, number>;
    /** Sliding window length in seconds. Default 5. */
    windowSeconds?: number;
    /** y-axis range (radians). Default [-π, π]. */
    yRange?: [number, number];
  }>(),
  {
    windowSeconds: 5,
    yRange: () => [-Math.PI, Math.PI],
  }
);

const containerEl = ref<HTMLDivElement | null>(null);

// Cookbook-palette-derived stroke colours for up to 6 joints — same as the
// world-axes RGB conventions where they overlap, then warm complementary
// tones for the rest.
const STROKE_COLOURS = [
  "#F26060", // joint 1 — cookbook red
  "#F4A261", // joint 2 — amber
  "#E8D7B5", // joint 3 — cream
  "#5BA38F", // joint 4 — muted teal
  "#9C8C72", // joint 5 — warm grey
  "#F9A8A8", // joint 6 — pink
];

let plot: uPlot | null = null;
let times: number[] = [];
let series: number[][] = [];
let jointNames: string[] = [];
let elapsed = 0;
let stopSampler: (() => void) | null = null;
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (!containerEl.value) return;

  // Wait one tick so jointAngles has its initial keys populated.
  // In practice the parent sets them synchronously; this is a guard.
  jointNames = Object.keys(props.jointAngles);
  if (jointNames.length === 0) {
    // Defer init until first sample comes in.
  }
  series = jointNames.map(() => []);

  const seriesConfig: uPlot.Series[] = jointNames.map((name, i) => ({
    label: name,
    stroke: STROKE_COLOURS[i % STROKE_COLOURS.length],
    width: 1.5,
    points: { show: false },
  }));

  // Fixed plot height. We can't read clientHeight at mount because the
  // ResizeObserver + uPlot then form a feedback loop: each resize lengthens
  // the legend, the container grows, the observer fires, uPlot grows again,
  // and the plot canvas balloons to thousands of px tall. Pinning height
  // breaks the loop; the slide layout reserves enough room above.
  const plotHeight = 360;
  const opts: uPlot.Options = {
    width: containerEl.value.clientWidth,
    height: plotHeight,
    pxAlign: false,
    series: [{ label: "t" }, ...seriesConfig],
    scales: {
      x: {
        time: false,
        range: (_u, _min, _max) =>
          [Math.max(0, elapsed - props.windowSeconds), Math.max(elapsed, 0.001)] as [number, number],
      },
      y: {
        // uPlot passes (self, dataMin, dataMax); we ignore the data extents
        // and force the configured range so the plot is stable on a
        // flat-zero series and on full-amplitude sweeps alike.
        range: () => [props.yRange[0], props.yRange[1]] as [number, number],
      },
    },
    axes: [
      {
        stroke: "#9C8C72",
        grid: { stroke: "rgba(232, 215, 181, 0.08)", width: 1 },
        ticks: { stroke: "rgba(232, 215, 181, 0.2)", width: 1 },
        values: (_u, splits) => splits.map((s) => s.toFixed(1)),
      },
      {
        stroke: "#9C8C72",
        grid: { stroke: "rgba(232, 215, 181, 0.08)", width: 1 },
        ticks: { stroke: "rgba(232, 215, 181, 0.2)", width: 1 },
        values: (_u, splits) => splits.map((s) => s.toFixed(2)),
      },
    ],
    cursor: { show: false },
    legend: { show: true },
  };

  plot = new uPlot(opts, [times, ...series], containerEl.value);

  // Sample every frame via the shared control driver. Sampling rate ≈ 60 Hz.
  stopSampler = registerController((dt) => {
    elapsed += dt;
    times.push(elapsed);
    for (let i = 0; i < jointNames.length; i++) {
      series[i].push(props.jointAngles[jointNames[i]] ?? 0);
    }
    // Drop samples older than the window.
    const cutoff = elapsed - props.windowSeconds;
    while (times.length > 0 && times[0] < cutoff) {
      times.shift();
      for (let i = 0; i < series.length; i++) series[i].shift();
    }
    plot?.setData([times, ...series]);
  });

  // Resize the plot's width when the container changes; height stays pinned
  // (see plotHeight comment above for why height can't track the container).
  resizeObserver = new ResizeObserver(() => {
    if (!plot || !containerEl.value) return;
    plot.setSize({
      width: containerEl.value.clientWidth,
      height: plotHeight,
    });
  });
  resizeObserver.observe(containerEl.value);
});

onBeforeUnmount(() => {
  stopSampler?.();
  resizeObserver?.disconnect();
  plot?.destroy();
  plot = null;
});
</script>

<template>
  <div ref="containerEl" class="plot-container" />
</template>

<style scoped>
.plot-container {
  width: 100%;
  height: 100%;
  min-height: 200px;
}
:deep(.u-legend) {
  color: var(--cookbook-text, #E8D7B5);
  font-size: 0.75rem;
  font-family: monospace;
}
:deep(.u-legend .u-label) {
  color: var(--cookbook-text-muted, #9C8C72);
}
:deep(.u-legend .u-value) {
  color: var(--cookbook-text-bold, #F4E5C2);
}
</style>
