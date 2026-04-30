/**
 * Bac-Oral V2 Frontend Integration Module
 * 
 * Provides enhanced HTML rendering for V2 entries with:
 * - Color-coded genre display
 * - Intro/Conclusion rendering
 * - Enhanced motion/movement display
 * - Procedure highlighting
 * - CSS generation for styling
 */

/**
 * Genre to color mapping (matching v2-colors.mjs)
 */
const GENRE_COLORS = {
  theatre: "#7B2CBF",
  poesie: "#3A86FF",
  roman: "#FF006E",
  general: "#666666",
};

const GENRE_LABELS = {
  theatre: "Théâtre",
  poesie: "Poésie",
  roman: "Roman",
  general: "Autres",
};

/**
 * Get CSS class for genre
 * @param {string} genre - Genre type
 * @returns {string} CSS class name
 */
export function getGenreClass(genre = "general") {
  return `genre-${genre}`;
}

/**
 * Get color for genre
 * @param {string} genre - Genre type
 * @returns {string} Hex color code
 */
export function getGenreColor(genre = "general") {
  return GENRE_COLORS[genre] || GENRE_COLORS.general;
}

/**
 * Escape HTML special characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str = "") {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Render introduction section with styling
 * @param {Object} entry - Entry object
 * @returns {string} HTML for intro section
 */
export function renderIntroduction(entry = {}) {
  if (!entry.introduction) return "";

  const genre = entry.genre || "general";
  const color = getGenreColor(genre);

  return `
    <div class="v2-intro-section ${getGenreClass(genre)}" style="border-left-color: ${color}">
      <details class="intro-details" open>
        <summary class="intro-summary" style="color: ${color}">
          <span class="intro-icon">▼</span> Introduction
        </summary>
        <div class="intro-content">
          <p>${escapeHtml(entry.introduction)}</p>
        </div>
      </details>
    </div>
  `;
}

/**
 * Render conclusion section with styling
 * @param {Object} entry - Entry object
 * @returns {string} HTML for conclusion section
 */
export function renderConclusion(entry = {}) {
  if (!entry.conclusion) return "";

  const genre = entry.genre || "general";
  const color = getGenreColor(genre);

  return `
    <div class="v2-conclusion-section ${getGenreClass(genre)}" style="border-left-color: ${color}">
      <details class="conclusion-details" open>
        <summary class="conclusion-summary" style="color: ${color}">
          <span class="conclusion-icon">▼</span> Conclusion
        </summary>
        <div class="conclusion-content">
          <p>${escapeHtml(entry.conclusion)}</p>
        </div>
      </details>
    </div>
  `;
}

/**
 * Render enhanced movement with color coding
 * @param {Object} movement - Movement object {title, bullets, excerpt}
 * @param {number} index - Movement index
 * @param {string} genre - Genre type
 * @returns {string} HTML for movement
 */
export function renderColorizedMovement(movement = {}, index = 0, genre = "general") {
  const color = getGenreColor(genre);
  const bullets = movement.bullets || [];

  const bulletsHtml = bullets.length
    ? bullets.map(bullet => `<li class="v2-bullet">${escapeHtml(bullet)}</li>`).join("")
    : '<li class="v2-bullet empty">Aucun point clé identifié</li>';

  return `
    <div class="v2-movement-card ${getGenreClass(genre)}" style="--genre-color: ${color}">
      <div class="movement-header" style="border-bottom-color: ${color}">
        <span class="movement-number">Mouvement ${index + 1}</span>
        <h4 class="movement-title" style="color: ${color}">${escapeHtml(movement.title || "")}</h4>
      </div>
      <div class="movement-content">
        <ul class="bullets-list">
          ${bulletsHtml}
        </ul>
        ${movement.excerpt ? `
          <details class="movement-excerpt">
            <summary>Voir l'extrait</summary>
            <p class="excerpt-text">${escapeHtml(movement.excerpt)}</p>
          </details>
        ` : ""}
      </div>
    </div>
  `;
}

/**
 * Render all movements with color coding
 * @param {Array} movements - Array of movement objects
 * @param {string} genre - Genre type
 * @returns {string} HTML for all movements
 */
