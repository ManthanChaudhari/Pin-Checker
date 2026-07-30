// ─── Localization ─────────────────────────────────────────────────────────────
const i18n = {
  en: {
    // Header & Login
    title: "Pin Manager",
    signIn: "Sign In",
    signingIn: "Signing in...",
    signInFailed: "Sign in failed. Please try again.",

    // Tabs
    tabUpload: "Upload",
    tabDashboard: "Dashboard",
    tabDownload: "Download",

    // Upload Tab
    dropZoneText: "Drop your Excel / CSV file here",
    dropZoneOr: "or click to browse",
    readingFile: "Reading file...",
    failedParseExcel: "Failed to parse Excel file.",
    foundPins: "✓ Found {count} unique pin(s) in \"{filename}\"",
    noValidPins: "No valid pins (UUIDs) found in this file.",
    pinsPerPartition: "Pins per partition:",
    partitionPreview: "→ {partitions} partition(s) of ~{size} pins each — run {partitions} browser(s)",
    uploadBtn: "Upload Pins to Firestore",
    uploading: "Uploading...",
    uploadedSuccess: "✓ {uploaded} pins uploaded across {totalPartitions} partition(s).",
    uploadError: "✗ Error: {message}",
    deletePinsLabel: "Delete pins:",
    delAll: "All",
    delAvailable: "Available",
    delUnavailable: "Unavailable",
    delUnchecked: "Unchecked",
    deleteBtn: "Delete Pins",
    deleting: "Deleting...",
    deletedSuccess: "✓ {deleted} pins deleted.",
    confirmDelete: "Delete all {label} pins? This cannot be undone.",

    // Dashboard Tab
    statTotal: "Total",
    statUnchecked: "Unchecked",
    statAvailable: "Available",
    statUnavailable: "Unavailable",
    loading: "Loading...",
    refreshBtn: "Refresh Stats",
    partitionLabel: "Partition (browser assignment):",
    noPartition: "— No partition (all pins) —",
    partitionInfo: "{totalPartitions} partition(s) — run {totalPartitions} browser(s) in parallel, one per partition.",
    startBtn: "Start",
    stopBtn: "Stop",
    startingWorker: "Starting worker...",
    openWidgetError: "Please open https://redeem.hype.games/widget/ in the active tab first.",
    reloadingPage: "Reloading page to inject content script...",
    waitingPageLoad: "Waiting for page to load...",
    widgetFrameError: "Widget iframe not found after reload. Make sure https://redeem.hype.games/widget is open.",
    widgetFrameError2: "Widget iframe not found. Make sure https://redeem.hype.games/widget is open and fully loaded.",
    connectingFrame: "Connecting to widget frame...",
    unreachableScript: "Could not reach content script. Try reloading the page.",
    workerRunning: "Worker {workerId}…{partLabel} running...",
    workerRunningMsg: "Worker running...",
    processingStatus: "Processing... {processed} done — Pin: {pin}… {status}",
    doneStatus: "✓ Done — {processed} pins processed.",
    stopped: "Stopped.",

    // Download Tab
    filterPinsLabel: "Filter pins to download:",
    filterAll: "All",
    filterAvailable: "Available",
    filterUnavailable: "Unavailable",
    formatLabel: "Format:",
    downloadBtn: "Download Pins",
    fetchingPins: "Fetching pins...",
    noPinsFound: "No pins found for this filter.",
    downloadSuccess: "✓ Downloaded {count} pins ({source}).",
    lastExport: "Last export: {count} pins ({filter})"
  },
  es: {
    // Header & Login
    title: "Gestor de Pines",
    signIn: "Iniciar Sesión",
    signingIn: "Iniciando sesión...",
    signInFailed: "Error al iniciar sesión. Por favor, inténtelo de nuevo.",

    // Tabs
    tabUpload: "Subir",
    tabDashboard: "Tablero",
    tabDownload: "Descargar",

    // Upload Tab
    dropZoneText: "Arrastre su archivo Excel / CSV aquí",
    dropZoneOr: "o haga clic para buscar",
    readingFile: "Leyendo archivo...",
    failedParseExcel: "Error al analizar el archivo Excel.",
    foundPins: "✓ Se encontraron {count} pin(es) único(s) en \"{filename}\"",
    noValidPins: "No se encontraron pines válidos (UUIDs) en este archivo.",
    pinsPerPartition: "Pines por partición:",
    partitionPreview: "→ {partitions} partición(es) de ~{size} pines cada una — ejecute {partitions} navegador(es)",
    uploadBtn: "Subir Pines a Firestore",
    uploading: "Subiendo...",
    uploadedSuccess: "✓ {uploaded} pines subidos en {totalPartitions} partición(es).",
    uploadError: "✗ Error: {message}",
    deletePinsLabel: "Eliminar pines:",
    delAll: "Todos",
    delAvailable: "Disponibles",
    delUnavailable: "No disponibles",
    delUnchecked: "Sin verificar",
    deleteBtn: "Eliminar Pines",
    deleting: "Eliminando...",
    deletedSuccess: "✓ {deleted} pines eliminados.",
    confirmDelete: "¿Eliminar todos los pines {label}? Esto no se puede deshacer.",

    // Dashboard Tab
    statTotal: "Total",
    statUnchecked: "Sin verificar",
    statAvailable: "Disponibles",
    statUnavailable: "No disponibles",
    loading: "Cargando...",
    refreshBtn: "Actualizar Estadísticas",
    partitionLabel: "Partición (asignación del navegador):",
    noPartition: "— Sin partición (todos los pines) —",
    partitionInfo: "{totalPartitions} partición(es) — ejecute {totalPartitions} navegador(es) en paralelo, uno por partición.",
    startBtn: "Iniciar",
    stopBtn: "Detener",
    startingWorker: "Iniciando trabajador...",
    openWidgetError: "Por favor, abra primero https://redeem.hype.games/widget/ en la pestaña activa.",
    reloadingPage: "Recargando página para inyectar script de contenido...",
    waitingPageLoad: "Esperando que la página cargue...",
    widgetFrameError: "No se encontró el iframe del widget después de recargar. Asegúrese de que https://redeem.hype.games/widget esté abierto.",
    widgetFrameError2: "No se encontró el iframe del widget. Asegúrese de que https://redeem.hype.games/widget esté abierto y completamente cargado.",
    connectingFrame: "Conectando al iframe del widget...",
    unreachableScript: "No se pudo comunicar con el script de contenido. Intente recargar la página.",
    workerRunning: "Trabajador {workerId}…{partLabel} ejecutándose...",
    workerRunningMsg: "Trabajador ejecutándose...",
    processingStatus: "Procesando... {processed} listos — Pin: {pin}… {status}",
    doneStatus: "✓ Completado — {processed} pines procesados.",
    stopped: "Detenido.",

    // Download Tab
    filterPinsLabel: "Filtrar pines para descargar:",
    filterAll: "Todos",
    filterAvailable: "Disponibles",
    filterUnavailable: "No disponibles",
    formatLabel: "Formato:",
    downloadBtn: "Descargar Pines",
    fetchingPins: "Obteniendo pines...",
    noPinsFound: "No se encontraron pines para este filtro.",
    downloadSuccess: "✓ Se descargaron {count} pines ({source}).",
    lastExport: "Última exportación: {count} pines ({filter})"
  }
};

