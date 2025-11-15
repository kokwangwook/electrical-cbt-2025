// LocalStorage에서 문제 검색
// 브라우저 환경이 아니므로 직접 파일을 읽어야 함
// 하지만 LocalStorage는 브라우저에서만 접근 가능하므로, 
// 실제로는 브라우저 콘솔에서 실행해야 합니다.

// 대신 questions 데이터가 저장된 파일이 있는지 확인
const fs = require('fs');
const path = require('path');

// 검색할 문제
const searchText = '3상 유도 전동기의 원선도를 그리는 데 필요하지 않은 것은';

console.log('🔍 문제 검색 시작...');
console.log('검색어:', searchText);
console.log('');

// LocalStorage는 브라우저에서만 접근 가능하므로
// 사용자에게 브라우저 콘솔에서 실행할 코드를 제공
console.log('='.repeat(80));
console.log('⚠️  LocalStorage는 브라우저에서만 접근 가능합니다.');
console.log('='.repeat(80));
console.log('');
console.log('브라우저 콘솔에서 다음 코드를 실행하세요:');
console.log('');
console.log('```javascript');
console.log('// 문제 검색');
console.log('const searchText = "3상 유도 전동기의 원선도를 그리는 데 필요하지 않은 것은";');
console.log('const questions = JSON.parse(localStorage.getItem("questions") || "[]");');
console.log('');
console.log('const found = questions.filter(q => {');
console.log('  const text = [q.question, q.option1, q.option2, q.option3, q.option4, q.explanation].join(" ");');
console.log('  return text.includes(searchText);');
console.log('});');
console.log('');
console.log('if (found.length > 0) {');
console.log('  console.log("✅ 발견된 문제:", found.length, "개");');
console.log('  found.forEach((q, idx) => {');
console.log('    console.log(`\\n문제 ${idx + 1}:`);');
console.log('    console.log("ID:", q.id);');
console.log('    console.log("카테고리:", q.category);');
console.log('    console.log("출제기준:", q.standard || "미지정");');
console.log('    console.log("문제:", q.question);');
console.log('    console.log("선택지:", q.option1, q.option2, q.option3, q.option4);');
console.log('    console.log("정답:", q.answer);');
console.log('    console.log("해설:", q.explanation || "없음");');
console.log('  });');
console.log('} else {');
console.log('  console.log("❌ 문제를 찾을 수 없습니다.");');
console.log('}');
console.log('```');
console.log('');

// 또는 JSON 파일이 있다면 검색
const possibleJsonFiles = [
  path.join(__dirname, 'source', '원소스', 'sample_test.json'),
  path.join(__dirname, 'questions.json'),
  path.join(__dirname, 'data', 'questions.json'),
];

let foundInFile = false;
for (const jsonFile of possibleJsonFiles) {
  if (fs.existsSync(jsonFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
      const questions = Array.isArray(data) ? data : (data.questions || []);
      
      const found = questions.filter(q => {
        const text = [
          q.question || '',
          q.option1 || '',
          q.option2 || '',
          q.option3 || '',
          q.option4 || '',
          q.explanation || '',
        ].join(' ');
        return text.includes(searchText);
      });
      
      if (found.length > 0) {
        foundInFile = true;
        console.log('='.repeat(80));
        console.log(`✅ 파일에서 발견: ${path.basename(jsonFile)}`);
        console.log('='.repeat(80));
        found.forEach((q, idx) => {
          console.log(`\n문제 ${idx + 1}:`);
          console.log('ID:', q.id);
          console.log('카테고리:', q.category || '미지정');
          console.log('출제기준:', q.standard || '미지정');
          console.log('문제:', q.question);
          console.log('선택지 1:', q.option1);
          console.log('선택지 2:', q.option2);
          console.log('선택지 3:', q.option3);
          console.log('선택지 4:', q.option4);
          console.log('정답:', q.answer);
          console.log('해설:', q.explanation || '없음');
        });
      }
    } catch (error) {
      // 파일 읽기 실패는 무시
    }
  }
}

if (!foundInFile) {
  console.log('❌ JSON 파일에서 문제를 찾을 수 없습니다.');
  console.log('브라우저 콘솔에서 위의 코드를 실행하세요.');
}


