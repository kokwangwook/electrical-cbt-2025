import type { Question } from '../types';
import {
  getAllQuestionsFromSheets,
  addQuestionToSheets,
  updateQuestionInSheets,
  deleteQuestionFromSheets,
  bulkAddQuestionsToSheets,
} from './googleSheetsService';

const QUESTIONS_KEY = 'questions';
const USE_GOOGLE_SHEETS = import.meta.env.VITE_GOOGLE_SHEETS_API_URL ? true : false;

/**
 * UUID 생성 (간단한 버전)
 */
function generateId(): number {
  return Date.now();
}

/**
 * LocalStorage에서 문제 가져오기 (백업용)
 */
function getQuestionsFromLocalStorage(): Question[] {
  try {
    const data = localStorage.getItem(QUESTIONS_KEY);
    if (!data) {
      return [];
    }
    
    const questions = JSON.parse(data);
    
    // 데이터 유효성 검사
    if (!Array.isArray(questions)) {
      console.error('❌ 문제 데이터가 배열이 아닙니다.');
      // 백업 시도
      try {
        const backupKey = QUESTIONS_KEY + '_backup_' + Date.now();
        localStorage.setItem(backupKey, data);
        console.log(`⚠️ 손상된 데이터를 ${backupKey}에 백업했습니다.`);
      } catch (e) {
        console.error('백업 저장 실패:', e);
      }
      return [];
    }
    
    return questions;
  } catch (error) {
    console.error('❌ 문제 데이터 읽기 실패:', error);
    // 백업 시도
    try {
      const data = localStorage.getItem(QUESTIONS_KEY);
      if (data) {
        const backupKey = QUESTIONS_KEY + '_backup_' + Date.now();
        localStorage.setItem(backupKey, data);
        console.log(`⚠️ 손상된 데이터를 ${backupKey}에 백업했습니다.`);
      }
    } catch (e) {
      console.error('백업 저장 실패:', e);
    }
    return [];
  }
}

/**
 * 모든 문제 조회
 * 성능 최적화: 항상 LocalStorage만 사용 (빠른 응답)
 * Google Sheets는 동기화 버튼을 통해 수동으로 관리
 */
export async function getAllQuestions(): Promise<Question[]> {
  return getQuestionsFromLocalStorage();
}

/**
 * 카테고리별 문제 조회
 */
export async function getQuestionsByCategory(category: string): Promise<Question[]> {
  const questions = await getAllQuestions();
  return questions.filter(q => q.category === category);
}

/**
 * 문제 추가
 */
export async function addQuestion(
  category: string,
  question: string,
  option1: string,
  option2: string,
  option3: string,
  option4: string,
  answer: number,
  explanation?: string,
  imageUrl?: string
): Promise<Question> {
  // 정답 유효성 검사
  if (![1, 2, 3, 4].includes(answer)) {
    throw new Error('정답은 1, 2, 3, 4 중 하나여야 합니다.');
  }

  const newQuestion: Question = {
    id: generateId(),
    category,
    question,
    option1,
    option2,
    option3,
    option4,
    answer,
    explanation: explanation?.trim() || '',
    imageUrl: imageUrl?.trim() || undefined,
  };

  if (USE_GOOGLE_SHEETS) {
    try {
      const result = await addQuestionToSheets(newQuestion);
      if (result) {
        console.log(`✅ 문제 추가 (Google Sheets): ${question}`);
        return result as Question;
      }
    } catch (error) {
      console.error('Google Sheets 추가 실패, LocalStorage 사용:', error);
    }
  }

  // LocalStorage에 저장 (백업 또는 Google Sheets 미사용 시)
  const questions = getQuestionsFromLocalStorage();
  questions.push(newQuestion);
  try {
    const jsonData = JSON.stringify(questions);
    localStorage.setItem(QUESTIONS_KEY, jsonData);
    console.log(`✅ 문제 추가 (LocalStorage): ${question}`);
  } catch (error) {
    console.error('❌ 문제 추가 실패:', error);
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      alert('❌ 저장 공간이 부족합니다. 브라우저의 로컬 스토리지를 정리해주세요.');
    } else {
      alert('❌ 문제 추가에 실패했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
    }
    throw error;
  }
  return newQuestion;
}

/**
 * 문제 수정
 */
