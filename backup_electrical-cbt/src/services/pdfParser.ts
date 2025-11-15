import * as pdfjsLib from 'pdfjs-dist';
import type { Question } from '../types';

// PDF.js worker 설정 - Vite를 통한 로컬 worker 사용
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * 카테고리 자동 분류 키워드
 */
const CATEGORY_KEYWORDS = {
  전기이론: [
    '옴의 법칙',
    '키르히호프',
    '전압',
    '전류',
    '저항',
    '콘덴서',
    '인덕턴스',
    '임피던스',
    '리액턴스',
    '공진',
    '교류',
    '직류',
    '전력',
    '역률',
    '전자기',
    '자속',
    '자계',
    '전계',
    '정전용량',
    '유전체',
  ],
  전기기기: [
    '변압기',
    '발전기',
    '전동기',
    '동기기',
    '유도기',
    '직류기',
    '권선',
    '회전자',
    '고정자',
    '정류자',
    '전기자',
    '계자',
    '슬립',
    '동기속도',
    '기동',
    '제동',
    '여자',
  ],
  전기설비: [
    '배선',
    '접지',
    '차단기',
    '개폐기',
    '퓨즈',
    '배전',
    '송전',
    '전선',
    '케이블',
    '애자',
    '피뢰기',
    '보호계전기',
    '변전',
    '분전반',
    '전력량계',
    '누전',
    '감전',
    '화재',
  ],
};

/**
 * 문제 텍스트에서 카테고리 자동 분류
 */
function classifyCategory(questionText: string): string {
  const scores = {
    전기이론: 0,
    전기기기: 0,
    전기설비: 0,
  };

  // 키워드 매칭으로 점수 계산
  Object.entries(CATEGORY_KEYWORDS).forEach(([category, keywords]) => {
    keywords.forEach((keyword) => {
      if (questionText.includes(keyword)) {
        scores[category as keyof typeof scores] += 1;
      }
    });
  });

  // 가장 높은 점수의 카테고리 반환
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) {
    return '미분류'; // 키워드가 없으면 미분류
  }

  const category = Object.entries(scores).find(([_, score]) => score === maxScore)?.[0];
  return category || '미분류';
}

/**
 * PDF 파일에서 텍스트 추출
 */
async function extractTextFromPDF(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageTexts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    pageTexts.push(pageText);
  }

  return pageTexts;
}

/**
 * 정답 키 파싱 (예: "정답: 1.가 2.나 3.다..." 또는 "1 . 가" 형식)
 */
function parseAnswerKey(answerText: string): Map<number, number> {
  const answerMap = new Map<number, number>();
  // "1 . 가" 처럼 공백이 있을 수 있으므로 패턴 수정
  const answerPattern = /(\d+)\s*\.\s*([가나다라])/g;
  let match;

  const optionMap: { [key: string]: number } = {
    가: 1,
    나: 2,
    다: 3,
    라: 4,
  };

  while ((match = answerPattern.exec(answerText)) !== null) {
    const questionNum = parseInt(match[1]);
    const answerOption = optionMap[match[2]];
    if (answerOption) {
      answerMap.set(questionNum, answerOption);
    }
  }

  return answerMap;
}

/**
 * 이미지 존재 여부 감지
 */
function detectImagePlaceholder(text: string): boolean {
  // PDF에서 이미지가 있을 때 나타나는 패턴 감지
  const imagePatterns = [
    /\[그림\]/,
    /\[도표\]/,
    /\[회로도\]/,
    /\[사진\]/,
    /Image/i,
    /Figure/i,
  ];

  return imagePatterns.some((pattern) => pattern.test(text));
}

/**
 * 문제 파싱 인터페이스
 */
interface ParsedQuestion {
  questionNumber: number;
  questionText: string;
  options: string[];
  hasImage: boolean;
  rawText: string;
}

/**
 * PDF 텍스트에서 문제 추출 (개선된 버전)
 */
