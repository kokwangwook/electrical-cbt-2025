import type { Question, ExamConfig } from '../types';

/**
 * 가중치 기반 랜덤 출제 서비스
 *
 * 가중치 의미:
 * - 1: 최고 빈도 (가장 많이 출제)
 * - 10: 최저 빈도 (가장 적게 출제)
 * - 역 가중치 R_i = 11 - W_i를 사용하여 확률 계산
 */

/**
 * 가중치를 역 가중치로 변환
 * @param weight 원본 가중치 (1~10)
 * @returns 역 가중치 (1~10, 높을수록 선택 확률 높음)
 */
function getReversedWeight(weight: number | undefined): number {
  if (!weight || weight < 1 || weight > 10) {
    return 5; // 기본값: 중간 가중치
  }
  return 11 - weight;
}

/**
 * 가중치 기반 랜덤 선택
 * @param questions 문제 배열
 * @param count 선택할 문제 수
 * @param config 출제 설정
 * @returns 선택된 문제 배열
 */
export function selectQuestionsByWeight(
  questions: Question[],
  count: number,
  config: ExamConfig
): Question[] {
  // 가중치 기반 출제가 비활성화된 경우, 일반 랜덤 선택
  if (!config.weightBasedEnabled) {
    return selectRandomQuestions(questions, count);
  }

  // 필터 모드: 선택된 가중치만
  if (config.mode === 'filter') {
    return selectByWeightFilter(questions, count, config.selectedWeights);
  }

  // 비율 모드: 가중치별 비율 할당
  if (config.mode === 'ratio' && config.weightRatios) {
    return selectByWeightRatio(questions, count, config.weightRatios);
  }

  // 기본: 일반 랜덤 선택
  return selectRandomQuestions(questions, count);
}

/**
 * 일반 랜덤 선택 (가중치 무시)
 */
