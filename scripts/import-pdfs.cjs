const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

// 카테고리 자동 분류 키워드
const CATEGORY_KEYWORDS = {
  전기이론: [
    '옴의 법칙', '키르히호프', '전압', '전류', '저항', '콘덴서', '인덕턴스',
    '임피던스', '리액턴스', '공진', '교류', '직류', '전력', '역률',
    '전자기', '자속', '자계', '전계', '정전용량', '유전체',
  ],
  전기기기: [
    '변압기', '발전기', '전동기', '동기기', '유도기', '직류기', '권선',
    '회전자', '고정자', '정류자', '전기자', '계자', '슬립', '동기속도',
    '기동', '제동', '여자',
  ],
  전기설비: [
    '배선', '접지', '차단기', '개폐기', '퓨즈', '배전', '송전', '전선',
    '케이블', '애자', '피뢰기', '보호계전기', '변전', '분전반',
    '전력량계', '누전', '감전', '화재',
  ],
};

// 카테고리 자동 분류
function classifyCategory(questionText) {
  const scores = {
    전기이론: 0,
    전기기기: 0,
    전기설비: 0,
  };

  Object.entries(CATEGORY_KEYWORDS).forEach(([category, keywords]) => {
    keywords.forEach((keyword) => {
      if (questionText.includes(keyword)) {
        scores[category] += 1;
      }
    });
  });

  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) {
    return '미분류';
  }

  const category = Object.entries(scores).find(([_, score]) => score === maxScore)?.[0];
  return category || '미분류';
}

// 정답 키 파싱
function parseAnswerKey(text) {
  const answerMap = new Map();
  const answerPattern = /(\d+)\.\s*([가나다라])/g;
  let match;

  const optionMap = { 가: 1, 나: 2, 다: 3, 라: 4 };

  while ((match = answerPattern.exec(text)) !== null) {
    const questionNum = parseInt(match[1]);
    const answerOption = optionMap[match[2]];
    if (answerOption) {
      answerMap.set(questionNum, answerOption);
    }
  }

  return answerMap;
}

// 이미지 존재 여부 감지
function detectImagePlaceholder(text) {
  const imagePatterns = [
    /\[그림\]/,
    /\[도표\]/,
    /\[회로도\]/,
    /\[사진\]/,
  ];
  return imagePatterns.some((pattern) => pattern.test(text));
}

// 문제 파싱
function parseQuestions(text) {
  const questions = [];

  // 문제 패턴: 번호. 문제내용 가. 선택지1 나. 선택지2 다. 선택지3 라. 선택지4
  const questionBlocks = text.split(/\n(?=\d+\.\s)/);

  for (const block of questionBlocks) {
    if (!block.trim()) continue;

    // 문제 번호 추출
    const numMatch = block.match(/^(\d+)\.\s/);
    if (!numMatch) continue;

    const questionNum = parseInt(numMatch[1]);
    if (questionNum < 1 || questionNum > 60) continue;

    // 선택지 추출
    const optionPattern = /([가나다라])\.\s*([^\n가나다라]+?)(?=\s*[가나다라]\.|$)/gs;
    const options = [];
    let optionMatch;

    const optionSection = block.substring(numMatch[0].length);
    let firstOptionIndex = optionSection.search(/[가나다라]\./);

    if (firstOptionIndex === -1) continue;

    const questionText = optionSection.substring(0, firstOptionIndex).trim();
    const optionsText = optionSection.substring(firstOptionIndex);

    while ((optionMatch = optionPattern.exec(optionsText)) !== null) {
      options.push(optionMatch[2].trim());
    }

    if (options.length === 4 && questionText) {
      questions.push({
        questionNumber: questionNum,
        questionText: questionText,
        options: options,
        hasImage: detectImagePlaceholder(block),
        rawText: block,
      });
    }
  }

  return questions;
}