function parseQuestionsFromText(pageTexts: string[]): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];

  // 전체 텍스트 결합
  const fullText = pageTexts.join('\n');

  // 🔍 디버깅: 추출된 텍스트 샘플 출력
  console.log('📝 추출된 텍스트 샘플 (처음 500자):');
  console.log(fullText.substring(0, 500));
  console.log('\n📝 추출된 텍스트 샘플 (마지막 500자):');
  console.log(fullText.substring(Math.max(0, fullText.length - 500)));

  // 📌 PDF 텍스트 정규화 (개선된 3단계)
  // 1단계: 소수점 복원 - "1. 5V" → "1.5V", "2. 0[m]" → "2.0[m]"
  let normalizedText = fullText.replace(/(\d+)\s*\.\s*(\d+)/g, '$1.$2');
  console.log('\n📝 소수점 복원 후 텍스트 샘플 (처음 500자):');
  console.log(normalizedText.substring(0, 500));

  // 2단계: 선택지 앞의 불필요한 줄바꿈 제거 (가. 나. 다. 라. 앞의 공백/줄바꿈)
  normalizedText = normalizedText.replace(/\s+([가나다라])\s*\./g, ' $1.');

  // 3단계: 여러 개의 공백/줄바꿈을 하나의 공백으로 통일
  normalizedText = normalizedText.replace(/\s+/g, ' ');
  console.log('\n📝 공백 압축 후 텍스트 샘플 (처음 500자):');
  console.log(normalizedText.substring(0, 500));

  // 문제 패턴: 번호. 문제내용 가. 선택지1 나. 선택지2 다. 선택지3 라. 선택지4
  // "1 ." 처럼 번호와 점 사이에 공백이 있을 수 있음
  // 소수점은 이미 복원되었으므로 "1.5V"는 공백이 없어서 매칭 안됨 ✅
  const questionPattern = /(\d+)\s*\.\s*(.+?)(?=\d+\s*\.|$)/gs;
  let questionMatch;
  let matchCount = 0;

  while ((questionMatch = questionPattern.exec(normalizedText)) !== null) {
    matchCount++;
    const questionNum = parseInt(questionMatch[1]);
    const questionBlock = questionMatch[2];

    console.log(`\n🔍 문제 ${questionNum} 매칭됨 (블록 길이: ${questionBlock.length}자)`);
    console.log(`첫 100자: ${questionBlock.substring(0, 100)}`);

    // 선택지 추출 - 개선된 방식
    const expectedOrder = ['가', '나', '다', '라'];
    const options: string[] = [];

    // 먼저 모든 선택지 마커의 위치를 찾음
    const optionPositions: { [key: string]: number } = {};
    expectedOrder.forEach((opt) => {
      const regex = new RegExp(`${opt}\\s*\\.`, 'g');
      const match = regex.exec(questionBlock);
      if (match) {
        optionPositions[opt] = match.index;
      }
    });

    console.log(`  📍 발견된 선택지 위치:`, optionPositions);

    // 순서대로 선택지 추출
    for (let i = 0; i < expectedOrder.length; i++) {
      const currentOption = expectedOrder[i];
      const nextOption = expectedOrder[i + 1];

      const currentPos = optionPositions[currentOption];

      if (currentPos === undefined) {
        console.log(`  ❌ 선택지 ${currentOption} 찾을 수 없음`);
        break;
      }

      // 현재 선택지 마커 길이 계산 (예: "가 ." 또는 "가.")
      const markerMatch = questionBlock.substring(currentPos).match(/^[가나다라]\s*\./);
      const markerLength = markerMatch ? markerMatch[0].length : 2;

      // 다음 선택지 위치 또는 블록 끝까지
      let endPos: number;
      if (nextOption && optionPositions[nextOption] !== undefined) {
        endPos = optionPositions[nextOption];
      } else {
        endPos = questionBlock.length;
      }

      // 선택지 텍스트 추출 (greedy)
      const optionText = questionBlock.substring(currentPos + markerLength, endPos).trim();

      if (optionText.length > 0) {
        options.push(optionText);
        console.log(`  ✓ 선택지 ${currentOption} 추출 (${optionText.length}자): ${optionText.substring(0, 50)}...`);
      } else {
        console.log(`  ❌ 선택지 ${currentOption} 텍스트 없음`);
        break;
      }
    }

    console.log(`  총 ${options.length}개 선택지 추출됨`);

    // 문제 텍스트 추출 (선택지 제외)
    let questionText = questionBlock;
    const firstOptionPos = optionPositions['가'];
    if (firstOptionPos !== undefined) {
      questionText = questionBlock.substring(0, firstOptionPos).trim();
    }

    // 4개의 선택지가 있는 경우만 추가
    if (options.length === 4) {
      console.log(`  ✅ 문제 ${questionNum} 추가 성공`);
      questions.push({
        questionNumber: questionNum,
        questionText: questionText,
        options: options,
        hasImage: detectImagePlaceholder(questionBlock),
        rawText: questionBlock,
      });
    } else {
      console.log(`  ❌ 문제 ${questionNum} 건너뜀 (선택지 ${options.length}개, 4개 필요)`);
    }
  }

  console.log(`\n📊 총 ${matchCount}개 문제 매칭, ${questions.length}개 유효 문제 추출`);

  return questions;
}

/**
 * PDF 파일을 파싱하여 Question 객체 배열 생성
 */
export async function parsePDFToQuestions(file: File): Promise<Question[]> {
  try {
    console.log(`📄 PDF 파싱 시작: ${file.name}`);

    // 1. PDF에서 텍스트 추출
    const pageTexts = await extractTextFromPDF(file);
    console.log(`📖 총 ${pageTexts.length}페이지 추출 완료`);

    // 2. 정답 키 추출 (보통 마지막 페이지)
    const lastPageText = pageTexts[pageTexts.length - 1];
    const answerMap = parseAnswerKey(lastPageText);
    console.log(`✅ ${answerMap.size}개 정답 추출 완료`);

    // 3. 문제 파싱
    const parsedQuestions = parseQuestionsFromText(pageTexts);
    console.log(`📝 ${parsedQuestions.length}개 문제 추출 완료`);

    // 4. Question 객체 생성
    const questions: Question[] = parsedQuestions.map((pq) => {
      const category = classifyCategory(pq.questionText + ' ' + pq.options.join(' '));
      const answer = answerMap.get(pq.questionNumber) || 1;

      return {
        id: Date.now() + pq.questionNumber,
        category: category,
        question: pq.questionText,
        option1: pq.options[0] || '',
        option2: pq.options[1] || '',
        option3: pq.options[2] || '',
        option4: pq.options[3] || '',
        answer: answer,
        explanation: '',
        imageUrl: pq.hasImage ? '이미지 필요' : undefined,
      };
    });

    console.log(`✅ PDF 파싱 완료: ${questions.length}개 문제 생성`);
    return questions;
  } catch (error) {
    console.error('❌ PDF 파싱 실패:', error);
    throw error;
  }
}

/**
 * 여러 PDF 파일을 일괄 파싱
 */
export async function parseBulkPDFs(files: File[]): Promise<Question[]> {
  const allQuestions: Question[] = [];

  for (const file of files) {
    try {
      const questions = await parsePDFToQuestions(file);
      allQuestions.push(...questions);
      console.log(`✅ ${file.name}: ${questions.length}개 문제 추가`);
    } catch (error) {
      console.error(`❌ ${file.name} 파싱 실패:`, error);
    }
  }

  console.log(`🎉 총 ${allQuestions.length}개 문제 파싱 완료`);
  return allQuestions;
}
