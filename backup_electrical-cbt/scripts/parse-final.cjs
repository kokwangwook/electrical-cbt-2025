const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

// LaTeX 변환
function convertToLatex(text) {
  if (!text) return text;

  let result = text;

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

  result = result.replace(/×/g, '$\\times$');
  result = result.replace(/÷/g, '$\\div$');
  result = result.replace(/≒/g, '$\\approx$');
  result = result.replace(/²/g, '$^2$');
  result = result.replace(/³/g, '$^3$');

  return result;
}

// 카테고리 분류
function categorizeQuestion(questionText) {
  const text = questionText.toLowerCase();

  if (text.includes('전압') || text.includes('전류') || text.includes('저항') ||
      text.includes('옴') || text.includes('키르히호프') || text.includes('전력') ||
      text.includes('임피던스') || text.includes('리액턴스') || text.includes('기전력')) {
    return '전기이론';
  }

  if (text.includes('전동기') || text.includes('발전기') || text.includes('변압기') ||
      text.includes('동기') || text.includes('유도') || text.includes('회전')) {
    return '전기기기';
  }

  if (text.includes('배선') || text.includes('접지') || text.includes('전선') ||
      text.includes('배전') || text.includes('설비') || text.includes('공사')) {
    return '전기설비';
  }

  return '미분류';
}

// PDF 파싱
async function parsePDF(pdfPath) {
  console.log(`\n📖 PDF 파일 읽는 중: ${path.basename(pdfPath)}`);

  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdf(dataBuffer);

  console.log(`📄 총 페이지: ${data.numpages}`);
  console.log(`📝 텍스트 추출 중...\n`);

  const text = data.text;
  const lines = text.split('\n');

  const questions = [];
  const warnings = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 문제 번호 패턴: "1.", "2.", etc.
    const questionMatch = line.match(/^(\d+)\.\s*(.*)/);

    if (questionMatch) {
      const questionNum = parseInt(questionMatch[1]);
      let questionText = questionMatch[2];

      // 다음 줄들을 읽어서 문제 텍스트 완성
      let j = i + 1;
      let choices = [];
      let foundChoices = false;

      while (j < lines.length) {
        const nextLine = lines[j].trim();

        // 방법 1: 압축 형식 감지 (예: "2152132㉮㉯㉰㉱" 또는 "110220380440㉮㉯㉰㉱")
        const compactMatch = nextLine.match(/^(.+)㉮㉯㉰㉱\s*$/);
        if (compactMatch) {
          const choicesText = compactMatch[1];

          // 선택지 파싱 - 연속된 숫자를 분리
          // 패턴: 같은 길이로 반복되는 숫자들
          const numbers = choicesText.match(/\d+/g) || [];

          if (numbers.length >= 4) {
            // 마지막 4개 숫자를 선택지로 사용
            choices = numbers.slice(-4);
          } else if (choicesText.length >= 4) {
            // 숫자가 아닌 경우, 균등 분할 시도
            const chunkSize = Math.floor(choicesText.length / 4);
            for (let k = 0; k < 4; k++) {
              choices.push(choicesText.substr(k * chunkSize, chunkSize).trim());
            }
          }

          foundChoices = true;
          j++;
          break;
        }

        // 방법 2: 확장 형식 감지 (예: "㉮ 용량과 전압이...")
        if (nextLine.startsWith('㉮')) {
          const choice1Text = nextLine.substring(1).trim();
          let choice1 = choice1Text;

          // 다음 줄들에서 나머지 선택지 찾기
          let k = j + 1;
          while (k < lines.length && !lines[k].trim().startsWith('㉯')) {
            if (lines[k].trim() && !lines[k].trim().match(/^\d+\./)) {
              choice1 += ' ' + lines[k].trim();
            }
            k++;
          }

          if (k < lines.length && lines[k].trim().startsWith('㉯')) {
            let choice2 = lines[k].trim().substring(1).trim();
            k++;
            while (k < lines.length && !lines[k].trim().startsWith('㉰')) {
              if (lines[k].trim() && !lines[k].trim().match(/^\d+\./)) {
                choice2 += ' ' + lines[k].trim();
              }
              k++;
            }

            if (k < lines.length && lines[k].trim().startsWith('㉰')) {
              let choice3 = lines[k].trim().substring(1).trim();
              k++;
              while (k < lines.length && !lines[k].trim().startsWith('㉱')) {
                if (lines[k].trim() && !lines[k].trim().match(/^\d+\./)) {
                  choice3 += ' ' + lines[k].trim();
                }
                k++;
              }

              if (k < lines.length && lines[k].trim().startsWith('㉱')) {
                let choice4 = lines[k].trim().substring(1).trim();
                k++;
                while (k < lines.length) {
                  const checkLine = lines[k].trim();
                  if (checkLine.match(/^\d+\./) || checkLine.startsWith('힌트')) {
                    break;
                  }
                  if (checkLine) {
                    choice4 += ' ' + checkLine;
                  }
                  k++;
                }

                choices = [choice1, choice2, choice3, choice4];
                foundChoices = true;
                j = k;
                break;
              }
            }
          }
        }

        // 다음 문제가 시작되면 중단
        if (nextLine.match(/^\d+\.\s+/)) {
          break;
        }

        // 힌트나 해설이면 스킵
        if (nextLine.startsWith('힌트') || nextLine.startsWith('◐')) {
          j++;
          continue;
        }

        // 문제 텍스트 계속
        if (nextLine && nextLine.length > 0) {
          questionText += ' ' + nextLine;
        }

        j++;
      }

      // 문제 저장
      if (foundChoices && choices.length === 4) {
        const cleanQuestion = questionText.trim();
        const cleanChoices = choices.map(c => c.trim()).filter(c => c.length > 0);

        if (cleanQuestion.length > 3 && cleanChoices.length === 4) {
          questions.push({
            id: questions.length + 1,
            category: categorizeQuestion(cleanQuestion),
            question: convertToLatex(cleanQuestion),
            option1: convertToLatex(cleanChoices[0]),
            option2: convertToLatex(cleanChoices[1]),
            option3: convertToLatex(cleanChoices[2]),
            option4: convertToLatex(cleanChoices[3]),
            answer: 0,
            explanation: undefined
          });
        }
      } else if (questionText.trim().length > 5) {
        warnings.push({
          number: questionNum,
          issue: `선택지 ${choices.length}개만 발견됨`,
          question: questionText.substring(0, 60) + '...'
        });
      }

      i = j - 1; // Continue from where we left off
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
      warnings.slice(0, 5).forEach(w => {
        console.log(`   - 문제 ${w.number}: ${w.issue}`);
        console.log(`     "${w.question}"`);
      });
      if (warnings.length > 5) {
        console.log(`   ... 외 ${warnings.length - 5}개 경고`);
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
      console.log(`\n📝 샘플 문제 (첫 3개):`);
      questions.slice(0, 3).forEach((q, i) => {
        console.log(`\n[${i + 1}] ${q.category}`);
        console.log(`문제: ${q.question.substring(0, 70)}${q.question.length > 70 ? '...' : ''}`);
        console.log(`① ${q.option1}`);
        console.log(`② ${q.option2}`);
        console.log(`③ ${q.option3}`);
        console.log(`④ ${q.option4}`);
      });
    }

    console.log(`\n⚠️  주의: answer 필드가 모두 0입니다. 정답을 수동으로 입력해주세요.`);

  } catch (error) {
    console.error('\n❌ 파싱 실패:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
