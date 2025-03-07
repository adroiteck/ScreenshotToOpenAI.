document.getElementById("saveBtn").addEventListener("click", () => {
  const key = document.getElementById("apiKeyInput").value.trim();
  if (key) {
    chrome.storage.local.set({ openaiApiKey: key }, () => {
      alert("API Key saved!");
    });
  }
});
