import type { Question } from '../types';

// Google Sheets 설정
// 사용자가 나중에 실제 스프레드시트 ID와 API 키를 입력해야 합니다
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID'; // 사용자가 교체해야 함
const API_KEY = 'YOUR_API_KEY'; // 사용자가 교체해야 함
const SHEET_NAME = 'Questions'; // 시트 이름

/**
 * TSV 파일에서 문제 데이터를 가져옵니다
 */
async function loadQuestionsFromTSV(): Promise<Question[]> {
  try {
    const response = await fetch('/converted_questions.tsv');
    if (!response.ok) {
      throw new Error('TSV 파일을 찾을 수 없습니다');
    }

    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim());

    // 첫 줄은 헤더이므로 제외
    const dataLines = lines.slice(1);

    const questions: Question[] = dataLines.map(line => {
      const columns = line.split('\t');
      return {
        id: parseInt(columns[0]),
        category: columns[1],
        question: columns[2],
        option1: columns[3],
        option2: columns[4],
        option3: columns[5],
        option4: columns[6],
        answer: parseInt(columns[7]),
        explanation: columns[8],
        imageUrl: columns[9],
      };
    });

    console.log(`✅ TSV 파일에서 ${questions.length}개 문제 로드 완료`);
    return questions;
  } catch (error) {
    console.error('TSV 파일 로드 실패:', error);
    return [];
  }
}

/**
 * Google Sheets에서 문제 데이터를 가져옵니다
 *
 * 구글 시트 설정 방법:
 * 1. Google Sheets에서 스프레드시트 생성
 * 2. 열: id | category | question | option1 | option2 | option3 | option4 | answer | explanation | imageUrl
 * 3. 파일 > 공유 > 링크가 있는 모든 사용자에게 공개
 * 4. Google Cloud Console에서 Sheets API 활성화 및 API 키 생성
 * 5. 위의 SPREADSHEET_ID와 API_KEY 값 교체
 */
export async function fetchQuestionsFromGoogleSheets(): Promise<Question[]> {
  // 먼저 TSV 파일에서 로드 시도
  console.log('📂 TSV 파일에서 문제 로드 시도 중...');
  const tsvQuestions = await loadQuestionsFromTSV();

  if (tsvQuestions.length > 0) {
    return tsvQuestions;
  }

  // TSV 실패 시 Google Sheets API 시도
  if (SPREADSHEET_ID !== 'YOUR_SPREADSHEET_ID' && API_KEY !== 'YOUR_API_KEY') {
    try {
      console.log('🌐 Google Sheets API 호출 중...');
      const range = `${SHEET_NAME}!A2:J`; // 헤더 제외, A-J 컬럼
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${API_KEY}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Google Sheets API 오류: ${response.statusText}`);
      }

      const data = await response.json();
      const rows = data.values || [];

      const questions: Question[] = rows.map((row: any[]) => ({
        id: parseInt(row[0]) || 0,
        category: row[1] || '',
        question: row[2] || '',
        option1: row[3] || '',
        option2: row[4] || '',
        option3: row[5] || '',
        option4: row[6] || '',
        answer: parseInt(row[7]) || 1,
        explanation: row[8] || '',
        imageUrl: row[9] || '',
      }));

      console.log(`✅ Google Sheets에서 ${questions.length}개 문제 로드 완료`);
      return questions;
    } catch (error) {
      console.error('Google Sheets 로드 실패:', error);
    }
  }

  // 모두 실패 시 샘플 데이터 반환
  console.log('⚠️ 샘플 데이터 사용 중');
  return getSampleQuestions();
}

/**
 * 개발/테스트용 샘플 문제
 */
function getSampleQuestions(): Question[] {
  return [
    {
      id: 1,
      category: '전기이론',
      question: '옴의 법칙에서 전압(V), 전류(I), 저항(R)의 관계식으로 옳은 것은?',
      option1: 'V = I × R',
      option2: 'V = I / R',
      option3: 'V = R / I',
      option4: 'V = I + R',
      answer: 1,
      explanation: '옴의 법칙: 전압 = 전류 × 저항 (V = I × R)',
    },
    {
      id: 2,
      category: '전기이론',
      question: '저항 10Ω에 2A의 전류가 흐를 때 소비되는 전력은?',
      option1: '20W',
      option2: '40W',
      option3: '5W',
      option4: '12W',
      answer: 2,
      explanation: 'P = I²R = 2² × 10 = 40W',
    },
    {
      id: 3,
      category: '전기기기',
      question: '변압기의 1차 전압이 220V, 2차 전압이 110V일 때 권선비는?',
      option1: '1:1',
      option2: '2:1',
      option3: '1:2',
      option4: '4:1',
      answer: 2,
      explanation: '권선비 = 1차전압/2차전압 = 220/110 = 2:1',
    },
    {
      id: 4,
      category: '전기설비',
      question: '접지저항의 허용값으로 옳은 것은? (저압)',
      option1: '100Ω 이하',
      option2: '10Ω 이하',
      option3: '1Ω 이하',
      option4: '제한 없음',
      answer: 1,
      explanation: '저압 전로의 접지저항은 100Ω 이하',
    },
    {
      id: 5,
      category: '전기이론',
      question: '직렬 연결된 저항 R1=10Ω, R2=20Ω의 합성 저항은?',
      option1: '30Ω',
      option2: '15Ω',
      option3: '6.67Ω',
      option4: '10Ω',
      answer: 1,
      explanation: '직렬 연결: R = R1 + R2 = 10 + 20 = 30Ω',
    },
  ];
}

/**
 * LocalStorage에 문제 캐시
 */
export function cacheQuestions(questions: Question[]): void {
  localStorage.setItem('cachedQuestions', JSON.stringify(questions));
  localStorage.setItem('cacheTimestamp', Date.now().toString());
}

/**
 * 캐시된 문제 가져오기
 */
export function getCachedQuestions(): Question[] | null {
  const cached = localStorage.getItem('cachedQuestions');
  const timestamp = localStorage.getItem('cacheTimestamp');

  if (!cached || !timestamp) return null;

  // 24시간 캐시
  const cacheAge = Date.now() - parseInt(timestamp);
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  if (cacheAge > maxAge) {
    localStorage.removeItem('cachedQuestions');
    localStorage.removeItem('cacheTimestamp');
    return null;
  }

  return JSON.parse(cached);
}

/**
 * 문제를 랜덤으로 선택
 */
export function selectRandomQuestions(questions: Question[], count: number): Question[] {
  const shuffled = [...questions].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, questions.length));
}