export function renderColorizedMovements(movements = [], genre = "general") {
  if (!movements.length) {
    return '<div class="empty-state">Aucun mouvement détecté.</div>';
  }

  const color = getGenreColor(genre);
  const label = GENRE_LABELS[genre] || "Autres";

  return `
    <div class="v2-movements-container ${getGenreClass(genre)}">
      <div class="movements-header" style="background-color: ${color}20; border-bottom: 2px solid ${color}">
        <h3 style="color: ${color}">Mouvements littéraires <span class="genre-label">${label}</span></h3>
        <span class="movements-count">${movements.length} mouvement(s)</span>
      </div>
      <div class="movements-grid">
        ${movements.map((motion, idx) => renderColorizedMovement(motion, idx, genre)).join("")}
      </div>
    </div>
  `;
}

/**
 * Render procedure/device tag with color
 * @param {Object} procedure - Procedure object {label, impact, weight}
 * @param {string} genre - Genre type
 * @returns {string} HTML for procedure tag
 */
export function renderProcedureTag(procedure = {}, genre = "general") {
  const color = getGenreColor(genre);
  const weight = procedure.weight || 1;
  const weightClass = weight >= 3 ? "weight-high" : weight >= 2 ? "weight-medium" : "weight-low";

  return `
    <span class="v2-procedure-tag ${getGenreClass(genre)} ${weightClass}" style="background-color: ${color}20; color: ${color}; border-color: ${color}">
      <strong>${escapeHtml(procedure.label)}</strong>
      <em>${escapeHtml(procedure.impact || "")}</em>
    </span>
  `;
}

/**
 * Render all procedures with color coding
 * @param {Array} procedures - Array of procedure objects
 * @param {string} genre - Genre type
 * @returns {string} HTML for all procedures
 */
export function renderColorizedProcedures(procedures = [], genre = "general") {
  if (!procedures.length) {
    return "";
  }

  const color = getGenreColor(genre);

  return `
    <div class="v2-procedures-section ${getGenreClass(genre)}">
      <h5 style="color: ${color}; border-bottom: 1px solid ${color}">Procédés littéraires clés</h5>
      <div class="procedures-tags">
        ${procedures.map(proc => renderProcedureTag(proc, genre)).join("")}
      </div>
    </div>
  `;
}

/**
 * Generate comprehensive CSS for V2 styling
 * @returns {string} CSS stylesheet
 */
