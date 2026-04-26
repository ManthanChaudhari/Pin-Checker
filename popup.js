// ─── Firebase init ────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyA5FcPE7xE0DLPlyIQ2Snk667Gqz1UlH4I",
  authDomain: "pv-extract.firebaseapp.com",
  projectId: "pv-extract",
  storageBucket: "pv-extract.firebasestorage.app",
  messagingSenderId: "17827015798",
  appId: "1:17827015798:web:790c74368a2605d7848357"
};
// const firebaseConfig = {
//   apiKey: "AIzaSyDxClYC9e2YmrbLITLmcj3daGD1pbj-8JA",
//   authDomain: "pin-checker-d183d.firebaseapp.com",
//   projectId: "pin-checker-d183d",
//   storageBucket: "pin-checker-d183d.firebasestorage.app",
//   messagingSenderId: "656085087991",
//   appId: "1:656085087991:web:b2b5fa79f0b022e36985f2"
// };

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db   = firebase.firestore();
const auth = firebase.auth();

// ─── Service ──────────────────────────────────────────────────────────────────
const pinService = new PinService({ db, projectId: "pv-extract" });
// const pinService = new PinService({ db, projectId: "pin-checker-d183d" });

const UUID_REGEX = /[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}/g;

// ─── Auth ─────────────────────────────────────────────────────────────────────
const HARDCODED_EMAIL = "chaudharimanthan05@gmail.com";
const HARDCODED_PASS  = "Manthan.pinCheck@03";

const loginScreen = document.getElementById("login-screen");
const appDiv      = document.getElementById("app");
const loginBtn    = document.getElementById("login-btn");
const loginError  = document.getElementById("login-error");

auth.onAuthStateChanged(user => {
  if (user) {
    loginScreen.style.display = "none";
    appDiv.style.display = "block";
  } else {
    loginScreen.style.display = "flex";
    appDiv.style.display = "none";
  }
});

loginBtn.addEventListener("click", doLogin);

async function doLogin() {
  loginError.textContent = "";
  loginBtn.disabled = true;
  loginBtn.innerHTML = '<span class="spinner"></span> Signing in...';
  try {
    await auth.signInWithEmailAndPassword(HARDCODED_EMAIL, HARDCODED_PASS);
  } catch (_) {
    loginError.textContent = "Sign in failed. Please try again.";
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Sign In";
  }
}

// ─── Tab switching ────────────────────────────────────────────────────────────
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "dashboard") loadStats();
  });
});

// ─── Upload Tab ───────────────────────────────────────────────────────────────
let parsedPins = [];

const dropZone    = document.getElementById("drop-zone");
const fileInput   = document.getElementById("file-input");
const uploadBtn   = document.getElementById("upload-btn");
const uploadStatus = document.getElementById("upload-status");
const previewCount = document.getElementById("preview-count");

dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("dragover"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", e => {
  e.preventDefault(); dropZone.classList.remove("dragover");
  handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", () => handleFile(fileInput.files[0]));

function handleFile(file) {
  if (!file) return;
  uploadStatus.textContent = "";
  previewCount.textContent = "Reading file...";
  uploadBtn.disabled = true;
  const reader = new FileReader();
  if (file.name.toLowerCase().endsWith(".csv")) {
    reader.onload = e => extractFromText(e.target.result, file.name);
    reader.readAsText(file);
  } else {
    reader.onload = e => {
      try {
        const wb    = XLSX.read(e.target.result, { type: "binary" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        extractFromText(XLSX.utils.sheet_to_csv(sheet), file.name);
      } catch (_) { previewCount.textContent = "Failed to parse Excel file."; }
    };
    reader.readAsBinaryString(file);
  }
}

function extractFromText(text, filename) {
  const matches = text.match(UUID_REGEX) || [];
  parsedPins = [...new Set(matches.map(p => p.toUpperCase()))];
  if (parsedPins.length > 0) {
    previewCount.textContent = `✓ Found ${parsedPins.length} unique pin(s) in "${filename}"`;
    uploadBtn.disabled = false;
    updatePartitionPreview();
  } else {
    previewCount.textContent = "No valid pins (UUIDs) found in this file.";
    uploadBtn.disabled = true;
  }
}

function updatePartitionPreview() {
  const sizeInput = document.getElementById("partition-size");
  const preview   = document.getElementById("partition-preview");
  if (!sizeInput || !preview || !parsedPins.length) return;
  const size       = Math.max(1, parseInt(sizeInput.value) || 500);
  const partitions = Math.ceil(parsedPins.length / size);
  preview.textContent = `→ ${partitions} partition(s) of ~${size} pins each — run ${partitions} browser(s)`;
}

document.getElementById("partition-size")?.addEventListener("input", updatePartitionPreview);

uploadBtn.addEventListener("click", async () => {
  if (!parsedPins.length) return;
  uploadBtn.disabled = true;
  uploadStatus.innerHTML = '<span class="spinner"></span> Uploading...';
  try {
    const partitionSize = Math.max(1, parseInt(document.getElementById("partition-size")?.value) || 500);
    const { uploaded, totalPartitions } = await pinService.uploadPins(parsedPins, partitionSize);
    uploadStatus.innerHTML = `<span class="success">✓ ${uploaded} pins uploaded across ${totalPartitions} partition(s).</span>`;
    // Store partition info for the dashboard selector
    await new Promise(r => chrome.storage.local.set({ totalPartitions }, r));
    updatePartitionSelector(totalPartitions);
    parsedPins = [];
    previewCount.textContent = "";
    fileInput.value = "";
  } catch (err) {
    uploadStatus.innerHTML = `<span class="error">✗ Error: ${err.message}</span>`;
    uploadBtn.disabled = false;
  }
});

// ─── Delete ───────────────────────────────────────────────────────────────────
let activeDelFilter = "all";

document.querySelectorAll(".del-filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".del-filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeDelFilter = btn.dataset.del;
  });
});

