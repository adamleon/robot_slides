// lib/ik.ts
//
// Wrapper around closed-chain-ik (gkjohnson) for our URDF robots.
// Build the IK tree once from a URDFRobot, attach a single position-only
// goal at a named end-effector link, and expose a small handle the caller
// uses each frame:
//   ik.setGoal(pos)  → write the user-driven target position
//   ik.solve()       → run one solver step + copy joint angles back onto
//                      the URDFRobot, which the renderer is showing
//
// The library has no TypeScript types so we use a few `any` casts at the
// boundary; the public IKHandle stays Vector3-typed for callers.
//
// See DESIGN.md §9 M5.

// closed-chain-ik ships no TypeScript types. Its package index re-exports
// IKRootsHelper, whose source imports removed three.js exports (Box/
// Cylinder/SphereBufferGeometry) — we work around that with a Vite resolve
// alias (see vite.config.ts) that swaps the broken file for an empty stub.
// With that alias in place, package-root imports work in dev and build.
// @ts-expect-error
import {
  Solver,
  Goal,
  DOF,
  urdfRobotToIKRoot,
  setUrdfFromIK,
  setIKFromUrdf,
} from "closed-chain-ik";
import type { URDFRobot } from "urdf-loader";
import * as THREE from "three";

export interface IKHandle {
  /** Set the goal's world-space target. Typically called every frame from
   *  the user-driven gizmo's position. */
  setGoal: (pos: THREE.Vector3) => void;
  /** Run one solver step and copy joint values back onto the URDFRobot.
   *  Cheap enough to call every frame at 60 fps for a 6-DOF arm. */
  solve: () => void;
  /** Read the current end-effector world position (useful for seeding the
   *  target gizmo on initial mount so it lines up with the arm). */
  getEndEffectorPosition: (target: THREE.Vector3) => void;
}

/**
 * Build an IK solver for `urdfRobot` with a position-only goal at the link
 * named `endEffectorLinkName`.
 *
 * For fixed-base robots (like the UR5e on a table), the world root joint
 * that urdfRobotToIKRoot creates is cleared of all 6 DoF so the solver
 * doesn't translate or rotate the whole arm to satisfy the goal.
 */
export function createIKForRobot(
  urdfRobot: URDFRobot,
  endEffectorLinkName: string
): IKHandle {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  // urdfRobotToIKRoot reads each URDFJoint's *current* `.quaternion` as
  // the outer joint's origin. urdf-loader bakes setJointValue's rotation
  // INTO that quaternion (premultiplying axisAngleQuat onto origQuaternion),
  // so a URDF that the caller has already posed would seed the IK tree with
  // the seeded rotation baked into the joint origins; setIKFromUrdf would
  // then write the same angle into the inner DoF and double-count the
  // rotation — IK FK and URDF FK end up disagreeing. Save the current pose,
  // zero the URDF for the duration of the build, then restore + sync.
  const savedAngles: Record<string, number> = {};
  for (const name in urdfRobot.joints) {
    const j = urdfRobot.joints[name];
    if (j.jointType === "revolute" || j.jointType === "continuous" || j.jointType === "prismatic") {
      savedAngles[name] = j.angle as number;
      j.setJointValue(0);
    }
  }
  urdfRobot.updateMatrixWorld(true);

  // trimUnused: false — the helper otherwise prunes leaf links that have
  // no downstream non-fixed joints (e.g. the UR5e's wrist_3_link, our
  // chosen end-effector). Keeping the full tree costs ~6 spare Link
  // objects on a 6-DOF arm; trivial.
  const ikRoot: any = urdfRobotToIKRoot(urdfRobot, false);

  // Restore the URDF to the caller's pose now that the IK tree has captured
  // the static joint origins.
  for (const name in savedAngles) {
    urdfRobot.joints[name].setJointValue(savedAngles[name]);
  }
  urdfRobot.updateMatrixWorld(true);

  // The IK tree initialises all joint DoFs to zero. Sync the URDF's current
  // joint values into the IK tree so the goal seeds at the right end-effector
  // position and the first frame's solve doesn't snap the arm back to zero.
  setIKFromUrdf(ikRoot, urdfRobot);

  // The synthetic __world_joint__ root has 6 free DoF by default. For a
  // fixed-base manipulator we lock all of them so only the actual joint
  // DoFs (shoulder_pan, shoulder_lift, …) participate in the solve.
  if (ikRoot.clearDoF) ikRoot.clearDoF();

  // Find the IK node corresponding to the requested end-effector link.
  let endEffector: any = null;
  ikRoot.traverse((node: any) => {
    if (node.name === endEffectorLinkName) endEffector = node;
  });
  if (!endEffector) {
    throw new Error(
      `IK end-effector link "${endEffectorLinkName}" not found in ${urdfRobot.robotName}.`
    );
  }

  // Position-only goal: constrain X, Y, Z; leave rotation free. With 6
  // arm joints + 3 constrained DoF the system is over-actuated and the
  // damped least-squares solver finds a smooth solution.
  const goal: any = new Goal();
  goal.setGoalDoF(DOF.X, DOF.Y, DOF.Z);

  // Seed the goal at the end-effector's current world position.
  const tmpArr = new Float32Array(3);
  endEffector.getWorldPosition(tmpArr);
  goal.setWorldPosition(tmpArr[0], tmpArr[1], tmpArr[2]);
  goal.makeClosure(endEffector);

  const solver: any = new Solver(ikRoot);
  // Damped-least-squares with the library's defaults (5 iterations,
  // restPoseFactor=0.01) gets stuck at local minima on long reaches from
  // an elbow-bent seed pose — the arm just doesn't move. Tuning notes:
  //   maxIterations 30 — still cheap on a 6-DOF arm at 60 fps; lets the
  //     solver iterate out of local stalls instead of bailing early.
  //   useSVD true — switch from the diagonal Jacobian-pseudoinverse to a
  //     full SVD-based one. More robust near singularities (e.g. a fully
  //     extended elbow) where the diagonal approximation underestimates
  //     the move that would actually reduce error.
  //   restPoseFactor 0 — the default 0.01 pulls every joint toward zero
  //     each step, which is a tiebreaker for redundancy but also fights
  //     against the goal on long reaches. Off for now.
  solver.maxIterations = 30;
  solver.useSVD = true;
  solver.restPoseFactor = 0;
  solver.translationErrorClamp = 0.25;
  solver.translationConvergeThreshold = 1e-5;

  return {
    setGoal(pos: THREE.Vector3) {
      goal.setWorldPosition(pos.x, pos.y, pos.z);
    },
    solve() {
      solver.solve();
      setUrdfFromIK(urdfRobot, ikRoot);
    },
    getEndEffectorPosition(target: THREE.Vector3) {
      endEffector.getWorldPosition(tmpArr);
      target.set(tmpArr[0], tmpArr[1], tmpArr[2]);
    },
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