let currentLang = "es";

function setLanguage(lang) {
  currentLang = lang;
  chrome.storage.local.set({ appLanguage: lang });

  const langSelect = document.getElementById("lang-select");
  if (langSelect) langSelect.value = lang;

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    if (i18n[lang] && i18n[lang][key]) {
      const text = i18n[lang][key];
      if (key === 'tabUpload') {
        el.innerHTML = `📤 ${text}`;
      } else if (key === 'tabDashboard') {
        el.innerHTML = `📊 ${text}`;
      } else if (key === 'tabDownload') {
        el.innerHTML = `📥 ${text}`;
      } else if (key === 'deleteBtn') {
        el.innerHTML = `🗑 ${text}`;
      } else if (key === 'refreshBtn') {
        el.innerHTML = `↻ ${text}`;
      } else if (key === 'startBtn') {
        el.innerHTML = `▶ ${text}`;
      } else if (key === 'stopBtn') {
        el.innerHTML = `■ ${text}`;
      } else {
        el.textContent = text;
      }
    }
  });

  // Re-trigger updates
  updatePartitionPreview();
}

function t(key, params = {}) {
  let text = i18n[currentLang]?.[key] || i18n["en"][key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(`{${k}}`, v);
  }
  return text;
}

// ─── Firebase init ────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyA5FcPE7xE0DLPlyIQ2Snk667Gqz1UlH4I",
  authDomain: "pv-extract.firebaseapp.com",
  projectId: "pv-extract",
  storageBucket: "pv-extract.firebasestorage.app",
  messagingSenderId: "17827015798",
  appId: "1:17827015798:web:790c74368a2605d7848357"
};


