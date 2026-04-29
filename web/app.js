const STORAGE_KEY = "bac-oral-studio-state-v2";
const DB_NAME = "bac-oral-studio-db";
const DB_STORE = "uploads";

const elements = {
  tabs: [...document.querySelectorAll(".tab-btn")],
  panels: [...document.querySelectorAll(".tab-panel")],
  recapDropzone: document.querySelector("#recap-dropzone"),
  recapFile: document.querySelector("#recap-file"),
  parseRecap: document.querySelector("#parse-recap"),
  manualRecap: document.querySelector("#manual-recap"),
  resetProject: document.querySelector("#reset-project"),
  loadDemo: document.querySelector("#load-demo"),
  recapBadge: document.querySelector("#recap-badge"),
  sequenceSelect: document.querySelector("#sequence-select"),
  lectureInput: document.querySelector("#lecture-input") || document.querySelector("#lecture-cursive"),
  lectureCursive: document.querySelector("#lecture-cursive"),
  lectureOptions: document.querySelector("#lecture-options"),
  sequenceSummary: document.querySelector("#sequence-summary"),
  recapInsights: document.querySelector("#recap-insights"),
  importIntro: document.querySelector("#import-intro"),
  importGrid: document.querySelector("#import-grid"),
  alDropzone: document.querySelector("#al-dropzone"),
  alFiles: document.querySelector("#al-files"),
  uploadQueue: document.querySelector("#upload-queue"),
  uploadCount: document.querySelector("#upload-count"),
  ocrProgress: document.querySelector("#ocr-progress"),
  processAllAl: document.querySelector("#process-all-al"),
  processAll: document.querySelector("#process-all"),
  fixWeak: document.querySelector("#fix-weak"),
  simplifyAll: document.querySelector("#simplify-all"),
  highlightProcedures: document.querySelector("#highlight-procedures"),
  processingSummary: document.querySelector("#processing-summary"),
  sequenceStatusGrid: document.querySelector("#sequence-status-grid"),
  statusTable: document.querySelector("#status-table"),
  previewGrid: document.querySelector("#preview-grid"),
  previewSequenceFilter: document.querySelector("#preview-sequence-filter"),
  exportMode: document.querySelector("#export-mode"),
  exportExcel: document.querySelector("#export-excel"),
  exportPdf: document.querySelector("#export-pdf"),
  quickExport: document.querySelector("#quick-export"),
  exportScope: document.querySelector("#export-scope"),
  singleAlSelect: document.querySelector("#single-al-select"),
  singleAlWrapper: document.querySelector("#single-al-wrapper"),
  exportLink: document.querySelector("#export-link"),
  qualitySummary: document.querySelector("#quality-summary"),
  autosaveStatus: document.querySelector("#autosave-status"),
  sessionStatus: document.querySelector("#session-status"),
  readyCount: document.querySelector("#ready-count"),
  currentSequenceLabel: document.querySelector("#current-sequence-label"),
  projectProgressBar: document.querySelector("#project-progress-bar"),
  projectProgressLabel: document.querySelector("#project-progress-label"),
  sidebarSequenceStatus: document.querySelector("#sidebar-sequence-status"),
  themeToggle: document.querySelector("#theme-toggle"),
  importModeInputs: [...document.querySelectorAll('input[name="import-mode"]')],
  viewScopeInputs: [...document.querySelectorAll('input[name="view-scope"]')],
  sequenceDropzone: document.querySelector("#sequence-dropzone"),
  sequenceUploadTrigger: document.querySelector("#sequence-upload-trigger"),
  sequenceFiles: document.querySelector("#sequence-files"),
  statusBanner: document.querySelector("#status-banner"),
  toastStack: document.querySelector("#toast-stack"),
};

let state = createInitialState();
let history = { undo: [], redo: [] };
let persistTimer = null;
let pendingRecapFile = null;

function createInitialState() {
  return {
    recapFileName: "",
    recapFileDataUrl: "",
    manualRecap: "",
    lectureCursives: [],
    selectedLectureCursive: "",
    sequences: [],
    selectedSequenceId: "",
    viewScope: "sequence",
    importMode: "al",
    entries: [],
    exportMode: "minimalist",
    exportScope: "full",
    exportSingleId: "",
    exportLink: "",
    exportLinks: {},
    darkMode: false,
    banner: {
      tone: "info",
      message: "Le projet est prêt. Charge le récapitulatif pour commencer.",
    },
    updatedAt: "",
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function currentSequence() {
  return state.sequences.find((sequence) => sequence.id === state.selectedSequenceId) || null;
}

function visibleEntries() {
  if (state.viewScope === "all" || !state.selectedSequenceId) {
    return state.entries;
  }
  return state.entries.filter((entry) => entry.sequenceId === state.selectedSequenceId);
}

function entriesForSequence(sequenceId) {
  return state.entries.filter((entry) => entry.sequenceId === sequenceId);
}

function emptyStatus() {
  return {
    ocr: "waiting",
    structuring: "waiting",
    analysis: "waiting",
    export: "waiting",
    overall: 0,
    message: "Ajoute une image ou une transcription",
  };
}

function sequenceLabelById(sequenceId) {
  return state.sequences.find((sequence) => sequence.id === sequenceId)?.label || "Séquence";
}

function stripFileForPersist(file) {
  return {
    id: file.id,
    alId: file.alId,
    name: file.name,
    status: file.status || "waiting",
    ocrText: file.ocrText || "",
    lastModified: file.lastModified || Date.now(),
  };
}

function stripStateForPersist(inputState) {
  return {
    ...inputState,
    entries: inputState.entries.map((entry) => ({
      ...entry,
      files: (entry.files || []).map(stripFileForPersist),
    })),
  };
}

function pushHistory() {
  history.undo.push(clone(stripStateForPersist(state)));
  if (history.undo.length > 60) {
    history.undo.shift();
  }
  history.redo = [];
}

function updateState(mutator, options = { trackHistory: true, renderNow: true }) {
  if (options.trackHistory) {
    pushHistory();
  }
  const nextState = typeof mutator === "function" ? mutator(clone(state)) : mutator;
  state = normalizeState(nextState);
  schedulePersist();
  if (options.renderNow !== false) {
    render();
  }
}

function setBanner(message, tone = "info", renderNow = true) {
  state.banner = { message, tone };
  if (renderNow) {
    renderBanner();
  }
}

function showToast(title, message, tone = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${tone}`;
  toast.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
  if (elements.toastStack) {
    elements.toastStack.appendChild(toast);
    setTimeout(() => toast.remove(), 3400);
    return;
  }
  console.warn("Toast stack is missing, cannot show toast:", title, message);
}

function setTab(tabId) {
  elements.tabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabId);
  });
  elements.panels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tabId}`);
  });
}

