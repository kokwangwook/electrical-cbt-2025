// Supabase Migration Service
import { supabase } from './supabaseClient';
import { getQuestions } from './storage';
import type { Question } from '../types';

export interface MigrationProgress {
  total: number;
  current: number;
  status: 'idle' | 'running' | 'success' | 'error';
  message: string;
}

export interface MigrationResult {
  success: boolean;
  totalMigrated: number;
  errors: string[];
}

// Supabase 연결 테스트
export const testSupabaseConnection = async (): Promise<boolean> => {
  try {
    const { error } = await supabase.from('questions').select('count', { count: 'exact', head: true });
    if (error) {
      console.error('Supabase 연결 실패:', error);
      return false;
    }
    console.log('✅ Supabase 연결 성공');
    return true;
  } catch (err) {
    console.error('Supabase 연결 오류:', err);
    return false;
  }
};

// Supabase에서 현재 문제 수 가져오기
export const getSupabaseQuestionCount = async (): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('문제 수 조회 실패:', error);
      return 0;
    }

    return count || 0;
  } catch (err) {
    console.error('문제 수 조회 오류:', err);
    return 0;
  }
};

// localStorage 문제를 Supabase로 이전
export const migrateQuestionsToSupabase = async (
  onProgress?: (progress: MigrationProgress) => void
): Promise<MigrationResult> => {
  const errors: string[] = [];
  let totalMigrated = 0;

  try {
    // 1. localStorage에서 문제 가져오기
    const localQuestions = getQuestions();

    if (localQuestions.length === 0) {
      return {
        success: false,
        totalMigrated: 0,
        errors: ['로컬에 이전할 문제가 없습니다.']
      };
    }

    onProgress?.({
      total: localQuestions.length,
      current: 0,
      status: 'running',
      message: `총 ${localQuestions.length}개의 문제를 이전합니다...`
    });

    // 2. 배치 단위로 이전 (Supabase 한도 고려)
    const batchSize = 100;
    const totalBatches = Math.ceil(localQuestions.length / batchSize);

    for (let i = 0; i < totalBatches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, localQuestions.length);
      const batch = localQuestions.slice(start, end);

      onProgress?.({
        total: localQuestions.length,
        current: start,
        status: 'running',
        message: `배치 ${i + 1}/${totalBatches} 처리 중... (${start + 1}~${end}번 문제)`
      });

      // Supabase 형식으로 변환
      const supabaseQuestions = batch.map(q => ({
        id: q.id,
        category: q.category,
        standard: q.standard || null,
        detailItem: q.detailItem || null,
        question: q.question,
        option1: q.option1,
        option2: q.option2,
        option3: q.option3,
        option4: q.option4,
        answer: q.answer,
        explanation: q.explanation,
        imageUrl: q.imageUrl || null,
        hasImage: q.hasImage || false,
        mustInclude: q.mustInclude || false,
        mustExclude: q.mustExclude || false,
        weight: q.weight || 5,
        source: q.source || null
      }));

      // Upsert (중복 시 업데이트)
      const { error } = await supabase
        .from('questions')
        .upsert(supabaseQuestions, { onConflict: 'id' });

      if (error) {
        console.error(`배치 ${i + 1} 오류:`, error);
        errors.push(`배치 ${i + 1} 오류: ${error.message}`);
      } else {
        totalMigrated += batch.length;
      }

      // 속도 제한을 위한 딜레이
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    onProgress?.({
      total: localQuestions.length,
      current: localQuestions.length,
      status: errors.length === 0 ? 'success' : 'error',
      message: errors.length === 0
        ? `✅ ${totalMigrated}개의 문제를 성공적으로 이전했습니다!`
        : `⚠️ ${totalMigrated}개 이전 완료, ${errors.length}개 오류 발생`
    });

    return {
      success: errors.length === 0,
      totalMigrated,
      errors
    };

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류';
    console.error('이전 중 오류:', err);

    onProgress?.({
      total: 0,
      current: 0,
      status: 'error',
      message: `❌ 이전 실패: ${errorMessage}`
    });

    return {
      success: false,
      totalMigrated,
      errors: [...errors, errorMessage]
    };
  }
};

// Supabase의 모든 문제 삭제 (주의: 위험한 작업)
export const clearSupabaseQuestions = async (): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('questions')
      .delete()
      .neq('id', 0); // 모든 문제 삭제

    if (error) {
      console.error('문제 삭제 실패:', error);
      return false;
    }

    console.log('✅ Supabase 문제 삭제 완료');
    return true;
  } catch (err) {
    console.error('문제 삭제 오류:', err);
    return false;
  }
};

// Supabase에서 문제 가져오기
export const fetchQuestionsFromSupabase = async (): Promise<Question[]> => {
  try {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('문제 조회 실패:', error);
      return [];
    }

    // Supabase 형식을 로컬 형식으로 변환
    return (data || []).map(q => ({
      id: q.id,
      category: q.category,
      standard: q.standard || undefined,
      detailItem: q.detailItem || undefined,
      question: q.question,
      option1: q.option1,
      option2: q.option2,
      option3: q.option3,
      option4: q.option4,
      answer: q.answer,
      explanation: q.explanation,
      imageUrl: q.imageUrl || undefined,
      hasImage: q.hasImage || false,
      mustInclude: q.mustInclude || false,
      mustExclude: q.mustExclude || false,
      weight: q.weight || 5,
      source: q.source || undefined
    }));
  } catch (err) {
    console.error('문제 조회 오류:', err);
    return [];
  }
};

// Supabase 사용량 통계
export interface SupabaseUsageStats {
  questionsCount: number;
  categoryCounts: {
    전기이론: number;
    전기기기: number;
    전기설비: number;
  };
  estimatedSizeKB: number;
  lastUpdated: string;
}

export const getSupabaseUsageStats = async (): Promise<SupabaseUsageStats | null> => {
  try {
    // 전체 문제 수
    const { count: totalCount, error: countError } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('사용량 조회 실패:', countError);
      return null;
    }

    // 카테고리별 문제 수 (개별 COUNT 쿼리로 1000행 제한 우회)
    const [theoryResult, machineResult, facilityResult] = await Promise.all([
      supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('category', '전기이론'),
      supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('category', '전기기기'),
      supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('category', '전기설비')
    ]);

    if (theoryResult.error || machineResult.error || facilityResult.error) {
      console.error('카테고리 조회 실패:', {
        theory: theoryResult.error,
        machine: machineResult.error,
        facility: facilityResult.error
      });
      return null;
    }

    const categoryCounts = {
      전기이론: theoryResult.count || 0,
      전기기기: machineResult.count || 0,
      전기설비: facilityResult.count || 0
    };

    // 대략적인 데이터 크기 계산 (문제당 평균 1KB로 추정)
    const estimatedSizeKB = Math.round((totalCount || 0) * 1);

    return {
      questionsCount: totalCount || 0,
      categoryCounts,
      estimatedSizeKB,
      lastUpdated: new Date().toLocaleString('ko-KR')
    };
  } catch (err) {
    console.error('사용량 통계 오류:', err);
    return null;
  }
};
