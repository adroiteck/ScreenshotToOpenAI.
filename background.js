let openaiApiKey = null;

// Load the API key when the extension is installed or updated
chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.local.get("openaiApiKey", function(data) {
    openaiApiKey = data.openaiApiKey || null;
  });
});

// Listen for changes to the API key
chrome.storage.onChanged.addListener(function(changes) {
  if (changes.openaiApiKey) {
    openaiApiKey = changes.openaiApiKey.newValue;
  }
});

// Listen for the keyboard shortcut command "toggle_overlay"
chrome.commands.onCommand.addListener(function(command) {
  if (command === "toggle_overlay") {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (!tabs || tabs.length === 0) {
        console.warn("No active tab found.");
        return;
      }
      var activeTab = tabs[0];
      if (!activeTab || !activeTab.id) {
        console.warn("Active tab or its ID is undefined.");
        return;
      }
      // Only send a message if the URL is supported (http or https)
      if (activeTab.url &&
          (activeTab.url.indexOf("http://") === 0 || activeTab.url.indexOf("https://") === 0)) {
        chrome.tabs.sendMessage(activeTab.id, { type: "TOGGLE_OVERLAY" }, function(response) {
          if (chrome.runtime.lastError) {
            console.warn("Could not send toggle overlay message: " + chrome.runtime.lastError.message);
          }
        });
      } else {
        console.warn("Active tab URL not supported: " + activeTab.url);
      }
    });
  }
});

// Listen for messages from overlay.js
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.type === "CAPTURE_SCREENSHOT") {
    captureScreenshot()
      .then(function(dataUrl) {
        sendResponse({ dataUrl: dataUrl });
      })
      .catch(function(err) {
        sendResponse({ error: err.message });
      });
    return true;
  }

  if (request.type === "ANALYZE_IMAGE") {
    var imageDataUrl = request.imageDataUrl;
    var prompt = request.prompt;
    processImageAndAnalyze(imageDataUrl, prompt)
      .then(function(answer) {
        sendResponse({ answer: answer });
      })
      .catch(function(err) {
        sendResponse({ error: err.message });
      });
    return true;
  }

  if (request.type === "ANALYZE_CONVERSATION") {
    var conversation = request.conversation;
    processConversation(conversation)
      .then(function(assistantMessage) {
        sendResponse({ assistantMessage: assistantMessage });
      })
      .catch(function(err) {
        sendResponse({ error: err.message });
      });
    return true;
  }
});

// Capture the visible tab as a screenshot
function captureScreenshot() {
  return new Promise(function(resolve, reject) {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, function(dataUrl) {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve(dataUrl);
    });
  });
}

// Send a single image + prompt to OpenAI using a model that supports images (e.g., gpt-4o-mini)
async function processImageAndAnalyze(imageDataUrl, userPrompt) {
  if (!openaiApiKey) {
    throw new Error("OpenAI API key not set. Please set it in the extension options.");
  }
  const payload = {
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          { type: "image_url", image_url: { url: imageDataUrl } }
        ]
      }
    ],
    store: true
  };
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + openaiApiKey
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error("OpenAI API error: " + response.status + " - " + errorText);
  }
  const data = await response.json();
  return data.choices &&
         data.choices[0] &&
         data.choices[0].message &&
         data.choices[0].message.content
         ? data.choices[0].message.content
         : "No response.";
}

// Handle multi-turn conversation using the same model
async function processConversation(conversation) {
  if (!openaiApiKey) {
    throw new Error("OpenAI API key not set.");
  }
  const payload = {
    model: "gpt-4o-mini",
    messages: conversation,
    store: true
  };
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + openaiApiKey
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error("OpenAI API error: " + response.status + " - " + errorText);
  }
  const data = await response.json();
  return data.choices &&
         data.choices[0] &&
         data.choices[0].message
         ? data.choices[0].message
         : { role: "assistant", content: "No response from OpenAI." };
}
