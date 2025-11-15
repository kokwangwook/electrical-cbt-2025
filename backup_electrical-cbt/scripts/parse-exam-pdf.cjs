const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

// LaTeX 변환 함수
function convertToLatex(text) {
  if (!text) return text;

  let result = text;

  // 단위 변환
  result = result.replace(/\[V\]/g, '$[V]$');
  result = result.replace(/\[A\]/g, '$[A]$');
  result = result.replace(/\[W\]/g, '$[W]$');
  result = result.replace(/\[Ω\]/g, '$[\\Omega]$');
  result = result.replace(/\[Hz\]/g, '$[Hz]$');
  result = result.replace(/\[J\]/g, '$[J]$');
  result = result.replace(/\[C\]/g, '$[C]$');
  result = result.replace(/\[F\]/g, '$[F]$');
  result = result.replace(/\[H\]/g, '$[H]$');
  result = result.replace(/\[T\]/g, '$[T]$');
  result = result.replace(/\[Wb\]/g, '$[Wb]$');
  result = result.replace(/\[N\]/g, '$[N]$');
  result = result.replace(/\[m\]/g, '$[m]$');
  result = result.replace(/\[s\]/g, '$[s]$');
  result = result.replace(/\[kg\]/g, '$[kg]$');

  // 수학 기호 변환 (단일 백슬래시)
  result = result.replace(/×/g, '$\\times$');
  result = result.replace(/÷/g, '$\\div$');
  result = result.replace(/≒/g, '$\\approx$');
  result = result.replace(/√/g, '$\\sqrt{}$');

  // 거듭제곱 변환
  result = result.replace(/²/g, '$^2$');
  result = result.replace(/³/g, '$^3$');
  result = result.replace(/(\d+)\^(-?\d+)/g, '$1^{$2}$');
  result = result.replace(/10\^(-?\d+)/g, '$10^{$1}$');

  // 분수 패턴 (간단한 경우만)
  result = result.replace(/(\d+)\/(\d+)/g, '$\\frac{$1}{$2}$');

  return result;
}

// 카테고리 분류 함수
function categorizeQuestion(questionText) {
  const text = questionText.toLowerCase();

  if (text.includes('전압') || text.includes('전류') || text.includes('저항') ||
      text.includes('옴의') || text.includes('키르히호프') || text.includes('전력')) {
    return '전기이론';
  }

  if (text.includes('전동기') || text.includes('발전기') || text.includes('변압기') ||
      text.includes('전기기기')) {
    return '전기기기';
  }

  if (text.includes('배선') || text.includes('접지') || text.includes('전선') ||
      text.includes('배전') || text.includes('전기설비')) {
    return '전기설비';
  }

  return '미분류';
}

// PDF 파싱 함수
async function parsePDF(pdfPath) {
  console.log(`\n📖 PDF 파일 읽는 중: ${path.basename(pdfPath)}`);

  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdf(dataBuffer);

  console.log(`📄 총 페이지: ${data.numpages}`);
  console.log(`📝 텍스트 추출 중...\n`);

  const text = data.text;
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);

  const questions = [];
  const warnings = [];
  let currentQuestion = null;
  let currentChoices = [];
  let questionNumber = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 문제 번호 패턴 감지 (1., 2., ... 또는 문제 1, 문제 2, ...)
    const questionMatch = line.match(/^(\d+)\s*\.\s*(.*)/) || line.match(/^문제\s*(\d+)\s*\.?\s*(.*)/);

    if (questionMatch) {
      // 이전 문제 저장
      if (currentQuestion && currentChoices.length === 4) {
        questions.push({
          id: questions.length + 1,
          category: categorizeQuestion(currentQuestion),
          question: convertToLatex(currentQuestion),
          option1: convertToLatex(currentChoices[0]),
          option2: convertToLatex(currentChoices[1]),
          option3: convertToLatex(currentChoices[2]),
          option4: convertToLatex(currentChoices[3]),
          answer: 0, // 정답은 별도 입력 필요
          explanation: undefined
        });
      } else if (currentQuestion && currentChoices.length !== 4) {
        warnings.push({
          number: questionNumber - 1,
          issue: `선택지 ${currentChoices.length}개만 발견됨`,
          question: currentQuestion.substring(0, 50) + '...'
        });
      }

      // 새 문제 시작
      currentQuestion = questionMatch[2] || '';
      currentChoices = [];
      questionNumber = parseInt(questionMatch[1]);
      continue;
    }

    // 선택지 패턴 감지 (①, ②, ③, ④ 또는 1), 2), 3), 4))
    const choiceMatch = line.match(/^[①②③④]\s*(.*)/) ||
                       line.match(/^[1-4]\s*\)\s*(.*)/) ||
                       line.match(/^[가-라]\s*\.\s*(.*)/);

    if (choiceMatch && currentQuestion) {
      const choiceText = choiceMatch[1].trim();
      if (choiceText && choiceText !== '×' && choiceText !== '') {
        currentChoices.push(choiceText);
      }
      continue;
    }

    // 정답 패턴 감지 (나중에 별도 처리 예정)
    if (line.match(/^정답\s*[:：]/i) || line.match(/^답\s*[:：]/i)) {
      // 정답 섹션 시작
      break;
    }

    // 문제 텍스트 연결
    if (currentQuestion && !choiceMatch && !questionMatch) {
      currentQuestion += ' ' + line;
    }
  }

  // 마지막 문제 저장
  if (currentQuestion && currentChoices.length === 4) {
    questions.push({
      id: questions.length + 1,
      category: categorizeQuestion(currentQuestion),
      question: convertToLatex(currentQuestion),
      option1: convertToLatex(currentChoices[0]),
      option2: convertToLatex(currentChoices[1]),
      option3: convertToLatex(currentChoices[2]),
      option4: convertToLatex(currentChoices[3]),
      answer: 0,
      explanation: undefined
    });
  }

  return { questions, warnings };
}

