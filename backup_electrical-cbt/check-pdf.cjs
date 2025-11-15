const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

async function checkPDF() {
  const pdfPath = path.join(__dirname, 'source', '원소스', '11.pdf');
  
  console.log('📄 PDF 파일 검토 시작...');
  console.log('경로:', pdfPath);
  console.log('파일 존재:', fs.existsSync(pdfPath));
  
  if (!fs.existsSync(pdfPath)) {
    console.error('❌ 파일을 찾을 수 없습니다.');
    return;
  }
  
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdf(dataBuffer);
    
    console.log('\n📊 PDF 정보:');
    console.log(`- 총 페이지: ${data.numpages}페이지`);
    console.log(`- 텍스트 길이: ${data.text.length}자`);
    
    // 처음 3000자만 출력
    const preview = data.text.substring(0, 3000);
    console.log('\n📝 내용 미리보기 (처음 3000자):');
    console.log('='.repeat(80));
    console.log(preview);
    console.log('='.repeat(80));
    
    // 문제 패턴 찾기
    const questionMatches = data.text.match(/\d+\.\s/g);
    console.log(`\n🔍 발견된 문제 번호 패턴: ${questionMatches ? questionMatches.length : 0}개`);
    
    // 선택지 패턴 찾기
    const choiceMatches = data.text.match(/[①②③④]/g);
    console.log(`🔍 발견된 선택지 패턴 (①②③④): ${choiceMatches ? choiceMatches.length : 0}개`);
    
    // 정답 패턴 찾기
    const answerMatches = data.text.match(/정답\s*[:：]/gi);
    console.log(`🔍 발견된 정답 섹션: ${answerMatches ? answerMatches.length : 0}개`);
    
    // 카테고리 키워드 찾기
    const categories = {
      '전기이론': (data.text.match(/전기이론|직류|교류|전압|전류|저항|옴의|키르히호프/gi) || []).length,
      '전기기기': (data.text.match(/전기기기|변압기|전동기|발전기|직류기|유도전동기/gi) || []).length,
      '전기설비': (data.text.match(/전기설비|배선|접지|전선|배전|가공인입선/gi) || []).length,
    };
    
    console.log('\n📈 카테고리 키워드 빈도:');
    Object.entries(categories).forEach(([cat, count]) => {
      console.log(`   - ${cat}: ${count}회`);
    });
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
    console.error(error.stack);
  }
}

checkPDF();


