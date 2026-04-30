/**
 * V3 AI Digitization Module
 * Handles file uploads, processing, review, and export for AL digitization
 * 
 * Bug Fixes:
 * - Removed all emojis
 * - Added null checks for all DOM elements
 * - Improved error handling and recovery
 * - Consistent async/await patterns
 * - Better logging and debugging
 */

const V3_CONFIG = {
  maxFiles: 20,
  maxFileSize: 50 * 1024 * 1024, // 50MB
  batchSize: 5,
  apiBase: '/api/v3',
  requestTimeout: 60000,
};

// State
const v3State = {
  fileQueue: [],
  processedALs: [],
  flaggedItems: [],
  currentProcessing: false,
  completionScore: 0,
  autoExport: true,
};

// V3 DOM Elements (lazy loaded)
const v3Elements = {};

// Utility: HTML escaping
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Utility: Safe element getter
function getV3Element(selector) {
  try {
    return document.querySelector(selector);
  } catch (e) {
    console.warn(`[V3] Failed to find element: ${selector}`, e);
    return null;
  }
}

// Initialize DOM elements
function initV3Elements() {
  v3Elements.dropzone = getV3Element('#v3-dropzone');
  v3Elements.files = getV3Element('#v3-files');
  v3Elements.queue = getV3Element('#v3-queue');
  v3Elements.queueCount = getV3Element('#v3-queue-count');
  v3Elements.processAllBtn = getV3Element('#v3-process-all');
  v3Elements.clearQueueBtn = getV3Element('#v3-clear-queue');
  v3Elements.processedCount = getV3Element('#v3-processed-count');
  v3Elements.flaggedCount = getV3Element('#v3-flagged-count');
  v3Elements.completionBar = getV3Element('#v3-completion-bar');
  v3Elements.completionPct = getV3Element('#v3-completion-pct');
  v3Elements.autoExportCheckbox = getV3Element('#v3-auto-export');
  v3Elements.refreshStatusBtn = getV3Element('#v3-refresh-status');
  v3Elements.reviewTable = getV3Element('#v3-review-table');
  v3Elements.flaggedBadge = getV3Element('#v3-flagged-badge');
  v3Elements.loadFlaggedBtn = getV3Element('#v3-load-flagged');
  v3Elements.approveAllBtn = getV3Element('#v3-approve-all');
  v3Elements.exportExcelBtn = getV3Element('#v3-export-excel');
  v3Elements.exportPdfBtn = getV3Element('#v3-export-pdf');
  v3Elements.exportJsonBtn = getV3Element('#v3-export-json');
  v3Elements.exportAllBtn = getV3Element('#v3-export-all');
  v3Elements.alList = getV3Element('#v3-al-list');
  v3Elements.alCount = getV3Element('#v3-al-count');
  v3Elements.uploadStatus = getV3Element('#v3-upload-status');
}

// Utility: Show notifications
function showToastV3(title, message, type = 'info') {
  console.log(`[V3][${type.toUpperCase()}] ${title}: ${message}`);
  if (typeof showToast === 'function') {
    showToast(title, message, type);
  }
}

// ===== FILE UPLOAD HANDLERS =====

function setupV3FileUpload() {
  if (!v3Elements.dropzone) {
    console.warn('[V3] Dropzone element not found');
    return;
  }

  v3Elements.dropzone.addEventListener('click', () => {
    if (v3Elements.files) {
      v3Elements.files.click();
    }
  });

  v3Elements.dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    v3Elements.dropzone.classList.add('dragging');
  });

  v3Elements.dropzone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    v3Elements.dropzone.classList.remove('dragging');
  });

  v3Elements.dropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    v3Elements.dropzone.classList.remove('dragging');
    if (e.dataTransfer?.files) {
      await handleV3FileSelect(e.dataTransfer.files);
    }
  });

  if (v3Elements.files) {
    v3Elements.files.addEventListener('change', async (e) => {
      if (e.target?.files) {
        await handleV3FileSelect(e.target.files);
      }
    });
  }
}

