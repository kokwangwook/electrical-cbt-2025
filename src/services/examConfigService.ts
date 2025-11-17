import type { ExamConfig } from '../types';

const EXAM_CONFIG_KEY = 'examConfig';

/**
 * 기본 출제 설정
 */
const DEFAULT_CONFIG: ExamConfig = {
  weightBasedEnabled: false,
  selectedWeights: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], // 모든 가중치 선택
  weightRatios: {},
  mode: 'filter',
};

/**
 * 출제 설정 불러오기
 */
export function getExamConfig(): ExamConfig {
  try {
    console.log('🔍 getExamConfig 호출됨');
    const data = localStorage.getItem(EXAM_CONFIG_KEY);
    console.log('📦 localStorage 키:', EXAM_CONFIG_KEY);
    console.log('📦 localStorage 원본 데이터:', data);
    
    if (!data) {
      console.log('⚠️ localStorage에 데이터 없음 - DEFAULT_CONFIG 반환');
      console.log('📋 DEFAULT_CONFIG:', DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    }
    
    const parsed = JSON.parse(data);
    console.log('✅ 파싱된 config:', parsed);
    console.log('✅ weightBasedEnabled:', parsed.weightBasedEnabled);
    console.log('✅ selectedWeights:', parsed.selectedWeights);
    return parsed;
  } catch (error) {
    console.error('❌ 출제 설정 불러오기 실패:', error);
    console.log('📋 에러 발생 - DEFAULT_CONFIG 반환:', DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }
}

/**
 * 출제 설정 저장
 */
export function saveExamConfig(config: ExamConfig): void {
  try {
    localStorage.setItem(EXAM_CONFIG_KEY, JSON.stringify(config));
    console.log('✅ 출제 설정 저장 완료');
  } catch (error) {
    console.error('❌ 출제 설정 저장 실패:', error);
    throw error;
  }
}

/**
 * 출제 설정 초기화
 */
export function resetExamConfig(): void {
  saveExamConfig(DEFAULT_CONFIG);
  console.log('✅ 출제 설정 초기화 완료');
}
