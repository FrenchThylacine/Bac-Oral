/**
 * Bac-Oral V2 Backend Integration Module
 * 
 * Provides integration functions for server.mjs:
 * - Enhanced entry processing with V2 features
 * - Color metadata addition
 * - V2 entry validation and enrichment
 * - Pipeline orchestration
 */

import {
  generateIntro,
  generateConclusion,
  detectMotions,
  applyColorProcessing,
  validateV2Output,
} from './v2-core.mjs';

import {
  createColorizedEntry,
  applyColorMetadata,
} from './v2-colors.mjs';

/**
 * Enhance entry with V2 features after initial processing
 * @param {Object} entry - Entry object from processEntries
 * @returns {Object} Enhanced entry with V2 features
 */
export function enhanceEntryWithV2(entry = {}) {
  if (!entry) return entry;

  // Ensure genre is set
  if (!entry.genre) {
    // Try to guess from sequence metadata
    if (entry.sequenceMeta?.objectStudy) {
      const study = entry.sequenceMeta.objectStudy.toLowerCase();
      if (study.includes('théâtre') || study.includes('theatre')) entry.genre = 'theatre';
      else if (study.includes('poésie') || study.includes('poesie')) entry.genre = 'poesie';
      else if (study.includes('roman') || study.includes('récit') || study.includes('recit')) entry.genre = 'roman';
      else entry.genre = 'general';
    } else {
      entry.genre = 'general';
    }
  }

  // Generate or enhance intro/conclusion
  if (entry.sourceText && !entry.introduction) {
    entry.introduction = generateIntro(entry, entry.genre);
  }

  if (!entry.conclusion && entry.oralBullets?.length > 0) {
    entry.conclusion = generateConclusion(entry, entry.genre);
  }

  // Enhance motions/movements if they exist
  if (entry.movements && entry.movements.length > 0) {
    entry.movements = entry.movements.map(motion => ({
      ...motion,
      genre: entry.genre,
    }));
  }

  // Apply color metadata
  entry = applyColorMetadata(entry, entry.genre);

  return entry;
}

/**
 * Apply V2 processing to all entries in a project
 * @param {Object} project - Project object with entries array
 * @returns {Object} Project with enhanced entries
 */
export function applyV2Processing(project = {}) {
  if (!project.entries || !Array.isArray(project.entries)) {
    return project;
  }

  return {
    ...project,
    entries: project.entries.map(entry => enhanceEntryWithV2(entry)),
  };
}

/**
 * Validate entries for export
 * Checks that V2 features are properly populated
 * @param {Object} project - Project object
 * @returns {Object} {valid: boolean, errors: Map<entryId, errors[]>}
 */
export function validateProjectV2(project = {}) {
  const errors = new Map();
  let valid = true;

  if (!project.entries || !Array.isArray(project.entries)) {
    return {
      valid: false,
      errors: new Map([['project', ['No entries found']]]),
    };
  }

  for (const entry of project.entries) {
    const entryErrors = [];

    // Check required fields
    if (!entry.id) entryErrors.push('Missing id');
    if (!entry.genre) entryErrors.push('Missing genre');
    if (!entry.title) entryErrors.push('Missing title');

    // Check V2 specific fields
    if (!entry.introduction) entryErrors.push('Missing introduction');
    if (!entry.conclusion) entryErrors.push('Missing conclusion');
    if (!entry.movements || entry.movements.length === 0) entryErrors.push('No movements');
    if (!entry.color) entryErrors.push('Missing color metadata');

    if (entryErrors.length > 0) {
      errors.set(entry.id, entryErrors);
      valid = false;
    }
  }

  return {
    valid,
    errors,
  };
}

/**
 * Generate V2 metadata summary for a project
 * Useful for logging and debugging
 * @param {Object} project - Project object
 * @returns {Object} Summary statistics
 */
export function generateV2Summary(project = {}) {
  const entries = project.entries || [];
  
  const genreCounts = {};
  let entriesWithIntro = 0;
  let entriesWithConclusion = 0;
  let entriesWithColors = 0;
  let totalMotions = 0;
  let totalProcedures = 0;

  for (const entry of entries) {
    // Count by genre
    const genre = entry.genre || 'general';
    genreCounts[genre] = (genreCounts[genre] || 0) + 1;

    // Count V2 features
    if (entry.introduction) entriesWithIntro++;
    if (entry.conclusion) entriesWithConclusion++;
    if (entry.color) entriesWithColors++;

    // Count sub-items
    totalMotions += entry.movements?.length || 0;
    totalProcedures += entry.keyProcedures?.length || 0;
  }

  return {
    totalEntries: entries.length,
    genreDistribution: genreCounts,
    v2Coverage: {
      introductions: entriesWithIntro,
      conclusions: entriesWithConclusion,
      colors: entriesWithColors,
    },
    totalMotions,
    totalProcedures,
    completeness: entries.length > 0 
      ? Math.round((entriesWithIntro + entriesWithConclusion + entriesWithColors) / (entries.length * 3) * 100)
      : 0,
  };
}

