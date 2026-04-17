// content.js — injected ONLY into https://redeem.hype.games/widget/

const STORAGE_KEY = "pinmanager_queue";

if (!location.href.startsWith("https://redeem.hype.games/widget/")) {
  throw new Error("[PinManager] Not the widget URL, skipping.");
}

const pinService = new PinService({ projectId: "pin-checker-d183d" });

let running = false;
let startedByMessage = false; // prevents load event from double-starting

// ─── On load: resume queue after reload ──────────────────────────────────────
window.addEventListener("load", async () => {
  await sleep(1000);

  // If this load was triggered by the message listener on the same page, skip
  if (startedByMessage) return;

  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  let state;
  try { state = JSON.parse(raw); } catch (_) { sessionStorage.removeItem(STORAGE_KEY); return; }

  if (!state.running || !Array.isArray(state.pins) || state.pins.length === 0) {
    sessionStorage.removeItem(STORAGE_KEY);
    chrome.runtime.sendMessage({ action: "done" }).catch(() => {});
    return;
  }

  running = true;
  await waitForElement("#hpws-pin", 10000);
  await processPins(state.pins);
});

// ─── Message listener from popup ─────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "start") {
    if (running) { sendResponse({ ok: false, reason: "already running" }); return; }

    if (msg.token) sessionStorage.setItem("pinmanager_token", msg.token);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ running: true, pins: msg.pins }));
    running = true;
    startedByMessage = true; // tell load event not to double-start

    waitForElement("#hpws-pin", 8000).then(() => processPins(msg.pins));
    sendResponse({ ok: true });
  }
  if (msg.action === "stop") {
    running = false;
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem("pinmanager_token");
    sendResponse({ ok: true });
  }
});

// ─── Main loop ────────────────────────────────────────────────────────────────
async function processPins(pins) {
  if (!pins || pins.length === 0) {
    // Nothing left — we're done
    running = false;
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem("pinmanager_token");
    chrome.runtime.sendMessage({ action: "done" }).catch(() => {});
    return;
  }

  if (!running) return;

  // Always process only the FIRST pin in the current queue
  const { pin, docId } = pins[0];
  const remaining = pins.slice(1);

  const success = await tryPin(pin);

  // Update Firestore
  const token = sessionStorage.getItem("pinmanager_token");
  try {
    await pinService.updatePinAvailability(docId, success, token);
  } catch (err) {
    console.error("[PinManager] Firestore update failed:", err);
  }

  // Notify popup (best-effort — popup may be closed)
  chrome.runtime.sendMessage({ action: "pinResult", pin, docId, success }).catch(() => {});

  if (remaining.length > 0) {
    // Save remaining pins and reload for a fresh form
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ running: true, pins: remaining }));
    window.location.reload();
    // Script dies here — load event picks up remaining on next load
  } else {
    // All pins processed — clean up and signal done
    running = false;
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem("pinmanager_token");
    chrome.runtime.sendMessage({ action: "done" }).catch(() => {});
    // Still reload to reset the form to a clean state
    window.location.reload();
  }
}

// ─── Pin attempt ──────────────────────────────────────────────────────────────
async function tryPin(pin) {
  const input = document.getElementById("hpws-pin");
  const btn   = document.getElementById("btn-validate");

  if (!input || !btn) {
    console.warn("[PinManager] Form elements not found");
    return false;
  }

  const errorEl = document.querySelector(".hpws-form-element__error");
  if (errorEl) errorEl.textContent = "";

  input.focus();
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  nativeSetter.call(input, "");
  triggerInputEvents(input);
  await sleep(150);

  nativeSetter.call(input, pin);
  triggerInputEvents(input);
  await sleep(300);

  const contentEl  = document.querySelector(".hpws-content");
  const beforeHTML = contentEl ? contentEl.innerHTML : document.body.innerHTML;

  btn.click();

  // Wait 5 seconds for the response
  await sleep(5000);

  const container = contentEl || document.body;

  // Check specifically for the "already used" h1 message inside .hpws-content
  const h1 = container.querySelector("h1");
  if (h1 && h1.textContent.includes("Esse PIN já foi utilizado")) {
    return false; // unavailable
  }

  // Any other DOM change = something else rendered (success/reward) = available
  if (container.innerHTML !== beforeHTML) {
    return true;
  }

  // No change at all = treat as unavailable
  return false;
}

function triggerInputEvents(el) {
  el.dispatchEvent(new Event("input",  { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
}

async function waitForElement(selector, timeout) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (document.querySelector(selector)) return true;
    await sleep(300);
  }
  return false;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
