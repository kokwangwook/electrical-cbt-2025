// ========== 문제 (Question) ==========
export interface Question {
  id: number;
  category: string; // '전기이론' | '전기기기' | '전기설비'
  standard?: string; // 출제기준 코드: "1.1", "2.1", "3.1" 등
  detailItem?: string; // 세부항목: "전기의 본질", "변압기의 구조와 원리" 등
  question: string; // 질문 텍스트 (LaTeX 지원)
  option1: string; // 선택지 1
  option2: string; // 선택지 2
  option3: string; // 선택지 3
  option4: string; // 선택지 4
  answer: number; // 정답 번호 (1~4)
  explanation: string; // 해설 (LaTeX 지원)
  imageUrl?: string; // 이미지 URL (선택)
  hasImage?: boolean; // 이미지 영역 확보 여부 (관리자가 체크)
  mustInclude?: boolean; // 반드시 포함 문제 여부 (랜덤 출제 시 항상 포함)
  mustExclude?: boolean; // 반드시 불포함 문제 여부 (랜덤 출제 시 항상 제외)
  weight?: number; // 출제 가중치 (1~10, 1이 최고 빈도, 10이 최저 빈도)
  source?: string; // 문제 출처 (교재명, 기출연도 등)
  helpResourceUrl?: string; // 학습 도움 자료 URL (유튜브 링크 등)
}

// ========== 회원 (Member) ==========
export interface Member {
  id: number; // 회원 고유 ID
  name: string; // 이름
  phone: string; // 전화번호
  email?: string; // 이메일 (선택)
  address: string; // 주소
  memo: string; // 메모
  registeredAt: number; // 가입 시간 (timestamp)
}

// ========== 오답 (WrongAnswer) ==========
export interface WrongAnswer {
  questionId: number; // 문제 ID
  question: Question; // 문제 전체 데이터
  userAnswer: number; // 사용자가 선택한 답 (1~4)
  timestamp: number; // 오답 발생 시간
  wrongCount: number; // 틀린 횟수 누적
  correctStreak: number; // 연속 정답 횟수
}

// ========== 시험 세션 (ExamSession) ==========
export interface ExamSession {
  questions: Question[]; // 시험 문제 배열
  answers: { [key: number]: number }; // 답안 맵 { 문제ID: 선택한답 }
  learningProgress?: { [key: number]: number }; // 학습 진도 맵 { 문제ID: 진도값(1-6) }
  startTime: number; // 시험 시작 시간 (timestamp)
  mode: 'timedRandom' | 'untimedRandom' | 'category' | 'wrong' | 'review'; // 시험 모드
  category?: string; // 카테고리 (category 모드 시)
  userId?: number; // 세션 소유자 ID (사용자별 세션 구분용)
}

// ========== 시험 결과 (ExamResult) ==========
export interface ExamResult {
  totalQuestions: number; // 총 문제 수
  correctAnswers: number; // 정답 개수
  wrongQuestions: Question[]; // 틀린 문제 목록
  allQuestions?: Question[]; // 전체 문제 목록 (통계 계산용)
  timestamp: number; // 시험 완료 시간
  mode: 'timedRandom' | 'untimedRandom' | 'random' | 'category' | 'wrong' | 'review'; // 시험 모드 (random은 이전 버전 호환용)
  category?: string; // 카테고리
}

// ========== 통계 (Statistics) ==========
export interface Statistics {
  totalExams: number; // 총 시험 횟수
  averageScore: number; // 평균 점수
  categoryStats: {
    // 카테고리별 통계
    [category: string]: {
      correct: number; // 정답 수
      total: number; // 전체 문제 수
    };
  };
  recentResults: ExamResult[]; // 최근 시험 결과 배열
}

// ========== 카테고리 ==========
export interface Category {
  id: number;
  name: string;
  description: string;
}

// ========== 피드백 (Feedback) ==========
export interface Feedback {
  id: number; // 피드백 고유 ID
  author: string; // 작성자 이름 (게스트는 "게스트")
  userId?: number; // 작성자 ID (사용자별 제보 내역 조회용)
  content: string; // 피드백 내용
  timestamp: number; // 작성 시간 (timestamp)
  type?: 'suggestion' | 'bug' | 'question'; // 피드백 유형
  questionId?: number; // 문제 ID (오류 제보 시)
  question?: Question; // 문제 정보 (오류 제보 시)
}

// ========== 출제 설정 (ExamConfig) ==========
export interface ExamConfig {
  weightBasedEnabled: boolean; // 가중치 기반 출제 활성화 여부
  selectedWeights: number[]; // 출제 대상 가중치 (1~10)
  weightRatios?: { [weight: number]: number }; // 가중치별 출제 비율 (%)
  mode: 'filter' | 'ratio'; // 'filter': 선택된 가중치만, 'ratio': 비율 할당
}

// ========== 로그인 기록 (LoginHistory) ==========
export interface LoginHistory {
  id: number; // 로그인 기록 고유 ID
  userId: number; // 회원 ID
  userName: string; // 회원 이름
  timestamp: number; // 로그인 시간 (timestamp)
  userAgent?: string; // 브라우저 정보 (선택)
  ipAddress?: string; // IP 주소 (선택)
}
