#!/usr/bin/env node
/**
 * V3 Debug Test - Trace extraction line-by-line
 */

import { readFileSync } from 'node:fs';

const placeholderPath = './input/placeholder/sample_al_1.txt';
const text = readFileSync(placeholderPath, 'utf-8');
const lines = text.split('\n').map(l => l.trim()).filter(l => l);

console.log(`Total lines: ${lines.length}\n`);
console.log('Lines:');
lines.forEach((line, i) => {
  console.log(`${i.toString().padStart(2)}: "${line}"`);
});

console.log('\n\nPattern tests:');
lines.forEach((line, i) => {
  if (line.match(/^MOUVEMENT/i)) console.log(`Line ${i}: MOUVEMENT detected`);
  if (line.match(/^[-•]\s*procedure:/i)) console.log(`Line ${i}: PROCEDURE detected`);
  if (line.match(/^\s+color:/i)) console.log(`Line ${i}: COLOR detected (indented)`);
  if (line.match(/^Color:/i)) console.log(`Line ${i}: COLOR detected (not indented)`);
  if (line.match(/^\s+analysis:/i)) console.log(`Line ${i}: ANALYSIS detected (indented)`);
  if (line.match(/^Analysis:/i)) console.log(`Line ${i}: ANALYSIS detected (not indented)`);
});

