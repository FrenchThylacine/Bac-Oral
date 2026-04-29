# Corrections Appliquées - Bac Oral Studio

## 🔧 Bugs Critiques Corrigés

### 1. **Nettoyage OCR** ✅
**Fichier**: `lib/revision-engine.mjs`

**Problème**: La colonne "Rappel du passage" était polluée par des caractères parasites (ex: 'O SE O LLJ...').

**Solution**:
- Ajout de `isOcrNoiseDetected()` : Détecte les patterns de bruit OCR
  - Ratio < 30% de caractères alphanumériques → Bruit détecté
  - Patterns spécifiques : `[O0]{2,}[\s]*[LIJ]{2,}[\s]*[J]{1,}` (OOLLJ, 00LLJ, etc.)
  - Caractères de contrôle `[\x00-\x08\x0B-\x0C\x0E-\x1F]`

- Ajout de `cleanOcrText()` : Nettoyage robuste du texte OCR
  - Supprime les caractères parasites
  - Retourne une chaîne vide si le bruit domine
  - Remplacement des séquences de bruit par des espaces

**Implémentation dans `server.mjs`**:
```javascript
const cleanedOcr = cleanOcrText(ocrText);
const hasNoise = ocrText && isOcrNoiseDetected(ocrText);

files.push({
  ...file,
  ocrText: cleanedOcr,
  rawOcrText: ocrText,
  status: cleanedOcr ? "done" : hasNoise ? "noise-detected" : "missing",
  qualityNote: hasNoise ? "Texte à vérifier - bruit OCR détecté" : "",
});
```

---

### 2. **Bug de Mapping (Duplication)** ✅
**Fichiers**: `lib/revision-engine.mjs`, `server.mjs`, `lib/export-workbook.mjs`

**Problème**:
- Dictionnaires partagés (`GENERIC_TEMPLATES`) mutés par plusieurs AL
- Double appel à `ensureCompleteEntry()` causant des modifications réitérées
- Boucles réutilisant les mêmes variables entre itérations

**Solutions Appliquées**:

#### a) **Copies Profondes Partout** (`JSON.parse(JSON.stringify(...))`)
- Dans `ensureCompleteEntry()`:
```javascript
movements: Array.isArray(entry.movements) ? JSON.parse(JSON.stringify(entry.movements)) : [],
keyProcedures: Array.isArray(entry.keyProcedures) ? JSON.parse(JSON.stringify(entry.keyProcedures)) : [],
```

- Dans `simplifyAnalysisEntry()` et `highlightKeyProcedures()`:
```javascript
const entryClone = JSON.parse(JSON.stringify(entry));
// Toutes les modifications se font sur entryClone
```

- Dans `fixWeakAnalyses()`:
```javascript
const entryClone = JSON.parse(JSON.stringify(entry));
// Aucune mutation de l'original
```

- Dans `detectProcedures()` (appelée depuis `createAnalysisDraft()`):
```javascript
const procedures = JSON.parse(JSON.stringify(detectProcedures(...)));
```

#### b) **Suppression du Double Appel à `ensureCompleteEntry()`**
Avant:
```javascript
const draft = createAnalysisDraft({...}); // Appelle ensureCompleteEntry()
const completed = ensureCompleteEntry({...draft, ...}, sequence); // Deuxième appel!
```

Après:
```javascript
const draft = createAnalysisDraft({...}); // Déjà complet
const completed = {...incoming, ...draft}; // Pas d'appel supplémentaire
```

#### c) **Copie Profonde dans `processEntries()`**
```javascript
const completed = {
  ...incoming,
  ...draft, // Le draft contient déjà le résultat de ensureCompleteEntry
  files,
  sequenceMeta: sequence,
  sequenceLabel: sequence.label,
  sourceText: draft.sourceText,
  id: draft.id, // ID unique garantit pour chaque AL
};
```

#### d) **Réinitialisation des Variables dans la Boucle Excel**
Dans `writeEntryBlock()`:
```javascript
const entryCopy = JSON.parse(JSON.stringify(entry)); // Copie profonde À CHAQUE ITÉRATION
const procedures = (entryCopy.keyProcedures || [])
  .slice(0, ...) 
  .map(p => ({ ...p })); // Copie supplémentaire des procédures
```

---

### 3. **Empêcher l'Injection de Valeurs par Défaut** ✅
**Fichier**: `lib/revision-engine.mjs`

**Problème**: Les templates par défaut (`GENERIC_TEMPLATES`) étaient injectés même quand les données manquaient.

**Solution**: 
- Ajout du paramètre `skipDefaults` dans `ensureCompleteEntry()`:
```javascript
export function ensureCompleteEntry(entry = {}, sequence = {}, skipDefaults = false) {
  // ...
  if (!skipDefaults) {
    // Remplir avec les valeurs par défaut
    if (!output.movements.length) {
      output.movements = buildMovementsFromText(...);
    }
    // ...
  }
  // ...
}
```

- `mergeProcessedEntry()` appelle avec `skipDefaults = true`:
```javascript
return ensureCompleteEntry(merged, {...}, true);
```

- Validation stricte des données par AL:
```javascript
// Chaque AL garde ses propres données
id: incoming.id || `AL-${Date.now()}`,
label: incoming.label || incoming.id,
```

---

## 📋 Checklist de Qualité

- [x] **Données Uniques**: Chaque AL (AL 1, AL 2, etc.) possède son propre dictionnaire
- [x] **Aucune Mutation**: Pas de modification des objets partagés
- [x] **Nettoyage OCR**: Texte parasites marqués ou ignorés
- [x] **Pas de Duplication**: Un seul appel à `ensureCompleteEntry()` par AL
- [x] **Réinitialisation**: Variables réinitialisées à chaque itération
- [x] **Isolation par AL**: Données spécifiques à chaque Analyse Linéaire

---

## 🧪 Étapes de Test Recommandées

1. **Export PDF avec OCR bruyant**:
   - Vérifier que le texte 'O SE O LLJ...' est marqué comme "noise-detected"
   - Consulter le `qualityNote` pour "Texte à vérifier"

2. **Export Excel - Multiple AL**:
   - AL 1 doit avoir ses propres "tension et renversement"
   - AL 2 ne doit pas avoir les procédés de AL 1
   - Vérifier que chaque AL a son propre bloc Excel sans chevauchemement

3. **Données Manquantes**:
   - Si `sourceText` est vide, vérifier que les mouvements ne sont PAS les templates par défaut
   - Chaque AL doit conserver ses spécificités sans injection de valeurs génériques

4. **Imports/Exports Répétés**:
   - Exporter deux fois le même projet
   - Vérifier que les données restent identiques (pas d'accumulation)

---

## 📁 Fichiers Modifiés

- ✅ `lib/revision-engine.mjs` (660+ lignes)
- ✅ `server.mjs` (200+ lignes)
- ✅ `lib/export-workbook.mjs` (180 lignes)

---

## 🔗 Dépendances

- Aucune nouvelle dépendance externe
- Utilisation uniquement de JavaScript ES6+ natif
- Compatible avec Node.js 18+
