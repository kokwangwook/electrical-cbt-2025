import { useState, useEffect, useCallback } from 'react';
import type { Feedback } from '../types';
import { getFeedbacks, deleteFeedback } from '../services/storage';
import { getFeedbacksFromSupabase, deleteFeedbackFromSupabase } from '../services/supabaseService';
import { getCurrentUser } from '../services/storage';

interface UseFeedbacksOptions {
  isAdmin?: boolean; // 관리자 모드 여부
  filterType?: 'suggestion' | 'bug' | 'question' | 'all'; // 필터링할 타입
}

interface UseFeedbacksReturn {
  feedbacks: Feedback[];
  allFeedbacksCount: { bug: number; suggestion: number; question: number };
  loading: boolean;
  error: string | null;
  loadFeedbacks: () => Promise<void>;
  deleteFeedbackItem: (id: number) => Promise<boolean>;
}

export function useFeedbacks(options: UseFeedbacksOptions = {}): UseFeedbacksReturn {
  const { isAdmin = false, filterType = 'all' } = options;

  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [allFeedbacksCount, setAllFeedbacksCount] = useState<{ bug: number; suggestion: number; question: number }>({
    bug: 0,
    suggestion: 0,
    question: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFeedbacks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Supabase에서 먼저 시도
      const supabaseResult = await getFeedbacksFromSupabase();
      let allFeedbacks: Feedback[];

      if (supabaseResult.success) {
        allFeedbacks = supabaseResult.data;
        console.log('✅ Supabase에서 제보 로드:', allFeedbacks.length, '개');
      } else {
        // Supabase 실패 시 로컬에서 로드
        console.warn('⚠️ Supabase 조회 실패, 로컬에서 로드:', supabaseResult.error);
        allFeedbacks = getFeedbacks();
        console.log('📦 로컬에서 제보 로드:', allFeedbacks.length, '개');
      }

      // 전체 개수 업데이트
      setAllFeedbacksCount({
        bug: allFeedbacks.filter(f => f.type === 'bug').length,
        suggestion: allFeedbacks.filter(f => f.type === 'suggestion').length,
        question: allFeedbacks.filter(f => f.type === 'question').length,
      });

      // 관리자가 아닌 경우, 자신의 제보만 필터링
      let filteredFeedbacks = allFeedbacks;
      if (!isAdmin) {
        const currentUserId = getCurrentUser();
        if (currentUserId) {
          filteredFeedbacks = allFeedbacks.filter(f => f.userId === currentUserId);
        } else {
          // 비로그인 사용자는 제보 목록을 볼 수 없음
          filteredFeedbacks = [];
        }
      }

      // 타입별 필터링
      if (filterType !== 'all') {
        filteredFeedbacks = filteredFeedbacks.filter(f => f.type === filterType);
      }

      setFeedbacks(filteredFeedbacks);
    } catch (err) {
      console.error('제보 로드 실패:', err);
      setError('제보를 불러오는데 실패했습니다.');

      // 오류 시 로컬에서 로드
      const localFeedbacks = getFeedbacks();
      setAllFeedbacksCount({
        bug: localFeedbacks.filter(f => f.type === 'bug').length,
        suggestion: localFeedbacks.filter(f => f.type === 'suggestion').length,
        question: localFeedbacks.filter(f => f.type === 'question').length,
      });

      let filteredFeedbacks = localFeedbacks;
      if (!isAdmin) {
        const currentUserId = getCurrentUser();
        if (currentUserId) {
          filteredFeedbacks = localFeedbacks.filter(f => f.userId === currentUserId);
        } else {
          filteredFeedbacks = [];
        }
      }

      if (filterType !== 'all') {
        filteredFeedbacks = filteredFeedbacks.filter(f => f.type === filterType);
      }

      setFeedbacks(filteredFeedbacks);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, filterType]);

  const deleteFeedbackItem = useCallback(async (id: number): Promise<boolean> => {
    try {
      // Supabase와 로컬 모두에서 삭제 시도 (동기화 문제 해결)
      const supabaseSuccess = await deleteFeedbackFromSupabase(id);

      // Supabase 성공 여부와 관계없이 로컬에서도 삭제 (동기화 보장)
      deleteFeedback(id);

      if (supabaseSuccess) {
        console.log('✅ Supabase 및 로컬에서 제보 삭제 완료:', id);
      } else {
        console.log('⚠️ Supabase 삭제 실패, 로컬에서만 삭제:', id);
      }

      // 목록 새로고침
      await loadFeedbacks();
      return true;
    } catch (err) {
      console.error('제보 삭제 실패:', err);
      setError('제보 삭제에 실패했습니다.');
      return false;
    }
  }, [loadFeedbacks]);

  // 초기 로드
  useEffect(() => {
    loadFeedbacks();
  }, [loadFeedbacks]);

  return {
    feedbacks,
    allFeedbacksCount,
    loading,
    error,
    loadFeedbacks,
    deleteFeedbackItem,
  };
}
