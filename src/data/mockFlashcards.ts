import type { Flashcard } from '../types';

/**
 * Mock 데이터: 플래시카드 5개
 * UI 개발 및 테스트용 샘플 데이터
 * 실제 데이터는 Supabase flashcards 테이블에서 로드
 */
export const mockFlashcards: Flashcard[] = [
    {
        id: 1,
        no: 1,
        category: '전기설비',
        question: '조명용 배결 전등을 일반 주택 및 아파트 각 호실에 설치할 때 현관 등은 최대 몇 분 이내에 소등되는 꺼지는 타임 스위치를 시설해야 되는가?',
        answer_keyword: '3분',
        explanation: '일반 주택 및 아파트 현관 등 타임 스위치 소등 시간: 3분 (관광 및 숙박 시설은 1분)',
    },
    {
        id: 2,
        no: 2,
        category: '전기설비',
        question: '다음 중 과전류 차단기를 시설해야 할 것은?',
        answer_keyword: '인입선',
        explanation: '과전류 차단기 시설 제한 장소 (접다접): 접지선, 다선식 전로의 중성선, 저압 가공 전로의 접지측 전선. 시설해야 하는 곳은 인입선이다.',
    },
    {
        id: 3,
        no: 7,
        category: '전기설비',
        question: '금속관 끝에 나사를 내는 공구는?',
        answer_keyword: '오스터',
        explanation: '금속관 끝에 나사를 낼 때 사용하는 공구는 오스터이다.',
    },
    {
        id: 4,
        no: 15,
        category: '전기기기',
        question: '자연 공기 내에서 개방할 때 접촉자가 떨어지면서 자연 소호된다. 자연 소호되는 방식을 가진 차단기로 저압의 교류 또는 직류 차단기로 많이 사용되는 것은?',
        answer_keyword: '기중 차단기 (ACB)',
        explanation: '자연 소호 방식을 사용하는 차단기는 **기중 차단기(Air Circuit Breaker)**이다.',
    },
    {
        id: 5,
        no: 16,
        category: '전기설비',
        question: '단면적 6제곱mm의 가는 전선의 직선 접속 방법은?',
        answer_keyword: '트위스트 접속',
        explanation: '6mm 이하의 가는 단선 직선 접속에는 트위스트 접속을 사용한다. (10mm 이상은 브리타니어 접속)',
    },
];
