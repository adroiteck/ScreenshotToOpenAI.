console.log("overlay.js has loaded");

// Global conversation array
let conversation = [];

// Create the overlay container covering the right half of the screen
const overlayContainer = document.createElement('div');
overlayContainer.id = 'myExtensionOverlay';
overlayContainer.style.position = 'fixed';
overlayContainer.style.top = '0';
overlayContainer.style.right = '0';
overlayContainer.style.width = '50%';  // initial width: 50% of viewport width
overlayContainer.style.height = '100%';
overlayContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';  // semi-transparent dark background
overlayContainer.style.zIndex = '1000000';
overlayContainer.style.display = 'none';         // Hidden by default
overlayContainer.style.flexDirection = 'column';
overlayContainer.style.justifyContent = 'center';
overlayContainer.style.alignItems = 'center';

// Create the modal content (chat UI)
const modalContent = document.createElement('div');
modalContent.style.width = '90%';
modalContent.style.height = '90%';
modalContent.style.backgroundColor = '#fff';
modalContent.style.borderRadius = '8px';
modalContent.style.boxShadow = '0 4px 10px rgba(0,0,0,0.25)';
modalContent.style.display = 'flex';
modalContent.style.flexDirection = 'column';
modalContent.style.overflow = 'hidden';

modalContent.innerHTML = `
  <div id="overlayHeader" style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold; position: relative;">
    Screenshot & ChatGPT
    <button id="closeOverlay" style="position: absolute; right: 10px; top: 10px;">X</button>
  </div>
  <div id="overlayChatContainer" style="flex: 1; overflow-y: auto; padding: 10px; background: #f7f7f7;"></div>
  <div id="overlayFooter" style="padding: 10px; border-top: 1px solid #ddd;">
    <textarea id="overlayPrompt" rows="2" placeholder="Type your message..." style="width:100%;"></textarea>
    <div style="margin-top: 5px; text-align: right;">
      <button id="overlaySendChatBtn">Send</button>
      <button id="overlayCaptureFullBtn">Full Screen</button>
      <button id="overlayCaptureRegionBtn">Region</button>
    </div>
  </div>
`;

// Append modal content to overlay container
overlayContainer.appendChild(modalContent);

// Create a resize handle on the left edge of the overlay
const resizeHandle = document.createElement('div');
resizeHandle.id = 'resizeHandle';
resizeHandle.style.position = 'absolute';
resizeHandle.style.left = '0';
resizeHandle.style.top = '0';
resizeHandle.style.width = '10px';
resizeHandle.style.height = '100%';
resizeHandle.style.cursor = 'ew-resize';
resizeHandle.style.zIndex = '1000001';
overlayContainer.appendChild(resizeHandle);

document.body.appendChild(overlayContainer);

// Grab references to overlay elements
const closeOverlayBtn = document.getElementById('closeOverlay');
const overlayChatContainer = document.getElementById('overlayChatContainer');
const overlayPrompt = document.getElementById('overlayPrompt');
const overlaySendChatBtn = document.getElementById('overlaySendChatBtn');
const overlayCaptureFullBtn = document.getElementById('overlayCaptureFullBtn');
const overlayCaptureRegionBtn = document.getElementById('overlayCaptureRegionBtn');

// Helper function to append chat messages
function appendOverlayChatMessage(role, text) {
  const bubble = document.createElement("div");
  bubble.style.margin = "5px";
  bubble.style.padding = "10px";
  bubble.style.borderRadius = "8px";
  bubble.style.maxWidth = "80%";
  bubble.style.whiteSpace = "pre-wrap";
  bubble.style.alignSelf = role === "user" ? "flex-end" : "flex-start";
  bubble.style.backgroundColor = role === "user" ? "#DCF8C6" : "#ECECEC";
  bubble.innerText = text;
  overlayChatContainer.appendChild(bubble);
  overlayChatContainer.scrollTop = overlayChatContainer.scrollHeight;
}

// Helper to format assistant content. If content is an array, join it; if it's a string, return as is.
function formatOverlayAssistantContent(contentData) {
  if (Array.isArray(contentData)) {
    return contentData.map(item => {
      if (item.type === "text") return item.text;
      if (item.type === "image_url") return "[Image attached]";
      return "";
    }).join("\n");
  } else {
    return contentData || "";
  }
}

