const fs = require('fs');
const path = require('path');

// PDF 텍스트 추출을 위한 간단한 구현
// pdfjs-dist를 사용하여 텍스트 추출

async function extractTextFromPDF(pdfPath) {
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = pdfjsLib.getDocument({data});
  const pdfDocument = await loadingTask.promise;

  let fullText = '';

  for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
    const page = await pdfDocument.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

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

  // 수학 기호 변환 (단일 백슬래시)
  result = result.replace(/×/g, '$\\times$');
  result = result.replace(/÷/g, '$\\div$');
  result = result.replace(/≒/g, '$\\approx$');

  // 거듭제곱 변환
  result = result.replace(/²/g, '$^2$');
  result = result.replace(/³/g, '$^3$');

  return result;
}

// 카테고리 분류
function categorizeQuestion(questionText) {
  const text = questionText.toLowerCase();

  if (text.includes('전압') || text.includes('전류') || text.includes('저항') ||
      text.includes('옴의') || text.includes('키르히호프') || text.includes('전력')) {
    return '전기이론';
  }

  if (text.includes('전동기') || text.includes('발전기') || text.includes('변압기')) {
    return '전기기기';
  }

  if (text.includes('배선') || text.includes('접지') || text.includes('전선') ||
      text.includes('배전')) {
    return '전기설비';
  }

  return '미분류';
}

// PDF 파싱
async function parsePDF(pdfPath) {
  console.log(`\n📖 PDF 파일 읽는 중: ${path.basename(pdfPath)}`);

  const text = await extractTextFromPDF(pdfPath);
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);

  console.log(`📝 총 ${lines.length}개 라인 추출됨\n`);

  const questions = [];
  const warnings = [];
  let currentQuestion = null;
  let currentChoices = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 문제 번호 패턴
    const questionMatch = line.match(/^(\d+)\s*\.\s*(.*)/) || line.match(/^문제\s*(\d+)\s*\.?\s*(.*)/);

    if (questionMatch) {
      // 이전 문제 저장
      if (currentQuestion && currentChoices.length === 4) {
        questions.push({
          id: questions.length + 1,
          category: categorizeQuestion(currentQuestion),
          question: convertToLatex(currentQuestion.trim()),
          option1: convertToLatex(currentChoices[0].trim()),
          option2: convertToLatex(currentChoices[1].trim()),
          option3: convertToLatex(currentChoices[2].trim()),
          option4: convertToLatex(currentChoices[3].trim()),
          answer: 0,
          explanation: undefined
        });
      } else if (currentQuestion && currentChoices.length > 0 && currentChoices.length !== 4) {
        warnings.push({
          number: questions.length + 1,
          issue: `선택지 ${currentChoices.length}개만 발견됨`,
          question: currentQuestion.substring(0, 50) + '...'
        });
      }

      // 새 문제 시작
      currentQuestion = questionMatch[2] || '';
      currentChoices = [];
      continue;
    }

    // 선택지 패턴
    const choiceMatch = line.match(/^[①②③④]\s*(.*)/) ||
                       line.match(/^[1-4]\s*\)\s*(.*)/) ||
                       line.match(/^[가-라]\s*\.\s*(.*)/);

    if (choiceMatch && currentQuestion) {
      const choiceText = choiceMatch[1].trim();
      if (choiceText && choiceText.length > 1) {
        currentChoices.push(choiceText);
      }
      continue;
    }

    // 정답 섹션 감지
    if (line.match(/^정답/i) || line.match(/^답\s*[:：]/i)) {
      break;
    }

    // 문제 텍스트 연결
    if (currentQuestion && !choiceMatch && !questionMatch && line.length > 0) {
      currentQuestion += ' ' + line;
    }
  }

  // 마지막 문제 저장
  if (currentQuestion && currentChoices.length === 4) {
    questions.push({
      id: questions.length + 1,
      category: categorizeQuestion(currentQuestion),
      question: convertToLatex(currentQuestion.trim()),
      option1: convertToLatex(currentChoices[0].trim()),
      option2: convertToLatex(currentChoices[1].trim()),
      option3: convertToLatex(currentChoices[2].trim()),
      option4: convertToLatex(currentChoices[3].trim()),
      answer: 0,
      explanation: undefined
    });
  }

  return { questions, warnings };
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
    const { questions, warnings } = await parsePDF(pdfPath);

    console.log('\n📊 파싱 결과:');
    console.log(`✅ 총 추출 문제: ${questions.length}개`);

    if (warnings.length > 0) {
      console.log(`\n⚠️  경고 (${warnings.length}개):`);
      warnings.slice(0, 10).forEach(w => {
        console.log(`   - 문제 ${w.number}: ${w.issue}`);
      });
      if (warnings.length > 10) {
        console.log(`   ... 외 ${warnings.length - 10}개 경고`);
      }
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
    console.log(`📁 저장 위치: ${outputPath}`);
    console.log(`\n⚠️  주의: answer 필드가 모두 0입니다. 정답을 수동으로 입력해주세요.`);

  } catch (error) {
    console.error('\n❌ 파싱 실패:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