function normalizeState(inputState) {
  const next = {
    ...createInitialState(),
    ...inputState,
  };

  next.sequences = Array.isArray(next.sequences) ? next.sequences : [];
  next.entries = Array.isArray(next.entries)
    ? next.entries.map((entry) => ({
        ...entry,
        files: Array.isArray(entry.files) ? entry.files : [],
        status: { ...emptyStatus(), ...(entry.status || {}) },
        movements: Array.isArray(entry.movements) ? entry.movements : [],
        keyProcedures: Array.isArray(entry.keyProcedures) ? entry.keyProcedures : [],
        oralBullets: Array.isArray(entry.oralBullets) ? entry.oralBullets : [],
        qualityFlags: Array.isArray(entry.qualityFlags) ? entry.qualityFlags : [],
      }))
    : [];

  if (!next.selectedSequenceId && next.sequences.length) {
    next.selectedSequenceId = next.sequences[0].id;
  }
  if (next.selectedSequenceId && !next.sequences.some((sequence) => sequence.id === next.selectedSequenceId)) {
    next.selectedSequenceId = next.sequences[0]?.id || "";
  }

  if (!next.lectureCursives?.length && next.sequences.length) {
    const merged = next.sequences.flatMap((sequence) => sequence.lecturesCursives || []);
    next.lectureCursives = unique(merged);
  }

  return next;
}

function unique(items = []) {
  return [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];
}

async function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putFileRecord(record) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(record);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteFileRecord(id) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllFileRecords() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const request = tx.objectStore(DB_STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function syncFilesToDb(entries) {
  const existingRecords = await getAllFileRecords();
  const nextRecords = entries.flatMap((entry) =>
    (entry.files || []).map((file) => ({
      id: file.id,
      alId: file.alId,
      name: file.name,
      dataUrl: file.dataUrl,
      lastModified: file.lastModified || Date.now(),
    })),
  );
  const nextIds = new Set(nextRecords.map((record) => record.id));

  await Promise.all(nextRecords.map((record) => putFileRecord(record)));
  await Promise.all(
    existingRecords
      .filter((record) => !nextIds.has(record.id))
      .map((record) => deleteFileRecord(record.id)),
  );
}

async function clearPersistedFiles() {
  await syncFilesToDb([]);
}

async function hydrateState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    render();
    return;
  }

  try {
    const saved = normalizeState(JSON.parse(raw));
    const files = await getAllFileRecords();
    const fileMap = new Map(files.map((file) => [file.id, file]));
    state = normalizeState({
      ...saved,
      entries: (saved.entries || []).map((entry) => ({
        ...entry,
        files: (entry.files || [])
          .map((file) => ({
            ...file,
            dataUrl: fileMap.get(file.id)?.dataUrl || "",
            alId: entry.id,
          }))
          .filter((file) => file.dataUrl),
      })),
    });
    render();
  } catch (error) {
    console.error(error);
    state = createInitialState();
    render();
  }
}

function schedulePersist() {
  clearTimeout(persistTimer);
  elements.autosaveStatus.textContent = "Sauvegarde...";
  persistTimer = setTimeout(async () => {
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stripStateForPersist(state)));
    await syncFilesToDb(state.entries);
    elements.autosaveStatus.textContent = "Actif";
    elements.sessionStatus.textContent = new Date(state.updatedAt).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, 250);
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Erreur réseau" }));
    throw new Error(error.error || "Erreur réseau");
  }
  return response.json();
}

function buildEntriesFromRecap(sequences, previousEntries = []) {
  const previousMap = new Map(previousEntries.map((entry) => [entry.id, entry]));
  return sequences.flatMap((sequence) =>
    (sequence.texts || []).map((text) => {
      const existing = previousMap.get(text.id);
      return {
        id: text.id,
        label: text.label,
        fullName: text.fullName || `${text.label} – ${text.title}`,
        title: text.title,
        author: text.author,
        work: text.work,
        excerpt: text.excerpt,
        raw: text.raw,
        sequenceId: sequence.id,
        sequenceLabel: sequence.label,
        sequenceMeta: sequence,
        files: existing?.files || [],
        manualText: existing?.manualText || "",
        sourceText: existing?.sourceText || "",
        movements: existing?.movements || [],
        keyProcedures: existing?.keyProcedures || [],
        oralBullets: existing?.oralBullets || [],
        qualityFlags: existing?.qualityFlags || [],
        status: { ...emptyStatus(), ...(existing?.status || {}) },
      };
    }),
  );
}

function projectStats(entryList = state.entries) {
  const total = entryList.length;
  const ready = entryList.filter((entry) => (entry.oralBullets || []).length >= 3).length;
  const withSource = entryList.filter((entry) => entry.sourceText).length;
  const imageCount = entryList.reduce((sum, entry) => sum + (entry.files?.length || 0), 0);
  const averageProgress = total
    ? Math.round(entryList.reduce((sum, entry) => sum + (entry.status?.overall || 0), 0) / total)
    : 0;
  return { total, ready, withSource, imageCount, averageProgress };
}

function sequenceStats(sequence) {
  const entries = entriesForSequence(sequence.id);
  const total = entries.length;
  const ready = entries.filter((entry) => (entry.oralBullets || []).length >= 3).length;
  const progress = total
    ? Math.round(entries.reduce((sum, entry) => sum + (entry.status?.overall || 0), 0) / total)
    : 0;
  return { total, ready, progress };
}

function renderBanner() {
  if (!elements.statusBanner) return;
  elements.statusBanner.className = `status-banner ${state.banner?.tone || "info"}`;
  elements.statusBanner.textContent = state.banner?.message || "";
}

function renderSequenceSelectors() {
  if (!elements.sequenceSelect) return;
  elements.sequenceSelect.innerHTML =
    '<option value="">Toutes les séquences</option>' +
    state.sequences
      .map(
        (sequence) =>
          `<option value="${sequence.id}" ${sequence.id === state.selectedSequenceId ? "selected" : ""}>${escapeHtml(sequence.label)} - ${escapeHtml(sequence.work?.title || "")}</option>`,
      )
      .join("");

  const lectureControl = elements.lectureCursive || elements.lectureInput;
  if (lectureControl) {
    if (lectureControl.tagName === "SELECT") {
      lectureControl.innerHTML =
        '<option value="">Non spécifiée</option>' +
        unique(state.lectureCursives || [])
          .map((lecture) => `<option value="${escapeHtml(lecture)}">${escapeHtml(lecture)}</option>`)
          .join("");
      lectureControl.value = state.selectedLectureCursive || "";
    } else {
      lectureControl.value = state.selectedLectureCursive || "";
    }
  }

  if (elements.lectureOptions) {
    elements.lectureOptions.innerHTML = unique(state.lectureCursives || [])
      .map((lecture) => `<option value="${escapeHtml(lecture)}"></option>`)
      .join("");
  }

  if (elements.importModeInputs.length) {
    elements.importModeInputs.forEach((input) => {
      input.checked = input.value === state.importMode;
    });
  }
  if (elements.viewScopeInputs.length) {
    elements.viewScopeInputs.forEach((input) => {
      input.checked = input.value === state.viewScope;
    });
  }
}