// PDF 파일 파싱
async function parsePDFFile(filePath) {
  try {
    console.log(`\n📄 Processing: ${path.basename(filePath)}`);

    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    const text = data.text;

    // 정답 키 추출
    const answerMap = parseAnswerKey(text);
    console.log(`  ✅ Found ${answerMap.size} answers`);

    // 문제 파싱
    const parsedQuestions = parseQuestions(text);
    console.log(`  📝 Parsed ${parsedQuestions.length} questions`);

    if (parsedQuestions.length === 0) {
      console.log(`  ⚠️ No questions found, skipping`);
      return [];
    }

    // Question 객체 생성
    const questions = parsedQuestions.map((pq) => {
      const category = classifyCategory(pq.questionText + ' ' + pq.options.join(' '));
      const answer = answerMap.get(pq.questionNumber) || 1;

      return {
        id: Date.now() + Math.random() * 1000 + pq.questionNumber,
        category: category,
        question: pq.questionText,
        option1: pq.options[0] || '',
        option2: pq.options[1] || '',
        option3: pq.options[2] || '',
        option4: pq.options[3] || '',
        answer: answer,
        explanation: undefined,
        imageUrl: pq.hasImage ? '이미지 필요' : undefined,
      };
    });

    console.log(`  ✅ Created ${questions.length} question objects`);
    return questions;

  } catch (error) {
    console.error(`  ❌ Error parsing ${path.basename(filePath)}:`, error.message);
    return [];
  }
}

// 메인 함수
async function main() {
  const sourceDir = path.join(__dirname, '..', 'source');
  const outputFile = path.join(__dirname, '..', 'questions-import.json');

  console.log('🚀 Starting PDF import process...\n');
  console.log(`📂 Source directory: ${sourceDir}`);

  // PDF 파일 목록 가져오기
  const allFiles = fs.readdirSync(sourceDir);

  // 기출문제 파일만 필터링
  const pdfFiles = allFiles.filter(file => {
    const fileName = file.toLowerCase();

    // PDF 파일만
    if (!fileName.endsWith('.pdf')) return false;

    // 제외할 파일들
    const excludePatterns = [
      '요점정리',
      '출제기준',
      '기호',
      '그래프',
      '기초이론',
      '개정',
    ];

    // 제외 패턴에 해당하는 파일 제외
    if (excludePatterns.some(pattern => fileName.includes(pattern))) {
      return false;
    }

    // "해설"만 있는 파일 제외 (기출문제가 없는 해설 전용)
    if (fileName.includes('해설') && !fileName.includes('회')) {
      return false;
    }

    return true;
  });

  console.log(`\n📋 Found ${pdfFiles.length} PDF files to process`);

  const allQuestions = [];
  let successCount = 0;
  let failCount = 0;

  // 각 PDF 파일 처리
  for (const file of pdfFiles) {
    const filePath = path.join(sourceDir, file);
    const questions = await parsePDFFile(filePath);

    if (questions.length > 0) {
      allQuestions.push(...questions);
      successCount++;
    } else {
      failCount++;
    }

    // 너무 빠르게 처리하지 않도록 약간의 딜레이
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n\n📊 Summary:`);
  console.log(`  ✅ Successfully processed: ${successCount} files`);
  console.log(`  ❌ Failed or empty: ${failCount} files`);
  console.log(`  📝 Total questions extracted: ${allQuestions.length}`);

  // 카테고리별 통계
  const categoryStats = {
    전기이론: 0,
    전기기기: 0,
    전기설비: 0,
    미분류: 0,
  };

  allQuestions.forEach(q => {
    categoryStats[q.category] = (categoryStats[q.category] || 0) + 1;
  });

  console.log(`\n  📊 Category distribution:`);
  Object.entries(categoryStats).forEach(([category, count]) => {
    console.log(`     ${category}: ${count} questions`);
  });

  // JSON 파일로 저장
  fs.writeFileSync(outputFile, JSON.stringify(allQuestions, null, 2), 'utf-8');
  console.log(`\n💾 Saved to: ${outputFile}`);

  // LocalStorage 형식으로도 출력 (복사해서 브라우저 콘솔에 붙여넣기 가능)
  const localStorageScript = `localStorage.setItem('questions', '${JSON.stringify(allQuestions).replace(/'/g, "\\'")}');`;
  const scriptFile = path.join(__dirname, '..', 'import-to-localstorage.js');
  fs.writeFileSync(scriptFile, localStorageScript, 'utf-8');
  console.log(`📋 LocalStorage script saved to: ${scriptFile}`);

  console.log(`\n✅ Import complete!`);
  console.log(`\n💡 To import into browser:`);
  console.log(`   1. Open http://localhost:5174/admin`);
  console.log(`   2. Login with password: admin2024`);
  console.log(`   3. Go to "일괄 Import" tab`);
  console.log(`   4. Or paste the content of import-to-localstorage.js into browser console`);
}

// 실행
main().catch(console.error);
