// content.js — injected ONLY into https://redeem.hype.games/widget/
// DEBUG: Open browser DevTools console to see [PinManager] and [PinService] logs

if (!location.href.startsWith("https://redeem.hype.games/widget")) {
  throw new Error("[PinManager] Not the widget URL, skipping.");
}

const STORAGE_KEY = "pinmanager_state";   // chrome.storage.local key

const pinService = new PinService({ projectId: "pv-extract" });
// const pinService = new PinService({ projectId: "pin-checker-d183d" });
let running = false;

// ─── On page load — resume if state exists ────────────────────────────────────
window.addEventListener("load", async () => {
  await sleep(2000);

  const stored = await chromeGet(STORAGE_KEY);
  if (!stored || !stored.running) return;

  // If this load was triggered by the start message (pins is empty array set by message listener),
  // the message listener already called processQueue — don't double-run
  if (running) return;

  running = true;
  console.log("[PinManager] Resuming worker", stored.workerId, "— remaining:", stored.pins?.length);

  await waitForElement("#hpws-pin", 10000);
  await processQueue(stored.workerId, stored.token, stored.partitionId ?? null, stored.pins || []);
});

// ─── Message listener (from popup) ───────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "start") {
    if (running) { sendResponse({ ok: false, reason: "already running" }); return; }
    running = true;

    chromeSet(STORAGE_KEY, { running: true, workerId: msg.workerId, token: msg.token, partitionId: msg.partitionId, pins: [] })
      .then(() => waitForElement("#hpws-pin", 8000))
      .then(() => processQueue(msg.workerId, msg.token, msg.partitionId, []));

    sendResponse({ ok: true });
  }

  if (msg.action === "stop") {
    running = false;
    chromeRemove(STORAGE_KEY);
    sendResponse({ ok: true });
  }
});


async function processQueue(workerId, token, partitionId, pins) {
  if (!running) return;

  // Fetch all pending pins for this partition once — only on first run
  if (pins.length === 0) {
    let allPins = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        allPins = await pinService.fetchPartitionPins(token, partitionId);
        break;
      } catch (err) {
        console.warn(`[PinManager] fetchPartitionPins attempt ${attempt + 1} failed:`, err);
        if (attempt < 2) await sleep(2000);
      }
    }

    if (!allPins || allPins.length === 0) {
      console.log("[PinManager] No pending pins in partition", partitionId);
      await finishWorker(workerId);
      return;
    }

    pins = allPins;
    console.log("[PinManager] Fetched", pins.length, "pins for partition", partitionId);
    // Save full list to storage so reloads can resume
    await chromeSet(STORAGE_KEY, { running: true, workerId, token, partitionId, pins });
  }

  const { pin, docId } = pins[0];
  const remaining = pins.slice(1);

  const result = await tryPin(pin);

  if (result !== null) {
    const { available, category } = result;
    try {
      await pinService.updatePinDone(docId, available, token, category);
    } catch (err) {
      console.error("[PinManager] updatePinDone failed:", err);
    }
    await appendLocalResult(partitionId, { pin, available, category });
    chrome.runtime.sendMessage({ action: "pinResult", pin, docId, success: available }).catch(() => {});
  } else {
    console.warn("[PinManager] Skipped pin (validate-form still present):", pin);
  }

  // Save remaining and reload for next pin
  await chromeSet(STORAGE_KEY, { running: true, workerId, token, partitionId, pins: remaining });
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

  // Available if redeem-form is present
  if (container.querySelector("#redeem-form")) {
    // Find the h1 that contains a <strong> tag for the category
    const h1WithStrong = container.querySelector("h1 strong");
    const fullText = h1WithStrong?.textContent?.trim() || "";
    // e.g. "Free Fire - 1060 Diamantes + 10 de Bonus - Colombia" → "1060 Diamantes"
    const category = fullText.split("-")[1]?.split("+")[0]?.trim() || fullText;
    console.log({category , fullText})
    return { available: true, category };
  }

  // Any h1 present without redeem-form — unavailable
  if (container.querySelector("h1")) return { available: false, category: "" };

  return { available: false, category: "" };
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

async function appendLocalResult(partitionId, result) {
  const key      = `pinresults_${partitionId ?? "all"}`;
  const existing = await chromeGet(key) || [];
  existing.push(result);
  await chromeSet(key, existing);
}