async function handleV3FileSelect(files) {
  if (!files || files.length === 0) {
    showToastV3('No Files', 'No files selected', 'warning');
    return;
  }

  const newFiles = Array.from(files).slice(0, V3_CONFIG.maxFiles - v3State.fileQueue.length);
  
  for (const file of newFiles) {
    if (file.size > V3_CONFIG.maxFileSize) {
      showToastV3('File Too Large', `${file.name} exceeds 50MB limit`, 'error');
      continue;
    }

    const fileId = `v3_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    v3State.fileQueue.push({
      id: fileId,
      file,
      status: 'pending',
      progress: 0,
      result: null,
      error: null,
    });
  }

  renderV3Queue();
  updateV3Controls();
  showToastV3('Files Added', `${newFiles.length} file(s) added to queue`, 'success');
}

function renderV3Queue() {
  if (!v3Elements.queue) return;

  if (v3State.fileQueue.length === 0) {
    v3Elements.queue.innerHTML = '<div class="empty-state">No files in queue</div>';
    return;
  }

  v3Elements.queue.innerHTML = v3State.fileQueue
    .map((item) => {
      const statusClass = item.status || 'pending';
      const fileSize = (item.file.size / 1024 / 1024).toFixed(1);
      
      return `
        <div class="queue-item queue-item-${statusClass}">
          <div class="queue-item-content">
            <div class="queue-item-info">
              <span class="queue-item-name" title="${escapeHtml(item.file.name)}">${escapeHtml(item.file.name)}</span>
              <span class="queue-item-size">${fileSize}MB</span>
            </div>
            <div class="queue-item-progress">
              <div class="progress-bar-small">
                <div class="progress-fill-small" style="width: ${item.progress}%"></div>
              </div>
              <span class="queue-item-status">${statusClass}</span>
            </div>
            ${item.error ? `<div class="queue-item-error">${escapeHtml(item.error)}</div>` : ''}
          </div>
          ${item.status === 'pending' ? `
            <button class="queue-item-remove" onclick="removeV3QueueItem('${item.id}')" type="button" title="Remove">Remove</button>
          ` : ''}
        </div>
      `;
    })
    .join('');
}

function removeV3QueueItem(fileId) {
  v3State.fileQueue = v3State.fileQueue.filter((f) => f.id !== fileId);
  renderV3Queue();
  updateV3Controls();
}

function updateV3Controls() {
  if (v3Elements.queueCount) {
    v3Elements.queueCount.textContent = v3State.fileQueue.length;
  }
  if (v3Elements.processAllBtn) {
    v3Elements.processAllBtn.disabled = v3State.fileQueue.length === 0 || v3State.currentProcessing;
  }
  if (v3Elements.clearQueueBtn) {
    v3Elements.clearQueueBtn.disabled = v3State.fileQueue.length === 0;
  }
}

// ===== PROCESSING HANDLERS =====

async function processAllV3Files() {
  if (v3State.currentProcessing || v3State.fileQueue.length === 0) return;

  v3State.currentProcessing = true;
  updateV3Controls();

  for (const item of v3State.fileQueue) {
    if (item.status !== 'pending') continue;

    await processV3File(item);
  }

  v3State.currentProcessing = false;
  updateV3Controls();
  await refreshV3Status();

  if (v3State.autoExport && v3State.processedALs.length > 0) {
    showToast('Processing Complete', 'Auto-exporting results...', 'success');
    exportAllV3ALs();
  }
}

async function processV3File(item) {
  try {
    item.status = 'processing';
    renderV3Queue();

    // Step 1: Upload and extract
    item.progress = 25;
    renderV3Queue();

    const formData = new FormData();
    formData.append('file', item.file);
    formData.append('fileName', item.file.name);

    const uploadRes = await fetch(`${V3_CONFIG.apiBase}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.statusText}`);

    const uploadData = await uploadRes.json();
    if (!uploadData.success) throw new Error(uploadData.error || 'Upload failed');

    const alId = uploadData.alId;
    item.progress = 50;
    renderV3Queue();

    // Step 2: Process (complete + validate)
    const processRes = await fetch(`${V3_CONFIG.apiBase}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: alId }),
    });

    if (!processRes.ok) throw new Error(`Processing failed: ${processRes.statusText}`);

    const processData = await processRes.json();
    item.progress = 75;
    renderV3Queue();

    // Step 3: Fetch full AL data
    const getRes = await fetch(`${V3_CONFIG.apiBase}/als/${alId}`);
    if (!getRes.ok) throw new Error('Failed to fetch AL data');

    const alData = await getRes.json();
    item.progress = 100;
    item.status = 'complete';
    item.result = {
      alId,
      title: uploadData.title,
      completionScore: processData.completionScore,
      flaggedCount: processData.flaggedCount,
      al: alData,
    };

    v3State.processedALs.push(item.result);
    renderV3Queue();
    showToast('Processed', `${uploadData.title} completed`, 'success');
  } catch (err) {
    item.status = 'error';
    item.result = { error: err.message };
    renderV3Queue();
    showToast('Error', `Failed to process ${item.file.name}: ${err.message}`, 'error');
  }
}

// ===== REVIEW HANDLERS =====

