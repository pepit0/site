const res = await fetch("https://www.extremepowersports.com/Inventory/Used-Inventory", {
  headers: { "User-Agent": "TemptationMotorsportsImport/1.0", Accept: "text/html" }
});
const html = await res.text();
console.log("status", res.status, "len", html.length);

for (const p of ["dx1", "DX1", "UnitId", "inventoryId", "vehicleId", "__NEXT_DATA__", "api.dx1", "powersports"]) {
  console.log(p, (html.match(new RegExp(p, "gi")) || []).length);
}

const detailLinks = [...html.matchAll(/href="(\/Inventory\/[^"]+)"/gi)].map((m) => m[1]);
console.log("detail links sample", [...new Set(detailLinks)].slice(0, 10));

const stockMatches = [...html.matchAll(/Stock\s*#:\s*([A-Z0-9]+)/gi)].map((m) => m[1]);
console.log("stocks", stockMatches.length, stockMatches.slice(0, 5));

const vinMatches = [...html.matchAll(/VIN:\s*([A-Z0-9]+)/gi)].map((m) => m[1]);
console.log("vins", vinMatches.length, vinMatches.slice(0, 3));

if (detailLinks[0]) {
  const detailUrl = `https://www.extremepowersports.com${detailLinks[0]}`;
  console.log("\nFetching detail", detailUrl);
  const dr = await fetch(detailUrl, { headers: { "User-Agent": "TemptationMotorsportsImport/1.0" } });
  const dhtml = await dr.text();
  console.log("detail len", dhtml.length);
  for (const p of ["dx1", "og:image", "application/ld+json", "Stock #", "data-"]) {
    console.log(" detail", p, (dhtml.match(new RegExp(p, "gi")) || []).length);
  }
  const imgs = [...dhtml.matchAll(/https:\/\/[^\"'\s>]+\.(?:jpg|jpeg|png|webp)/gi)].slice(0, 8);
  console.log("imgs sample", imgs);
}
