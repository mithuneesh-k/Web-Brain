// Extract interactive elements
function extractDOM() {
  const elements = [];
  let idCounter = 0;
  
  const interactables = document.querySelectorAll('button, a, input, select, textarea, [role="button"], [role="link"], [tabindex]');
  interactables.forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || rect.bottom < 0 || rect.top > window.innerHeight) return;
    
    const id = "ozer-" + (idCounter++);
    el.setAttribute("data-ozer-id", id);
    
    elements.push({
      id: id,
      role: el.tagName.toLowerCase(),
      text: (el.innerText || el.value || el.placeholder || el.name || "").substring(0, 50).trim(),
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    });
  });
  return elements;
}

// Execute an action
function executeAction(action) {
  if (action.action === "noop") return "No operation performed.";
  
  const el = document.querySelector(`[data-ozer-id="${action.target_id}"]`);
  if (!el) return "Element not found for execution.";
  
  if (action.action === "click") {
    el.click();
    return "Clicked element " + action.target_id;
  } else if (action.action === "type" && action.value) {
    el.value = action.value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return "Typed into element " + action.target_id;
  }
  return "Unknown action.";
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "EXTRACT_DOM") {
    sendResponse({ elements: extractDOM() });
  } else if (msg.type === "EXECUTE_ACTION") {
    const result = executeAction(msg.actionPayload);
    sendResponse({ result });
  }
});
