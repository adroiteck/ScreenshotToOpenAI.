document.getElementById("capture-btn").addEventListener("click", () => {
    const prompt = document.getElementById("prompt").value;
    
    // Send a message to the background script with the user's prompt.
    chrome.runtime.sendMessage(
      { type: "CAPTURE_AND_ANALYZE", prompt },
      (response) => {
        const resultEl = document.getElementById("result");
        if (response.error) {
          resultEl.innerText = "Error: " + response.error;
        } else {
          resultEl.innerText = response.answer || "No response from OpenAI.";
        }
      }
    );
  });
  