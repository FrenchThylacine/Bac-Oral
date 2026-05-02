// web/app-v3.js — Bac Oral Studio V3 Frontend
// Handles: upload, processing status, AL card display, export
// All IDs match index.html contract exactly
'use strict';

(function () {

  // ── State ─────────────────────────────────────────────────
  const state = {
    queue: [],      // { id, file, name, status, result }
    als: [],        // loaded from /api/v3/als
    apiKey: localStorage.getItem('bos-v3-apikey') || '',
  };

  // ── DOM refs (matched to index.html IDs) ──────────────────
  const $ = id => document.getElementById(id);

  const els = {
    dropzone:     $('v3-dropzone'),
    fileInput:    $('v3-file-input'),
    queue:        $('v3-queue'),
    queueTitle:   $('v3-queue-title'),
    queueList:    $('v3-queue-list'),
    clearQueue:   $('v3-clear-queue'),
    processBtn:   $('v3-process-btn'),
    alList:       $('v3-al-list'),
    log:          $('v3-log'),
    statTotal:    $('v3-stat-total'),
    statReady:    $('v3-stat-ready'),
    statFlags:    $('v3-stat-flags'),
    exportAll:    $('v3-export-all'),
    exportMode:   $('v3-export-mode'),
    downloadLink: $('v3-download-link'),
    reviewSection:$('v3-review-section'),
    reviewBody:   $('v3-review-body'),
    apiKeyInput:  $('v3-api-key'),
    saveKeyBtn:   $('v3-save-key'),
    keyStatus:    $('v3-key-status'),
  };

  // ── Logging ───────────────────────────────────────────────
  function log(msg, type = 'info') {
    if (!els.log) return;
    const row = document.createElement('div');
    row.className = `log-row log-${type}`;
    row.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    els.log.appendChild(row);
    els.log.scrollTop = els.log.scrollHeight;
    // Keep max 60 lines
    while (els.log.children.length > 60) els.log.removeChild(els.log.firstChild);
  }

  // ── API helpers ───────────────────────────────────────────
  async function apiPost(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async function apiGet(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // ── File → base64 ─────────────────────────────────────────
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ── API Key ───────────────────────────────────────────────
  if (els.apiKeyInput) {
    els.apiKeyInput.value = state.apiKey;
    updateKeyStatus();
  }

  if (els.saveKeyBtn) {
    els.saveKeyBtn.addEventListener('click', () => {
      const val = els.apiKeyInput.value.trim();
      state.apiKey = val;
      localStorage.setItem('bos-v3-apikey', val);
      updateKeyStatus();
      log(val ? 'API key saved — vision mode enabled' : 'API key cleared — OCR mode', 'success');
    });
  }

  function updateKeyStatus() {
    if (!els.keyStatus) return;
    if (state.apiKey && state.apiKey.startsWith('sk-')) {
      els.keyStatus.textContent = 'Vision IA active';
      els.keyStatus.className = 'key-status key-ok';
    } else {
      els.keyStatus.textContent = 'OCR mode (no API key)';
      els.keyStatus.className = 'key-status key-warn';
    }
  }

  // ── Dropzone ──────────────────────────────────────────────
  if (els.dropzone) {
    els.dropzone.addEventListener('click', () => els.fileInput?.click());

    els.dropzone.addEventListener('dragover', e => {
      e.preventDefault();
      els.dropzone.classList.add('drag-over');
    });
    els.dropzone.addEventListener('dragleave', () => {
      els.dropzone.classList.remove('drag-over');
    });
    els.dropzone.addEventListener('drop', e => {
      e.preventDefault();
      els.dropzone.classList.remove('drag-over');
      addFilesToQueue([...e.dataTransfer.files]);
    });
  }

  if (els.fileInput) {
    els.fileInput.addEventListener('change', () => {
      addFilesToQueue([...els.fileInput.files]);
      els.fileInput.value = '';
    });
  }

  function addFilesToQueue(files) {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (!imageFiles.length) { log('No image files found in selection', 'warn'); return; }

    for (const file of imageFiles) {
      state.queue.push({
        id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        name: file.name,
        status: 'waiting', // waiting | processing | done | error
        result: null,
      });
    }

    log(`${imageFiles.length} file(s) added to queue`, 'success');
    renderQueue();
    updateProcessBtn();
  }

  function renderQueue() {
    if (!els.queue || !els.queueList || !els.queueTitle) return;

    if (state.queue.length === 0) {
      els.queue.classList.add('hidden');
      return;
    }

    els.queue.classList.remove('hidden');
    els.queueTitle.textContent = `${state.queue.length} fichier(s) en attente`;

    els.queueList.innerHTML = state.queue.map(item => `
      <div class="queue-item queue-item--${item.status}" data-qid="${item.id}">
        <div class="queue-item-icon">${statusIcon(item.status)}</div>
        <div class="queue-item-name">${escHtml(item.name)}</div>
        <div class="queue-item-status">${statusLabel(item.status)}</div>
        ${item.status === 'waiting' ?
          `<button class="queue-remove-btn" data-qid="${item.id}">✕</button>` : ''}
      </div>
    `).join('');

    // Wire remove buttons
    els.queueList.querySelectorAll('.queue-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const qid = btn.dataset.qid;
        state.queue = state.queue.filter(i => i.id !== qid);
        renderQueue();
        updateProcessBtn();
      });
    });
  }

  function statusIcon(status) {
    return { waiting: '○', processing: '◌', done: '●', error: '✕' }[status] || '○';
  }
  function statusLabel(status) {
    return { waiting: 'En attente', processing: 'Traitement…', done: 'Traité', error: 'Erreur' }[status] || '';
  }

  function updateProcessBtn() {
    if (!els.processBtn) return;
    const waiting = state.queue.filter(i => i.status === 'waiting').length;
    els.processBtn.disabled = waiting === 0;
    els.processBtn.textContent = waiting > 0
      ? `Analyser ${waiting} fichier(s)`
      : 'Analyser';
  }

  if (els.clearQueue) {
    els.clearQueue.addEventListener('click', () => {
      state.queue = state.queue.filter(i => i.status !== 'waiting');
      renderQueue();
      updateProcessBtn();
    });
  }

  // ── Process queue ─────────────────────────────────────────
  if (els.processBtn) {
    els.processBtn.addEventListener('click', processQueue);
  }

  async function processQueue() {
    const toProcess = state.queue.filter(i => i.status === 'waiting');
    if (!toProcess.length) return;

    els.processBtn.disabled = true;
    log(`Starting analysis of ${toProcess.length} file(s)…`);

    for (const item of toProcess) {
      item.status = 'processing';
      renderQueue();
      log(`Processing: ${item.name}…`);

      try {
        const dataUrl = await fileToBase64(item.file);
        const result = await apiPost('/api/v3/upload', {
          images: [{ dataUrl, name: item.name }],
          apiKey: state.apiKey || undefined,
        });

        item.status = 'done';
        item.result = result;
        log(`Done: ${item.name} → ${result.title || result.alId}`, 'success');
      } catch (err) {
        item.status = 'error';
        log(`Error: ${item.name} — ${err.message}`, 'error');
      }

      renderQueue();
    }

    log('All files processed — reloading AL list…', 'success');
    await loadALs();
    updateProcessBtn();
  }

  // ── Load ALs from server ──────────────────────────────────
  async function loadALs() {
    try {
      const data = await apiGet('/api/v3/als');
      state.als = data.als || [];
      renderALList();
      updateStats();
      log(`${state.als.length} AL(s) loaded`, 'success');
    } catch (err) {
      log(`Failed to load ALs: ${err.message}`, 'error');
    }
  }

  // ── Render AL cards ───────────────────────────────────────
  function renderALList() {
    if (!els.alList) return;

    if (!state.als.length) {
      els.alList.innerHTML = `
        <div class="al-empty">
          <div class="al-empty-icon">—</div>
          <div class="al-empty-title">Aucune AL traitée</div>
          <div class="al-empty-sub">Importez des photos et lancez l'analyse.</div>
        </div>`;
      return;
    }

    els.alList.innerHTML = state.als.map(al => renderALCard(al)).join('');

    // Wire delete buttons
    els.alList.querySelectorAll('.al-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Supprimer cette AL ?')) return;
        try {
          await fetch(`/api/v3/als/${btn.dataset.alid}`, { method: 'DELETE' });
          state.als = state.als.filter(a => a.id !== btn.dataset.alid);
          renderALList();
          updateStats();
        } catch (e) { log('Delete failed: ' + e.message, 'error'); }
      });
    });

    // Wire expand buttons
    els.alList.querySelectorAll('.al-expand-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.al-card');
        const body = card.querySelector('.al-card-body');
        const isOpen = body.classList.toggle('al-card-body--open');
        btn.textContent = isOpen ? 'Réduire' : 'Voir détails';
      });
    });
  }

  function renderALCard(al) {
    const flags = parseJson(al.quality_flags, []);
    const oralBullets = parseJson(al.oral_bullets, []);
    const hasOcr = al.source_text && al.source_text.length > 50;
    const statusCls = hasOcr ? 'status-ok' : 'status-warn';
    const statusTxt = hasOcr ? 'OCR OK' : 'OCR insuffisant';
    const genreColor = { theatre: '#6B3FA0', poesie: '#1A5FA8', roman: '#8B2E45', general: '#2E6B4A' };
    const gc = genreColor[al.genre] || genreColor.general;

    return `
      <div class="al-card" data-alid="${al.id}">
        <div class="al-card-stripe" style="background:${gc}"></div>
        <div class="al-card-header">
          <div class="al-card-meta">
            <span class="al-card-label">${escHtml(al.label || al.id)}</span>
            <span class="al-card-genre" style="color:${gc}">${escHtml(al.genre || 'général')}</span>
          </div>
          <div class="al-card-title">${escHtml(al.title || 'Sans titre')}</div>
          ${al.author ? `<div class="al-card-author">${escHtml(al.author)}</div>` : ''}
          <div class="al-card-indicators">
            <span class="al-indicator ${statusCls}">${statusTxt}</span>
            ${flags.length ? `<span class="al-indicator status-warn">${flags.length} alerte(s)</span>` : ''}
          </div>
        </div>

        <div class="al-card-body">
          ${al.introduction ? `
            <div class="al-section">
              <div class="al-section-label">Introduction</div>
              <div class="al-section-text" contenteditable="true" data-field="introduction" data-alid="${al.id}">${escHtml(al.introduction)}</div>
            </div>` : ''}

          <div class="al-section">
            <div class="al-section-label">Mouvements</div>
            <div class="al-movements" id="mov-${al.id}">
              <div class="al-loading">Chargement…</div>
            </div>
          </div>

          ${oralBullets.length ? `
            <div class="al-section">
              <div class="al-section-label">Bullets oraux</div>
              <div class="al-bullets">
                ${oralBullets.map(b => `<div class="al-bullet">${escHtml(b)}</div>`).join('')}
              </div>
            </div>` : ''}

          ${al.conclusion ? `
            <div class="al-section">
              <div class="al-section-label">Conclusion</div>
              <div class="al-section-text" contenteditable="true" data-field="conclusion" data-alid="${al.id}">${escHtml(al.conclusion)}</div>
            </div>` : ''}

          ${al.source_text ? `
            <details class="al-source">
              <summary>Texte OCR source</summary>
              <pre class="al-source-text">${escHtml(al.source_text.slice(0, 500))}${al.source_text.length > 500 ? '…' : ''}</pre>
            </details>` : ''}
        </div>

        <div class="al-card-footer">
          <button class="al-expand-btn btn-text" data-alid="${al.id}">Voir détails</button>
          <button class="al-export-btn btn-text" data-alid="${al.id}">Export Excel</button>
          <button class="al-delete-btn btn-text btn-danger" data-alid="${al.id}">Supprimer</button>
        </div>
      </div>`;
  }

  // Load movements lazily when card is expanded
  document.addEventListener('click', async e => {
    const btn = e.target.closest('.al-expand-btn');
    if (!btn) return;
    const alid = btn.dataset.alid;
    const movDiv = document.getElementById(`mov-${alid}`);
    if (!movDiv || movDiv.dataset.loaded) return;

    try {
      const al = await apiGet(`/api/v3/als/${alid}`);
      movDiv.dataset.loaded = '1';
      movDiv.innerHTML = renderMovements(al.movements || [], al.genre);
    } catch (e) {
      movDiv.innerHTML = `<div class="al-error">Erreur chargement: ${e.message}</div>`;
    }
  });

  function renderMovements(movements, genre) {
    if (!movements.length) return '<div class="al-empty-sub">Aucun mouvement détecté</div>';
    const gc = { theatre: '#6B3FA0', poesie: '#1A5FA8', roman: '#8B2E45', general: '#2E6B4A' };
    const color = gc[genre] || gc.general;

    return movements.map(mov => `
      <div class="al-movement" style="border-left:3px solid ${color}">
        <div class="al-movement-title" style="color:${color}">
          ${escHtml(mov.title || `Mouvement ${mov.number}`)}
          ${mov.lines ? `<span class="al-movement-lines">${escHtml(mov.lines)}</span>` : ''}
        </div>
        ${(mov.procedures || []).length ? `
          <div class="al-procs">
            ${(mov.procedures || []).map(p => `
              <div class="al-proc al-proc--w${Math.min(p.weight || 3, 5)}">
                <span class="al-proc-label">${escHtml(p.label)}</span>
                ${p.quote ? `<span class="al-proc-quote">« ${escHtml(p.quote)} »</span>` : ''}
                <span class="al-proc-analysis">${escHtml(p.analysis)}</span>
                <span class="al-proc-weight">${'●'.repeat(p.weight || 3)}${'○'.repeat(5 - (p.weight || 3))}</span>
              </div>`).join('')}
          </div>` : '<div class="al-empty-sub">Procédés non détectés</div>'}
      </div>`).join('');
  }

  // ── Stats ─────────────────────────────────────────────────
  function updateStats() {
    const total = state.als.length;
    const ready = state.als.filter(a => {
      const bullets = parseJson(a.oral_bullets, []);
      return bullets.length >= 2;
    }).length;
    const flags = state.als.filter(a => parseJson(a.quality_flags, []).length > 0).length;

    if (els.statTotal) els.statTotal.textContent = total;
    if (els.statReady) els.statReady.textContent = ready;
    if (els.statFlags) els.statFlags.textContent = flags;

    // Update global header stats
    const readyCount = document.getElementById('ready-count');
    if (readyCount) readyCount.textContent = ready;
  }

  // ── Export ────────────────────────────────────────────────
  if (els.exportAll) {
    els.exportAll.addEventListener('click', async () => {
      if (!state.als.length) { log('No ALs to export', 'warn'); return; }
      els.exportAll.disabled = true;
      els.exportAll.textContent = 'Export en cours…';
      try {
        const mode = els.exportMode?.value || 'minimalist';
        const data = await apiPost('/api/v3/export', { mode });
        if (els.downloadLink) {
          els.downloadLink.href = data.downloadUrl;
          els.downloadLink.download = data.fileName;
          els.downloadLink.classList.remove('hidden');
          els.downloadLink.click();
        }
        log(`Export ready: ${data.fileName}`, 'success');
      } catch (e) {
        log('Export failed: ' + e.message, 'error');
      } finally {
        els.exportAll.disabled = false;
        els.exportAll.textContent = 'Export Excel — Toutes les AL';
      }
    });
  }

  // Per-AL export
  document.addEventListener('click', async e => {
    const btn = e.target.closest('.al-export-btn');
    if (!btn) return;
    const alid = btn.dataset.alid;
    btn.textContent = 'Export…';
    btn.disabled = true;
    try {
      const data = await apiPost('/api/v3/export', { alId: alid, mode: els.exportMode?.value || 'minimalist' });
      if (els.downloadLink) {
        els.downloadLink.href = data.downloadUrl;
        els.downloadLink.download = data.fileName;
        els.downloadLink.classList.remove('hidden');
        els.downloadLink.click();
      }
      log(`Export: ${data.fileName}`, 'success');
    } catch (err) {
      log('Export failed: ' + err.message, 'error');
    } finally {
      btn.textContent = 'Export Excel';
      btn.disabled = false;
    }
  });

  // ── Inline editing auto-save ──────────────────────────────
  document.addEventListener('blur', async e => {
    const el = e.target.closest('[data-field][data-alid]');
    if (!el) return;
    const { field, alid } = el.dataset;
    const value = el.textContent.trim();
    try {
      await fetch(`/api/v3/als/${alid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      log(`Saved: ${field}`, 'success');
    } catch (e) { log('Save failed: ' + e.message, 'error'); }
  }, true);

  // ── Utilities ─────────────────────────────────────────────
  function escHtml(str = '') {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function parseJson(val, fallback) {
    try { return JSON.parse(val || '[]'); } catch { return fallback; }
  }

  // ── Init ──────────────────────────────────────────────────
  async function init() {
    log('Bac Oral Studio V3 ready');
    updateKeyStatus();

    // Set V3 tab as default active
    const v3Tab = document.querySelector('[data-tab="digitize"]');
    const recapTab = document.querySelector('[data-tab="recap"]');
    const v3Panel = document.getElementById('tab-digitize');
    const recapPanel = document.getElementById('tab-recap');

    if (v3Tab && v3Panel && recapTab && recapPanel) {
      recapTab.classList.remove('active');
      recapPanel.classList.remove('active');
      v3Tab.classList.add('active');
      v3Panel.classList.add('active');
    }

    await loadALs();
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
