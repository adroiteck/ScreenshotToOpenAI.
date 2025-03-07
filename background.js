// If you have Tesseract bundled, you can do:
// import { createWorker } from './assets/tesseract.esm.js';

let openaiApiKey = null;

// Load the API key from storage when extension starts
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get("openaiApiKey", (data) => {
    openaiApiKey = data.openaiApiKey || null;
  });
});

// Listen for changes to the API key
chrome.storage.onChanged.addListener((changes) => {
  if (changes.openaiApiKey) {
    openaiApiKey = changes.openaiApiKey.newValue;
  }
});

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "CAPTURE_AND_ANALYZE") {
    const userPrompt = request.prompt;
    captureScreenshot()
      .then((imageDataUrl) => processImageAndAnalyze(imageDataUrl, userPrompt))
      .then((answer) => sendResponse({ answer }))
      .catch((err) => sendResponse({ error: err.message }));
    
    // Important: return true to indicate async response
    return true;
  }
});

// Capture visible tab screenshot
function captureScreenshot() {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve(dataUrl);
    });
  });
}

// Process the screenshot + prompt
async function processImageAndAnalyze(imageDataUrl, userPrompt) {
  if (!openaiApiKey) {
    throw new Error("OpenAI API key not set. Go to extension options to save it.");
  }

  // 1. OCR
  const text = await runLocalOCR(imageDataUrl);

  // 2. Create final prompt
  const finalPrompt = `
    The user wants the following done: ${userPrompt}
    The text from the screenshot is:
    "${text}"
    Provide your best response or analysis:
  `;

  // 3. Send to OpenAI
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: finalPrompt }],
      max_tokens: 300
    })
  });

  if (!response.ok) {
    throw new Error("OpenAI API error: " + response.statusText);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "No response from OpenAI.";
}

// Example Tesseract OCR function
async function runLocalOCR(imageDataUrl) {
  // If you have Tesseract properly set up:
  const { createWorker } = Tesseract;
  const worker = createWorker();

  await worker.load();
  await worker.loadLanguage('eng');
  await worker.initialize('eng');

  const { data: { text } } = await worker.recognize(imageDataUrl);
  await worker.terminate();
  return text;
}