if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db   = firebase.firestore();
const auth = firebase.auth();

// ─── Service ──────────────────────────────────────────────────────────────────
const pinService = new PinService({ db, projectId: "pv-extract" });


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

// Load language preference
chrome.storage.local.get("appLanguage", data => {
  if (data.appLanguage) {
    setLanguage(data.appLanguage);
  } else {
    // Default to Spanish
    setLanguage("es");
  }
});

// Setup language listener
document.getElementById("lang-select")?.addEventListener("change", (e) => {
  setLanguage(e.target.value);
});

loginBtn.addEventListener("click", doLogin);

async function doLogin() {
  loginError.textContent = "";
  loginBtn.disabled = true;
  loginBtn.innerHTML = `<span class="spinner"></span> ${t('signingIn')}`;
  try {
    await auth.signInWithEmailAndPassword(HARDCODED_EMAIL, HARDCODED_PASS);
  } catch (_) {
    loginError.textContent = t('signInFailed');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = t('signIn');
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
  previewCount.textContent = t('readingFile');
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
      } catch (_) { previewCount.textContent = t('failedParseExcel'); }
    };
    reader.readAsBinaryString(file);
  }
}

function extractFromText(text, filename) {
  const matches = text.match(UUID_REGEX) || [];
  parsedPins = [...new Set(matches.map(p => p.toUpperCase()))];
  if (parsedPins.length > 0) {
    previewCount.textContent = t('foundPins', { count: parsedPins.length, filename });
    uploadBtn.disabled = false;
    updatePartitionPreview();
  } else {
    previewCount.textContent = t('noValidPins');
    uploadBtn.disabled = true;
  }
}

function updatePartitionPreview() {
  const sizeInput = document.getElementById("partition-size");
  const preview   = document.getElementById("partition-preview");
  if (!sizeInput || !preview || !parsedPins.length) return;
  const size       = Math.max(1, parseInt(sizeInput.value) || 500);
  const partitions = Math.ceil(parsedPins.length / size);
  preview.textContent = t('partitionPreview', { partitions, size });
}

document.getElementById("partition-size")?.addEventListener("input", updatePartitionPreview);

uploadBtn.addEventListener("click", async () => {
  if (!parsedPins.length) return;
  uploadBtn.disabled = true;
  uploadStatus.innerHTML = `<span class="spinner"></span> ${t('uploading')}`;
  try {
    const partitionSize = Math.max(1, parseInt(document.getElementById("partition-size")?.value) || 500);
    const { uploaded, totalPartitions } = await pinService.uploadPins(parsedPins, partitionSize);
    uploadStatus.innerHTML = `<span class="success">${t('uploadedSuccess', { uploaded, totalPartitions })}</span>`;
    // Store partition info for the dashboard selector
    await new Promise(r => chrome.storage.local.set({ totalPartitions }, r));
    updatePartitionSelector(totalPartitions);
    parsedPins = [];
    previewCount.textContent = "";
    fileInput.value = "";
  } catch (err) {
    uploadStatus.innerHTML = `<span class="error">${t('uploadError', { message: err.message })}</span>`;
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

  const labelKey = activeDelFilter === "all" ? "delAll" : activeDelFilter === "available" ? "delAvailable" : activeDelFilter === "unavailable" ? "delUnavailable" : "delUnchecked";
  const translatedLabel = t(labelKey);
  if (!confirm(t('confirmDelete', { label: translatedLabel }))) return;

  deleteBtn.disabled = true;
  deleteStatus.innerHTML = `<span class="spinner"></span> ${t('deleting')}`;
  try {
    const deleted = await pinService.deletePins(activeDelFilter);
    deleteStatus.innerHTML = `<span class="success">${t('deletedSuccess', { deleted })}</span>`;

    // Clear worker state and local results cache upon deletion
    await new Promise(resolve => {
      chrome.storage.local.get(null, (items) => {
        const keysToRemove = ["pinmanager_state"];
        for (const key of Object.keys(items)) {
          if (key.startsWith("pinresults_")) {
            keysToRemove.push(key);
          }
        }
        chrome.storage.local.remove(keysToRemove, resolve);
      });
    });

    // Reset UI if worker was running
    stopStatsInterval();
    resetRunUI();
    await loadStats();
  } catch (err) {
    deleteStatus.innerHTML = `<span class="error">✗ ${err.message}</span>`;
  } finally {
    deleteBtn.disabled = false;
  }
});

// ─── Dashboard Tab ────────────────────────────────────────────────────────────
async function loadStats() {
  const dashStatus = document.getElementById("dash-status");
  dashStatus.innerHTML = `<span class="spinner"></span> ${t('loading')}`;
  setStatEls("—", "—", "—", "—");
  try {
    const { total, available, unavailable, unchecked, totalPartitions } = await pinService.getStats();
    _localTotal = total; _localAvailable = available;
    _localUnavailable = unavailable; _localUnchecked = unchecked;
    setStatEls(total, available, unavailable, unchecked);
    if (totalPartitions) updatePartitionSelector(totalPartitions);
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

// Auto-refresh stats every 30 seconds — only while process is running
let statsInterval = null;

function startStatsInterval() {
  if (!statsInterval) statsInterval = setInterval(loadStats, 60000);
}

function stopStatsInterval() {
  clearInterval(statsInterval);
  statsInterval = null;
}

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.dataset.tab !== "dashboard") stopStatsInterval();
  });
});

