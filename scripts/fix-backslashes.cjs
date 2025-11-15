const fs = require('fs');
const path = require('path');

const sourceFile = path.join(__dirname, '../source/전기공학기초이론_cbt_converted.json');
const outputFile = path.join(__dirname, '../source/전기공학기초이론_cbt_fixed.json');

console.log('📖 JSON 파일 읽는 중...');
let content = fs.readFileSync(sourceFile, 'utf8');

console.log('🔄 이중 백슬래시 수정 중...');

// \\\\ -> \\ 변환 (JSON 문자열에서 4개 백슬래시를 2개로)
const before = (content.match(/\\\\\\\\/g) || []).length;
content = content.replace(/\\\\\\\\/g, '\\\\');
const after = (content.match(/\\\\\\\\/g) || []).length;

fs.writeFileSync(outputFile, content, 'utf8');

console.log('\n✅ 수정 완료!');
console.log(`📁 출력 파일: ${outputFile}`);
console.log(`🔧 수정된 이중 백슬래시: ${before - after}개`);
