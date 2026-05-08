// setup/build-profile.ts
//
// Build-tier flag, set via the VITE_BUILD_PROFILE env var at compile time.
// Components branch on this so the same source produces three artifacts:
//   - full: classroom lecture, every interactive feature live.
//   - lite: single-file archive; heavy 3D scenes fall back to video/still.
//   - pdf:  static export; controllers snap to default state.
// See docs/DESIGN.md §2.

export type BuildProfile = "full" | "lite" | "pdf";

export const BUILD_PROFILE: BuildProfile =
  (import.meta.env.VITE_BUILD_PROFILE as BuildProfile) ?? "full";

export const isFull = BUILD_PROFILE === "full";
export const isLite = BUILD_PROFILE === "lite";
export const isPdf = BUILD_PROFILE === "pdf";
