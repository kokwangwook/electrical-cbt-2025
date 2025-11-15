const fs = require('fs');
const path = require('path');

// 소스 JSON 파일 읽기
const sourceFile = path.join(__dirname, '../source/전기공학기초이론_cbt_latex.json');
const outputFile = path.join(__dirname, '../source/전기공학기초이론_cbt_converted.json');

console.log('📖 JSON 파일 읽는 중...');
const data = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));

console.log('🔄 CBT 시스템 형식으로 변환 중...');

let currentId = 1; // 시작 ID
const convertedQuestions = [];
const missingAnswers = [];

data.questions.forEach((q, index) => {
  const converted = {
    id: currentId++,
    category: q.category || '미분류',
    question: q.question,
    option1: q.choices[0] || '',
    option2: q.choices[1] || '',
    option3: q.choices[2] || '',
    option4: q.choices[3] || '',
    answer: 0, // ⚠️ 정답 없음 - 수동 입력 필요
    explanation: q.explanation || undefined,
  };

  // 정답이 비어있으면 기록
  if (!q.answer || q.answer === '') {
    missingAnswers.push({
      id: converted.id,
      number: q.number,
      question: q.question.substring(0, 50) + '...',
    });
  } else {
    // 정답이 있으면 변환 (문자열 "1" -> 숫자 1)
    converted.answer = parseInt(q.answer) || 0;
  }

  convertedQuestions.push(converted);
});

// 변환된 데이터 저장
fs.writeFileSync(outputFile, JSON.stringify(convertedQuestions, null, 2), 'utf8');

console.log('\n✅ 변환 완료!');
console.log(`📁 출력 파일: ${outputFile}`);
console.log(`📊 총 ${convertedQuestions.length}개 문제 변환`);
console.log(`⚠️  정답 없는 문제: ${missingAnswers.length}개`);

if (missingAnswers.length > 0) {
  console.log('\n⚠️  다음 문제들은 정답이 비어있습니다:');
  console.log('━'.repeat(80));
  missingAnswers.slice(0, 10).forEach(m => {
    console.log(`ID ${m.id} (원본 #${m.number}): ${m.question}`);
  });
  if (missingAnswers.length > 10) {
    console.log(`... 외 ${missingAnswers.length - 10}개 문제`);
  }
  console.log('\n💡 해결 방법:');
  console.log('1. 관리자 페이지에서 일괄 임포트');
  console.log('2. 문제 관리 탭에서 각 문제 수정하여 정답 입력');
  console.log('3. 또는 JSON 파일을 직접 수정 후 재임포트');
}

console.log('\n📋 다음 단계:');
console.log('1. 브라우저에서 http://localhost:5173/admin 접속');
console.log('2. "문제 관리" 탭 → "📤 Google Sheets로 마이그레이션" 버튼 클릭');
console.log('   (기존 LocalStorage 데이터를 Google Sheets로 백업)');
console.log('3. "일괄 Import" 탭으로 이동');
console.log('4. 변환된 JSON 파일을 스크립트로 임포트');
console.log('\n또는 questionService.ts에 직접 추가하는 방법도 있습니다.');