// Send chat message event
overlaySendChatBtn.addEventListener('click', () => {
  const userText = overlayPrompt.value.trim();
  if (!userText) return;
  overlayPrompt.value = "";
  
  const userMessage = {
    role: "user",
    content: [{ type: "text", text: userText }]
  };
  conversation.push(userMessage);
  appendOverlayChatMessage("user", userText);
  
  chrome.runtime.sendMessage({
    type: "ANALYZE_CONVERSATION",
    conversation: conversation
  }, (response) => {
    if (chrome.runtime.lastError) {
      appendOverlayChatMessage("assistant", "Error: " + chrome.runtime.lastError.message);
    } else if (response.error) {
      appendOverlayChatMessage("assistant", "Error: " + response.error);
    } else {
      conversation.push(response.assistantMessage);
      const assistantText = formatOverlayAssistantContent(response.assistantMessage.content);
      appendOverlayChatMessage("assistant", assistantText);
    }
  });
});

// Close overlay event
closeOverlayBtn.addEventListener('click', () => {
  overlayContainer.style.display = 'none';
});

// Listen for toggle messages from background to show/hide overlay
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.type === "TOGGLE_OVERLAY") {
    overlayContainer.style.display = (overlayContainer.style.display === 'none') ? 'flex' : 'none';
    sendResponse({ success: true });
  }
});

// Full screen capture event
overlayCaptureFullBtn.addEventListener('click', () => {
  const promptText = overlayPrompt.value.trim() || "Analyze this screenshot.";
  chrome.runtime.sendMessage({ type: "CAPTURE_SCREENSHOT" }, (response) => {
    if (chrome.runtime.lastError) {
      appendOverlayChatMessage("assistant", "Error: " + chrome.runtime.lastError.message);
    } else if (response.error) {
      appendOverlayChatMessage("assistant", "Error: " + response.error);
    } else {
      const screenshotDataUrl = response.dataUrl;
      const userMessage = {
        role: "user",
        content: [
          { type: "text", text: promptText },
          { type: "image_url", image_url: { url: screenshotDataUrl } }
        ]
      };
      conversation.push(userMessage);
      appendOverlayChatMessage("user", promptText + "\n[Full Screenshot Attached]");
      
      chrome.runtime.sendMessage({
        type: "ANALYZE_CONVERSATION",
        conversation: conversation
      }, (resp) => {
        if (chrome.runtime.lastError) {
          appendOverlayChatMessage("assistant", "Error: " + chrome.runtime.lastError.message);
        } else if (resp.error) {
          appendOverlayChatMessage("assistant", "Error: " + resp.error);
        } else {
          conversation.push(resp.assistantMessage);
          const assistantText = formatOverlayAssistantContent(resp.assistantMessage.content);
          appendOverlayChatMessage("assistant", assistantText);
        }
      });
    }
  });
});

// ===== REGION CAPTURE =====

// Variables for region capture coordinates
let regionStartX = 0, regionStartY = 0, regionEndX = 0, regionEndY = 0;
let regionOverlay = null;

overlayCaptureRegionBtn.addEventListener('click', startRegionCapture);

function startRegionCapture() {
  // Create regionOverlay if it doesn't exist
  if (!regionOverlay) {
    regionOverlay = document.createElement('div');
    regionOverlay.id = 'regionOverlay';
    regionOverlay.style.position = 'fixed';
    regionOverlay.style.top = '0';
    regionOverlay.style.left = '0';
    regionOverlay.style.width = '100%';
    regionOverlay.style.height = '100%';
    regionOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
    regionOverlay.style.zIndex = '1000002'; // above overlay
    document.body.appendChild(regionOverlay);
  }
  regionOverlay.style.display = 'block';
  regionOverlay.innerHTML = ''; // clear previous selection
  
  regionOverlay.addEventListener('mousedown', regionSelectionStart);
  regionOverlay.addEventListener('mouseup', regionSelectionEnd);
}

