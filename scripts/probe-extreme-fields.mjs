const res = await fetch("https://www.extremepowersports.com/Inventory/Used-Inventory", {
  headers: { "User-Agent": "TemptationMotorsportsImport/1.0" }
});
const html = await res.text();
const appId = (html.match(/applicationId['":\s]+['"]([^'"]+)/i) || [])[1] ?? "RBG3H22Y5V";
const apiKey = (html.match(/apiKey['":\s]+['"]([^'"]+)/i) || [])[1];

const ar = await fetch(`https://${appId.toLowerCase()}-dsn.algolia.net/1/indexes/*/queries`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Algolia-Application-Id": appId,
    "X-Algolia-API-Key": apiKey
  },
  body: JSON.stringify({
    requests: [{ indexName: "prod_WebSellable", params: "hitsPerPage=3&page=0&filters=Condition:Used" }]
  })
});
const hits = (await ar.json()).results?.[0]?.hits ?? [];
for (const hit of hits) {
  const pick = {};
  for (const k of Object.keys(hit).sort()) {
    if (/stock|vin|mile|odom|url|object|product|manufacturer|name|year|make|model|category|type|photo|price|condition/i.test(k)) {
      pick[k] = hit[k];
    }
  }
  console.log(JSON.stringify(pick, null, 2));
  console.log("---");
}
