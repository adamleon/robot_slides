// lib/control-vec.ts
//
// Vec3 versions of the helpers in lib/control.ts. Same dynamics, applied
// componentwise. Used for camera position, end-effector targets, and
// anything else with x/y/z structure. See docs/DESIGN.md §5.5.

import { ref, unref, type Ref } from "vue";
import * as THREE from "three";
import { registerController } from "../setup/control-driver";
import type { PIDOptions, SpringOptions } from "./control";

// Gain/tuning options inherit MaybeRef<number> typing from ./control, so we
// re-read them via unref() each frame. Plain-number callers still work.

// --- Spring (Vec3) -----------------------------------------------------------

/**
 * useSpringVec3 — Vec3 mass-spring-damper toward a target Vector3.
 *
 * The target ref's Vector3 is read every frame, so callers can mutate it in
 * place (target.value.set(x, y, z)) or replace it (target.value = new ...).
 *
 * Returns a ref whose Vector3 value is updated in place each frame.
 */
export function useSpringVec3(
  target: Ref<THREE.Vector3>,
  opts: SpringOptions = {}
): Readonly<Ref<THREE.Vector3>> {
  const actual = ref(target.value.clone());
  const velocity = new THREE.Vector3();
  const tmpDisp = new THREE.Vector3();
  const tmpForce = new THREE.Vector3();
  let lastSnapKey = unref(opts.snapKey) ?? 0;

  registerController(
    (dt) => {
      // Snap path — see opts.snapKey docstring in lib/control.ts. We check
      // FIRST so callers can race a target update + snap in the same frame
      // and the snap reads the just-updated target.
      const currentSnapKey = unref(opts.snapKey) ?? 0;
      if (currentSnapKey !== lastSnapKey) {
        lastSnapKey = currentSnapKey;
        actual.value.copy(target.value);
        velocity.set(0, 0, 0);
        return;
      }

      const k = unref(opts.stiffness) ?? 100;
      const c = unref(opts.damping) ?? 20;
      const m = unref(opts.mass) ?? 1;

      tmpDisp.copy(actual.value).sub(target.value);
      // F = -k·x − c·v
      tmpForce.copy(tmpDisp).multiplyScalar(-k);
      tmpForce.addScaledVector(velocity, -c);
      // a = F/m, v += a·dt, x += v·dt
      velocity.addScaledVector(tmpForce, dt / m);
      actual.value.addScaledVector(velocity, dt);
    },
    () => {
      actual.value.copy(target.value);
      velocity.set(0, 0, 0);
    }
  );

  return actual;
}

/**
 * useCriticalSpringVec3 — Vec3 critically-damped spring with given response time.
 */
export function useCriticalSpringVec3(
  target: Ref<THREE.Vector3>,
  opts: { responseTime?: number } = {}
): Readonly<Ref<THREE.Vector3>> {
  const tau = opts.responseTime ?? 0.25;
  const m = 1;
  const k = (4 / tau) * (4 / tau) * m;
  const c = 2 * Math.sqrt(k * m);
  return useSpringVec3(target, { stiffness: k, damping: c, mass: m });
}

// --- PID (Vec3) --------------------------------------------------------------

/**
 * usePIDVec3 — Vec3 PID controller. Applies the same gains independently per axis.
 */
export function usePIDVec3(
  setpoint: Ref<THREE.Vector3>,
  opts: PIDOptions
): Readonly<Ref<THREE.Vector3>> {
  const actual = ref(setpoint.value.clone());
  const velocity = new THREE.Vector3();
  const integral = new THREE.Vector3();

  const error = new THREE.Vector3();
  const force = new THREE.Vector3();

  registerController(
    (dt) => {
      const Kp = unref(opts.Kp);
      const Ki = unref(opts.Ki) ?? 0;
      const Kd = unref(opts.Kd) ?? 0;
      const mass = unref(opts.mass) ?? 1;
      const clamp = unref(opts.integralClamp) ?? Infinity;

      error.copy(setpoint.value).sub(actual.value);
      integral.addScaledVector(error, dt);
      // Componentwise integral clamp.
      if (integral.x > clamp) integral.x = clamp;
      if (integral.x < -clamp) integral.x = -clamp;
      if (integral.y > clamp) integral.y = clamp;
      if (integral.y < -clamp) integral.y = -clamp;
      if (integral.z > clamp) integral.z = clamp;
      if (integral.z < -clamp) integral.z = -clamp;

      // Derivative-on-measurement (see lib/control.ts usePID for the why).
      force.set(0, 0, 0);
      force.addScaledVector(error, Kp);
      force.addScaledVector(integral, Ki);
      force.addScaledVector(velocity, -Kd);

      velocity.addScaledVector(force, dt / mass);
      actual.value.addScaledVector(velocity, dt);
    },
    () => {
      actual.value.copy(setpoint.value);
      velocity.set(0, 0, 0);
      integral.set(0, 0, 0);
    }
  );

  return actual;
}
