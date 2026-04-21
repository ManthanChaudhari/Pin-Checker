// content.js — injected ONLY into https://redeem.hype.games/widget/
// DEBUG: Open browser DevTools console to see [PinManager] and [PinService] logs

if (!location.href.startsWith("https://redeem.hype.games/widget")) {
  throw new Error("[PinManager] Not the widget URL, skipping.");
}

const STORAGE_KEY  = "pinmanager_state";   // chrome.storage.local key
const BATCH_SIZE   = 5;
const LOCK_TIMEOUT = 5 * 60 * 1000;       // 5 min stale lock reclaim

const pinService = new PinService({ projectId: "pin-checker-d183d" });
let running = false;

// ─── On page load — resume if state exists ────────────────────────────────────
window.addEventListener("load", async () => {
  await sleep(2000);

  const stored = await chromeGet(STORAGE_KEY);
  if (!stored || !stored.running) return;

  running = true;
  console.log("[PinManager] Resuming worker", stored.workerId, "— remaining:", stored.pins?.length);

  await waitForElement("#hpws-pin", 10000);
  await processQueue(stored.workerId, stored.token, stored.pins || []);
});

// ─── Message listener (from popup) ───────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "start") {
    if (running) { sendResponse({ ok: false, reason: "already running" }); return; }
    running = true;

    // Bootstrap: save initial state then kick off
    chromeSet(STORAGE_KEY, { running: true, workerId: msg.workerId, token: msg.token, pins: [] })
      .then(() => waitForElement("#hpws-pin", 8000))
      .then(() => processQueue(msg.workerId, msg.token, []));

    sendResponse({ ok: true });
  }

  if (msg.action === "stop") {
    running = false;
    chromeRemove(STORAGE_KEY);
    sendResponse({ ok: true });
  }
});


async function processQueue(workerId, token, pins) {
  if (!running) return;

  // Fetch a new batch when current list is exhausted
  if (pins.length === 0) {
    try { await pinService.reclaimStalePins(token, LOCK_TIMEOUT); } catch (_) {}

    let batch = null;
    // Retry up to 3 times in case of transient network errors
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        batch = await pinService.fetchAndLockBatch(workerId, token, BATCH_SIZE);
        break;
      } catch (err) {
        console.warn(`[PinManager] fetchAndLockBatch attempt ${attempt + 1} failed:`, err);
        if (attempt < 2) await sleep(2000);
      }
    }

    if (!batch || batch.length === 0) {
      console.log("[PinManager] No more pending pins — worker done.");
      await finishWorker(workerId);
      return;
    }

    pins = batch;
    console.log("[PinManager] Locked batch of", pins.length, "pins");
  }

  const { pin, docId } = pins[0];
  const remaining = pins.slice(1);

  const success = await tryPin(pin);

  // null means the form wasn't submitted properly — skip without updating Firestore
  if (success !== null) {
    try {
      await pinService.updatePinDone(docId, success, token);
    } catch (err) {
      console.error("[PinManager] updatePinDone failed:", err);
    }
    chrome.runtime.sendMessage({ action: "pinResult", pin, docId, success }).catch(() => {});
  } else {
    console.warn("[PinManager] Skipped pin (validate-form still present):", pin);
  }

  // Always reload — the target site resets its UI after each submission
  await chromeSet(STORAGE_KEY, { running: true, workerId, token, pins: remaining });
  window.location.reload();
}

// ─── Worker finished ──────────────────────────────────────────────────────────
async function finishWorker(workerId) {
  running = false;
  await chromeRemove(STORAGE_KEY);
  chrome.runtime.sendMessage({ action: "done", workerId }).catch(() => {});
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

  const contentEl = document.querySelector(".hpws-content");

  btn.click();
  await sleep(3000);

  const container = contentEl || document.body;

  // If validate-form is still present, submission didn't go through — skip this pin
  if (container.querySelector("#validate-form")) return null;

  // Available if h1 exists AND redeem-form is present
  const h1 = container.querySelector("h1");
  if (h1 && container.querySelector("#redeem-form")) return true;

  // Only h1 present (no redeem-form) — unavailable
  if (h1) return false;

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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// chrome.storage.local promise wrappers
function chromeGet(key) {
  return new Promise(resolve => chrome.storage.local.get(key, r => resolve(r[key] || null)));
}
function chromeSet(key, val) {
  return new Promise(resolve => chrome.storage.local.set({ [key]: val }, resolve));
}
function chromeRemove(key) {
  return new Promise(resolve => chrome.storage.local.remove(key, resolve));
}
