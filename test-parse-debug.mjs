import { readFileSync } from 'fs';

const text = readFileSync('input/placeholder/sample_al_1.txt', 'utf-8');
console.log('=== FILE CONTENT ===');
console.log(text);

console.log('\n=== PARSING TEST ===');

const lines = text.split('\n');
console.log('Total lines:', lines.length);

// Test movement regex
const movementRe = /^MOUVEMENT?\s+(\d+)\s*:\s*(.+?)$/i;
lines.forEach((line, i) => {
  const match = line.match(movementRe);
  if (match) {
    console.log(`Line ${i}: Movement found! Number=${match[1]}, Title=${match[2]}`);
  }
});

// Test procedure regex
const procRe = /^\s*[-•]\s+Procedure\s*:/i;
lines.forEach((line, i) => {
  const match = line.match(procRe);
  if (match) {
    console.log(`Line ${i}: Procedure header found!`);
  }
});

console.log('\n=== Section detection ===');
let intro = '';
let conclusion = '';
let inIntro = false;
let inConc = false;

for (const line of lines) {
  if (line.match(/^INTRODUCTION/i)) {
    inIntro = true;
    continue;
  }
  if (line.match(/^CONCLUSION/i)) {
    inConc = true;
    inIntro = false;
    continue;
  }
  if (line.match(/^MOUVEMENT/i)) {
    inIntro = false;
    inConc = false;
  }
  if (inIntro) intro += line + '\n';
  if (inConc) conclusion += line + '\n';
}

console.log('Intro found:', !!intro.trim());
console.log('Conclusion found:', !!conclusion.trim());
