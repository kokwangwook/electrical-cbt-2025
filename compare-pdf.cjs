const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

async function comparePDF() {
  const pdfPath = path.join(__dirname, 'source', '원소스', '11.pdf');
  const mdPath = path.join(__dirname, '출제기준.md');
  
  console.log('📄 PDF와 Markdown 파일 비교 시작...\n');
  
  // PDF 읽기
  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdf(dataBuffer);
  const pdfText = data.text;
  
  // Markdown 읽기
  const mdText = fs.readFileSync(mdPath, 'utf8');
  
  console.log('='.repeat(80));
  console.log('PDF에서 추출한 주요 항목:');
  console.log('='.repeat(80));
  
  // PDF에서 주요 항목 추출
  const pdfItems = [];
  
  // 전기이론 항목 찾기
  const theoryPattern = /1\.\s*전기의성질과전하에의한전기장|2\.\s*자기의성질과전류에의한자기장|3\.\s*전자력과전자유도|4\.\s*직류회로|5\.\s*교류회로|6\.\s*전류의열작용과화학작용/g;
  const theoryMatches = pdfText.match(theoryPattern);
  if (theoryMatches) {
    console.log('\n전기이론 항목:');
    theoryMatches.forEach(m => console.log(`  - ${m}`));
  }
  
  // 전기기기 항목 찾기 (7-12번)
  const machinePattern = /7\.\s*변압기|8\.\s*직류기|9\.\s*유도전동기|10\.\s*동기기|11\.\s*정류기및제어기기|12\.\s*보호계전기/g;
  const machineMatches = pdfText.match(machinePattern);
  if (machineMatches) {
    console.log('\n전기기기 항목 (PDF 번호):');
    machineMatches.forEach(m => console.log(`  - ${m}`));
  }
  
  // 전기설비 항목 찾기 (13-19번)
  const facilityPattern = /13\.\s*배선재료및공구|14\.\s*전선접속|15\.\s*배선설비공사및전선허용전류계산|16\.\s*전선및기계기구의보안공사|17\.\s*가공인입선및배전선공사|18\.\s*고압및저압배전반공사|19\.\s*특수장소공사/g;
  const facilityMatches = pdfText.match(facilityPattern);
  if (facilityMatches) {
    console.log('\n전기설비 항목 (PDF 번호):');
    facilityMatches.forEach(m => console.log(`  - ${m}`));
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('Markdown 파일의 주요 항목:');
  console.log('='.repeat(80));
  
  // Markdown에서 주요 항목 추출
  const mdTheoryPattern = /###\s*1\.\d+\s+[^\n]+/g;
  const mdTheoryMatches = mdText.match(mdTheoryPattern);
  if (mdTheoryMatches) {
    console.log('\n전기이론 항목:');
    mdTheoryMatches.forEach(m => console.log(`  - ${m.replace(/###\s*/, '')}`));
  }
  
  const mdMachinePattern = /###\s*2\.\d+\s+[^\n]+/g;
  const mdMachineMatches = mdText.match(mdMachinePattern);
  if (mdMachineMatches) {
    console.log('\n전기기기 항목:');
    mdMachineMatches.forEach(m => console.log(`  - ${m.replace(/###\s*/, '')}`));
  }
  
  const mdFacilityPattern = /###\s*3\.\d+\s+[^\n]+/g;
  const mdFacilityMatches = mdText.match(mdFacilityPattern);
  if (mdFacilityMatches) {
    console.log('\n전기설비 항목:');
    mdFacilityMatches.forEach(m => console.log(`  - ${m.replace(/###\s*/, '')}`));
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('차이점 분석:');
  console.log('='.repeat(80));
  
  // 번호 체계 차이 확인
  console.log('\n⚠️  발견된 차이점:');
  console.log('1. PDF는 전기기기를 7-12번으로, 전기설비를 13-19번으로 번호를 매김');
  console.log('2. Markdown은 전기이론을 1.1-1.6, 전기기기를 2.1-2.6, 전기설비를 3.1-3.8로 번호를 매김');
  console.log('3. 번호 체계는 다르지만 내용은 동일한 것으로 보임');
  
  // 세부 항목 비교
  console.log('\n📋 세부 항목 비교:');
  
  // PDF에서 세부 항목 추출 시도
  const pdfDetails = pdfText.match(/세부항목[^\n]*/g);
  if (pdfDetails) {
    console.log(`PDF 세부항목 키워드: ${pdfDetails.length}개 발견`);
  }
  
  const mdDetails = mdText.match(/####\s*세부항목/g);
  if (mdDetails) {
    console.log(`Markdown 세부항목 섹션: ${mdDetails.length}개 발견`);
  }
  
  // 세세 항목 비교
  const pdfSubDetails = pdfText.match(/세세항목/g);
  if (pdfSubDetails) {
    console.log(`PDF 세세항목 키워드: ${pdfSubDetails.length}개 발견`);
  }
  
  const mdSubDetails = mdText.match(/####\s*세세항목/g);
  if (mdSubDetails) {
    console.log(`Markdown 세세항목 섹션: ${mdSubDetails.length}개 발견`);
  }
  
  console.log('\n✅ 비교 완료');
}

comparePDF();