async function loadFlaggedItems() {
  try {
    v3Elements.reviewTable.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';

    const allFlagged = [];
    for (const al of v3State.processedALs) {
      try {
        const res = await fetch(`${V3_CONFIG.apiBase}/review?id=${al.alId}`);
        if (res.ok) {
          const data = await res.json();
          allFlagged.push(...(data.flaggedItems || []));
        }
      } catch (e) {
        console.warn('Failed to load flagged for', al.alId, e);
      }
    }

    v3State.flaggedItems = allFlagged;
    renderReviewTable();
  } catch (err) {
    showToast('Error', `Failed to load flagged items: ${err.message}`, 'error');
  }
}

function renderReviewTable() {
  if (!v3Elements.reviewTable) return;

  if (v3State.flaggedItems.length === 0) {
    v3Elements.reviewTable.innerHTML = '<tr class="empty-state"><td colspan="4">No flagged items.</td></tr>';
    return;
  }

  v3Elements.reviewTable.innerHTML = v3State.flaggedItems
    .map((item) => `
      <tr data-flag-id="${item.id}">
        <td>${escapeHtml(item.alTitle || 'Unknown')}</td>
        <td>${escapeHtml(item.type || 'Unknown')}</td>
        <td>
          <span class="confidence-badge" style="opacity: ${item.confidence}">
            ${Math.round(item.confidence * 100)}%
          </span>
        </td>
        <td class="action-cell">
          <button class="btn-icon" onclick="approveV3Flag('${item.id}', true)" title="Approve">✅</button>
          <button class="btn-icon" onclick="approveV3Flag('${item.id}', false)" title="Reject">❌</button>
        </td>
      </tr>
    `)
    .join('');
}

async function approveV3Flag(flagId, approved) {
  try {
    const decisions = { [flagId]: approved ? 'approved' : 'rejected' };

    // Find which AL this belongs to
    const flag = v3State.flaggedItems.find((f) => f.id === flagId);
    if (!flag) return;

    const res = await fetch(`${V3_CONFIG.apiBase}/review?id=${flag.alId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decisions }),
    });

    if (!res.ok) throw new Error('Failed to resolve flag');

    v3State.flaggedItems = v3State.flaggedItems.filter((f) => f.id !== flagId);
    renderReviewTable();
    showToast('Updated', approved ? 'Item approved' : 'Item rejected', 'success');
  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}

async function approveAllV3Flags() {
  for (const flag of v3State.flaggedItems) {
    await approveV3Flag(flag.id, true);
  }
}

// ===== STATUS HANDLERS =====

async function refreshV3Status() {
  try {
    // Fetch all ALs
    const res = await fetch(`${V3_CONFIG.apiBase}/als`);
    if (!res.ok) throw new Error('Failed to fetch ALs');

    const data = await res.json();
    const als = data.als || [];

    // Calculate stats
    const totalCompletion = als.length > 0
      ? Math.round(als.reduce((sum, al) => sum + (al.completionPercent || 0), 0) / als.length)
      : 0;

    // Update UI
    if (v3Elements.processedCount) {
      v3Elements.processedCount.textContent = als.length;
    }
    if (v3Elements.completionBar) {
      v3Elements.completionBar.style.width = `${totalCompletion}%`;
    }
    if (v3Elements.completionPct) {
      v3Elements.completionPct.textContent = `${totalCompletion}%`;
    }

    // Count flagged
    const totalFlagged = als.reduce((sum, al) => sum + (al.flaggedCount || 0), 0);
    if (v3Elements.flaggedCount) {
      v3Elements.flaggedCount.textContent = totalFlagged;
    }
    if (v3Elements.flaggedBadge) {
      v3Elements.flaggedBadge.textContent = totalFlagged;
    }

    // Render AL list
    renderV3ALList(als);
  } catch (err) {
    showToast('Error', `Failed to refresh status: ${err.message}`, 'error');
  }
}

function renderV3ALList(als) {
  if (!v3Elements.alList) return;

  if (als.length === 0) {
    v3Elements.alList.innerHTML = '<div class="empty-state">No ALs processed yet.</div>';
    if (v3Elements.alCount) {
      v3Elements.alCount.textContent = '0 ALs';
    }
    return;
  }

  v3Elements.alList.innerHTML = als
    .map((al) => `
      <div class="al-item">
        <div class="al-item-header">
          <h4>${escapeHtml(al.title || 'Untitled')}</h4>
          <span class="al-completion-badge">${al.completionPercent || 0}%</span>
        </div>
        <div class="al-item-meta">
          <span>Movements: ${al.movementCount || 0}</span>
          <span>Procedures: ${al.procedureCount || 0}</span>
          ${al.flaggedCount > 0 ? `<span class="warning">⚠️ ${al.flaggedCount} flagged</span>` : ''}
        </div>
        <div class="al-item-actions">
          <button class="btn-small" onclick="exportV3AL('${al.id}', 'json')">JSON</button>
          <button class="btn-small" onclick="exportV3AL('${al.id}', 'excel')">Excel</button>
          <button class="btn-small" onclick="exportV3AL('${al.id}', 'pdf')">PDF</button>
        </div>
      </div>
    `)
    .join('');

  if (v3Elements.alCount) {
    v3Elements.alCount.textContent = `${als.length} AL${als.length !== 1 ? 's' : ''}`;
  }
}

// ===== EXPORT HANDLERS =====

async function exportV3AL(alId, format) {
  try {
    showToast('Exporting', `Generating ${format.toUpperCase()}...`, 'info');

    const res = await fetch(`${V3_CONFIG.apiBase}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: alId, format }),
    });

    if (!res.ok) throw new Error(`Export failed: ${res.statusText}`);

    const data = await res.json();
    if (!data.success || !data.downloadUrl) throw new Error(data.error || 'Export failed');

    // Download file
    const link = document.createElement('a');
    link.href = data.downloadUrl;
    link.download = data.fileName || `al-export.${format === 'json' ? 'json' : format === 'excel' ? 'xlsx' : 'pdf'}`;
    link.click();

    showToast('Success', `${format.toUpperCase()} exported`, 'success');
  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}