export async function updateQuestion(
  id: number,
  category: string,
  question: string,
  option1: string,
  option2: string,
  option3: string,
  option4: string,
  answer: number,
  explanation?: string,
  imageUrl?: string
): Promise<Question> {
  // 정답 유효성 검사
  if (![1, 2, 3, 4].includes(answer)) {
    throw new Error('정답은 1, 2, 3, 4 중 하나여야 합니다.');
  }

  const updatedQuestion: Question = {
    id,
    category,
    question,
    option1,
    option2,
    option3,
    option4,
    answer,
    explanation: explanation?.trim() || '',
    imageUrl: imageUrl?.trim() || undefined,
  };

  if (USE_GOOGLE_SHEETS) {
    try {
      const result = await updateQuestionInSheets(updatedQuestion);
      if (result) {
        console.log(`✅ 문제 수정 (Google Sheets): ${question}`);
        return result as Question;
      }
    } catch (error) {
      console.error('Google Sheets 수정 실패, LocalStorage 사용:', error);
    }
  }

  // LocalStorage에서 수정 (백업 또는 Google Sheets 미사용 시)
  const questions = getQuestionsFromLocalStorage();
  const index = questions.findIndex(q => q.id === id);

  if (index === -1) {
    throw new Error('문제를 찾을 수 없습니다.');
  }

  questions[index] = updatedQuestion;
  try {
    const jsonData = JSON.stringify(questions);
    localStorage.setItem(QUESTIONS_KEY, jsonData);
    console.log(`✅ 문제 수정 (LocalStorage): ${question}`);
  } catch (error) {
    console.error('❌ 문제 수정 실패:', error);
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      alert('❌ 저장 공간이 부족합니다. 브라우저의 로컬 스토리지를 정리해주세요.');
    } else {
      alert('❌ 문제 수정에 실패했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
    }
    throw error;
  }
  return questions[index];
}

/**
 * 문제 삭제
 */
export async function deleteQuestion(id: number): Promise<void> {
  if (USE_GOOGLE_SHEETS) {
    try {
      const success = await deleteQuestionFromSheets(id);
      if (success) {
        console.log(`✅ 문제 삭제 (Google Sheets): ${id}`);
        return;
      }
    } catch (error) {
      console.error('Google Sheets 삭제 실패, LocalStorage 사용:', error);
    }
  }

  // LocalStorage에서 삭제 (백업 또는 Google Sheets 미사용 시)
  const questions = getQuestionsFromLocalStorage();
  const filtered = questions.filter(q => q.id !== id);

  if (filtered.length === questions.length) {
    throw new Error('문제를 찾을 수 없습니다.');
  }

  try {
    const jsonData = JSON.stringify(filtered);
    localStorage.setItem(QUESTIONS_KEY, jsonData);
    console.log(`✅ 문제 삭제 (LocalStorage): ${id}`);
  } catch (error) {
    console.error('❌ 문제 삭제 실패:', error);
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      alert('❌ 저장 공간이 부족합니다. 브라우저의 로컬 스토리지를 정리해주세요.');
    } else {
      alert('❌ 문제 삭제에 실패했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
    }
    throw error;
  }
}

/**
 * TSV 파일 또는 기타 소스에서 문제를 가져와 저장
 */
export async function importQuestions(questions: Question[]): Promise<void> {
  // 정답 유효성 검사
  const invalidQuestions = questions.filter(q => ![1, 2, 3, 4].includes(q.answer));
  if (invalidQuestions.length > 0) {
    throw new Error(`정답이 올바르지 않은 문제가 ${invalidQuestions.length}개 있습니다. 정답은 1, 2, 3, 4 중 하나여야 합니다.`);
  }

  if (USE_GOOGLE_SHEETS) {
    try {
      const success = await bulkAddQuestionsToSheets(questions);
      if (success) {
        console.log(`✅ ${questions.length}개 문제 가져오기 완료 (Google Sheets)`);
        return;
      }
    } catch (error) {
      console.error('Google Sheets 일괄 추가 실패, LocalStorage 사용:', error);
    }
  }

  // LocalStorage에 저장 (백업 또는 Google Sheets 미사용 시)
  try {
    const jsonData = JSON.stringify(questions);
    localStorage.setItem(QUESTIONS_KEY, jsonData);
    console.log(`✅ ${questions.length}개 문제 가져오기 완료 (LocalStorage)`);
  } catch (error) {
    console.error('❌ 문제 가져오기 실패:', error);
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      alert('❌ 저장 공간이 부족합니다. 브라우저의 로컬 스토리지를 정리해주세요.');
    } else {
      alert('❌ 문제 가져오기에 실패했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
    }
    throw error;
  }
}

