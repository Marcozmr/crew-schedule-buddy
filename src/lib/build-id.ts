/** Build id injetado em build (Vite `define`) — SHA do deploy, id Vercel ou fallback. */
export function getEscalaxBuildId(): string {
  if (typeof __ESCALAX_BUILD_ID__ !== 'undefined' && __ESCALAX_BUILD_ID__) {
    return __ESCALAX_BUILD_ID__;
  }
  return 'unknown';
}
