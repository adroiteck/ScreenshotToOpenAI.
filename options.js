// On "Save" button click, store the key in chrome.storage.local
document.getElementById("saveBtn").addEventListener("click", () => {
    const key = document.getElementById("apiKeyInput").value.trim();
    if (key) {
      chrome.storage.local.set({ openaiApiKey: key }, () => {
        alert("API Key saved!");
      });
    }
  });
  