/**
 * 카테고리별 문제 수 확인
 */
export async function getQuestionCountByCategory(): Promise<Record<string, number>> {
  const questions = await getAllQuestions();
  const counts: Record<string, number> = {
    '전기이론': 0,
    '전기기기': 0,
    '전기설비': 0,
    '주관식': 0,
    '기타': 0,
  };

  questions.forEach(q => {
    if (counts[q.category] !== undefined) {
      counts[q.category]++;
    }
  });

  return counts;
}

/**
 * LocalStorage 데이터를 Google Sheets로 마이그레이션
 */
export async function migrateLocalStorageToSheets(): Promise<{
  success: boolean;
  message: string;
  migratedCount?: number;
}> {
  if (!USE_GOOGLE_SHEETS) {
    return {
      success: false,
      message: 'Google Sheets API가 설정되지 않았습니다.',
    };
  }

  try {
    // LocalStorage에서 데이터 가져오기
    const localQuestions = getQuestionsFromLocalStorage();

    if (localQuestions.length === 0) {
      return {
        success: false,
        message: 'LocalStorage에 마이그레이션할 문제가 없습니다.',
      };
    }

    // Google Sheets로 일괄 업로드
    const success = await bulkAddQuestionsToSheets(localQuestions);

    if (success) {
      return {
        success: true,
        message: `✅ ${localQuestions.length}개 문제가 Google Sheets로 마이그레이션되었습니다.`,
        migratedCount: localQuestions.length,
      };
    } else {
      return {
        success: false,
        message: 'Google Sheets 업로드에 실패했습니다.',
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `마이그레이션 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
    };
  }
}

/**
 * 동기화 상태 비교
 */
export async function compareSyncStatus(): Promise<{
  localCount: number;
  sheetsCount: number;
  localOnly: number[];
  sheetsOnly: number[];
  recommendation: 'local-to-sheets' | 'sheets-to-local' | 'in-sync' | 'conflict';
  message: string;
}> {
  if (!USE_GOOGLE_SHEETS) {
    return {
      localCount: 0,
      sheetsCount: 0,
      localOnly: [],
      sheetsOnly: [],
      recommendation: 'in-sync',
      message: 'Google Sheets API가 설정되지 않았습니다.',
    };
  }

  try {
    // 양쪽 데이터 가져오기
    const localQuestions = getQuestionsFromLocalStorage();
    const sheetsQuestions = await getAllQuestionsFromSheets();

    const localIds = new Set(localQuestions.map(q => q.id));
    const sheetsIds = new Set(sheetsQuestions.map(q => q.id));

    // 차이점 분석
    const localOnly = localQuestions.filter(q => !sheetsIds.has(q.id)).map(q => q.id);
    const sheetsOnly = sheetsQuestions.filter(q => !localIds.has(q.id)).map(q => q.id);

    // 동기화 방향 추천
    let recommendation: 'local-to-sheets' | 'sheets-to-local' | 'in-sync' | 'conflict';
    let message: string;

    if (localOnly.length === 0 && sheetsOnly.length === 0) {
      recommendation = 'in-sync';
      message = '✅ LocalStorage와 Google Sheets가 동기화되어 있습니다.';
    } else if (localOnly.length > 0 && sheetsOnly.length === 0) {
      recommendation = 'local-to-sheets';
      message = `📤 관리자 페이지(LocalStorage)에 ${localOnly.length}개의 새로운 문제가 있습니다.\nGoogle Sheets로 동기화할까요?`;
    } else if (localOnly.length === 0 && sheetsOnly.length > 0) {
      recommendation = 'sheets-to-local';
      message = `📥 Google Sheets에 ${sheetsOnly.length}개의 새로운 문제가 있습니다.\n관리자 페이지로 동기화할까요?`;
    } else {
      recommendation = 'conflict';
      message = `⚠️ 양쪽에 서로 다른 데이터가 있습니다.\n- LocalStorage 전용: ${localOnly.length}개\n- Google Sheets 전용: ${sheetsOnly.length}개\n\n어느 쪽으로 동기화할까요?`;
    }

    return {
      localCount: localQuestions.length,
      sheetsCount: sheetsQuestions.length,
      localOnly,
      sheetsOnly,
      recommendation,
      message,
    };
  } catch (error) {
    return {
      localCount: 0,
      sheetsCount: 0,
      localOnly: [],
      sheetsOnly: [],
      recommendation: 'in-sync',
      message: `동기화 상태 확인 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
    };
  }
}

/**
 * Google Sheets → LocalStorage 동기화
 */
export async function syncFromSheetsToLocal(): Promise<{
  success: boolean;
  message: string;
  syncedCount?: number;
}> {
  if (!USE_GOOGLE_SHEETS) {
    return {
      success: false,
      message: 'Google Sheets API가 설정되지 않았습니다.',
    };
  }

  try {
    // 기존 데이터 백업 (안전장치)
    let backupData: string | null = null;
    try {
      backupData = localStorage.getItem(QUESTIONS_KEY);
      if (backupData) {
        const backupKey = QUESTIONS_KEY + '_backup_before_sync_' + Date.now();
        localStorage.setItem(backupKey, backupData);
        console.log(`⚠️ 동기화 전 기존 데이터를 ${backupKey}에 백업했습니다.`);
      }
    } catch (e) {
      console.warn('백업 생성 실패 (계속 진행):', e);
    }

    const sheetsQuestions = await getAllQuestionsFromSheets();

    // 데이터 유효성 검사
    if (!Array.isArray(sheetsQuestions)) {
      console.error('❌ Google Sheets에서 가져온 데이터가 배열이 아닙니다.');
      // 백업 데이터 복원 시도
      if (backupData) {
        try {
          localStorage.setItem(QUESTIONS_KEY, backupData);
          console.log('⚠️ 백업 데이터로 복원했습니다.');
        } catch (e) {
          console.error('복원 실패:', e);
        }
      }
      return {
        success: false,
        message: 'Google Sheets에서 가져온 데이터 형식이 올바르지 않습니다.',
      };
    }

    if (sheetsQuestions.length === 0) {
      // 빈 배열이면 기존 데이터 유지
      if (backupData) {
        console.log('⚠️ Google Sheets에 데이터가 없어 기존 데이터를 유지합니다.');
        return {
          success: false,
          message: 'Google Sheets에 동기화할 문제가 없습니다. 기존 데이터를 유지합니다.',
        };
      }
      return {
        success: false,
        message: 'Google Sheets에 동기화할 문제가 없습니다.',
      };
    }

    // LocalStorage에 저장 (완전 교체)
    try {
      const jsonData = JSON.stringify(sheetsQuestions);
      localStorage.setItem(QUESTIONS_KEY, jsonData);
      console.log(`✅ Google Sheets에서 ${sheetsQuestions.length}개 문제를 가져왔습니다.`);
    } catch (error) {
      console.error('❌ 동기화 저장 실패:', error);
      // 백업 데이터 복원 시도
      if (backupData) {
        try {
          localStorage.setItem(QUESTIONS_KEY, backupData);
          console.log('⚠️ 저장 실패로 백업 데이터로 복원했습니다.');
        } catch (e) {
          console.error('복원 실패:', e);
        }
      }
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        return {
          success: false,
          message: '❌ 저장 공간이 부족합니다. 브라우저의 로컬 스토리지를 정리해주세요.',
        };
      }
      throw error;
    }

    return {
      success: true,
      message: `✅ Google Sheets에서 ${sheetsQuestions.length}개 문제를 가져왔습니다.`,
      syncedCount: sheetsQuestions.length,
    };
  } catch (error) {
    return {
      success: false,
      message: `동기화 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
    };
  }
}

/**
 * LocalStorage → Google Sheets 동기화
 */
export async function syncFromLocalToSheets(): Promise<{
  success: boolean;
  message: string;
  syncedCount?: number;
}> {
  if (!USE_GOOGLE_SHEETS) {
    return {
      success: false,
      message: 'Google Sheets API가 설정되지 않았습니다.',
    };
  }

  try {
    const localQuestions = getQuestionsFromLocalStorage();

    if (localQuestions.length === 0) {
      return {
        success: false,
        message: 'LocalStorage에 동기화할 문제가 없습니다.',
      };
    }

    // Google Sheets로 일괄 업로드 (기존 데이터는 Apps Script에서 처리)
    const success = await bulkAddQuestionsToSheets(localQuestions);

    if (success) {
      return {
        success: true,
        message: `✅ LocalStorage에서 ${localQuestions.length}개 문제를 Google Sheets로 동기화했습니다.`,
        syncedCount: localQuestions.length,
      };
    } else {
      return {
        success: false,
        message: 'Google Sheets 업로드에 실패했습니다.',
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `동기화 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
    };
  }
}

