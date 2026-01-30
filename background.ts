// Background service worker to handle screen capture
// This is necessary because content scripts cannot capture the visible tab directly.

chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: (response: any) => void) => {
  if (request.type === 'CAPTURE_VISIBLE_TAB') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl: string) => {
      if (chrome.runtime.lastError) {
        console.error("Capture failed:", chrome.runtime.lastError.message);
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ dataUrl });
      }
    });
    return true; // Indicates we will respond asynchronously
  }
});
