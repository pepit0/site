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
    requests: [{ indexName: "prod_WebSellable", params: "hitsPerPage=1&page=0&filters=Condition:Used" }]
  })
});
const hit = (await ar.json()).results?.[0]?.hits?.[0];
console.log(JSON.stringify(hit, null, 2));