function selectRandomQuestions(questions: Question[], count: number): Question[] {
  const shuffled = [...questions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * 가중치 필터 모드: 선택된 가중치의 문제만 랜덤 선택
 */
function selectByWeightFilter(
  questions: Question[],
  count: number,
  selectedWeights: number[]
): Question[] {
  // 선택된 가중치에 해당하는 문제만 필터링
  const filteredQuestions = questions.filter(q => {
    const weight = q.weight || 5; // 기본값: 5
    return selectedWeights.includes(weight);
  });

  if (filteredQuestions.length === 0) {
    console.warn('⚠️ 선택된 가중치에 해당하는 문제가 없습니다. 모든 문제에서 선택합니다.');
    return selectRandomQuestions(questions, count);
  }

  // 필터링된 문제 중에서 가중치 기반 랜덤 선택
  return weightedRandomSelection(filteredQuestions, count);
}

/**
 * 가중치 비율 모드: 가중치별 정확한 비율로 문제 선택
 */
function selectByWeightRatio(
  questions: Question[],
  count: number,
  weightRatios: { [weight: number]: number }
): Question[] {
  const selectedQuestions: Question[] = [];

  // 각 가중치별로 문제 그룹화
  const questionsByWeight: { [weight: number]: Question[] } = {};
  questions.forEach(q => {
    const weight = q.weight || 5;
    if (!questionsByWeight[weight]) {
      questionsByWeight[weight] = [];
    }
    questionsByWeight[weight].push(q);
  });

  // 각 가중치별로 비율에 맞게 문제 선택
  Object.entries(weightRatios).forEach(([weightStr, ratio]) => {
    const weight = parseInt(weightStr);
    const targetCount = Math.round((count * ratio) / 100);
    const availableQuestions = questionsByWeight[weight] || [];

    if (availableQuestions.length === 0) {
      console.warn(`⚠️ 가중치 ${weight}에 해당하는 문제가 없습니다.`);
      return;
    }

    // 해당 가중치에서 targetCount만큼 선택
    const selected = weightedRandomSelection(availableQuestions, targetCount);
    selectedQuestions.push(...selected);
  });

  // 부족한 경우 나머지 문제에서 추가 선택
  if (selectedQuestions.length < count) {
    const remaining = count - selectedQuestions.length;
    const selectedIds = new Set(selectedQuestions.map(q => q.id));
    const remainingQuestions = questions.filter(q => !selectedIds.has(q.id));
    const additional = weightedRandomSelection(remainingQuestions, remaining);
    selectedQuestions.push(...additional);
  }

  // 최종 셔플
  for (let i = selectedQuestions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [selectedQuestions[i], selectedQuestions[j]] = [selectedQuestions[j], selectedQuestions[i]];
  }

  return selectedQuestions.slice(0, count);
}

/**
 * 가중치 기반 랜덤 선택 (Weighted Random Selection)
 * 역 가중치 R_i = 11 - W_i를 사용
 */
function weightedRandomSelection(questions: Question[], count: number): Question[] {
  if (questions.length === 0) {
    return [];
  }

  if (count >= questions.length) {
    return [...questions];
  }

  const selected: Question[] = [];
  const remaining = [...questions];

  for (let i = 0; i < count && remaining.length > 0; i++) {
    // 각 문제의 역 가중치 계산
    const weights = remaining.map(q => getReversedWeight(q.weight));

    // 역 가중치의 총합
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    // 랜덤 값 생성 (0 ~ totalWeight)
    let random = Math.random() * totalWeight;

    // 가중치 기반 선택
    let selectedIndex = 0;
    for (let j = 0; j < weights.length; j++) {
      random -= weights[j];
      if (random <= 0) {
        selectedIndex = j;
        break;
      }
    }

    // 선택된 문제 추가 및 제거
    selected.push(remaining[selectedIndex]);
    remaining.splice(selectedIndex, 1);
  }

  return selected;
}

/**
 * 카테고리별 가중치 기반 랜덤 선택
 * @param allQuestions 전체 문제 배열
 * @param category 카테고리명
 * @param count 선택할 문제 수
 * @param config 출제 설정
 * @returns 선택된 문제 배열
 */
export function selectCategoryQuestionsByWeight(
  allQuestions: Question[],
  category: string,
  count: number,
  config: ExamConfig
): Question[] {
  // 반드시 불포함 문제 제외
  const availableQuestions = allQuestions.filter(q => !q.mustExclude);
  const categoryQuestions = availableQuestions.filter(q => q.category === category);
  return selectQuestionsByWeight(categoryQuestions, count, config);
}

/**
 * 균등 배분 + 가중치 기반 랜덤 선택
 * 각 카테고리에서 questionsPerCategory개씩 선택 (총 60문제)
 * 반드시 포함 문제는 우선 선택
 */
export function selectBalancedQuestionsByWeight(
  allQuestions: Question[],
  totalCount: number = 60,
  config: ExamConfig
): Question[] {
  const categories = ['전기이론', '전기기기', '전기설비'];
  const questionsPerCategory = Math.floor(totalCount / 3);
  const selected: Question[] = [];
  const selectedIds = new Set<number>();

  // 0단계: 반드시 불포함 문제 제외
  const availableQuestions = allQuestions.filter(q => !q.mustExclude);
  console.log(`🚫 반드시 불포함 문제: ${allQuestions.length - availableQuestions.length}개 제외`);

  // 1단계: 반드시 포함 문제 먼저 선택
  const mustIncludeQuestions = availableQuestions.filter(q => q.mustInclude);
  
  if (mustIncludeQuestions.length > totalCount) {
    console.warn(`⚠️ 반드시 포함 문제(${mustIncludeQuestions.length}개)가 목표 문제 수(${totalCount}개)를 초과합니다. 모든 반드시 포함 문제가 포함됩니다.`);
  }

  // 반드시 포함 문제는 모두 포함
  selected.push(...mustIncludeQuestions);
  mustIncludeQuestions.forEach(q => selectedIds.add(q.id));

  console.log(`⭐ 반드시 포함 문제: ${mustIncludeQuestions.length}개 선택`);

  // 2단계: 각 카테고리에서 나머지 문제를 가중치 기반으로 선택
  categories.forEach(category => {
    const categoryQuestions = availableQuestions.filter(
      q => q.category === category && !selectedIds.has(q.id)
    );

    if (categoryQuestions.length === 0) {
      console.warn(`⚠️ ${category} 카테고리에 선택 가능한 문제가 없습니다.`);
      return;
    }

    // 카테고리별 목표 개수 계산 (반드시 포함 문제 제외)
    const categorySelectedCount = selected.filter(q => q.category === category).length;
    const targetCount = questionsPerCategory - categorySelectedCount;

    if (targetCount > 0) {
      const categorySelected = selectQuestionsByWeight(
        categoryQuestions,
        targetCount,
        config
      );

      selected.push(...categorySelected);
      categorySelected.forEach(q => selectedIds.add(q.id));
      console.log(`✅ ${category}: ${categorySelected.length}개 문제 선택 (가중치 기반)`);
    }
  });

  // 3단계: 부족한 경우 추가 선택
  if (selected.length < totalCount) {
    const remaining = totalCount - selected.length;
    const remainingQuestions = availableQuestions.filter(q => !selectedIds.has(q.id));
    const additional = selectQuestionsByWeight(remainingQuestions, remaining, config);
    selected.push(...additional);
    console.log(`✅ 추가: ${additional.length}개 문제 선택`);
  }

  // 4단계: 최종 셔플 (반드시 포함 문제는 유지하되 순서만 섞기)
  for (let i = selected.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [selected[i], selected[j]] = [selected[j], selected[i]];
  }

  console.log(`🎯 총 ${selected.length}개 문제 선택 완료 (반드시 포함: ${mustIncludeQuestions.length}개 포함)`);
  return selected.slice(0, totalCount);
}
