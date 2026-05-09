// scripts/strip-cdn-refs.mjs
//
// Post-build pass that strips runtime-fetch CDN <link> tags from a built
// HTML file. Slidev injects a favicon from cdn.jsdelivr.net and a Google
// Fonts stylesheet at build time; both fail offline (and violate the
// "no CDN URLs at runtime" rule in DESIGN.md §0.8).
//
// Browsers fall back to system fonts and a default tab icon when these
// links are removed — visual difference is minor; offline correctness
// is the win.

import fs from "node:fs";

const CDN_LINK_PATTERNS = [
  /<link[^>]*\bhref\s*=\s*["']https:\/\/cdn\.jsdelivr\.net\/[^"']*["'][^>]*>\s*/gi,
  /<link[^>]*\bhref\s*=\s*["']https:\/\/fonts\.googleapis\.com\/[^"']*["'][^>]*>\s*/gi,
  /<link[^>]*\bhref\s*=\s*["']https:\/\/fonts\.gstatic\.com\/[^"']*["'][^>]*>\s*/gi,
];

/**
 * Strip known CDN <link> tags from an HTML file in place.
 * Returns the number of tags removed.
 */
export function stripCdnRefs(filePath) {
  const original = fs.readFileSync(filePath, "utf8");
  let stripped = original;
  let removed = 0;
  for (const re of CDN_LINK_PATTERNS) {
    const matches = stripped.match(re);
    if (matches) removed += matches.length;
    stripped = stripped.replace(re, "");
  }
  if (stripped !== original) {
    fs.writeFileSync(filePath, stripped);
  }
  return removed;
}
