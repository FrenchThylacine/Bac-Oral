import { extractHybrid } from './lib/v3-hybrid-extractor.mjs';

const result = await extractHybrid('input/placeholder/sample_al_1.txt');

console.log('=== HYBRID EXTRACTION TEST ===');
console.log('Title:', result.title);
console.log('Author:', result.author);
console.log('Genre:', result.genre);
console.log('Movements:', result.movements.length);
result.movements.forEach(m => {
  console.log(`  Movement ${m.number}: ${m.title} (${m.procedures?.length || 0} procedures)`);
  if (m.procedures) {
    m.procedures.forEach(p => {
      console.log(`    - ${p.label}: ${p.analysis}`);
    });
  }
});
console.log('Introduction:', result.introduction?.slice(0, 80));
console.log('Conclusion:', result.conclusion?.slice(0, 80));
console.log('\n✅ Test complete');
