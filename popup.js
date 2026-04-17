// ─── Firebase init ────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDxClYC9e2YmrbLITLmcj3daGD1pbj-8JA",
  authDomain: "pin-checker-d183d.firebaseapp.com",
  projectId: "pin-checker-d183d",
  storageBucket: "pin-checker-d183d.firebasestorage.app",
  messagingSenderId: "656085087991",
  appId: "1:656085087991:web:b2b5fa79f0b022e36985f2"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db   = firebase.firestore();
const auth = firebase.auth();

// ─── Service ──────────────────────────────────────────────────────────────────
const pinService = new PinService({ db, projectId: "pin-checker-d183d" });

const UUID_REGEX = /[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}/g;

// ─── Auth ─────────────────────────────────────────────────────────────────────
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
document.getElementById("login-pass").addEventListener("keydown", e => {
  if (e.key === "Enter") doLogin();
});

async function doLogin() {
  const email = document.getElementById("login-email").value.trim();
  const pass  = document.getElementById("login-pass").value;
  loginError.textContent = "";
  loginBtn.disabled = true;
  loginBtn.innerHTML = '<span class="spinner"></span> Signing in...';
  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch (_) {
    loginError.textContent = "Invalid email or password.";
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
  } else {
    previewCount.textContent = "No valid pins (UUIDs) found in this file.";
    uploadBtn.disabled = true;
  }
}

uploadBtn.addEventListener("click", async () => {
  if (!parsedPins.length) return;
  uploadBtn.disabled = true;
  uploadStatus.innerHTML = '<span class="spinner"></span> Uploading...';
  try {
    const uploaded = await pinService.uploadPins(parsedPins);
    uploadStatus.innerHTML = `<span class="success">✓ ${uploaded} pins uploaded successfully.</span>`;
    parsedPins = [];
    previewCount.textContent = "";
    fileInput.value = "";
  } catch (err) {
    uploadStatus.innerHTML = `<span class="error">✗ Error: ${err.message}</span>`;
    uploadBtn.disabled = false;
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

// ─── Automation ───────────────────────────────────────────────────────────────
const startBtn  = document.getElementById("start-btn");
const stopBtn   = document.getElementById("stop-btn");
const runStatus = document.getElementById("run-status");

startBtn.addEventListener("click", startAutomation);
stopBtn.addEventListener("click", stopAutomation);

async function startAutomation() {
  runStatus.textContent = "Fetching unchecked pins...";
  startBtn.style.display = "none";
  stopBtn.style.display = "block";

  // Always refresh stats first so local counters are accurate for live updates
  await loadStats();

  let pins;
  try {
    pins = await pinService.getUncheckedPins();
  } catch (err) {
    runStatus.innerHTML = `<span class="error">✗ ${err.message}</span>`;
    resetRunUI(); return;
  }

  if (!pins.length) {
    runStatus.textContent = "No unchecked pins to process.";
    resetRunUI(); return;
  }

  const total = pins.length;
  runStatus.textContent = `Starting — ${total} pins to process...`;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || (!tab.url.includes("canjea.me") && !tab.url.includes("redeem.hype.games"))) {
    runStatus.innerHTML = `<span class="error">Please open https://canjea.me or https://redeem.hype.games/widget/ in the active tab first.</span>`;
    resetRunUI(); return;
  }

  let processed = 0;
  const listener = (msg) => {
    if (msg.action === "pinResult") {
      processed = Math.min(processed + 1, total);
      runStatus.textContent = `Processing... ${processed}/${total} — Pin: ${msg.pin.slice(0, 8)}… ${msg.success ? "✓" : "✗"}`;
      // Pull real values from Firestore after each pin so dashboard is always accurate
      loadStats();
    }
    if (msg.action === "done") {
      chrome.runtime.onMessage.removeListener(listener);
      runStatus.innerHTML = `<span class="success">✓ Done — ${processed} pins processed.</span>`;
      stopAutomation();
      loadStats();
    }
  };
  chrome.runtime.onMessage.addListener(listener);

  const token = await auth.currentUser.getIdToken();

  // Find the widget iframe frame — retry up to 10s in case it's still loading
  runStatus.textContent = `Connecting to widget frame...`;
  const widgetFrame = await findWidgetFrame(tab.id, 10000);

  if (!widgetFrame) {
    runStatus.innerHTML = `<span class="error">Widget iframe not found. Make sure https://canjea.me is open and fully loaded.</span>`;
    resetRunUI(); return;
  }

  // Send start message — retry until content script is ready
  const sent = await sendToFrame(tab.id, widgetFrame.frameId, { action: "start", pins, token }, 8000);
  if (!sent) {
    runStatus.innerHTML = `<span class="error">Could not reach content script in widget frame. Try reloading the page.</span>`;
    resetRunUI(); return;
  }
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
      const found = frames && frames.find(f => f.url && f.url.startsWith("https://redeem.hype.games/widget/"));
      if (found) return found;
    } catch (_) {}
    await new Promise(r => setTimeout(r, 500));
  }
  return null;
}

/** Send a message to a specific frame, retrying until content script responds or timeout */
async function sendToFrame(tabId, frameId, msg, timeout) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await chrome.tabs.sendMessage(tabId, msg, { frameId });
      return true; // success
    } catch (_) {
      // Content script not ready yet — wait and retry
      await new Promise(r => setTimeout(r, 600));
    }
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
    const pins = await pinService.downloadPins(activeFilter);
    if (!pins.length) {
      downloadStatus.innerHTML = `<span class="error">No pins found for this filter.</span>`;
      downloadBtn.disabled = false; return;
    }
    const isCSV    = activeFormat === "csv";
    const content  = isCSV ? "pin\n" + pins.join("\n") : pins.join("\n");
    const filename = `pins_${activeFilter}.${activeFormat}`;
    const blob     = new Blob([content], { type: isCSV ? "text/csv" : "text/plain" });
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    downloadStatus.innerHTML = `<span class="success">✓ Downloaded ${pins.length} pins.</span>`;
    downloadInfo.textContent = `Last export: ${pins.length} pins (${activeFilter})`;
  } catch (err) {
    downloadStatus.innerHTML = `<span class="error">✗ ${err.message}</span>`;
  } finally {
    downloadBtn.disabled = false;
  }
});
