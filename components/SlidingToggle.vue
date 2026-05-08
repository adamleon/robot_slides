<!--
  SlidingToggle.vue — first end-to-end demo of a control helper driving a UI element.

  Props:
    modelValue: boolean — current toggle state (use v-model).

  The knob target is 0 (left) or 1 (right). The actual position is the
  output of a critically-damped spring; CSS reads it via a custom property.
  No CSS transition: the spring drives every frame via control-driver.

  See docs/DESIGN.md §5.5.4.
-->

<script setup lang="ts">
import { computed } from "vue";
import { useCriticalSpring } from "../lib/control";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();

const target = computed(() => (props.modelValue ? 1 : 0));
const knob = useCriticalSpring(target, { responseTime: 0.18 });
</script>

<template>
  <button
    class="toggle"
    :class="{ on: modelValue }"
    :style="{ '--knob': knob }"
    @click="emit('update:modelValue', !modelValue)"
    type="button"
    :aria-pressed="modelValue"
  >
    <span class="knob" />
  </button>
</template>

<style scoped>
.toggle {
  width: 60px;
  height: 32px;
  border-radius: 16px;
  position: relative;
  border: none;
  cursor: pointer;
  background: #444;
  padding: 0;
  /* Background colour is the only thing CSS animates — purely cosmetic. */
  transition: background-color 200ms ease;
}
.toggle.on {
  background: #4488ff;
}
.knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: white;
  /* Spring drives this every frame — no CSS transition on transform. */
  transform: translateX(calc(var(--knob, 0) * 28px));
}
</style>
