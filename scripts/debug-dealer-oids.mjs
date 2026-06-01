const base = process.argv[2] ?? "https://www.foxpowersports.com";
const url = `${base}/--Inventory?pg=1&sz=50&condition=Pre-Owned`;
const res = await fetch(url, { headers: { "User-Agent": "TemptationMotorsportsImport/1.0" } });
const html = await res.text();
console.log("status", res.status, "len", html.length);

const patterns = [
  /oid(?:=|%3D|%26#x3D;|&#x3D;)(\d+)/gi,
  /xInventoryDetail\?oid=(\d+)/gi,
  /InventoryDetail\?oid=(\d+)/gi,
  /inventory[_-]?id["'=:\s]+(\d{5,})/gi,
  /data-oid=["'](\d+)["']/gi
];

for (const re of patterns) {
  const ids = [...html.matchAll(re)].map((m) => m[1]);
  console.log(re.source, "->", new Set(ids).size, [...new Set(ids)].slice(0, 5));
}
