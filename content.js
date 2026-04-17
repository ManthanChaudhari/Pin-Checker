// content.js — injected ONLY into https://redeem.hype.games/widget/

const STORAGE_KEY = "pinmanager_queue";
const TOKEN_KEY   = "pinmanager_token";

if (!location.href.startsWith("https://redeem.hype.games/widget/")) {
  throw new Error("[PinManager] Not the widget URL, skipping.");
}

const pinService = new PinService({ projectId: "pin-checker-d183d" });
let running = false;

// ─── On load ──────────────────────────────────────────────────────────────────
window.addEventListener("load", async () => {
  await sleep(2000);

  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  let state;
  try { state = JSON.parse(raw); } catch (_) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }

  // Only resume if explicitly marked running AND has pins
  if (!state.running || !Array.isArray(state.pins) || state.pins.length === 0) {
    // Clean stale state — do NOT send "done" here, it was already sent
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    return;
  }

  running = true;
  await waitForElement("#hpws-pin", 10000);
  await processPins(state.pins);
});

// ─── Message listener ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "start") {
    if (running) { sendResponse({ ok: false, reason: "already running" }); return; }

    if (msg.token) sessionStorage.setItem(TOKEN_KEY, msg.token);
    // Write queue AFTER setting running=true so load event won't race
    running = true;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ running: true, pins: msg.pins }));

    waitForElement("#hpws-pin", 8000).then(() => processPins(msg.pins));
    sendResponse({ ok: true });
  }

  if (msg.action === "stop") {
    running = false;
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sendResponse({ ok: true });
  }
});

// ─── Main loop ────────────────────────────────────────────────────────────────
async function processPins(pins) {
  if (!running || !pins || pins.length === 0) {
    running = false;
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    chrome.runtime.sendMessage({ action: "done" }).catch(() => {});
    return;
  }

  const { pin, docId } = pins[0];
  const remaining      = pins.slice(1);

  const success = await tryPin(pin);

  // Update Firestore
  const token = sessionStorage.getItem(TOKEN_KEY);
  try {
    await pinService.updatePinAvailability(docId, success, token);
  } catch (err) {
    console.error("[PinManager] Firestore update failed:", err);
  }

  // Notify popup
  chrome.runtime.sendMessage({ action: "pinResult", pin, docId, success }).catch(() => {});

  if (remaining.length > 0) {
    // Save ONLY remaining, keep running:true, then reload
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ running: true, pins: remaining }));
    window.location.reload();
    // Dies here — load event resumes with remaining
  } else {
    // Last pin — clear everything THEN send done (no reload)
    running = false;
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    chrome.runtime.sendMessage({ action: "done" }).catch(() => {});
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
  await sleep(5000);

  const container = contentEl || document.body;
  const h1 = container.querySelector("h1");

  if (h1 && h1.textContent.includes("Esse PIN já foi utilizado")) return false;
  if (container.innerHTML !== beforeHTML) return true;
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