function renderRecapInsights() {
  if (!elements.recapInsights) return;
  if (!state.sequences.length) {
    elements.recapInsights.className = "summary-grid empty-state";
    elements.recapInsights.textContent = "Le récapitulatif affichera ici le nombre de séquences, d’AL et les lectures cursives détectées.";
    return;
  }

  const stats = projectStats();
  elements.recapInsights.className = "summary-grid";
  elements.recapInsights.innerHTML = `
    <article class="metric-card">
      <p class="eyebrow">Structure</p>
      <h4>${state.sequences.length} séquence(s)</h4>
      <p class="summary-copy">${stats.total} AL détectées depuis le récapitulatif.</p>
    </article>
    <article class="metric-card">
      <p class="eyebrow">Lecture cursive</p>
      <h4>${state.lectureCursives.length || 0} suggestion(s)</h4>
      <p class="summary-copy">${escapeHtml(state.selectedLectureCursive || "Choisis librement une lecture cursive globale.")}</p>
    </article>
    <article class="metric-card">
      <p class="eyebrow">Progression</p>
      <h4>${stats.ready}/${stats.total}</h4>
      <p class="summary-copy">AL déjà prêtes pour une révision orale rapide.</p>
    </article>
  `;
}

function renderSequenceSummary() {
  if (!elements.sequenceSummary) return;
  if (!state.sequences.length) {
    elements.sequenceSummary.className = "summary-grid empty-state";
    elements.sequenceSummary.textContent = "Charge le récapitulatif pour voir la structure complète du dossier.";
    return;
  }

  elements.sequenceSummary.className = "summary-grid";
  elements.sequenceSummary.innerHTML = state.sequences
    .map((sequence) => {
      const stats = sequenceStats(sequence);
      return `
        <article class="summary-card">
          <div class="panel-head compact">
            <div>
              <p class="eyebrow">${escapeHtml(sequence.label)}</p>
              <h4>${escapeHtml(sequence.work?.title || "")}</h4>
            </div>
            <button class="mini-button sequence-pick" type="button" data-sequence-id="${sequence.id}">Ouvrir</button>
          </div>
          <p>${escapeHtml(sequence.work?.author || "")}</p>
          <p class="summary-copy">${escapeHtml(sequence.objectStudy || "")}</p>
          <div class="meter-shell">
            <div class="meter-track">
              <span class="meter-fill" style="width:${stats.progress}%"></span>
            </div>
            <strong>${stats.progress}%</strong>
          </div>
          <div class="badge-row">
            <span class="mini-badge ready">${stats.ready}/${stats.total} prêtes</span>
            <span class="mini-badge">${(sequence.texts || []).length} AL</span>
          </div>
          <div class="tag-list">
            ${(sequence.texts || [])
              .map((text) => `<span class="tag">${escapeHtml(text.fullName || `${text.label} – ${text.excerpt}`)}</span>`)
              .join("")}
          </div>
        </article>
      `;
    })
    .join("");
}

function entryBadges(entry) {
  const imageCount = entry.files?.length || 0;
  const progress = entry.status?.overall || 0;
  return `
    <div class="badge-row">
      <span class="status-pill ${imageCount ? "ready" : "waiting"}">${imageCount} image(s)</span>
      <span class="status-pill ${entry.sourceText ? "ready" : "waiting"}">${entry.sourceText ? "Source prête" : "Source manquante"}</span>
      <span class="status-pill ${progress >= 75 ? "ready" : "waiting"}">${progress}%</span>
    </div>
  `;
}

function renderFileStack(entry) {
  if (!entry.files?.length) {
    return '<div class="hint-box">Aucune image importée pour cette AL.</div>';
  }
  return entry.files
    .map(
      (file) => `
        <div class="file-row" data-entry-id="${entry.id}" data-file-id="${file.id}" draggable="true">
          <img class="file-thumb" src="${file.dataUrl}" alt="${escapeHtml(file.name)}" />
          <div class="file-meta">
            <strong class="file-name">${escapeHtml(file.name)}</strong>
            <span class="file-status">${escapeHtml(file.ocrText ? "OCR prêt" : "OCR en attente")}</span>
          </div>
          <div class="file-actions">
            <button class="icon-button file-up" type="button">↑</button>
            <button class="icon-button file-down" type="button">↓</button>
            <button class="icon-button file-delete" type="button">✕</button>
          </div>
        </div>
      `,
    )
    .join("");
}

function renderImportSection() {
  if (!elements.importGrid) return;
  const entries = visibleEntries();
  const sequence = currentSequence();
  const scopeLabel = state.viewScope === "all"
    ? "toutes les AL du projet"
    : sequence
      ? `${entries.length} AL affichées pour ${sequence.label}.`
      : "Choisis une séquence pour afficher les AL.";

  elements.importIntro.textContent = scopeLabel;
  elements.sequenceDropzone.classList.toggle("hidden", state.importMode !== "sequence");

  if (!entries.length) {
    elements.importGrid.innerHTML = '<div class="empty-state">Aucune AL à afficher pour le moment.</div>';
    return;
  }

  elements.importGrid.innerHTML = entries
    .map(
      (entry) => `
        <article class="al-card" data-entry-id="${entry.id}">
          <div class="panel-head">
            <div>
              <p class="eyebrow">${escapeHtml(entry.label)} - ${escapeHtml(entry.sequenceLabel || "")}</p>
              <h4>${escapeHtml(entry.title)}</h4>
            </div>
            <button class="mini-button process-entry" type="button">Analyser</button>
          </div>

          ${entryBadges(entry)}

          <div class="meter-shell">
            <div class="meter-track">
              <span class="meter-fill" style="width:${entry.status?.overall || 0}%"></span>
            </div>
            <strong>${entry.status?.overall || 0}%</strong>
          </div>

          <label class="upload-card">
            <input class="al-file-input" type="file" accept="image/*" multiple hidden />
            <span class="upload-title">Uploader des images pour ${escapeHtml(entry.label)}</span>
            <span class="upload-copy">${escapeHtml(entry.fullName || entry.title)}</span>
          </label>

          <label class="field-stack">
            <span>Transcription manuelle de secours</span>
            <textarea class="manual-text" rows="4" placeholder="Colle ici un passage si l’OCR est incomplet.">${escapeHtml(entry.manualText || "")}</textarea>
          </label>

          <div class="file-stack">${renderFileStack(entry)}</div>
        </article>
      `,
    )
    .join("");
}