// Load partition info from Firestore on popup open (works across all browsers)
(async () => {
  const stored = await new Promise(r => chrome.storage.local.get("pinmanager_state", r));
  const state  = stored["pinmanager_state"];
  if (state && state.running) {
    startBtn.style.display = "none";
    stopBtn.style.display  = "block";
    runStatus.textContent  = t('workerRunningMsg');
  }
  // Load partitions from Firestore so all browsers see the same value
  try {
    const { totalPartitions } = await pinService.getStats();
    if (totalPartitions) updatePartitionSelector(totalPartitions);
  } catch (_) {}
})();

function updatePartitionSelector(totalPartitions) {
  const select = document.getElementById("partition-select");
  const info   = document.getElementById("partition-info");
  if (!select || !info) return;
  select.innerHTML = "";
  for (let i = 0; i < totalPartitions; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `Partition ${i + 1}`;
    select.appendChild(opt);
  }
  info.textContent = t('partitionInfo', { totalPartitions });

  // Restore previously selected partition
  chrome.storage.local.get("selectedPartition", data => {
    if (data.selectedPartition !== undefined && data.selectedPartition < totalPartitions) {
      select.value = data.selectedPartition;
    }
  });
}

// Persist partition selection on change
document.getElementById("partition-select")?.addEventListener("change", (e) => {
  chrome.storage.local.set({ selectedPartition: parseInt(e.target.value) });
});

// ─── Automation ───────────────────────────────────────────────────────────────
const startBtn  = document.getElementById("start-btn");
const stopBtn   = document.getElementById("stop-btn");
const runStatus = document.getElementById("run-status");

startBtn.addEventListener("click", startAutomation);
stopBtn.addEventListener("click", stopAutomation);

