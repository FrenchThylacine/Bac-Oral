/**
 * V3 AI Digitization Module
 * Handles file uploads, processing, review, and export for AL digitization
 */

const V3_CONFIG = {
  maxFiles: 20,
  maxFileSize: 50 * 1024 * 1024, // 50MB
  batchSize: 5,
  apiBase: '/api/v3',
};

// State
let v3State = {
  fileQueue: [],
  processedALs: [],
  flaggedItems: [],
  currentProcessing: null,
  completionScore: 0,
  autoExport: true,
};

// V3 DOM Elements
const v3Elements = {
  dropzone: document.querySelector('#v3-dropzone'),
  files: document.querySelector('#v3-files'),
  queue: document.querySelector('#v3-queue'),
  queueCount: document.querySelector('#v3-queue-count'),
  processAllBtn: document.querySelector('#v3-process-all'),
  clearQueueBtn: document.querySelector('#v3-clear-queue'),
  processedCount: document.querySelector('#v3-processed-count'),
  flaggedCount: document.querySelector('#v3-flagged-count'),
  completionBar: document.querySelector('#v3-completion-bar'),
  completionPct: document.querySelector('#v3-completion-pct'),
  autoExportCheckbox: document.querySelector('#v3-auto-export'),
  refreshStatusBtn: document.querySelector('#v3-refresh-status'),
  reviewTable: document.querySelector('#v3-review-table'),
  flaggedBadge: document.querySelector('#v3-flagged-badge'),
  loadFlaggedBtn: document.querySelector('#v3-load-flagged'),
  approveAllBtn: document.querySelector('#v3-approve-all'),
  exportExcelBtn: document.querySelector('#v3-export-excel'),
  exportPdfBtn: document.querySelector('#v3-export-pdf'),
  exportJsonBtn: document.querySelector('#v3-export-json'),
  exportAllBtn: document.querySelector('#v3-export-all'),
  alList: document.querySelector('#v3-al-list'),
  alCount: document.querySelector('#v3-al-count'),
  uploadStatus: document.querySelector('#v3-upload-status'),
};

// ===== FILE UPLOAD HANDLERS =====

function setupV3FileUpload() {
  if (!v3Elements.dropzone) return;

  // Click to upload
  v3Elements.dropzone.addEventListener('click', () => {
    v3Elements.files?.click();
  });

  // Drag and drop
  v3Elements.dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    v3Elements.dropzone.classList.add('dragging');
  });

  v3Elements.dropzone.addEventListener('dragleave', () => {
    v3Elements.dropzone.classList.remove('dragging');
  });

  v3Elements.dropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    v3Elements.dropzone.classList.remove('dragging');
    await handleV3FileSelect(e.dataTransfer.files);
  });

  // File input
  v3Elements.files?.addEventListener('change', async (e) => {
    await handleV3FileSelect(e.target.files);
  });
}

async function handleV3FileSelect(files) {
  const newFiles = Array.from(files).slice(0, V3_CONFIG.maxFiles - v3State.fileQueue.length);
  
  for (const file of newFiles) {
    if (file.size > V3_CONFIG.maxFileSize) {
      showToast('File Too Large', `${file.name} exceeds 50MB limit`, 'error');
      continue;
    }

    const fileId = `v3_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    v3State.fileQueue.push({
      id: fileId,
      file,
      status: 'pending',
      progress: 0,
      result: null,
    });
  }

  renderV3Queue();
  updateV3Controls();
}

function renderV3Queue() {
  if (!v3Elements.queue) return;

  if (v3State.fileQueue.length === 0) {
    v3Elements.queue.innerHTML = '';
    return;
  }

  v3Elements.queue.innerHTML = v3State.fileQueue
    .map((item) => `
      <div class="queue-item ${item.status}">
        <div class="queue-item-info">
          <span class="queue-item-name">${escapeHtml(item.file.name)}</span>
          <span class="queue-item-size">${(item.file.size / 1024 / 1024).toFixed(1)}MB</span>
        </div>
        <div class="queue-item-progress">
          <div class="progress-small">
            <div class="progress-fill-small" style="width: ${item.progress}%"></div>
          </div>
          <span class="queue-item-status">${item.status}</span>
        </div>
        ${item.status === 'pending' ? `
          <button class="queue-item-remove" onclick="removeV3QueueItem('${item.id}')">
            <span>×</span>
          </button>
        ` : ''}
      </div>
    `)
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