function renderProcessingSummary() {
  if (!elements.processingSummary) return;
  const entries = visibleEntries();
  const stats = projectStats(entries);
  elements.processingSummary.innerHTML = `
    <div class="summary-metric"><span>AL visibles</span><strong>${stats.total}</strong></div>
    <div class="summary-metric"><span>Sources prêtes</span><strong>${stats.withSource}</strong></div>
    <div class="summary-metric"><span>Images</span><strong>${stats.imageCount}</strong></div>
    <div class="summary-metric"><span>AL prêtes</span><strong>${stats.ready}</strong></div>
    <div class="summary-metric"><span>Progression moyenne</span><strong>${stats.averageProgress}%</strong></div>
  `;
}

function renderSequenceStatusGrid() {
  if (!elements.sequenceStatusGrid) return;
  if (!state.sequences.length) {
    elements.sequenceStatusGrid.innerHTML = '<div class="empty-state">Aucune séquence à suivre.</div>';
    return;
  }

  elements.sequenceStatusGrid.innerHTML = state.sequences
    .map((sequence) => {
      const stats = sequenceStats(sequence);
      return `
        <article class="sequence-progress-card">
          <div class="panel-head compact">
            <div>
              <p class="eyebrow">${escapeHtml(sequence.label)}</p>
              <h4>${escapeHtml(sequence.work?.title || "")}</h4>
            </div>
            <span class="mini-badge ${stats.ready === stats.total && stats.total ? "ready" : "waiting"}">${stats.ready}/${stats.total}</span>
          </div>
          <div class="meter-shell">
            <div class="meter-track">
              <span class="meter-fill" style="width:${stats.progress}%"></span>
            </div>
            <strong>${stats.progress}%</strong>
          </div>
          <p>${escapeHtml(sequence.objectStudy || "")}</p>
        </article>
      `;
    })
    .join("");
}

function renderStatusTable() {
  if (!elements.statusTable) return;
  const entries = visibleEntries();
  if (!entries.length) {
    elements.statusTable.innerHTML = '<div class="empty-state">Aucune AL en cours.</div>';
    return;
  }

  elements.statusTable.innerHTML = entries
    .map(
      (entry) => `
        <article class="status-card-row">
          <div class="entry-status-top">
            <div>
              <p class="eyebrow">${escapeHtml(entry.label)} - ${escapeHtml(entry.sequenceLabel || "")}</p>
              <h4>${escapeHtml(entry.title)}</h4>
            </div>
            <div class="entry-status-meta">
              <span class="status-pill ${entry.status?.overall >= 75 ? "ready" : "waiting"}">${entry.status?.overall || 0}%</span>
              <button class="mini-button process-entry" type="button" data-entry-id="${entry.id}">Relancer</button>
            </div>
          </div>

          <div class="meter-shell">
            <div class="meter-track">
              <span class="meter-fill" style="width:${entry.status?.overall || 0}%"></span>
            </div>
            <strong>${entry.status?.overall || 0}%</strong>
          </div>

          <div class="progress-steps">
            <span class="progress-step ${entry.status?.ocr || "waiting"}">OCR</span>
            <span class="progress-step ${entry.status?.structuring || "waiting"}">Structure</span>
            <span class="progress-step ${entry.status?.analysis || "waiting"}">Analyse</span>
            <span class="progress-step ${entry.status?.export || "waiting"}">Export</span>
          </div>

          <div class="status-message">${escapeHtml(entry.status?.message || "En attente")}</div>
        </article>
      `,
    )
    .join("");
}

function renderPreviewGrid() {
  if (!elements.previewGrid) return;
  const entries = visibleEntries();
  if (!entries.length) {
    elements.previewGrid.innerHTML = '<div class="empty-state">Aucune fiche à prévisualiser.</div>';
    return;
  }

  elements.previewGrid.innerHTML = entries
    .map((entry) => {
      const movements = entry.movements?.length
        ? entry.movements
        : [
            { title: "Mouvement 1", bullets: [] },
            { title: "Mouvement 2", bullets: [] },
            { title: "Mouvement 3", bullets: [] },
          ];
      const genreClass = `genre-${entry.genre || "general"}`;
      return `
        <article class="preview-card ${genreClass}" data-preview-id="${entry.id}">
          <div class="panel-head">
            <div>
              <p class="eyebrow">${escapeHtml(entry.label)} - ${escapeHtml(entry.sequenceLabel || "")}</p>
              <h4>${escapeHtml(entry.title)}</h4>
              <span class="genre-label">${escapeHtml(entry.genre || "general")}</span>
            </div>
            <button class="ghost-button regenerate-entry" type="button">Régénérer</button>
          </div>

          <div class="preview-meta">
            <span class="status-pill ${entry.sourceText ? "ready" : "waiting"}">${entry.sourceText ? "Source prête" : "Source manquante"}</span>
            <span class="status-pill ${entry.qualityFlags?.length ? "waiting" : "ready"}">${entry.qualityFlags?.length ? `${entry.qualityFlags.length} alerte(s)` : "Cohérence OK"}</span>
            <span class="status-pill">${escapeHtml(entry.genre || "general")}</span>
          </div>

          ${entry.introduction ? `
            <details class="intro-section">
              <summary>Introduction</summary>
              <p>${escapeHtml(entry.introduction)}</p>
            </details>
          ` : ""}

          <label class="field-stack">
            <span>Titre</span>
            <input class="entry-title" type="text" value="${escapeHtml(entry.title)}" />
          </label>

          <div class="movement-grid ${genreClass}">
            <div class="movement-header">
              <strong>Mouvements littéraires</strong>
              <span class="movement-title-badge">${movements.length} mouvement(s)</span>
            </div>
            ${movements
              .map(
                (movement, index) => `
                  <div class="movement-card" data-movement-index="${index}">
                    <label class="field-stack">
                      <span>Mouvement ${index + 1}</span>
                      <input class="movement-title" type="text" value="${escapeHtml(movement.title || "")}" />
                    </label>
                    <label class="field-stack">
                      <span>Arguments oraux</span>
                      <textarea class="movement-bullets" rows="4">${escapeHtml((movement.bullets || []).join("\n"))}</textarea>
                    </label>
                  </div>
                `,
              )
              .join("")}
          </div>

          ${entry.procedures?.length ? `
            <div class="procedures-section">
              <h5>Procédés littéraires</h5>
              <div class="procedures-grid">
                ${entry.procedures
                  .map((procedure) => {
                    const weight = procedure.weight || 1;
                    const statusClass = weight >= 3 ? "status-high" : weight >= 2 ? "status-medium" : "status-low";
                    return `
                      <div class="procedure-badge ${statusClass}">
                        <strong>${escapeHtml(procedure.label)}</strong>
                        <em>${escapeHtml(procedure.description || procedure.impact || "")}</em>
                        <span class="weight-indicator">${weight}/5</span>
                      </div>
                    `;
                  })
                  .join("")}
              </div>
            </div>
          ` : ""}

          <label class="field-stack">
            <span>Version orale rapide</span>
            <textarea class="oral-editor" rows="4">${escapeHtml((entry.oralBullets || []).join("\n"))}</textarea>
          </label>

          ${entry.conclusion ? `
            <details class="conclusion-section">
              <summary>Conclusion</summary>
              <p>${escapeHtml(entry.conclusion)}</p>
            </details>
          ` : ""}

          <details class="source-preview">
            <summary>Voir le texte source et les rappels</summary>
            <p>${escapeHtml(entry.sourceText || "Aucune source consolidée pour le moment.")}</p>
          </details>
        </article>
      `;
    })
    .join("");
}

