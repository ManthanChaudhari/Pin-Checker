// content.js — injected ONLY into https://redeem.hype.games/widget/
// DEBUG: Open browser DevTools console to see [PinManager] and [PinService] logs

if (!location.href.startsWith("https://redeem.hype.games/widget")) {
  throw new Error("[PinManager] Not the widget URL, skipping.");
}

const STORAGE_KEY = "pinmanager_state";   // chrome.storage.local key
const BUFFER_KEY  = "pinmanager_buffer";  // buffered results awaiting flush
const FLUSH_EVERY = 10;                   // flush to Firestore every N pins

const pinService = new PinService({ projectId: "pv-extract" });

let running = false;

// ─── On page load — resume if state exists ────────────────────────────────────
window.addEventListener("load", async () => {
  await sleep(2000);

  const stored = await chromeGet(STORAGE_KEY);
  if (!stored || !stored.running) return;

  if (running) return;

  running = true;
  console.log("[PinManager] Resuming worker", stored.workerId, "— remaining:", stored.pins?.length);

  // Flush any buffered results from before the reload
  await flushBuffer(stored.token);

  await waitForElement("#hpws-pin", 10000);
  await processQueue(stored.workerId, stored.token, stored.partitionId ?? null, stored.pins || []);
});

// ─── Message listener (from popup) ───────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "start") {
    if (running) { sendResponse({ ok: false, reason: "already running" }); return; }
    running = true;

    // Clear any stale buffer from previous runs
    chromeRemove(BUFFER_KEY);
    chromeSet(STORAGE_KEY, { running: true, workerId: msg.workerId, token: msg.token, partitionId: msg.partitionId, pins: [] })
      .then(() => waitForElement("#hpws-pin", 8000))
      .then(() => processQueue(msg.workerId, msg.token, msg.partitionId, []));

    sendResponse({ ok: true });
  }

  if (msg.action === "stop") {
    running = false;
    // Flush remaining buffer before stopping
    chromeGet(STORAGE_KEY).then(stored => {
      if (stored?.token) flushBuffer(stored.token);
    });
    chromeRemove(STORAGE_KEY);
    sendResponse({ ok: true });
  }
});


// ─── Buffer & Flush Logic ─────────────────────────────────────────────────────

/**
 * Add a result to the local buffer. Flush when buffer reaches FLUSH_EVERY.
 * Buffer format: { [docId]: [{ pinIndex, available, category }] }
 */
async function bufferResult(docId, pinIndex, available, category, token) {
  const buffer = await chromeGet(BUFFER_KEY) || {};
  if (!buffer[docId]) buffer[docId] = [];
  buffer[docId].push({ pinIndex, available, category });

  // Count total buffered results
  const totalBuffered = Object.values(buffer).reduce((sum, arr) => sum + arr.length, 0);
  await chromeSet(BUFFER_KEY, buffer);

  console.log(`[PinManager] Buffered result (${totalBuffered}/${FLUSH_EVERY})`);

  // Flush if we've hit the threshold
  if (totalBuffered >= FLUSH_EVERY) {
    await flushBuffer(token);
  }
}

/**
 * Flush all buffered results to Firestore.
 * Groups updates by docId and uses updateBatchDoc for each.
 */
async function flushBuffer(token) {
  const buffer = await chromeGet(BUFFER_KEY);
  if (!buffer || Object.keys(buffer).length === 0) return;

  console.log("[PinManager] Flushing buffer to Firestore...");

  for (const [docId, updates] of Object.entries(buffer)) {
    try {
      await pinService.updateBatchDoc(docId, updates, token);
      console.log(`[PinManager] Flushed ${updates.length} results to doc ${docId}`);
    } catch (err) {
      console.error(`[PinManager] Flush failed for doc ${docId}:`, err);
      // Keep failed entries in buffer for retry on next flush
      const currentBuffer = await chromeGet(BUFFER_KEY) || {};
      // Only keep this docId's entries if they weren't already cleared
      if (currentBuffer[docId]) {
        // Leave it for next attempt
        return;
      }
    }
  }

  // Clear buffer after successful flush
  await chromeRemove(BUFFER_KEY);
  console.log("[PinManager] Buffer flushed successfully");
}

// ─── Process queue (packed documents model + buffered writes) ────────────────
// pins array format: [{ docId, pinIndex, pin }]
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
      // Flush any remaining buffer before finishing
      await flushBuffer(token);
      await finishWorker(workerId);
      return;
    }

    pins = allPins;
    console.log("[PinManager] Fetched", pins.length, "pins for partition", partitionId);
    await chromeSet(STORAGE_KEY, { running: true, workerId, token, partitionId, pins });
  }

  const { pin, docId, pinIndex } = pins[0];
  const remaining = pins.slice(1);

  const result = await tryPin(pin);

  if (!running) return;

  if (result !== null) {
    const { available, category } = result;
    // Buffer the result instead of writing to Firestore immediately
    await bufferResult(docId, pinIndex, available, category, token);
    if (!running) return;
    await appendLocalResult(partitionId, { pin, available, category });
    chrome.runtime.sendMessage({ action: "pinResult", pin, docId, success: available }).catch(() => {});
  } else {
    console.warn("[PinManager] Skipped pin (validate-form still present):", pin);
  }

  if (!running) return;

  // If no more pins, flush buffer and finish
  if (remaining.length === 0) {
    await flushBuffer(token);
    await finishWorker(workerId);
    return;
  }

  // Save remaining and reload for next pin
  await chromeSet(STORAGE_KEY, { running: true, workerId, token, partitionId, pins: remaining });
  window.location.reload();
}

// ─── Worker finished ──────────────────────────────────────────────────────────
async function finishWorker(workerId) {
  running = false;
  await chromeRemove(STORAGE_KEY);
  await chromeRemove(BUFFER_KEY);
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

  // If validate-form is still present, check if a validation error was displayed
  if (container.querySelector("#validate-form")) {
    const currentErrorEl = container.querySelector(".hpws-form-element__error");
    const errorText = currentErrorEl ? currentErrorEl.textContent.trim() : "";
    if (errorText !== "") {
      console.log("[PinManager] Pin is invalid/unavailable. Form error:", errorText);
      return { available: false, category: "" };
    }
    return null;
  }

  // Available if redeem-form is present
  if (container.querySelector("#redeem-form")) {
    const h1WithStrong = container.querySelector("h1 strong");
    const fullText = h1WithStrong?.textContent?.trim() || "";
    const category = fullText.split("-")[1]?.split("+")[0]?.trim() || fullText;
    console.log({ category, fullText });
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
