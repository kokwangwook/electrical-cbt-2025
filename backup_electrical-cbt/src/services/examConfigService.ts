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
    const data = localStorage.getItem(EXAM_CONFIG_KEY);
    if (!data) {
      return DEFAULT_CONFIG;
    }
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ 출제 설정 불러오기 실패:', error);
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
