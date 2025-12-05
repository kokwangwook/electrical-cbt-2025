// Supabase Service - 서버에서 직접 문제 가져오기
import { supabase } from './supabaseClient';
import type { Flashcard } from '../types';
// ==========================================

// TSV 파일에서 플래시카드 로드
export const loadFlashcardsFromTSV = async (): Promise<Flashcard[]> => {
    try {
        const response = await fetch('/hongong.tsv');
        if (!response.ok) {
            throw new Error('데이터 파일을 찾을 수 없습니다.');
        }

        const text = await response.text();
        const lines = text.split('\n');

        // 헤더 제외하고 데이터 파싱
        const flashcards: Flashcard[] = lines
            .slice(1) // 헤더 건너뛰기
            .filter(line => line.trim() !== '') // 빈 줄 제외
            .map((line, index) => {
                const cols = line.split('\t');
                // TSV 컬럼: 시간, No, 카테고리, 문제 전문, 정답 키워드, 해설 및 암기 팁
                return {
                    id: index + 1,
                    no: parseInt(cols[1]) || index + 1,
                    category: cols[2] || '기타',
                    question: cols[3] || '',
                    answer_keyword: cols[4] || '',
                    explanation: cols[5] || ''
                };
            })
            .filter(card => card.question && card.answer_keyword); // 유효한 데이터만 필터링

        console.log(`✅ TSV 데이터 로드 완료: ${flashcards.length}개`);
        return flashcards;
    } catch (error) {
        console.error('플래시카드 로드 실패:', error);
        return [];
    }
};

/**
 * 모든 플래시카드 가져오기 (Supabase -> TSV로 변경)
 */
export const fetchAllFlashcards = async (): Promise<Flashcard[]> => {
    // 우선 TSV 파일에서 로드 시도
    const tsvData = await loadFlashcardsFromTSV();
    if (tsvData.length > 0) {
        return tsvData;
    }

    // 실패 시 기존 로직 (Supabase)
    try {
        const { data, error } = await supabase
            .from('flashcards')
            .select('*')
            .order('no', { ascending: true });

        if (error) {
            console.error('Supabase 플래시카드 조회 실패:', error);
            return [];
        }

        return data || [];
    } catch (err) {
        console.error('플래시카드 조회 오류:', err);
        return [];
    }
};

/**
 * 카테고리별 플래시카드 가져오기
 */
export const fetchFlashcardsByCategory = async (category: string): Promise<Flashcard[]> => {
    try {
        const { data, error } = await supabase
            .from('flashcards')
            .select('*')
            .eq('category', category)
            .order('no', { ascending: true });

        if (error) {
            console.error(`${category} 플래시카드 조회 실패:`, error);
            return [];
        }

        console.log(`✅ ${category} 플래시카드 ${data?.length || 0}개 로드 완료`);
        return data || [];
    } catch (err) {
        console.error(`${category} 플래시카드 조회 오류:`, err);
        return [];
    }
};
