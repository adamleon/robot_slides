// Stub replacement for closed-chain-ik's three.js helper modules.
//
// IKRootsHelper.js and IKJointHelper.js in closed-chain-ik 0.0.3 both
// import BoxBufferGeometry / CylinderBufferGeometry / SphereBufferGeometry
// from three — all renamed years ago (now plain BoxGeometry,
// CylinderGeometry, SphereGeometry), so the import lines alone fail
// Vite/Rollup resolution. closed-chain-ik's index re-exports
// IKRootsHelper, and IKRootsHelper imports IKJointHelper, so even users
// who never reference either drag both broken files into the bundle.
//
// We don't use either (lib/ik.ts only needs Solver/Goal/DOF and the
// urdfHelpers). vite.config.ts aliases both broken modules to this
// stub so package-root imports stay clean.

export class IKRootsHelper {}
export class IKJointHelper {}
