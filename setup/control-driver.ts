// setup/control-driver.ts
//
// One requestAnimationFrame loop drives every active controller in the deck.
// Components register a step function via registerController(); the driver
// owns the rAF call and feeds each step the real wall-clock dt.
//
// Why a single shared loop rather than one rAF per controller:
//   - Cheaper: browser only schedules one frame callback regardless of slider count.
//   - Tab-hidden pause behaviour is automatic (browser pauses rAF).
//   - dt comes from a single clock so all controllers stay in sync.
//
// PDF builds call snapAll() before render so every controller jumps to its
// target instantly (no inertia in static output).
//
// See docs/DESIGN.md §5.5.2.

export type ControllerStep = (dt: number) => void;

interface Registered {
  step: ControllerStep;
  snap?: () => void;
}

const controllers: Registered[] = [];
let lastTime: number | null = null;
let rafId: number | null = null;
let started = false;

function tick(now: number): void {
  if (lastTime === null) {
    lastTime = now;
  }
  // Convert ms → s; clamp dt so a long tab-hidden pause doesn't explode integrals.
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  for (let i = 0; i < controllers.length; i++) {
    controllers[i].step(dt);
  }

  rafId = requestAnimationFrame(tick);
}

function start(): void {
  if (started) return;
  started = true;
  // Lazy-start: only begin rAF when the first controller registers.
  // This avoids a pointless empty loop on slides with no controllers.
  if (typeof window !== "undefined") {
    rafId = requestAnimationFrame(tick);
  }
}

/**
 * Register a controller step. Called once per animation frame with dt (seconds).
 *
 * Optional snap: a function that fast-forwards the controller to its target.
 * Used by the PDF build before render so static output reflects converged state.
 */
export function registerController(
  step: ControllerStep,
  snap?: () => void
): () => void {
  const entry: Registered = { step, snap };
  controllers.push(entry);
  start();
  return () => {
    const i = controllers.indexOf(entry);
    if (i >= 0) controllers.splice(i, 1);
  };
}

/**
 * Fast-forward every registered controller to its target. Used by the PDF
 * build pipeline before invoking the renderer — see scripts/build-pdf.mjs.
 */
export function snapAll(): void {
  for (const c of controllers) {
    c.snap?.();
  }
}

/**
 * Stop the shared loop. Mainly useful in tests; production never calls this.
 */
export function stopDriver(): void {
  if (rafId !== null && typeof window !== "undefined") {
    cancelAnimationFrame(rafId);
  }
  rafId = null;
  lastTime = null;
  started = false;
}
