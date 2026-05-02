import { readFileSync } from 'fs';

// Import the exact parseALText function from hybrid-extractor
const text = readFileSync('input/placeholder/sample_al_1.txt', 'utf-8');

// Replicate parseALText logic
const lines = text.split('\n');

function extractTitle(lines) {
  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim();
    if (trimmed.length > 10 && !trimmed.match(/^[-•]/)) {
      return trimmed.substring(0, 200);
    }
  }
  return null;
}

function extractSection(lines, sectionName) {
  let inSection = false;
  let content = [];
  
  for (const line of lines) {
    if (line.match(new RegExp(`^${sectionName}`, 'i'))) {
      inSection = true;
      continue;
    }
    
    if (inSection) {
      // Stop at next section marker
      if (line.match(/^(MOUVEMENT|MOVEMENT|\w+:)\s/i) && !line.includes('Procedure')) {
        break;
      }
      
      const trimmed = line.trim();
      if (trimmed.length > 0) {
        content.push(trimmed);
      }
    }
  }
  
  return content.length > 0 ? content.join(' ') : null;
}

function parseMovements(lines) {
  const movements = [];
  let currentMovement = null;
  
  console.log('Starting parseMovements with', lines.length, 'lines');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Movement header: "MOUVEMENT 1: NAME" or "MOVEMENT 1: NAME"
    const movementMatch = line.match(/^MOUVEMENT?\s+(\d+)\s*:\s*(.+?)$/i);
    if (movementMatch) {
      console.log(`Found movement at line ${i}: num=${movementMatch[1]}, title=${movementMatch[2]}`);
      currentMovement = {
        number: parseInt(movementMatch[1]),
        name: movementMatch[2].trim(),
        lines: '',
        procedures: [],
      };
      movements.push(currentMovement);
      continue;
    }
    
    // Procedure header: "- Procedure: NAME"
    if (currentMovement && line.match(/^\s*[-•]\s+Procedure\s*:/i)) {
      const procMatch = line.match(/Procedure\s*:\s*(.+?)$/i);
      if (procMatch) {
        console.log(`Found procedure at line ${i}: label=${procMatch[1]}`);
        const procedure = {
          label: procMatch[1].trim(),
          name: procMatch[1].trim(),
          color: '',
          type: '',
          analyses: [],
          quote: '',
          analysis: '',
          weight: 1,
        };
        
        // Look for metadata in following lines
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const metaLine = lines[j];
          
          // Skip empty lines
          if (!metaLine.trim()) break;
          
          // If we hit a new procedure or movement, stop
          if (metaLine.match(/^MOUVEMENT|^[-•].*Procedure/i)) break;
          
          // Color & Type: "Color: Blue, Type: Dialogue"
          const colorTypeMatch = metaLine.match(/Color\s*:\s*(\w+)\s*,\s*Type\s*:\s*(\w+)/i);
          if (colorTypeMatch) {
            procedure.color = colorTypeMatch[1].trim();
            procedure.type = colorTypeMatch[2].trim();
            console.log(`  Found color/type: ${colorTypeMatch[1]}, ${colorTypeMatch[2]}`);
            continue;
          }
          
          // Analysis: "Analysis: text" or "Analyses: text"
          const analysisMatch = metaLine.match(/Analys(?:is|es)\s*:\s*(.+)$/i);
          if (analysisMatch) {
            const analysisText = analysisMatch[1].trim();
            procedure.analyses = analysisText
              .split(/;\s*/)
              .map(a => a.trim())
              .filter(a => a.length > 0);
            procedure.analysis = procedure.analyses.join('; ');
            console.log(`  Found analysis: ${procedure.analysis}`);
            continue;
          }
        }
        
        currentMovement.procedures.push(procedure);
      }
    }
  }
  
  return movements;
}

console.log('Title:', extractTitle(lines));
console.log('Intro:', extractSection(lines, 'INTRODUCTION'));
console.log('Conclusion:', extractSection(lines, 'CONCLUSION'));
console.log('\nMovements:');
const movements = parseMovements(lines);
console.log('\nResult:', JSON.stringify(movements, null, 2));
