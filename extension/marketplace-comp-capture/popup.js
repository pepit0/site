const STORAGE_KEYS = ["apiBase", "apiKey", "searchId"];

function setStatus(text) {
  document.getElementById("status").textContent = text;
}

async function loadSettings() {
  const stored = await chrome.storage.sync.get(STORAGE_KEYS);
  document.getElementById("apiBase").value = stored.apiBase || "https://temptmotorsports.com";
  document.getElementById("apiKey").value = stored.apiKey || "";
  document.getElementById("searchId").value = stored.searchId || "";
}

document.getElementById("save").addEventListener("click", async () => {
  const apiBase = document.getElementById("apiBase").value.trim().replace(/\/+$/, "");
  const apiKey = document.getElementById("apiKey").value.trim();
  const searchId = document.getElementById("searchId").value.trim();
  if (!apiBase || !apiKey || !searchId) {
    setStatus("Fill in all fields.");
    return;
  }
  await chrome.storage.sync.set({ apiBase, apiKey, searchId });
  setStatus("Saved.");
});

loadSettings().catch((err) => setStatus(err instanceof Error ? err.message : "Load failed"));
