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

  // 수학 기호 변환 (단일 백슬래시)
  result = result.replace(/×/g, '$\\times$');
  result = result.replace(/÷/g, '$\\div$');
  result = result.replace(/≒/g, '$\\approx$');

  // 거듭제곱
  result = result.replace(/²/g, '$^2$');
  result = result.replace(/³/g, '$^3$');

  return result;
}

// 카테고리 분류
function categorizeQuestion(questionText) {
  const text = questionText.toLowerCase();

  if (text.includes('전압') || text.includes('전류') || text.includes('저항') ||
      text.includes('옴의') || text.includes('키르히호프') || text.includes('전력') ||
      text.includes('임피던스') || text.includes('리액턴스')) {
    return '전기이론';
  }

  if (text.includes('전동기') || text.includes('발전기') || text.includes('변압기') ||
      text.includes('동기') || text.includes('유도')) {
    return '전기기기';
  }

  if (text.includes('배선') || text.includes('접지') || text.includes('전선') ||
      text.includes('배전') || text.includes('설비')) {
    return '전기설비';
  }

  return '미분류';
}

// 한국어 숫자를 아라비아 숫자로 변환
function convertKoreanNumber(str) {
  const map = {'㉮': 1, '㉯': 2, '㉰': 3, '㉱': 4};
  return map[str] || 0;
}

// PDF 파싱
async function parsePDF(pdfPath) {
  console.log(`\n📖 PDF 파일 읽는 중: ${path.basename(pdfPath)}`);

  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdf(dataBuffer);

  console.log(`📄 총 페이지: ${data.numpages}`);
  console.log(`📝 텍스트 추출 중...\n`);

  const text = data.text;
  const lines = text.split('\n').map(line => line.trim());

  const questions = [];
  const warnings = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // 문제 번호 패턴: "1.", "2.", etc.
    const questionMatch = line.match(/^(\d+)\.\s*(.*)/);

    if (questionMatch) {
      const questionNum = parseInt(questionMatch[1]);
      let questionText = questionMatch[2];

      // 다음 줄들을 읽어서 문제 텍스트 완성 (선택지 줄까지)
      i++;
      while (i < lines.length) {
        const nextLine = lines[i];

        // 선택지 줄 감지: ㉮㉯㉰㉱ 포함
        if (nextLine.includes('㉮') && nextLine.includes('㉯') &&
            nextLine.includes('㉰') && nextLine.includes('㉱')) {

          // 선택지 파싱
          const choices = [];

          // ㉮로 시작하는 줄 찾기
          let choiceStartIdx = i;

          // 현재 줄에 선택지 번호만 있는 경우
          if (nextLine.match(/^㉮㉯㉰㉱\s*$/)) {
            choiceStartIdx = i + 1;
          }

          // 선택지 4개 수집
          let choiceIdx = choiceStartIdx;
          let currentChoice = '';
          let choiceCount = 0;

          while (choiceIdx < lines.length && choiceCount < 4) {
            const choiceLine = lines[choiceIdx];

            // 선택지 시작 패턴
            const choiceMatch = choiceLine.match(/^([㉮㉯㉰㉱])\s*(.*)/);

            if (choiceMatch) {
              // 이전 선택지 저장
              if (currentChoice) {
                choices.push(currentChoice.trim());
                choiceCount++;
              }

              // 새 선택지 시작
              currentChoice = choiceMatch[2];
            } else if (currentChoice) {
              // 선택지 텍스트 계속
              // 다음 문제나 힌트가 아니면 추가
              if (!choiceLine.match(/^\d+\./) && !choiceLine.startsWith('힌트')) {
                currentChoice += ' ' + choiceLine;
              } else {
                // 선택지 종료
                choices.push(currentChoice.trim());
                choiceCount++;
                currentChoice = '';
                break;
              }
            }

            choiceIdx++;
          }

          // 마지막 선택지 저장
          if (currentChoice && choiceCount < 4) {
            choices.push(currentChoice.trim());
            choiceCount++;
          }

          // 4개 선택지가 모두 있는지 확인
          if (choices.length === 4 && questionText.length > 5) {
            questions.push({
              id: questions.length + 1,
              category: categorizeQuestion(questionText),
              question: convertToLatex(questionText.trim()),
              option1: convertToLatex(choices[0]),
              option2: convertToLatex(choices[1]),
              option3: convertToLatex(choices[2]),
              option4: convertToLatex(choices[3]),
              answer: 0,
              explanation: undefined
            });
          } else {
            warnings.push({
              number: questionNum,
              issue: `선택지 ${choices.length}개만 발견됨`,
              question: questionText.substring(0, 50) + '...'
            });
          }

          i = choiceIdx;
          break;
        }

        // 다음 문제 시작이면 중단
        if (nextLine.match(/^\d+\.\s*/)) {
          warnings.push({
            number: questionNum,
            issue: '선택지를 찾을 수 없음',
            question: questionText.substring(0, 50) + '...'
          });
          break;
        }

        // 문제 텍스트 계속
        if (nextLine && !nextLine.startsWith('힌트')) {
          questionText += ' ' + nextLine;
        }

        i++;
      }
    } else {
      i++;
    }
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
        if (w.question) {
          console.log(`     "${w.question}"`);
        }
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

    // 샘플 문제 출력
    if (questions.length > 0) {
      console.log(`\n📝 샘플 문제 (첫 번째):
카테고리: ${questions[0].category}
문제: ${questions[0].question.substring(0, 80)}...
① ${questions[0].option1.substring(0, 40)}...
② ${questions[0].option2.substring(0, 40)}...
③ ${questions[0].option3.substring(0, 40)}...
④ ${questions[0].option4.substring(0, 40)}...`);
    }

    console.log(`\n⚠️  주의: answer 필드가 모두 0입니다. 정답을 수동으로 입력해주세요.`);

  } catch (error) {
    console.error('\n❌ 파싱 실패:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