function renderExportOptions() {
  if (!elements.exportScope) return;
  elements.exportMode.value = state.exportMode;
  elements.exportScope.value = state.exportScope;
  elements.singleAlSelect.innerHTML =
    '<option value="">Choisir une AL</option>' +
    state.entries
      .map(
        (entry) =>
          `<option value="${entry.id}" ${state.exportSingleId === entry.id ? "selected" : ""}>${escapeHtml(`${entry.label} - ${entry.title}`)}</option>`,
      )
      .join("");

  elements.singleAlWrapper.classList.toggle("hidden", state.exportScope !== "single");
  elements.exportLink.classList.toggle("hidden", !state.exportLink);
  if (state.exportLink) {
    elements.exportLink.href = state.exportLink;
  }
}

function renderQualitySummary() {
  if (!elements.qualitySummary) return;
  const entries = visibleEntries();
  const flagged = entries.filter((entry) => entry.qualityFlags?.length).length;
  const ready = entries.filter((entry) => entry.oralBullets?.length >= 3).length;
  const scope = state.viewScope === "all" ? "le projet complet" : currentSequence()?.label || "la séquence active";
  elements.qualitySummary.innerHTML = `
    <strong>${ready}/${entries.length || 0} AL</strong> sont prêtes dans ${escapeHtml(scope)}.
    ${flagged ? `${flagged} fiche(s) demandent encore une simplification ou une source plus propre.` : "Aucune alerte bloquante détectée."}
  `;
}

function renderMeta() {
  const stats = projectStats();
  elements.readyCount.textContent = String(stats.ready);
}

function render() {
  // Theme management
  if (elements.themeToggle) {
    elements.themeToggle.style.opacity = state.darkMode ? "1" : "0.7";
  }
  document.body.dataset.theme = state.darkMode ? "dark" : "light";

  // Header and sidebar
  const stats = projectStats();
  if (elements.currentSequenceLabel) {
    elements.currentSequenceLabel.textContent =
      state.viewScope === "all"
        ? "Toutes"
        : currentSequence()?.label || "Aucune";
  }
  if (elements.projectProgressBar) {
    elements.projectProgressBar.style.width = `${stats.averageProgress}%`;
  }
  if (elements.projectProgressLabel) {
    elements.projectProgressLabel.textContent = `${stats.averageProgress}%`;
  }
  if (elements.recapBadge) {
    elements.recapBadge.className = `status-pill ${state.sequences.length ? "ready" : "waiting"}`;
    elements.recapBadge.textContent = state.sequences.length
      ? `${state.sequences.length} séquence(s)`
      : "Non chargé";
  }
  if (elements.parseRecap) {
    elements.parseRecap.disabled = !pendingRecapFile && !elements.manualRecap?.value.trim();
  }
  if (elements.sessionStatus) {
    elements.sessionStatus.textContent = state.updatedAt
      ? new Date(state.updatedAt).toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Nouvelle";
  }

  if (elements.sidebarSequenceStatus) {
    elements.sidebarSequenceStatus.innerHTML = state.sequences
      .map((sequence) => {
        const statsBySequence = sequenceStats(sequence);
        return `
          <article class="sidebar-progress-card">
            <div>
              <strong>${escapeHtml(sequence.label)}</strong>
              <div class="summary-copy">${statsBySequence.ready}/${statsBySequence.total} prêtes</div>
            </div>
            <span class="mini-badge ${statsBySequence.ready === statsBySequence.total && statsBySequence.total ? "ready" : "waiting"}">${statsBySequence.progress}%</span>
          </article>
        `;
      })
      .join("");
  }

  // Render all sections
  renderBanner();
  renderSequenceSelectors();
  renderRecapInsights();
  renderSequenceSummary();
  renderImportSection();
  renderProcessingSummary();
  renderSequenceStatusGrid();
  renderStatusTable();
  renderPreviewGrid();
  renderExportOptions();
  renderQualitySummary();
  renderMeta();
}

function updateEntry(entryId, updater, options = { trackHistory: true }) {
  updateState((draft) => {
    draft.entries = draft.entries.map((entry) =>
      entry.id === entryId ? updater(clone(entry)) : entry,
    );
    return draft;
  }, options);
}

function collectPreviewEdits() {
  const updates = new Map();
  document.querySelectorAll(".preview-card").forEach((card) => {
    const entryId = card.dataset.previewId;
    updates.set(entryId, {
      title: card.querySelector(".entry-title")?.value || "",
      movements: [...card.querySelectorAll(".movement-card")].map((movementCard, index) => ({
        title: movementCard.querySelector(".movement-title")?.value || `Mouvement ${index + 1}`,
        bullets: (movementCard.querySelector(".movement-bullets")?.value || "")
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 3),
      })),
      keyProcedures: (card.querySelector(".procedures-editor")?.value || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [label, impact] = line.split("::").map((part) => part.trim());
          return {
            label: label || "procédé",
            impact: impact || "effet à préciser",
            weight: 2,
          };
        }),
      oralBullets: (card.querySelector(".oral-editor")?.value || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 4),
    });
  });

  if (!updates.size) {
    return;
  }

  updateState((draft) => {
    draft.entries = draft.entries.map((entry) =>
      updates.has(entry.id)
        ? { ...entry, ...updates.get(entry.id) }
        : entry,
    );
    return draft;
  }, { trackHistory: false });
}

function resetExportLink() {
  state.exportLink = "";
  state.exportLinks = {};
}

function buildScope() {
  if (state.exportScope === "single") {
    return { type: "single", value: state.exportSingleId };
  }
  if (state.exportScope === "sequence") {
    return { type: "sequence", value: state.selectedSequenceId };
  }
  return { type: "full" };
}

