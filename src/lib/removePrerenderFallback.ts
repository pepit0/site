/** Remove build-time crawler HTML once React mounts (prerender lives outside #root). */
export function removePrerenderFallback(): void {
  document.querySelectorAll('main[id$="-prerender-fallback"]').forEach((node) => {
    node.remove();
  });
}
