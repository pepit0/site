/**
 * Vite resolves layer cutout filenames under `src/assets/` (and `src/assets/home-hero/`) for hero glow only.
 * Excludes `background.png`.
 */

function basenameFromModulePath(modulePath: string): string {
  const normalized = modulePath.replace(/\\/g, "/");
  const seg = normalized.split("/").pop();
  return seg ?? modulePath;
}

const folderLayers = import.meta.glob<string>(
  "../assets/home-hero/*.{png,PNG,webp,WEBP,jpg,JPG,jpeg,JPEG}",
  {
    eager: true,
    import: "default"
  }
);

const rootLayers = import.meta.glob<string>("../assets/*.{png,PNG,webp,WEBP,jpg,JPG,jpeg,JPEG}", {
  eager: true,
  import: "default"
});

const urlByFilename = new Map<string, string>();

for (const [path, url] of Object.entries(folderLayers)) {
  urlByFilename.set(basenameFromModulePath(path), url);
}

for (const [path, url] of Object.entries(rootLayers)) {
  const name = basenameFromModulePath(path);
  if (name.toLowerCase() === "background.png") continue;
  if (!urlByFilename.has(name)) urlByFilename.set(name, url);
}

export function getHomeHeroLayerUrl(filename: string): string | undefined {
  return urlByFilename.get(filename);
}