function regionSelectionStart(e) {
  regionStartX = e.clientX;
  regionStartY = e.clientY;
  // Create a selection rectangle
  const selectionRect = document.createElement('div');
  selectionRect.id = 'regionSelectionRect';
  selectionRect.style.position = 'absolute';
  selectionRect.style.border = '2px dashed #fff';
  selectionRect.style.left = regionStartX + 'px';
  selectionRect.style.top = regionStartY + 'px';
  regionOverlay.appendChild(selectionRect);
  regionOverlay.addEventListener('mousemove', regionSelectionUpdate);
}

function regionSelectionUpdate(e) {
  regionEndX = e.clientX;
  regionEndY = e.clientY;
  const selectionRect = document.getElementById('regionSelectionRect');
  if (selectionRect) {
    selectionRect.style.left = Math.min(regionStartX, regionEndX) + 'px';
    selectionRect.style.top = Math.min(regionStartY, regionEndY) + 'px';
    selectionRect.style.width = Math.abs(regionEndX - regionStartX) + 'px';
    selectionRect.style.height = Math.abs(regionEndY - regionStartY) + 'px';
  }
}

function regionSelectionEnd(e) {
  regionOverlay.removeEventListener('mousemove', regionSelectionUpdate);
  regionOverlay.style.display = 'none';
  // After region selection, capture the screenshot
  chrome.runtime.sendMessage({ type: "CAPTURE_SCREENSHOT" }, (response) => {
    if (chrome.runtime.lastError) {
      appendOverlayChatMessage("assistant", "Error: " + chrome.runtime.lastError.message);
    } else if (response.error) {
      appendOverlayChatMessage("assistant", "Error: " + response.error);
    } else {
      // Crop the screenshot based on region coordinates
      cropImage(
        response.dataUrl,
        Math.min(regionStartX, regionEndX),
        Math.min(regionStartY, regionEndY),
        Math.abs(regionEndX - regionStartX),
        Math.abs(regionEndY - regionStartY)
      ).then(croppedDataUrl => {
        const promptText = overlayPrompt.value.trim() || "Analyze this region.";
        const userMessage = {
          role: "user",
          content: [
            { type: "text", text: promptText },
            { type: "image_url", image_url: { url: croppedDataUrl } }
          ]
        };
        conversation.push(userMessage);
        appendOverlayChatMessage("user", promptText + "\n[Region Screenshot Attached]");
        chrome.runtime.sendMessage({
          type: "ANALYZE_CONVERSATION",
          conversation: conversation
        }, (resp) => {
          if (chrome.runtime.lastError) {
            appendOverlayChatMessage("assistant", "Error: " + chrome.runtime.lastError.message);
          } else if (resp.error) {
            appendOverlayChatMessage("assistant", "Error: " + resp.error);
          } else {
            conversation.push(resp.assistantMessage);
            const assistantText = formatOverlayAssistantContent(resp.assistantMessage.content);
            appendOverlayChatMessage("assistant", assistantText);
          }
        });
      }).catch(err => {
        appendOverlayChatMessage("assistant", "Error: " + err.message);
      });
    }
  });
  // Reset region coordinates
  regionStartX = regionStartY = regionEndX = regionEndY = 0;
}

// Crop image using a canvas
function cropImage(dataUrl, x, y, width, height) {
  return new Promise(function(resolve, reject) {
    const img = new Image();
    img.onload = function() {
      // Compute scale factor between screenshot dimensions and viewport
      const scale = img.width / window.innerWidth;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, x * scale, y * scale, width * scale, height * scale, 0, 0, width, height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// ===== Resizable Overlay Functionality =====
resizeHandle.addEventListener('mousedown', initResize, false);
function initResize(e) {
  e.preventDefault();
  window.addEventListener('mousemove', startResize, false);
  window.addEventListener('mouseup', stopResize, false);
}
function startResize(e) {
  let newWidth = window.innerWidth - e.clientX;
  if (newWidth < 200) newWidth = 200;
  if (newWidth > window.innerWidth * 0.9) newWidth = window.innerWidth * 0.9;
  overlayContainer.style.width = newWidth + "px";
}
function stopResize(e) {
  window.removeEventListener('mousemove', startResize, false);
  window.removeEventListener('mouseup', stopResize, false);
}
