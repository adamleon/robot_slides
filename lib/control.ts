// lib/control.ts
//
// Control-theoretic motion primitives. Every animated parameter in the deck
// flows through one of these. See docs/DESIGN.md §0.11 and §5.5.
//
// Three primitives:
//   usePID            — classic PID with virtual mass; can overshoot/lag
//                       (the helper used to teach PID tuning live).
//   useSpring         — mass-spring-damper; cleaner default for visual motion.
//   useCriticalSpring — convenience for "no overshoot, settle in τ seconds".
//
// All three return a Readonly<Ref<number>> that converges toward the target.
// State is kept in closures so two controllers never share state.
//
// Each controller registers a step with setup/control-driver.ts and gets
// called once per animation frame with the real dt.

import { ref, unref, type Ref, type MaybeRef } from "vue";
import { registerController } from "../setup/control-driver";

// All gain/tuning parameters accept either a plain number (static gain) or a
// Ref<number> (live-tunable — value is re-read each frame). The PID-tuning
// slide drives Kp and Kd from slider refs; existing call sites that pass
// plain numbers still work because unref() is a no-op for non-refs.

// --- PID ---------------------------------------------------------------------

export interface PIDOptions {
  /** Proportional gain. */
  Kp: MaybeRef<number>;
  /** Integral gain (default 0). */
  Ki?: MaybeRef<number>;
  /** Derivative gain (default 0). */
  Kd?: MaybeRef<number>;
  /** Virtual mass (default 1). */
  mass?: MaybeRef<number>;
  /** Initial value of the controlled variable (default = setpoint at register time). */
  initial?: number;
  /** Anti-windup limit on the integral term (default Infinity). */
  integralClamp?: MaybeRef<number>;
}

/**
 * usePID — drive a value toward a setpoint via a PID controller.
 *
 * setpoint: ref the slider (or another controller) writes to.
 * opts:     PID gains and virtual mass.
 *
 * Returns a read-only ref carrying the controlled value. Subscribe to it
 * (watch, computed, template binding) to drive a joint, plot, or DOM style.
 */
export function usePID(
  setpoint: Ref<number>,
  opts: PIDOptions
): Readonly<Ref<number>> {
  const actual = ref(opts.initial ?? setpoint.value);
  let velocity = 0;
  let integral = 0;

  registerController(
    (dt) => {
      // Read tunables each frame; unref() handles both Ref and plain number.
      const Kp = unref(opts.Kp);
      const Ki = unref(opts.Ki) ?? 0;
      const Kd = unref(opts.Kd) ?? 0;
      const mass = unref(opts.mass) ?? 1;
      const clamp = unref(opts.integralClamp) ?? Infinity;

      const error = setpoint.value - actual.value;
      integral += error * dt;
      if (integral > clamp) integral = clamp;
      if (integral < -clamp) integral = -clamp;
      // Derivative-on-measurement: damp the actual's velocity rather than
      // the error's rate. Avoids "derivative kick" — a jump in setpoint
      // (which happens every frame the user drags a slider) would otherwise
      // spike d(error)/dt and inject a force impulse. With this form, the
      // step response is a clean 2nd-order mass-spring-damper:
      //   m·x_ddot + Kd·x_dot + Kp·x = Kp·setpoint
      const force = Kp * error + Ki * integral - Kd * velocity;
      const acceleration = force / mass;
      velocity += acceleration * dt;
      actual.value += velocity * dt;
    },
    () => {
      // PDF/snap path: jump to setpoint, zero out internal state.
      actual.value = setpoint.value;
      velocity = 0;
      integral = 0;
    }
  );

  return actual;
}

// --- Mass-spring-damper ------------------------------------------------------

export interface SpringOptions {
  /** Spring constant k (default 100). */
  stiffness?: MaybeRef<number>;
  /** Damping coefficient c (default 20 → roughly critically damped at m=1). */
  damping?: MaybeRef<number>;
  /** Mass m (default 1). */
  mass?: MaybeRef<number>;
  /** Initial value of the controlled variable (default = target at register time). */
  initial?: number;
}

/**
 * useSpring — drive a value toward a target via a mass-spring-damper.
 *
 * Simpler than PID, no integral term. Good default for visual motion (camera
 * glides, knob positions, anything that should "feel" inertial).
 */
export function useSpring(
  target: Ref<number>,
  opts: SpringOptions = {}
): Readonly<Ref<number>> {
  const actual = ref(opts.initial ?? target.value);
  let velocity = 0;

  registerController(
    (dt) => {
      const k = unref(opts.stiffness) ?? 100;
      const c = unref(opts.damping) ?? 20;
      const m = unref(opts.mass) ?? 1;

      const displacement = actual.value - target.value;
      const springForce = -k * displacement;
      const dampingForce = -c * velocity;
      const acceleration = (springForce + dampingForce) / m;
      velocity += acceleration * dt;
      actual.value += velocity * dt;
    },
    () => {
      actual.value = target.value;
      velocity = 0;
    }
  );

  return actual;
}

// --- Critically-damped spring ------------------------------------------------

/**
 * useCriticalSpring — "settle to target in roughly responseTime seconds, no overshoot".
 *
 * Picks stiffness and damping for critical damping at the requested response
 * time. Use for UI elements where overshoot would look like a bug.
 */
export function useCriticalSpring(
  target: Ref<number>,
  opts: { responseTime?: number; initial?: number } = {}
): Readonly<Ref<number>> {
  const tau = opts.responseTime ?? 0.25;
  // Critical damping condition: c² = 4·k·m. Pick m=1.
  // Settling time ~= 4/(ω_n) for critical damping; ω_n = sqrt(k/m).
  // Solving for k given desired tau: k = (4/tau)² / m.
  const m = 1;
  const k = (4 / tau) * (4 / tau) * m;
  const c = 2 * Math.sqrt(k * m);
  return useSpring(target, {
    stiffness: k,
    damping: c,
    mass: m,
    initial: opts.initial,
  });
}