export function generateV2Styles() {
  return `
/* Bac-Oral V2 Frontend Styles */

.v2-intro-section, .v2-conclusion-section {
  margin: 1rem 0;
  border-left: 3px solid currentColor;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 2px;
  padding: 0;
}

.intro-details, .conclusion-details {
  padding: 1rem;
}

.intro-summary, .conclusion-summary {
  font-weight: 600;
  padding: 0.5rem;
  margin: -0.5rem -0.5rem 0.5rem -0.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  user-select: none;
}

.intro-summary:hover, .conclusion-summary:hover {
  background: rgba(0, 0, 0, 0.04);
}

.intro-icon, .conclusion-icon {
  display: inline-block;
  transition: transform 0.2s;
}

details[open] .intro-icon,
details[open] .conclusion-icon {
  transform: rotate(180deg);
}

.intro-content, .conclusion-content {
  line-height: 1.6;
  color: rgba(0, 0, 0, 0.8);
}

.intro-content p, .conclusion-content p {
  margin: 0.5rem 0;
}

/* Movements Container */

.v2-movements-container {
  margin: 1.5rem 0;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid currentColor;
  border-color: var(--genre-color, #999);
}

.movements-header {
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.movements-header h3 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.genre-label {
  font-size: 0.75rem;
  font-weight: normal;
  padding: 0.25rem 0.5rem;
  background: currentColor;
  color: white;
  border-radius: 3px;
}

.movements-count {
  font-size: 0.9rem;
  opacity: 0.7;
}

.movements-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.01);
}

/* Movement Card */

.v2-movement-card {
  border: 1px solid var(--genre-color, #ccc);
  border-radius: 4px;
  overflow: hidden;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  transition: all 0.2s;
}

.v2-movement-card:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.movement-header {
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, rgba(0,0,0,0.02), transparent);
  border-bottom: 2px solid var(--genre-color, #ccc);
}

.movement-number {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.6;
}

.movement-title {
  margin: 0.5rem 0 0 0;
  font-size: 1.1rem;
}

.movement-content {
  padding: 1rem;
}

.bullets-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.v2-bullet {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
  position: relative;
}

.v2-bullet:before {
  content: "›";
  position: absolute;
  left: 0;
  font-weight: bold;
}

.v2-bullet.empty {
  opacity: 0.6;
  font-style: italic;
}

.movement-excerpt {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  font-size: 0.9rem;
}

.movement-excerpt summary {
  cursor: pointer;
  color: rgba(0, 0, 0, 0.7);
  user-select: none;
}

.movement-excerpt summary:hover {
  color: rgba(0, 0, 0, 0.9);
}

.excerpt-text {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.02);
  border-left: 2px solid var(--genre-color, #ccc);
  font-style: italic;
  line-height: 1.5;
}

/* Procedures Section */

.v2-procedures-section {
  margin: 1.5rem 0;
  padding: 1rem;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.02);
}

.v2-procedures-section h5 {
  margin: 0 0 1rem 0;
  padding-bottom: 0.5rem;
}

.procedures-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.v2-procedure-tag {
  display: inline-flex;
  flex-direction: column;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  border: 1px solid;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.2s;
}

.v2-procedure-tag:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.v2-procedure-tag strong {
  display: block;
}

.v2-procedure-tag em {
  display: block;
  font-style: italic;
  font-size: 0.8rem;
  margin-top: 0.25rem;
  opacity: 0.9;
}

.v2-procedure-tag.weight-high {
  font-weight: 700;
}

.v2-procedure-tag.weight-low {
  opacity: 0.8;
}

/* Responsive Design */

@media (max-width: 768px) {
  .movements-grid {
    grid-template-columns: 1fr;
  }

  .movements-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .procedures-tags {
    flex-direction: column;
  }

  .v2-procedure-tag {
    width: 100%;
  }
}

/* Empty State */

.empty-state {
  padding: 2rem;
  text-align: center;
  color: rgba(0, 0, 0, 0.5);
  font-style: italic;
}
  `;
}

/**
 * Inject V2 styles into the page
 * @returns {HTMLStyleElement} Style element
 */
export function injectV2Styles() {
  if (document.querySelector("style#v2-styles")) {
    return document.querySelector("style#v2-styles");
  }

  const style = document.createElement("style");
  style.id = "v2-styles";
  style.textContent = generateV2Styles();
  document.head.appendChild(style);
  return style;
}

/**
 * Create complete V2 entry preview HTML
 * @param {Object} entry - Entry object
 * @returns {string} Complete HTML for entry preview
 */
export function createV2EntryPreview(entry = {}) {
  const genre = entry.genre || "general";
  const color = getGenreColor(genre);
  const genreLabel = GENRE_LABELS[genre] || "Autres";

  return `
    <article class="v2-entry-preview ${getGenreClass(genre)}" data-entry-id="${entry.id}" style="--genre-color: ${color}">
      <div class="v2-entry-header">
        <div>
          <span class="v2-genre-badge" style="background-color: ${color}">${genreLabel}</span>
          <h3 class="v2-entry-title">${escapeHtml(entry.title || "Sans titre")}</h3>
          <p class="v2-entry-meta">${escapeHtml(entry.author || "Auteur inconnu")} – ${escapeHtml(entry.work || "Œuvre inconnue")}</p>
        </div>
      </div>

      ${renderIntroduction(entry)}

      ${renderColorizedMovements(entry.movements || [], genre)}

      ${entry.keyProcedures && entry.keyProcedures.length ? renderColorizedProcedures(entry.keyProcedures, genre) : ""}

      ${renderConclusion(entry)}
    </article>
  `;
}

export default {
  getGenreClass,
  getGenreColor,
  renderIntroduction,
  renderConclusion,
  renderColorizedMovement,
  renderColorizedMovements,
  renderProcedureTag,
  renderColorizedProcedures,
  generateV2Styles,
  injectV2Styles,
  createV2EntryPreview,
};
