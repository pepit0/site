const res = await fetch("https://www.extremepowersports.com/Inventory/Used-Inventory", {
  headers: { "User-Agent": "TemptationMotorsportsImport/1.0" }
});
const html = await res.text();

const appMatch = html.match(/applicationId['":\s]+['"]([^'"]+)/i) || html.match(/appId['":\s]+['"]([^'"]+)/i);
const apiMatch = html.match(/apiKey['":\s]+['"]([^'"]+)/i);
const indexMatch = html.match(/indexName['":\s]+['"](prod_WebSellable)['"]/i);

console.log("appId", appMatch?.[1]);
console.log("index", indexMatch?.[1]);
console.log("apiKey prefix", apiMatch?.[1]?.slice(0, 40));

const appId = appMatch?.[1] ?? "RBG3H22Y5V";
const apiKey = apiMatch?.[1];
const indexName = indexMatch?.[1] ?? "prod_WebSellable";

const body = {
  requests: [
    {
      indexName,
      params: "hitsPerPage=50&page=0&filters=Condition:Used"
    }
  ]
};

const ar = await fetch(`https://${appId.toLowerCase()}-dsn.algolia.net/1/indexes/*/queries`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Algolia-Application-Id": appId,
    "X-Algolia-API-Key": apiKey
  },
  body: JSON.stringify(body)
});
const data = await ar.json();
console.log("algolia status", ar.status);
const hits = data.results?.[0]?.hits ?? [];
console.log("hits", hits.length, "nbHits", data.results?.[0]?.nbHits);
if (hits[0]) {
  console.log("sample keys", Object.keys(hits[0]).slice(0, 30));
  console.log("sample", JSON.stringify(hits[0], null, 2).slice(0, 2500));
}