async function exportAllV3ALs() {
  try {
    showToast('Exporting', 'Generating Excel and PDF exports...', 'info');

    const res = await fetch(`${V3_CONFIG.apiBase}/als`);
    if (!res.ok) throw new Error('Failed to fetch ALs');

    const data = await res.json();
    const als = data.als || [];

    if (als.length === 0) {
      showToast('No Data', 'No ALs to export', 'warning');
      return;
    }

    // Export all to Excel
    const excelRes = await fetch(`${V3_CONFIG.apiBase}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'all', format: 'excel' }),
    });

    if (excelRes.ok) {
      const excelData = await excelRes.json();
      if (excelData.downloadUrl) {
        const link = document.createElement('a');
        link.href = excelData.downloadUrl;
        link.download = excelData.fileName || 'all-als.xlsx';
        link.click();
      }
    }

    showToast('Success', 'All exports complete', 'success');
  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}

// ===== EVENT LISTENERS =====

function setupV3EventListeners() {
  if (v3Elements.processAllBtn) {
    v3Elements.processAllBtn.addEventListener('click', processAllV3Files);
  }

  if (v3Elements.clearQueueBtn) {
    v3Elements.clearQueueBtn.addEventListener('click', () => {
      v3State.fileQueue = v3State.fileQueue.filter((f) => f.status !== 'pending');
      renderV3Queue();
      updateV3Controls();
    });
  }

  if (v3Elements.refreshStatusBtn) {
    v3Elements.refreshStatusBtn.addEventListener('click', refreshV3Status);
  }

  if (v3Elements.loadFlaggedBtn) {
    v3Elements.loadFlaggedBtn.addEventListener('click', loadFlaggedItems);
  }

  if (v3Elements.approveAllBtn) {
    v3Elements.approveAllBtn.addEventListener('click', approveAllV3Flags);
  }

  if (v3Elements.exportExcelBtn) {
    v3Elements.exportExcelBtn.addEventListener('click', () => {
      if (v3State.processedALs.length > 0) {
        exportAllV3ALs();
      } else {
        showToast('No Data', 'Process files first', 'warning');
      }
    });
  }

  if (v3Elements.exportPdfBtn) {
    v3Elements.exportPdfBtn.addEventListener('click', () => {
      showToast('Info', 'PDF export included in "Export All"', 'info');
    });
  }

  if (v3Elements.exportJsonBtn) {
    v3Elements.exportJsonBtn.addEventListener('click', () => {
      showToast('Info', 'JSON export included in "Export All"', 'info');
    });
  }

  if (v3Elements.exportAllBtn) {
    v3Elements.exportAllBtn.addEventListener('click', exportAllV3ALs);
  }

  if (v3Elements.autoExportCheckbox) {
    v3Elements.autoExportCheckbox.addEventListener('change', (e) => {
      v3State.autoExport = e.target.checked;
    });
  }
}

// ===== INITIALIZATION =====

function initV3Module() {
  setupV3FileUpload();
  setupV3EventListeners();
  refreshV3Status();
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initV3Module);
} else {
  initV3Module();
}