async function startAutomation() {
  runStatus.textContent = t('startingWorker');
  startBtn.style.display = "none";
  stopBtn.style.display = "block";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !tab.url.includes("redeem.hype.games")) {
    runStatus.innerHTML = `<span class="error">${t('openWidgetError')}</span>`;
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

  runStatus.textContent = t('reloadingPage');
  await chrome.tabs.reload(tab.id);

  runStatus.textContent = t('waitingPageLoad');
  const widgetFrame = await findWidgetFrame(tab.id, 15000);
  if (!widgetFrame) {
    runStatus.innerHTML = `<span class="error">${t('widgetFrameError')}</span>`;
    resetRunUI(); return;
  }

  await new Promise(r => setTimeout(r, 1500));

  let processed = 0;
  const listener = (msg) => {
    if (msg.action === "pinResult") {
      processed++;
      runStatus.textContent = t('processingStatus', { processed, pin: msg.pin.slice(0, 8), status: msg.success ? "✓" : "✗" });
    }
    if (msg.action === "done") {
      chrome.runtime.onMessage.removeListener(listener);
      runStatus.innerHTML = `<span class="success">${t('doneStatus', { processed })}</span>`;
      stopAutomation();
      loadStats();
    }
  };
  chrome.runtime.onMessage.addListener(listener);

  runStatus.textContent = t('connectingFrame');
  const widgetFrame2 = await findWidgetFrame(tab.id, 10000);
  if (!widgetFrame2) {
    runStatus.innerHTML = `<span class="error">${t('widgetFrameError2')}</span>`;
    chrome.runtime.onMessage.removeListener(listener);
    resetRunUI(); return;
  }

  const sent = await sendToFrame(tab.id, widgetFrame2.frameId, { action: "start", workerId, token, partitionId }, 8000);
  if (!sent) {
    runStatus.innerHTML = `<span class="error">${t('unreachableScript')}</span>`;
    chrome.runtime.onMessage.removeListener(listener);
    resetRunUI(); return;
  }

  const partLabel = partitionId !== null ? ` (${t('statTotal').toLowerCase() === 'total' ? 'Partition' : 'Partición'} ${partitionId + 1})` : "";
  runStatus.textContent = t('workerRunning', { workerId: workerId.slice(0, 8), partLabel });
  startStatsInterval();
}

async function stopAutomation() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    const widgetFrame = await findWidgetFrame(tab.id, 3000);
    if (widgetFrame) {
      sendToFrame(tab.id, widgetFrame.frameId, { action: "stop" }, 2000).catch(() => {});
    }
  }
  await new Promise(r => chrome.storage.local.remove("pinmanager_state", r));
  runStatus.textContent = t('stopped');
  stopStatsInterval();
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
  downloadStatus.innerHTML = `<span class="spinner"></span> ${t('fetchingPins')}`;
  try {
    let rows;

    // Always fetch from Firestore for accurate complete data
    rows = await pinService.downloadPins(activeFilter);

    // Also merge in any locally cached results not yet flushed to Firestore
    const partitionSelect = document.getElementById("partition-select");
    const partitionId     = partitionSelect?.value !== "" ? partitionSelect.value : "all";
    const cacheKey        = `pinresults_${partitionId}`;
    const cached          = await new Promise(r => chrome.storage.local.get(cacheKey, d => r(d[cacheKey] || null)));

    if (cached && cached.length > 0) {
      // Add cached results that aren't already in the Firestore results (unflushed buffer)
      const existingPins = new Set(rows.map(r => r.pin));
      const extraRows = cached
        .filter(r => {
          if (existingPins.has(r.pin)) return false;
          if (activeFilter === "available")   return r.available === true;
          if (activeFilter === "unavailable") return r.available === false;
          return true;
        })
        .map(r => ({
          pin:      r.pin,
          status:   r.available === true ? "Available" : r.available === false ? "Unavailable" : "Unchecked",
          category: r.category || ""
        }));
      rows = rows.concat(extraRows);
    }

    if (!rows.length) {
      downloadStatus.innerHTML = `<span class="error">${t('noPinsFound')}</span>`;
      downloadBtn.disabled = false; return;
    }

    let content, filename;
    if (activeFormat === "csv") {
      content  = "pin,status,category\n" + rows.map(r => `${r.pin},${r.status},${r.category || ""}`).join("\n");
      filename = `pins_${activeFilter}.csv`;
    } else {
      content  = "pin\tstatus\tcategory\n" + rows.map(r => `${r.pin}\t${r.status}\t${r.category || ""}`).join("\n");
      filename = `pins_${activeFilter}.txt`;
    }

    const mime = activeFormat === "csv" ? "text/csv" : "text/plain";
    const blob = new Blob([content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    const source = "Firestore";
    downloadStatus.innerHTML = `<span class="success">${t('downloadSuccess', { count: rows.length, source })}</span>`;
    const filterLabel = activeFilter === "all" ? t('filterAll') : activeFilter === "available" ? t('filterAvailable') : t('filterUnavailable');
    downloadInfo.textContent = t('lastExport', { count: rows.length, filter: filterLabel });
  } catch (err) {
    downloadStatus.innerHTML = `<span class="error">✗ ${err.message}</span>`;
  } finally {
    downloadBtn.disabled = false;
  }
});