async function attachFilesToEntry(entryId, fileList) {
  const files = await Promise.all(
    [...fileList].map(async (file) => ({
      id: `${entryId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      alId: entryId,
      name: file.name,
      dataUrl: await readAsDataUrl(file),
      lastModified: file.lastModified || Date.now(),
      ocrText: "",
      status: "waiting",
    })),
  );

  updateEntry(entryId, (entry) => {
    entry.files = [...(entry.files || []), ...files];
    entry.status = {
      ...entry.status,
      message: "Images ajoutées, OCR prêt à lancer",
    };
    return entry;
  });

  showToast("Images ajoutées", `${files.length} fichier(s) ajoutés à ${entryId}.`, "success");
}

function reorderFile(entryId, fileId, direction) {
  updateEntry(entryId, (entry) => {
    const index = entry.files.findIndex((file) => file.id === fileId);
    if (index === -1) {
      return entry;
    }
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= entry.files.length) {
      return entry;
    }
    const cloneFiles = [...entry.files];
    const [moved] = cloneFiles.splice(index, 1);
    cloneFiles.splice(nextIndex, 0, moved);
    entry.files = cloneFiles;
    return entry;
  });
}

function deleteFile(entryId, fileId) {
  updateEntry(entryId, (entry) => {
    entry.files = entry.files.filter((file) => file.id !== fileId);
    return entry;
  });
}

function findEntryIdFromFilename(name) {
  const match = name.match(/\bAL[\s_-]*(\d{1,2})\b/i);
  if (!match) {
    return null;
  }
  const expected = `AL-${Number(match[1])}`;
  return state.entries.some((entry) => entry.id === expected) ? expected : null;
}

async function handleSequenceUpload(fileList) {
  const unmatched = [];
  for (const file of [...fileList]) {
    const entryId = findEntryIdFromFilename(file.name);
    if (!entryId) {
      unmatched.push(file.name);
      continue;
    }
    await attachFilesToEntry(entryId, [file]);
  }

  if (unmatched.length) {
    setBanner(`Certains fichiers n’ont pas été classés automatiquement: ${unmatched.slice(0, 3).join(", ")}`, "warning");
    showToast("Classement partiel", "Quelques noms de fichiers n’indiquent pas clairement l’AL.", "warning");
  } else {
    setBanner("Import de séquence terminé. Les images ont été réparties automatiquement.", "success");
  }
}

async function processEntries({ scope = "visible", entryId = "" } = {}) {
  try {
    const selectedEntries =
      scope === "single"
        ? state.entries.filter((entry) => entry.id === entryId)
        : scope === "all"
          ? state.entries
          : visibleEntries();

    if (!selectedEntries.length) {
      setBanner("Aucune AL à traiter dans cette vue.", "warning");
      return;
    }

    setBanner("Traitement en cours. OCR, structuration et analyse sont en train d’être recalculés.", "info");
    elements.autosaveStatus.textContent = "Traitement...";

    const processed = await postJson("/api/process", {
      project: {
        ...state,
        entries: selectedEntries.map((entry) => clone(entry)),
      },
      options: { runOcr: true },
    });

    updateState((draft) => {
      draft.entries = draft.entries.map((entry) => {
        const updated = processed.entries.find((candidate) => candidate.id === entry.id);
        return updated ? updated : entry;
      });
      draft.banner = {
        tone: "success",
        message: scope === "single"
          ? `${entryId} a été recalculée.`
          : "Le traitement est terminé. Tu peux vérifier l’aperçu et exporter.",
      };
      return draft;
    }, { trackHistory: false });

    showToast("Traitement terminé", "Les analyses ont été mises à jour.", "success");
  } catch (error) {
    console.error(error);
    setBanner(error.message || "Le traitement a échoué.", "danger");
    showToast("Erreur de traitement", error.message || "Le serveur a refusé l’analyse.", "danger");
  }
}

async function applySmartAction(action) {
  try {
    const response = await postJson("/api/action", {
      project: state,
      action,
    });
    updateState(response, { trackHistory: false });
    const labels = {
      "fix-weak": "Fix all weak analyses",
      simplify: "Simplify all analyses",
      highlight: "Highlight key procédés",
    };
    setBanner(`${labels[action] || "Action"} appliqué.`, "success");
  } catch (error) {
    console.error(error);
    setBanner(error.message || "L’action intelligente a échoué.", "danger");
    showToast("Erreur", error.message || "Impossible d’appliquer l’action demandée.", "danger");
  }
}

async function runExport(format) {
  try {
    const scope = buildScope();
    if (scope.type === "single" && !scope.value) {
      setBanner("Choisis une AL avant l’export unitaire.", "warning");
      return null;
    }
    if (scope.type === "sequence" && !state.selectedSequenceId) {
      setBanner("Choisis une séquence avant l’export ciblé.", "warning");
      return null;
    }

    const response = await postJson("/api/export", {
      project: {
        ...state,
        selectedSequenceLabel:
          scope.type === "sequence"
            ? currentSequence()?.label || "Séquence"
            : "Toutes les séquences",
      },
      scope,
      format,
      options: {
        mode: state.exportMode,
        contrast: state.exportMode === "high-contrast" ? "high" : "soft",
      },
    });

    updateState((draft) => {
      draft.exportLink = response.downloadUrl;
      draft.exportLinks = {
        ...draft.exportLinks,
        [format]: response.downloadUrl,
      };
      draft.banner = {
        tone: "success",
        message: `Export ${format.toUpperCase()} prêt. Tu peux le télécharger.`,
      };
      return draft;
    }, { trackHistory: false });

    showToast("Export prêt", `Le fichier ${response.fileName} est disponible.`, "success");
    return response;
  } catch (error) {
    console.error(error);
    setBanner(error.message || "L’export a échoué.", "danger");
    showToast("Erreur d’export", error.message || "Impossible de générer le fichier.", "danger");
    return null;
  }
}

async function runExportBoth() {
  const xlsx = await runExport("xlsx");
  const pdf = await runExport("pdf");
  if (xlsx && pdf) {
    setBanner("Les exports Excel et PDF sont prêts.", "success");
  }
}

async function withBusy(button, busyLabel, task) {
  const previous = button.textContent;
  button.disabled = true;
  button.textContent = busyLabel;
  try {
    return await task();
  } catch (error) {
    console.error(error);
    setBanner(error.message || "Une action a échoué.", "danger");
    showToast("Erreur", error.message || "Une erreur est survenue.", "danger");
    return null;
  } finally {
    button.disabled = false;
    button.textContent = previous;
  }
}

async function parseRecapInput() {
  try {
    const file = pendingRecapFile || elements.recapFile.files?.[0];
    if (file) {
      const dataUrl = await readAsDataUrl(file);
      const payload = await postJson("/api/recap/parse", {
        fileName: file.name,
        fileBase64: dataUrl,
      });
      updateState((draft) => {
        draft.recapFileName = payload.fileName;
        draft.recapFileDataUrl = dataUrl;
        draft.sequences = payload.sequences || [];
        draft.lectureCursives = payload.lectureCursives || [];
        draft.entries = buildEntriesFromRecap(payload.sequences || [], draft.entries || []);
        draft.selectedSequenceId = payload.sequences?.[0]?.id || "";
        draft.selectedLectureCursive = draft.selectedLectureCursive || payload.lectureCursives?.[0] || "";
        draft.banner = {
          tone: "success",
          message: `Récapitulatif chargé: ${payload.sequenceCount || 0} séquence(s), ${payload.textCount || 0} AL.`,
        };
        return draft;
      }, { trackHistory: false });
      showToast("Récapitulatif importé", "La structure du projet a été générée.", "success");
      return;
    }

    const manualText = elements.manualRecap.value.trim();
    if (manualText) {
      const payload = await postJson("/api/recap/parse", {
        manualText,
      });
      updateState((draft) => {
        draft.manualRecap = manualText;
        draft.sequences = payload.sequences || [];
        draft.lectureCursives = payload.lectureCursives || [];
        draft.entries = buildEntriesFromRecap(payload.sequences || [], draft.entries || []);
        draft.selectedSequenceId = payload.sequences?.[0]?.id || "";
        draft.selectedLectureCursive = draft.selectedLectureCursive || payload.lectureCursives?.[0] || "";
        draft.banner = {
          tone: "success",
          message: `Récapitulatif texte chargé: ${payload.sequenceCount || 0} séquence(s), ${payload.textCount || 0} AL.`,
        };
        return draft;
      }, { trackHistory: false });
      showToast("Texte importé", "La structure a été générée depuis la saisie manuelle.", "success");
      return;
    }

    setBanner("Ajoute un PDF ou colle le texte du récapitulatif avant de lancer l’analyse.", "warning");
  } catch (error) {
    console.error(error);
    setBanner(error.message || "Le parsing du récapitulatif a échoué.", "danger");
    showToast("Erreur de parsing", error.message || "Impossible de lire le récapitulatif.", "danger");
  }
}

function undo() {
  const previous = history.undo.pop();
  if (!previous) {
    return;
  }
  history.redo.push(clone(stripStateForPersist(state)));
  state = normalizeState({
    ...state,
    ...previous,
    entries: previous.entries.map((entry) => ({
      ...entry,
      files: state.entries.find((current) => current.id === entry.id)?.files || [],
    })),
  });
  schedulePersist();
  render();
}

function redo() {
  const next = history.redo.pop();
  if (!next) {
    return;
  }
  history.undo.push(clone(stripStateForPersist(state)));
  state = normalizeState({
    ...state,
    ...next,
    entries: next.entries.map((entry) => ({
      ...entry,
      files: state.entries.find((current) => current.id === entry.id)?.files || [],
    })),
  });
  schedulePersist();
  render();
}

elements.tabs.forEach((button) => {
  button.addEventListener("click", () => setTab(button.dataset.tab));
});

// Dark mode toggle
elements.themeToggle?.addEventListener("click", () => {
  updateState((state) => {
    state.darkMode = !state.darkMode;
    return state;
  });
});

elements.recapDropzone?.addEventListener("click", () => {
  elements.recapFile?.click();
});

["dragenter", "dragover"].forEach((eventName) => {
  elements.recapDropzone?.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.recapDropzone.classList.add("drag-active");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  elements.recapDropzone?.addEventListener(eventName, () => {
    elements.recapDropzone.classList.remove("drag-active");
  });
});

elements.recapDropzone?.addEventListener("drop", async (event) => {
  event.preventDefault();
  if (event.dataTransfer.files?.length) {
    pendingRecapFile = event.dataTransfer.files[0];
    await withBusy(elements.parseRecap, "Analyse...", parseRecapInput);
  }
});

elements.recapFile?.addEventListener("change", () => {
  pendingRecapFile = elements.recapFile.files?.[0] || null;
  render();
});

// AL Import handlers (drag & drop or file input)
elements.alDropzone?.addEventListener("click", () => {
  elements.alFiles.click();
});

["dragenter", "dragover"].forEach((eventName) => {
  elements.alDropzone?.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.alDropzone.classList.add("drag-active");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  elements.alDropzone?.addEventListener(eventName, () => {
    elements.alDropzone.classList.remove("drag-active");
  });
});

elements.alDropzone?.addEventListener("drop", async (event) => {
  event.preventDefault();
  if (event.dataTransfer.files?.length) {
    await handleSequenceUpload(event.dataTransfer.files);
  }
});

elements.alFiles?.addEventListener("change", async () => {
  if (elements.alFiles.files?.length) {
    await handleSequenceUpload(elements.alFiles.files);
    elements.alFiles.value = "";
  }
});

elements.parseRecap?.addEventListener("click", async () => {
  await withBusy(elements.parseRecap, "Analyse...", parseRecapInput);
});

elements.resetProject?.addEventListener("click", async () => {
  history = { undo: [], redo: [] };
  await clearPersistedFiles();
  localStorage.removeItem(STORAGE_KEY);
  pendingRecapFile = null;
  elements.recapFile.value = "";
  elements.manualRecap.value = "";
  state = createInitialState();
  render();
  showToast("Projet réinitialisé", "Les données locales de cette session ont été effacées.", "warning");
});

elements.sequenceSelect?.addEventListener("change", () => {
  updateState((draft) => {
    draft.selectedSequenceId = elements.sequenceSelect.value;
    return draft;
  }, { trackHistory: false });
});

const lectureControl = elements.lectureCursive || elements.lectureInput;
lectureControl?.addEventListener("change", () => {
  updateState((draft) => {
    draft.selectedLectureCursive = lectureControl.value.trim();
    if (draft.selectedLectureCursive) {
      draft.lectureCursives = unique([...(draft.lectureCursives || []), draft.selectedLectureCursive]);
    }
    return draft;
  }, { trackHistory: false });
});

elements.importModeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    updateState((draft) => {
      draft.importMode = input.value;
      return draft;
    }, { trackHistory: false });
  });
});

elements.viewScopeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    updateState((draft) => {
      draft.viewScope = input.value;
      return draft;
    }, { trackHistory: false });
  });
});

elements.sequenceSummary?.addEventListener("click", (event) => {
  const button = event.target.closest(".sequence-pick");
  if (!button) {
    return;
  }
  updateState((draft) => {
    draft.selectedSequenceId = button.dataset.sequenceId;
    draft.viewScope = "sequence";
    return draft;
  }, { trackHistory: false });
  setTab("import");
});

elements.importGrid?.addEventListener("click", async (event) => {
  const target = event.target;
  const card = target.closest(".al-card");
  if (!card) {
    return;
  }
  const entryId = card.dataset.entryId;

  if (target.closest(".upload-card")) {
    card.querySelector(".al-file-input")?.click();
    return;
  }

  if (target.closest(".process-entry")) {
    collectPreviewEdits();
    await processEntries({ scope: "single", entryId });
    setTab("processing");
    return;
  }

  const fileRow = target.closest(".file-row");
  if (!fileRow) {
    return;
  }
  const fileId = fileRow.dataset.fileId;
  if (target.classList.contains("file-up")) {
    reorderFile(entryId, fileId, "up");
  }
  if (target.classList.contains("file-down")) {
    reorderFile(entryId, fileId, "down");
  }
  if (target.classList.contains("file-delete")) {
    deleteFile(entryId, fileId);
  }
});

elements.importGrid?.addEventListener("change", async (event) => {
  const target = event.target;
  const card = target.closest(".al-card");
  if (!card) {
    return;
  }
  const entryId = card.dataset.entryId;

  if (target.classList.contains("al-file-input")) {
    await attachFilesToEntry(entryId, target.files);
    target.value = "";
  }

  if (target.classList.contains("manual-text")) {
    updateEntry(entryId, (entry) => {
      entry.manualText = target.value;
      entry.status = {
        ...entry.status,
        message: target.value.trim()
          ? "Transcription manuelle ajoutée"
          : "Ajoute une image ou une transcription",
      };
      return entry;
    }, { trackHistory: false });
  }
});

elements.importGrid?.addEventListener("dragstart", (event) => {
  const row = event.target.closest(".file-row");
  if (!row) {
    return;
  }
  event.dataTransfer.setData("text/plain", JSON.stringify({
    entryId: row.dataset.entryId,
    fileId: row.dataset.fileId,
  }));
});

elements.importGrid?.addEventListener("dragover", (event) => {
  if (event.target.closest(".file-row")) {
    event.preventDefault();
  }
});

elements.importGrid?.addEventListener("drop", (event) => {
  const targetRow = event.target.closest(".file-row");
  if (!targetRow) {
    return;
  }
  event.preventDefault();
  const payload = JSON.parse(event.dataTransfer.getData("text/plain"));
  if (payload.entryId !== targetRow.dataset.entryId || payload.fileId === targetRow.dataset.fileId) {
    return;
  }
  updateEntry(payload.entryId, (entry) => {
    const sourceIndex = entry.files.findIndex((file) => file.id === payload.fileId);
    const targetIndex = entry.files.findIndex((file) => file.id === targetRow.dataset.fileId);
    if (sourceIndex === -1 || targetIndex === -1) {
      return entry;
    }
    const nextFiles = [...entry.files];
    const [moved] = nextFiles.splice(sourceIndex, 1);
    nextFiles.splice(targetIndex, 0, moved);
    entry.files = nextFiles;
    return entry;
  });
});

elements.sequenceUploadTrigger?.addEventListener("click", () => {
  elements.sequenceFiles?.click();
});

elements.sequenceFiles?.addEventListener("change", async () => {
  if (elements.sequenceFiles.files?.length) {
    await handleSequenceUpload(elements.sequenceFiles.files);
    elements.sequenceFiles.value = "";
  }
});

["dragenter", "dragover"].forEach((eventName) => {
  elements.sequenceDropzone?.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.sequenceDropzone.classList.add("drag-active");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  elements.sequenceDropzone?.addEventListener(eventName, () => {
    elements.sequenceDropzone.classList.remove("drag-active");
  });
});

elements.sequenceDropzone?.addEventListener("drop", async (event) => {
  event.preventDefault();
  if (event.dataTransfer.files?.length) {
    await handleSequenceUpload(event.dataTransfer.files);
  }
});

elements.processAll?.addEventListener("click", async () => {
  collectPreviewEdits();
  await withBusy(elements.processAll, "Traitement...", () => processEntries({ scope: "all" }));
});

elements.processAllAl?.addEventListener("click", async () => {
  collectPreviewEdits();
  await withBusy(elements.processAllAl, "Traitement...", () => processEntries({ scope: "all" }));
  setTab("processing");
});

elements.processVisible?.addEventListener("click", async () => {
  collectPreviewEdits();
  await withBusy(elements.processVisible, "Traitement...", () => processEntries({ scope: "visible" }));
  setTab("processing");
});

elements.fixWeak?.addEventListener("click", async () => {
  collectPreviewEdits();
  await withBusy(elements.fixWeak, "Correction...", () => applySmartAction("fix-weak"));
});

elements.simplifyAll?.addEventListener("click", async () => {
  collectPreviewEdits();
  await withBusy(elements.simplifyAll, "Simplification...", () => applySmartAction("simplify"));
});

elements.highlightProcedures?.addEventListener("click", async () => {
  collectPreviewEdits();
  await withBusy(elements.highlightProcedures, "Tri...", () => applySmartAction("highlight"));
});

elements.statusTable?.addEventListener("click", async (event) => {
  const button = event.target.closest(".process-entry");
  if (!button) {
    return;
  }
  const entryId = button.dataset.entryId;
  collectPreviewEdits();
  await processEntries({ scope: "single", entryId });
});

elements.previewGrid?.addEventListener("click", async (event) => {
  const button = event.target.closest(".regenerate-entry");
  if (!button) {
    return;
  }
  const card = button.closest(".preview-card");
  if (!card) {
    return;
  }
  collectPreviewEdits();
  await withBusy(button, "Régénération...", () => processEntries({ scope: "single", entryId: card.dataset.previewId }));
});

elements.exportMode?.addEventListener("change", () => {
  updateState((draft) => {
    draft.exportMode = elements.exportMode.value;
    return draft;
  }, { trackHistory: false });
});

elements.exportScope?.addEventListener("change", () => {
  updateState((draft) => {
    draft.exportScope = elements.exportScope.value;
    return draft;
  }, { trackHistory: false });
});

elements.singleAlSelect?.addEventListener("change", () => {
  updateState((draft) => {
    draft.exportSingleId = elements.singleAlSelect.value;
    return draft;
  }, { trackHistory: false });
});

elements.exportExcel?.addEventListener("click", async () => {
  collectPreviewEdits();
  await withBusy(elements.exportExcel, "Export Excel...", () => runExport("xlsx"));
});

elements.exportPdf?.addEventListener("click", async () => {
  collectPreviewEdits();
  await withBusy(elements.exportPdf, "Export PDF...", () => runExport("pdf"));
});

elements.exportBoth?.addEventListener("click", async () => {
  collectPreviewEdits();
  await withBusy(elements.exportBoth, "Exports...", runExportBoth);
});

elements.quickExport?.addEventListener("click", async () => {
  collectPreviewEdits();
  await withBusy(elements.quickExport, "Export Excel...", () => runExport("xlsx"));
});

elements.loadDemo?.addEventListener("click", () => {
  elements.recapFile?.click();
});

elements.manualRecap?.addEventListener("input", () => {
  updateState((draft) => {
    draft.manualRecap = elements.manualRecap.value.trim();
    return draft;
  }, { trackHistory: false });
});

window.addEventListener("keydown", async (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    collectPreviewEdits();
    schedulePersist();
    showToast("Sauvegarde", "Les données locales ont été mises à jour.", "success");
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undo();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
    event.preventDefault();
    redo();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "e") {
    event.preventDefault();
    collectPreviewEdits();
    await runExport("xlsx");
  }
});

hydrateState();