document.getElementById("delete-btn").addEventListener("click", async () => {
  const deleteBtn    = document.getElementById("delete-btn");
  const deleteStatus = document.getElementById("delete-status");

  const label = activeDelFilter === "all" ? "ALL" : activeDelFilter;
  if (!confirm(`Delete all ${label} pins? This cannot be undone.`)) return;

  deleteBtn.disabled = true;
  deleteStatus.innerHTML = '<span class="spinner"></span> Deleting...';
  try {
    const deleted = await pinService.deletePins(activeDelFilter);
    deleteStatus.innerHTML = `<span class="success">✓ ${deleted} pins deleted.</span>`;
  } catch (err) {
    deleteStatus.innerHTML = `<span class="error">✗ ${err.message}</span>`;
  } finally {
    deleteBtn.disabled = false;
  }
});

// ─── Dashboard Tab ────────────────────────────────────────────────────────────
async function loadStats() {
  const dashStatus = document.getElementById("dash-status");
  dashStatus.innerHTML = '<span class="spinner"></span> Loading...';
  setStatEls("—", "—", "—", "—");
  try {
    const { total, available, unavailable, unchecked } = await pinService.getStats();
    _localTotal = total; _localAvailable = available;
    _localUnavailable = unavailable; _localUnchecked = unchecked;
    setStatEls(total, available, unavailable, unchecked);
    dashStatus.textContent = "";
  } catch (err) {
    dashStatus.innerHTML = `<span class="error">✗ ${err.message}</span>`;
  }
}

function setStatEls(total, available, unavailable, unchecked) {
  document.getElementById("stat-total").textContent       = total;
  document.getElementById("stat-available").textContent   = available;
  document.getElementById("stat-unavailable").textContent = unavailable;
  const el = document.getElementById("stat-unchecked");
  if (el) el.textContent = unchecked;
}

document.getElementById("refresh-btn").addEventListener("click", loadStats);

// Load saved partition count on popup open and restore running state
(async () => {
  const stored = await new Promise(r => chrome.storage.local.get(["totalPartitions", "pinmanager_state"], r));
  if (stored.totalPartitions) updatePartitionSelector(stored.totalPartitions);

  // If a worker is actively running, restore the stop button
  const state = stored["pinmanager_state"];
  if (state && state.running) {
    startBtn.style.display = "none";
    stopBtn.style.display  = "block";
    runStatus.textContent  = "Worker running...";
  }
})();

function updatePartitionSelector(totalPartitions) {
  const select = document.getElementById("partition-select");
  const info   = document.getElementById("partition-info");
  if (!select || !info) return;
  select.innerHTML = "";
  for (let i = 0; i < totalPartitions; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `Partition ${i} (~${Math.ceil(500)} pins)`;
    select.appendChild(opt);
  }
  info.textContent = `${totalPartitions} partition(s) — run ${totalPartitions} browser(s) in parallel, one per partition.`;
}

// ─── Automation ───────────────────────────────────────────────────────────────
const startBtn  = document.getElementById("start-btn");
const stopBtn   = document.getElementById("stop-btn");
const runStatus = document.getElementById("run-status");

startBtn.addEventListener("click", startAutomation);
stopBtn.addEventListener("click", stopAutomation);

