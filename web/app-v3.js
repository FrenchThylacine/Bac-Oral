'''// web/app-v3.js — Bac Oral Studio V3 Frontend v4.0
'use strict';

(function () {

  // ── State ─────────────────────────────────────────────────
  const state = {
    queue: [],
    als: [],
    apiKey: localStorage.getItem('bos-v3-apikey') || '',
  };

  // ── DOM refs ──────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const els = {
    dropzone: $('v3-dropzone'), fileInput: $('v3-file-input'),
    queue: $('v3-queue'), queueTitle: $('v3-queue-title'), queueList: $('v3-queue-list'),
    clearQueue: $('v3-clear-queue'), processBtn: $('v3-process-btn'),
    alList: $('v3-al-list'), log: $('v3-log'),
    statTotal: $('v3-stat-total'), statReady: $('v3-stat-ready'), statFlags: $('v3-stat-flags'),
    exportAll: $('v3-export-all'), exportMode: $('v3-export-mode'), downloadLink: $('v3-download-link'),
    apiKeyInput: $('v3-api-key'), saveKeyBtn: $('v3-save-key'), keyStatus: $('v3-key-status'),
  };

  // ── Logging ───────────────────────────────────────────────
  function log(msg, type = 'info') {
    if (!els.log) return;
    const row = document.createElement('div');
    row.className = `log-row log-${type}`;
    row.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    els.log.appendChild(row);
    els.log.scrollTop = els.log.scrollHeight;
    if (els.log.children.length > 60) els.log.removeChild(els.log.firstChild);
  }

  // ── API helpers ───────────────────────────────────────────
  async function apiPost(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  async function apiGet(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // ── File Handling ─────────────────────────────────────────
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ── Init & Event Listeners ────────────────────────────────
  function init() {
    setupApiKeyHandler();
    setupDropzone();
    setupQueueButtons();
    setupExportButtons();
    setupActionButtons();
    log('Bac Oral Studio V3 ready');
    loadALs();
  }

  function setupApiKeyHandler() {
    if (!els.apiKeyInput) return;
    els.apiKeyInput.value = state.apiKey;
    updateKeyStatus();
    els.saveKeyBtn.addEventListener('click', () => {
      state.apiKey = els.apiKeyInput.value.trim();
      localStorage.setItem('bos-v3-apikey', state.apiKey);
      updateKeyStatus();
      log(state.apiKey ? 'API key saved — vision mode enabled' : 'API key cleared — OCR mode', 'success');
    });
  }

  function updateKeyStatus() {
    if (!els.keyStatus) return;
    const isActive = state.apiKey && state.apiKey.startsWith('sk-');
    els.keyStatus.textContent = isActive ? 'Vision IA active' : 'OCR locale active';
    els.keyStatus.className = `key-status ${isActive ? 'key-ok' : 'key-warn'}`;
  }

  function setupDropzone() {
    if (!els.dropzone) return;
    const dz = els.dropzone;
    dz.addEventListener('click', () => els.fileInput?.click());
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', e => {
      e.preventDefault();
      dz.classList.remove('drag-over');
      addFilesToQueue([...e.dataTransfer.files]);
    });
    els.fileInput.addEventListener('change', () => {
      addFilesToQueue([...els.fileInput.files]);
      els.fileInput.value = '';
    });
  }
   
  function setupQueueButtons() {
    els.processBtn?.addEventListener('click', processQueue);
    els.clearQueue?.addEventListener('click', () => {
      state.queue = state.queue.filter(i => i.status !== 'waiting');
      renderQueue();
    });
  }

  function setupExportButtons() {
      els.exportAll?.addEventListener('click', () => exportData('pdf', null));
  }

  function setupActionButtons() {
      document.addEventListener('click', e => {
          const delBtn = e.target.closest('.al-delete-btn');
          if (delBtn) handleDelete(delBtn.dataset.alid);

          const pdfBtn = e.target.closest('.al-export-pdf-btn');
          if (pdfBtn) exportData('pdf', pdfBtn.dataset.alid);
      });
  }

  // ── Queue Management ──────────────────────────────────────
  function addFilesToQueue(files) {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (!imageFiles.length) return log('No image files found', 'warn');

    imageFiles.forEach(file => {
      state.queue.push({
        id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        file, name: file.name, status: 'waiting',
      });
    });
    log(`${imageFiles.length} file(s) added to queue`, 'success');
    renderQueue();
  }

  function renderQueue() {
    if (!els.queue) return;
    const hasItems = state.queue.length > 0;
    els.queue.classList.toggle('hidden', !hasItems);
    if (!hasItems) return;

    const waitingCount = state.queue.filter(i => i.status === 'waiting').length;
    els.queueTitle.textContent = `${state.queue.length} fichier(s) en attente`;
    els.processBtn.disabled = waitingCount === 0;
    els.processBtn.textContent = waitingCount > 0 ? `Analyser ${waitingCount} fichier(s)` : 'Analyser';

    const statusMap = { waiting: '○', processing: '◌', done: '●', error: '✕' };
    els.queueList.innerHTML = state.queue.map(item => `
      <div class="queue-item queue-item--${item.status}" data-qid="${item.id}">
        <div class="queue-item-icon">${statusMap[item.status]}</div>
        <div class="queue-item-name">${escHtml(item.name)}</div>
      </div>`).join('');
  }

  async function processQueue() {
    const toProcess = state.queue.filter(i => i.status === 'waiting');
    if (!toProcess.length) return;

    log(`Starting analysis of ${toProcess.length} file(s)...`);
    for (const item of toProcess) {
      item.status = 'processing';
      renderQueue();
      log(`Processing: ${item.name}...`);
      try {
        const dataUrl = await fileToBase64(item.file);
        await apiPost('/api/v3/upload', {
          images: [{ dataUrl, name: item.name }],
          apiKey: state.apiKey || undefined,
        });
        item.status = 'done';
        log(`Done: ${item.name}`, 'success');
      } catch (err) {
        item.status = 'error';
        log(`Error processing ${item.name}: ${err.message}`, 'error');
      }
      renderQueue();
    }
    log('Processing complete. Reloading AL list.', 'success');
    loadALs();
  }

  // ── AL Data & Rendering ───────────────────────────────────
  async function loadALs() {
    try {
      const data = await apiGet('/api/v3/als');
      state.als = data.als || [];
      renderALList();
      updateStats();
    } catch (err) {
      log(`Failed to load ALs: ${err.message}`, 'error');
    }
  }
  
  function renderALList() {
    if (!els.alList) return;
    if (!state.als.length) {
      els.alList.innerHTML = `<div class="al-empty"><div class="al-empty-icon">—</div><div class="al-empty-title">Aucune AL traitée</div><div class="al-empty-sub">Importez des photos pour commencer.</div></div>`;
      return;
    }
    els.alList.innerHTML = state.als.map(al => renderALCard(al)).join('');
  }

  function getGenreColor(genre) {
    const colors = { theatre: '#6B3FA0', poesie: '#1A5FA8', roman: '#8B2E45', general: '#2E6B4A' };
    return colors[genre] || colors.general;
  }

  function renderALCard(al) {
    const color = getGenreColor(al.genre);
    const flags = al.qualityFlags || [];
    const statusCls = flags.includes("ocr_insuffisante") ? 'status-warn' : 'status-ok';
    const statusTxt = statusCls === 'status-ok' ? 'OCR OK' : 'OCR Faible';
    
    return `
      <div class="al-card" data-alid="${al.id}">
        <div class="al-card-stripe" style="background:${color}"></div>
        <div class="al-card-header">
          <div class="al-card-meta">
            <span class="al-card-label">${escHtml(al.label)}</span>
            <span class="al-card-genre" style="color:${color}">${escHtml(al.genre)}</span>
          </div>
          <div class="al-card-title">${escHtml(al.title)}</div>
          <div class="al-card-author">${escHtml(al.author)}</div>
          <div class="al-card-indicators">
            <span class="al-indicator ${statusCls}">${statusTxt}</span>
            <span class="al-indicator status-info">${al.movements?.length || 0} mvts</span>
            <span class="al-indicator status-info">${al.movements?.reduce((sum, m) => sum + m.procedures.length, 0) || 0} procédés</span>
            ${flags.length ? `<span class="al-indicator status-warn">${flags.length} alerte(s)</span>` : ''}
          </div>
        </div>
        <div class="al-card-body al-card-body--open">
          ${renderStructuredSection('INTRODUCTION', al.introduction)}
          ${renderMovements(al.movements, al.genre)}
          ${renderStructuredSection('CONCLUSION', al.conclusion)}
        </div>
        <div class="al-card-footer">
          <button class="al-export-pdf-btn btn-text" data-alid="${al.id}">Export PDF</button>
          <button class="al-delete-btn btn-text btn-danger" data-alid="${al.id}">Supprimer</button>
        </div>
      </div>`;
  }

  function renderStructuredSection(title, data) {
    if (!data) return '';
    const fieldMap = {
      INTRODUCTION: { auteurContexte: 'Auteur/Contexte', oeuvrePassage: 'Œuvre/Passage', problematique: 'Problématique', annoncePlan: 'Annonce du Plan' },
      CONCLUSION: { cheminement: 'Cheminement', reponse: 'Réponse', ouverture: 'Ouverture' },
    };
    const fields = fieldMap[title];
    if (!fields) return '';
    
    const content = Object.entries(fields)
      .map(([key, label]) => data[key] ? `<p><strong>${label}:</strong> ${escHtml(data[key])}</p>` : '')
      .join('');
      
    return `<div class="al-section">
              <div class="al-section-label">${title}</div>
              <div class="al-section-content">${content}</div>
            </div>`;
  }

  function renderMovements(movements, genre) {
    if (!movements || !movements.length) return '<div class="al-section"><div class="al-section-label">MOUVEMENTS</div><p>Aucun mouvement détecté.</p></div>';
    const color = getGenreColor(genre);
    
    return `<div class="al-section">
              <div class="al-section-label">MOUVEMENTS</div>
              ${movements.map(mov => `
                <div class="al-movement" style="border-left-color: ${color};">
                  <div class="al-movement-header">
                    <strong style="color: ${color};">Mouvement ${mov.number}: ${escHtml(mov.title)}</strong>
                  </div>
                  <p class="al-movement-theme"><em>${escHtml(mov.phraseTheme)}</em></p>
                  <div class="al-procs-table">
                    <div class="al-procs-header">
                      <div>Procédé</div><div>Citation</div><div>Analyse</div><div>Poids</div>
                    </div>
                    ${(mov.procedures || []).map(p => `
                      <div class="al-proc-row">
                        <div>${escHtml(p.label)}</div>
                        <div>« ${escHtml(p.quote)} »</div>
                        <div>${escHtml(p.analysis)}</div>
                        <div>${'●'.repeat(p.weight || 0)}${'○'.repeat(5 - (p.weight || 0))}</div>
                      </div>`).join('')}
                  </div>
                </div>
              `).join('')}
            </div>`;
  }
  
  // ── Actions ───────────────────────────────────────────────
  async function handleDelete(alId) {
    if (!alId || !confirm(`Supprimer l'AL ${alId} ?`)) return;
    try {
      await fetch(`/api/v3/als/${alId}`, { method: 'DELETE' });
      log(`AL ${alId} deleted.`, 'success');
      loadALs();
    } catch (err) {
      log(`Failed to delete ${alId}: ${err.message}`, 'error');
    }
  }

  async function exportData(format, alId) {
      const btn = alId ? document.querySelector(`.al-export-${format}-btn[data-alid="${alId}"]`) : els.exportAll;
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Export...';

      try {
          const payload = { format };
          if (alId) payload.alId = alId;

          const data = await apiPost('/api/v3/export', payload);

          if (els.downloadLink) {
              els.downloadLink.href = data.downloadUrl;
              els.downloadLink.download = data.fileName;
              els.downloadLink.click();
              log(`Export successful: ${data.fileName}`, 'success');
          }
      } catch (err) {
          log(`Export failed: ${err.message}`, 'error');
      } finally {
          btn.disabled = false;
          btn.textContent = originalText;
      }
  }

  // ── Stats ─────────────────────────────────────────────────
  function updateStats() {
    const total = state.als.length;
    const ready = state.als.filter(a => a.movements?.length > 0).length;
    const flags = state.als.reduce((acc, a) => acc + (a.qualityFlags?.length || 0), 0);

    if (els.statTotal) els.statTotal.textContent = total;
    if (els.statReady) els.statReady.textContent = ready;
    if (els.statFlags) els.statFlags.textContent = flags;
  }

  // ── Utils ─────────────────────────────────────────────────
  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Run ───────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);

})();
''