// 검증 함수
function validateQuestions(questions) {
  const issues = [];

  questions.forEach((q, index) => {
    // 필수 필드 검증
    if (!q.question || q.question.trim() === '') {
      issues.push(`문제 ${index + 1}: 문제 텍스트 누락`);
    }

    // 선택지 검증
    const options = [q.option1, q.option2, q.option3, q.option4];
    options.forEach((opt, optIdx) => {
      if (!opt || opt.trim() === '') {
        issues.push(`문제 ${index + 1}: 선택지 ${optIdx + 1} 비어있음`);
      }
      if (opt && opt.length < 2) {
        issues.push(`문제 ${index + 1}: 선택지 ${optIdx + 1} 너무 짧음 (${opt})`);
      }
      if (opt && (opt === '$\\times$' || opt === '×')) {
        issues.push(`문제 ${index + 1}: 선택지 ${optIdx + 1} 내용 없음 (× 기호만)`);
      }
    });

    // LaTeX 검증
    const allText = [q.question, ...options].join(' ');
    const openCount = (allText.match(/\$/g) || []).length;
    if (openCount % 2 !== 0) {
      issues.push(`문제 ${index + 1}: LaTeX $ 기호 짝이 맞지 않음`);
    }

    // 이중 백슬래시 검증
    if (allText.includes('\\\\')) {
      issues.push(`문제 ${index + 1}: 이중 백슬래시 발견`);
    }
  });

  return issues;
}

// 메인 실행
async function main() {
  const pdfFileName = process.argv[2] || '전기기능사_기출문제_2009년_1회.pdf';
  const pdfPath = path.join(__dirname, '../source/원소스', pdfFileName);

  if (!fs.existsSync(pdfPath)) {
    console.error(`❌ 파일을 찾을 수 없습니다: ${pdfPath}`);
    process.exit(1);
  }

  try {
    // PDF 파싱
    const { questions, warnings } = await parsePDF(pdfPath);

    console.log('\n📊 파싱 결과:');
    console.log(`✅ 총 추출 문제: ${questions.length}개`);

    if (warnings.length > 0) {
      console.log(`\n⚠️  경고 (${warnings.length}개):`);
      warnings.forEach(w => {
        console.log(`   - 문제 ${w.number}: ${w.issue}`);
        console.log(`     "${w.question}"`);
      });
    }

    // 검증
    const issues = validateQuestions(questions);
    if (issues.length > 0) {
      console.log(`\n⚠️  검증 문제 (${issues.length}개):`);
      issues.forEach(issue => console.log(`   - ${issue}`));
    }

    // 카테고리 분포
    const categoryCount = {};
    questions.forEach(q => {
      categoryCount[q.category] = (categoryCount[q.category] || 0) + 1;
    });

    console.log('\n📈 카테고리 분포:');
    Object.entries(categoryCount).forEach(([cat, count]) => {
      console.log(`   - ${cat}: ${count}개`);
    });

    // 파일 저장
    const outputFileName = pdfFileName.replace('.pdf', '_parsed.json');
    const outputPath = path.join(__dirname, '../source', outputFileName);

    fs.writeFileSync(outputPath, JSON.stringify(questions, null, 2), 'utf8');

    console.log(`\n💾 저장 완료: ${outputFileName}`);
    console.log(`\n⚠️  주의: answer 필드가 모두 0입니다. 정답을 수동으로 입력해주세요.`);

  } catch (error) {
    console.error('\n❌ 파싱 실패:', error.message);
    process.exit(1);
  }
}

main();