async function startAutomation() {
  runStatus.textContent = "Starting worker...";
  startBtn.style.display = "none";
  stopBtn.style.display = "block";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !tab.url.includes("redeem.hype.games")) {
    runStatus.innerHTML = `<span class="error">Please open https://redeem.hype.games/widget/ in the active tab first.</span>`;
    resetRunUI(); return;
  }

  const stored = await new Promise(r => chrome.storage.local.get(["workerId", "totalPartitions"], r));
  const workerId       = stored.workerId || crypto.randomUUID();
  const totalPartitions = stored.totalPartitions || 1;
  await new Promise(r => chrome.storage.local.set({ workerId }, r));

  // Read selected partition from UI
  const partitionSelect = document.getElementById("partition-select");
  const partitionId     = partitionSelect ? parseInt(partitionSelect.value) : null;

  const token = await auth.currentUser.getIdToken();

  runStatus.textContent = "Reloading page to inject content script...";
  await chrome.tabs.reload(tab.id);

  runStatus.textContent = "Waiting for page to load...";
  const widgetFrame = await findWidgetFrame(tab.id, 15000);
  if (!widgetFrame) {
    runStatus.innerHTML = `<span class="error">Widget iframe not found after reload. Make sure https://redeem.hype.games/widget is open.</span>`;
    resetRunUI(); return;
  }

  await new Promise(r => setTimeout(r, 1500));

  let processed = 0;
  const listener = (msg) => {
    if (msg.action === "pinResult") {
      processed++;
      runStatus.textContent = `Processing... ${processed} done — Pin: ${msg.pin.slice(0, 8)}… ${msg.success ? "✓" : "✗"}`;
    }
    if (msg.action === "done") {
      chrome.runtime.onMessage.removeListener(listener);
      runStatus.innerHTML = `<span class="success">✓ Done — ${processed} pins processed.</span>`;
      stopAutomation();
      loadStats();
    }
  };
  chrome.runtime.onMessage.addListener(listener);

  runStatus.textContent = "Connecting to widget frame...";
  const widgetFrame2 = await findWidgetFrame(tab.id, 10000);
  if (!widgetFrame2) {
    runStatus.innerHTML = `<span class="error">Widget iframe not found. Make sure https://redeem.hype.games/widget is open and fully loaded.</span>`;
    chrome.runtime.onMessage.removeListener(listener);
    resetRunUI(); return;
  }

  const sent = await sendToFrame(tab.id, widgetFrame2.frameId, { action: "start", workerId, token, partitionId }, 8000);
  if (!sent) {
    runStatus.innerHTML = `<span class="error">Could not reach content script. Try reloading the page.</span>`;
    chrome.runtime.onMessage.removeListener(listener);
    resetRunUI(); return;
  }

  const partLabel = partitionId !== null ? ` (Partition ${partitionId})` : "";
  runStatus.textContent = `Worker ${workerId.slice(0, 8)}…${partLabel} running...`;
}

async function stopAutomation() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    const widgetFrame = await findWidgetFrame(tab.id, 3000);
    if (widgetFrame) {
      sendToFrame(tab.id, widgetFrame.frameId, { action: "stop" }, 2000).catch(() => {});
    }
  }
  runStatus.textContent = "Stopped.";
  resetRunUI();
}

// ─── Frame helpers ────────────────────────────────────────────────────────────

/** Poll until the widget frame appears in the tab, up to `timeout` ms */
async function findWidgetFrame(tabId, timeout) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const frames = await chrome.webNavigation.getAllFrames({ tabId });
      const found = frames && frames.find(f => f.url && f.url.startsWith("https://redeem.hype.games/widget"));
      if (found) return found;
    } catch (_) {}
    await new Promise(r => setTimeout(r, 500));
  }
  return null;
}

/** Send a message to a specific frame, retrying until content script confirms or timeout */
async function sendToFrame(tabId, frameId, msg, timeout) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, msg, { frameId }, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null); // not ready yet
        } else {
          resolve(response);
        }
      });
    });
    // Content script responds with { ok: true/false } — any response means it's alive
    if (result !== null && result !== undefined) return true;
    await new Promise(r => setTimeout(r, 700));
  }
  return false;
}

function resetRunUI() {
  startBtn.style.display = "block";
  stopBtn.style.display = "none";
}

// ─── Download Tab ─────────────────────────────────────────────────────────────
let activeFilter = "all";
let activeFormat = "csv";

document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = btn.dataset.filter;
  });
});

document.querySelectorAll(".format-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".format-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeFormat = btn.dataset.format;
  });
});

document.getElementById("download-btn").addEventListener("click", async () => {
  const downloadBtn    = document.getElementById("download-btn");
  const downloadStatus = document.getElementById("download-status");
  const downloadInfo   = document.getElementById("download-info");

  downloadBtn.disabled = true;
  downloadStatus.innerHTML = '<span class="spinner"></span> Fetching pins...';
  try {
    const rows = await pinService.downloadPins(activeFilter);
    if (!rows.length) {
      downloadStatus.innerHTML = `<span class="error">No pins found for this filter.</span>`;
      downloadBtn.disabled = false; return;
    }

    let content, filename;
    if (activeFormat === "csv") {
      // Two columns: pin, status
      content  = "pin,status\n" + rows.map(r => `${r.pin},${r.status}`).join("\n");
      filename = `pins_${activeFilter}.csv`;
    } else {
      // TXT: tab-separated
      content  = "pin\tstatus\n" + rows.map(r => `${r.pin}\t${r.status}`).join("\n");
      filename = `pins_${activeFilter}.txt`;
    }

    const mime = activeFormat === "csv" ? "text/csv" : "text/plain";
    const blob = new Blob([content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    downloadStatus.innerHTML = `<span class="success">✓ Downloaded ${rows.length} pins.</span>`;
    downloadInfo.textContent = `Last export: ${rows.length} pins (${activeFilter})`;
  } catch (err) {
    downloadStatus.innerHTML = `<span class="error">✗ ${err.message}</span>`;
  } finally {
    downloadBtn.disabled = false;
  }
});
