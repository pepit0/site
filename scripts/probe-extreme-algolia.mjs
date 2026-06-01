const res = await fetch("https://www.extremepowersports.com/Inventory/Used-Inventory", {
  headers: { "User-Agent": "TemptationMotorsportsImport/1.0" }
});
const html = await res.text();

for (const re of [
  /algolia[^"']{0,80}/gi,
  /applicationId['":\s]+['"]([^'"]+)/gi,
  /searchOnlyApiKey['":\s]+['"]([^'"]+)/gi,
  /apiKey['":\s]+['"]([^'"]+)/gi,
  /indexName['":\s]+['"]([^'"]+)/gi,
  /"index":"([^"]+)"/gi,
  /portalid['":\s]+(\d+)/gi
]) {
  const matches = [...html.matchAll(re)].slice(0, 5);
  if (matches.length) console.log(re.source, matches.map((m) => m[0] || m[1]));
}

const scriptUrls = [...html.matchAll(/src="([^"]+showroom[^"]+)"/gi)].map((m) => m[1]);
console.log("showroom scripts", scriptUrls);

for (const path of scriptUrls.slice(0, 3)) {
  const url = path.startsWith("http") ? path : `https://www.extremepowersports.com${path}`;
  const sr = await fetch(url, { headers: { "User-Agent": "TemptationMotorsportsImport/1.0" } });
  const js = await sr.text();
  console.log("\nJS", path.slice(-40), "len", js.length);
  for (const needle of ["applicationId", "apiKey", "indexName", "algolia", "portalid", "Used"]) {
    const idx = js.indexOf(needle);
    if (idx >= 0) console.log(" ", needle, js.slice(idx, idx + 120).replace(/\s+/g, " "));
  }
}
