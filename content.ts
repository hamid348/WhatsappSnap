import { extractNumbersFromImage } from './services/geminiService';

let overlay: HTMLDivElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let startX = 0;
let startY = 0;
let isDragging = false;
let selectionBox: HTMLDivElement | null = null;

// Listen for activation message
chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: any) => {
  if (request.type === 'ACTIVATE_PICKER') {
    createOverlay();
    sendResponse({ status: 'active' });
  }
});

function createOverlay() {
  if (overlay) return;

  // Create host for Shadow DOM
  overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.zIndex = '2147483647'; // Max z-index
  overlay.style.cursor = 'crosshair';
  
  // Attach Shadow DOM to isolate styles
  shadowRoot = overlay.attachShadow({ mode: 'open' });
  
  // Styles
  const style = document.createElement('style');
  style.textContent = `
    :host {
      display: block;
      background: rgba(0, 0, 0, 0.2);
    }
    #selection-box {
      position: absolute;
      border: 2px dashed #ffffff;
      background: rgba(255, 255, 255, 0.1);
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.4); 
      pointer-events: none;
      display: none;
    }
    .tooltip {
      position: absolute;
      background: white;
      padding: 8px 12px;
      border-radius: 8px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 8px;
      animation: popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    @keyframes popIn {
      from { transform: scale(0.9); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    .btn-whatsapp {
      background: #25D366;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn-whatsapp:hover {
      background: #128C7E;
    }
    .loader {
      width: 16px;
      height: 16px;
      border: 2px solid #f3f3f3;
      border-top: 2px solid #3498db;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .close-btn {
      background: none;
      border: none;
      color: #999;
      cursor: pointer;
      font-size: 16px;
      margin-left: 8px;
      padding: 0 4px;
    }
    .close-btn:hover { color: #333; }
  `;
  shadowRoot.appendChild(style);

  // Selection Box
  selectionBox = document.createElement('div');
  selectionBox.id = 'selection-box';
  shadowRoot.appendChild(selectionBox);

  // Events
  overlay.addEventListener('mousedown', onMouseDown);
  overlay.addEventListener('mousemove', onMouseMove);
  overlay.addEventListener('mouseup', onMouseUp);

  document.body.appendChild(overlay);
}

function removeOverlay() {
  if (overlay) {
    document.body.removeChild(overlay);
    overlay = null;
    shadowRoot = null;
    selectionBox = null;
  }
}

function onMouseDown(e: MouseEvent) {
  isDragging = true;
  startX = e.clientX;
  startY = e.clientY;
  
  if (selectionBox) {
    selectionBox.style.left = `${startX}px`;
    selectionBox.style.top = `${startY}px`;
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    selectionBox.style.display = 'block';
  }
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging || !selectionBox) return;
  
  const currentX = e.clientX;
  const currentY = e.clientY;
  
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);
  const left = Math.min(currentX, startX);
  const top = Math.min(currentY, startY);
  
  selectionBox.style.left = `${left}px`;
  selectionBox.style.top = `${top}px`;
  selectionBox.style.width = `${width}px`;
  selectionBox.style.height = `${height}px`;
}

async function onMouseUp(e: MouseEvent) {
  if (!isDragging) return;
  isDragging = false;
  
  // Calculate final coordinates
  const rect = selectionBox?.getBoundingClientRect();
  
  // If selection is too small, just cancel (accidental click)
  if (!rect || rect.width < 10 || rect.height < 10) {
    removeOverlay();
    return;
  }

  // Show loading UI at cursor
  const loadingTooltip = showTooltip(e.clientX, e.clientY, null, true);

  // 1. Capture Screen via Background Script
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' });
    
    if (response.error || !response.dataUrl) {
      throw new Error(response.error || "Capture failed");
    }

    // 2. Crop Image
    const croppedDataUrl = await cropImage(response.dataUrl, rect);

    // 3. Process with Gemini
    const numbers = await extractNumbersFromImage(croppedDataUrl);

    // 4. Show Result
    loadingTooltip.remove();
    
    if (numbers.length > 0) {
      // Use the first confident number found
      showResultTooltip(e.clientX, e.clientY, numbers[0]);
    } else {
      showErrorTooltip(e.clientX, e.clientY, "No number found");
      setTimeout(removeOverlay, 2000);
    }

  } catch (error) {
    console.error(error);
    loadingTooltip.remove();
    showErrorTooltip(e.clientX, e.clientY, "Error scanning");
    setTimeout(removeOverlay, 2000);
  }
}

async function cropImage(base64: string, rect: DOMRect): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      // Handle high DPI screens
      const pixelRatio = window.devicePixelRatio || 1;
      
      canvas.width = rect.width * pixelRatio;
      canvas.height = rect.height * pixelRatio;
      
      if (!ctx) {
        reject("Canvas context missing");
        return;
      }

      // Draw the specific slice
      ctx.drawImage(
        img, 
        rect.left * pixelRatio, 
        rect.top * pixelRatio, 
        rect.width * pixelRatio, 
        rect.height * pixelRatio, 
        0, 
        0, 
        rect.width * pixelRatio, 
        rect.height * pixelRatio
      );
      
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = base64;
  });
}

function showTooltip(x: number, y: number, content: HTMLElement | null, isLoading = false) {
  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip';
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y + 20}px`; // Below cursor
  
  if (isLoading) {
    tooltip.innerHTML = '<div class="loader"></div><span>Scanning...</span>';
  } else if (content) {
    tooltip.appendChild(content);
  }

  shadowRoot?.appendChild(tooltip);
  return tooltip;
}

function showResultTooltip(x: number, y: number, data: any) {
  // Clear previous tooltips
  removeOverlay(); // Remove the big overlay but keep a small floating element? 
  // Actually better to keep overlay until user closes or clicks.
  // Re-create overlay for result mode if we want to block interaction, 
  // or just append to body if we want free interaction. 
  // For simplicity, let's keep using the shadowRoot we have but make background transparent.
  
  if (!overlay || !shadowRoot) return;
  
  // Make background transparent so user can see page again
  overlay.style.pointerEvents = 'none'; // Click through
  // Reset overlay styles
  const style = shadowRoot.querySelector('style');
  if (style) {
     style.textContent += ` :host { background: transparent !important; } `;
  }
  
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.gap = '8px';
  container.style.pointerEvents = 'auto'; // Re-enable clicks for tooltip
  
  const text = document.createElement('span');
  text.style.fontWeight = 'bold';
  text.style.color = '#333';
  text.textContent = data.normalized;

  const btn = document.createElement('button');
  btn.className = 'btn-whatsapp';
  btn.innerHTML = `
    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
    Chat
  `;
  btn.onclick = () => {
    const clean = data.normalized.replace(/[^\d+]/g, '');
    window.open(`https://wa.me/${clean}`, '_blank');
    removeOverlay();
  };

  const close = document.createElement('button');
  close.className = 'close-btn';
  close.innerHTML = '&times;';
  close.title = "Close";
  close.onclick = () => removeOverlay();

  container.appendChild(text);
  container.appendChild(btn);
  container.appendChild(close);

  showTooltip(x, y, container, false);
}

function showErrorTooltip(x: number, y: number, msg: string) {
  const span = document.createElement('span');
  span.style.color = '#e74c3c';
  span.textContent = msg;
  showTooltip(x, y, span, false);
}