/**
 * Export V2 data in a structured format
 * @param {Object} project - Project object
 * @param {string} format - Format type ('json', 'csv', 'html')
 * @returns {Object|string} Formatted data
 */
export function exportV2Data(project = {}, format = 'json') {
  const entries = project.entries || [];

  if (format === 'json') {
    return {
      metadata: {
        exported: new Date().toISOString(),
        version: '2.0',
        entryCount: entries.length,
      },
      entries: entries.map(entry => ({
        id: entry.id,
        title: entry.title,
        author: entry.author,
        work: entry.work,
        genre: entry.genre,
        color: entry.color,
        introduction: entry.introduction,
        movements: entry.movements,
        conclusion: entry.conclusion,
        keyProcedures: entry.keyProcedures,
        oralBullets: entry.oralBullets,
      })),
    };
  }

  if (format === 'csv') {
    const headers = ['ID', 'Title', 'Author', 'Genre', 'Introduction', 'Movements', 'Conclusion'];
    const rows = entries.map(entry => [
      entry.id,
      entry.title,
      entry.author,
      entry.genre,
      (entry.introduction || '').replace(/"/g, '""').slice(0, 100),
      entry.movements?.length || 0,
      (entry.conclusion || '').replace(/"/g, '""').slice(0, 100),
    ]);

    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return csvContent;
  }

  if (format === 'html') {
    const genreColors = {
      theatre: '#7B2CBF',
      poesie: '#3A86FF',
      roman: '#FF006E',
      general: '#666666',
    };

    const entriesHtml = entries.map(entry => `
      <div class="v2-entry" style="border-left: 4px solid ${genreColors[entry.genre] || '#999'}; padding: 1rem; margin: 1rem 0;">
        <h3>${entry.title}</h3>
        <p><strong>Author:</strong> ${entry.author || 'Unknown'}</p>
        <p><strong>Genre:</strong> ${entry.genre}</p>
        <div><strong>Introduction:</strong> ${entry.introduction || 'N/A'}</div>
        <div><strong>Movements:</strong> ${entry.movements?.length || 0}</div>
        <div><strong>Conclusion:</strong> ${entry.conclusion || 'N/A'}</div>
      </div>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Bac-Oral V2 Export</title>
        <style>
          body { font-family: Arial; margin: 1rem; }
          .v2-entry { background: #f5f5f5; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>Bac-Oral V2 Export</h1>
        <p>Exported: ${new Date().toLocaleString()}</p>
        ${entriesHtml}
      </body>
      </html>
    `;
  }

  throw new Error(`Unknown export format: ${format}`);
}

/**
 * Perform batch V2 enhancement on entries
 * Applies all V2 transformations in order
 * @param {Array} entries - Array of entries
 * @returns {Array} Enhanced entries
 */
export function batchEnhanceEntries(entries = []) {
  return entries.map(entry => enhanceEntryWithV2(entry));
}

/**
 * Create a V2 migration report
 * Shows what changed from V1 to V2
 * @param {Object} beforeProject - Project before V2 processing
 * @param {Object} afterProject - Project after V2 processing
 * @returns {Object} Migration report
 */
export function createMigrationReport(beforeProject = {}, afterProject = {}) {
  const before = beforeProject.entries || [];
  const after = afterProject.entries || [];

  const report = {
    timestamp: new Date().toISOString(),
    entriesProcessed: after.length,
    changes: {
      introductionsAdded: 0,
      conclusionsAdded: 0,
      colorsApplied: 0,
      movementsEnhanced: 0,
    },
  };

  for (let i = 0; i < after.length; i++) {
    const beforeEntry = before[i] || {};
    const afterEntry = after[i] || {};

    if (!beforeEntry.introduction && afterEntry.introduction) report.changes.introductionsAdded++;
    if (!beforeEntry.conclusion && afterEntry.conclusion) report.changes.conclusionsAdded++;
    if (!beforeEntry.color && afterEntry.color) report.changes.colorsApplied++;
    if ((beforeEntry.movements?.length || 0) < (afterEntry.movements?.length || 0)) {
      report.changes.movementsEnhanced++;
    }
  }

  return report;
}

export default {
  enhanceEntryWithV2,
  applyV2Processing,
  validateProjectV2,
  generateV2Summary,
  exportV2Data,
  batchEnhanceEntries,
  createMigrationReport,
};