/**
 * 3개 영역에서 균등하게 랜덤 문제 선택
 * - 전기이론, 전기기기, 전기설비에서 각각 questionsPerCategory개씩 선택
 * - 총 totalCount개 문제 반환
 */
export async function selectBalancedRandomQuestions(
  totalCount: number = 60
): Promise<Question[]> {
  const allQuestions = await getAllQuestions();

  // 카테고리별로 문제 분류
  const categories = {
    전기이론: allQuestions.filter(q => q.category === '전기이론'),
    전기기기: allQuestions.filter(q => q.category === '전기기기'),
    전기설비: allQuestions.filter(q => q.category === '전기설비'),
  };

  // 각 카테고리에서 선택할 문제 수 (균등 분배)
  const questionsPerCategory = Math.floor(totalCount / 3);
  const selectedQuestions: Question[] = [];

  // 각 카테고리에서 랜덤으로 문제 선택
  Object.entries(categories).forEach(([category, questions]) => {
    if (questions.length === 0) {
      console.warn(`⚠️ ${category} 카테고리에 문제가 없습니다.`);
      return;
    }

    // Fisher-Yates 셔플 알고리즘으로 랜덤 선택
    const shuffled = [...questions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // 필요한 만큼만 선택
    const selected = shuffled.slice(0, Math.min(questionsPerCategory, shuffled.length));
    selectedQuestions.push(...selected);

    console.log(`✅ ${category}: ${selected.length}/${questions.length}개 문제 선택`);
  });

  // 부족한 경우 남은 문제에서 랜덤 선택
  if (selectedQuestions.length < totalCount) {
    const remaining = totalCount - selectedQuestions.length;
    const selectedIds = new Set(selectedQuestions.map(q => q.id));
    const remainingQuestions = allQuestions.filter(q => !selectedIds.has(q.id));

    // 랜덤 셔플
    const shuffled = [...remainingQuestions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const extra = shuffled.slice(0, Math.min(remaining, shuffled.length));
    selectedQuestions.push(...extra);
    console.log(`✅ 추가: ${extra.length}개 문제 선택 (총 ${selectedQuestions.length}/${totalCount})`);
  }

  // 최종 셔플 (순서 무작위화)
  for (let i = selectedQuestions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [selectedQuestions[i], selectedQuestions[j]] = [selectedQuestions[j], selectedQuestions[i]];
  }

  console.log(`🎯 총 ${selectedQuestions.length}개 문제 선택 완료`);
  return selectedQuestions;
}

/**
 * 빈 ID를 가진 문제들에게 자동으로 ID 부여
 */
export async function assignMissingIds(): Promise<{
  success: boolean;
  message: string;
  assignedCount: number;
}> {
  const questions = getQuestionsFromLocalStorage();

  // ID가 없거나 0인 문제들 찾기
  const questionsWithoutId = questions.filter(q => !q.id || q.id === 0);

  if (questionsWithoutId.length === 0) {
    return {
      success: true,
      message: '모든 문제에 이미 ID가 부여되어 있습니다.',
      assignedCount: 0,
    };
  }

  // 기존 ID들 중 최대값 찾기
  const existingIds = questions
    .filter(q => q.id && q.id > 0)
    .map(q => q.id);
  const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;

  // 빈 ID에 순차적으로 ID 부여
  let nextId = maxId + 1;
  let assignedCount = 0;

  questions.forEach(q => {
    if (!q.id || q.id === 0) {
      q.id = nextId;
      nextId++;
      assignedCount++;
    }
  });

  // LocalStorage에 저장
  try {
    const jsonData = JSON.stringify(questions);
    localStorage.setItem(QUESTIONS_KEY, jsonData);
    console.log(`✅ ${assignedCount}개 문제에 ID 부여 완료 (${maxId + 1} ~ ${nextId - 1})`);
  } catch (error) {
    console.error('❌ ID 부여 저장 실패:', error);
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      throw new Error('저장 공간이 부족합니다. 브라우저의 로컬 스토리지를 정리해주세요.');
    }
    throw error;
  }

  return {
    success: true,
    message: `✅ ${assignedCount}개 문제에 ID가 부여되었습니다.`,
    assignedCount,
  };
}
