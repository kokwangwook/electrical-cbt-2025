import { useState, useEffect, useMemo, useRef } from 'react';
import type { Question } from '../types';
import ScientificCalculator from '../components/ScientificCalculator';
import { getStandardTitle } from '../data/examStandards';
import { isMobileDevice } from '../utils/deviceDetection';
import {
  getCurrentExamSession,
  saveCurrentExamSession,
  clearCurrentExamSession,
  addWrongAnswer,
  updateCorrectAnswer,
  removeWrongAnswer,
  addExamResult,
  updateStatistics,
  getWrongAnswers,
  getCurrentUser,
  getMemberById,
  getExamResults,
  saveExamResults,
  getGlobalLearningProgress,
  updateGlobalLearningProgress,
  getStatistics,
} from '../services/storage';
import { saveUserDataToSupabase } from '../services/supabaseService';
import type { ExamSession, ExamResult, WrongAnswer } from '../types';
import LatexRenderer from '../components/LatexRenderer';
import FeedbackBoard from '../components/FeedbackBoard';

interface ExamProps {
  questions: Question[];
  onComplete: (answers: (number | null)[], mode?: 'timedRandom' | 'untimedRandom' | 'random' | 'category' | 'wrong' | 'review') => void;
  onExit: () => void;
  mode?: 'timedRandom' | 'untimedRandom' | 'random' | 'category' | 'wrong' | 'review';
}

export default function Exam({ questions, onComplete, onExit, mode: propMode }: ExamProps) {
  // 랜덤 모드일 때 카테고리별로 정렬 (1-20: 전기이론, 21-40: 전기기기, 41-60: 전기설비)
  const sortedQuestions = useMemo(() => {
    // 카테고리별로 그룹화
    const categoryGroups: Record<string, Question[]> = {
      '전기이론': [],
      '전기기기': [],
      '전기설비': [],
      '기타': [],
    };

    questions.forEach(q => {
      const category = q.category || '기타';
      if (!categoryGroups[category]) {
        categoryGroups[category] = [];
      }
      categoryGroups[category].push(q);
    });

    // 카테고리 순서대로 정렬
    const categoryOrder = ['전기이론', '전기기기', '전기설비', '기타'];
    const sorted: Question[] = [];
    
    categoryOrder.forEach(category => {
      if (categoryGroups[category] && categoryGroups[category].length > 0) {
        sorted.push(...categoryGroups[category]);
      }
    });

    return sorted.length > 0 ? sorted : questions;
  }, [questions]);

  // 초기 세션 복원 (실전 모의고사 모드는 세션 복원하지 않음)
  const savedSession = getCurrentExamSession();
  
  // 모드 결정: prop > savedSession > URL 파라미터 > 기본값
  const urlParams = new URLSearchParams(window.location.search);
  const urlMode = urlParams.get('mode') === 'exam' ? 'timedRandom' : null;
  const determinedMode: 'timedRandom' | 'untimedRandom' | 'random' | 'category' | 'wrong' | 'review' = 
    (propMode || savedSession?.mode || urlMode || 'untimedRandom') as 'timedRandom' | 'untimedRandom' | 'random' | 'category' | 'wrong' | 'review';
  
  // 실전 모의고사 모드인지 확인
  // 실전 모의고사는 항상 새로 시작해야 하므로 세션 복원하지 않음
  const isTimedRandomMode = determinedMode === 'timedRandom' || savedSession?.mode === 'timedRandom';
  
  // 전역 문제 이해도 불러오기 (새로운 세션이어도 이전에 체크한 이해도 표시)
  const globalLearningProgress = getGlobalLearningProgress();
  
  // 정렬된 문제 사용 (세션 복원 시 "완벽 이해" 문제 제외)
  const displayQuestions = useMemo(() => {
    // 세션 복원 여부 확인
    const shouldRestoreSession = !isTimedRandomMode && 
      savedSession && 
      savedSession.questions && 
      savedSession.questions.length > 0 &&
      sortedQuestions.length > 0 &&
      savedSession.questions.length === sortedQuestions.length;
    
    // 세션 복원 시 "완벽 이해" (value: 6)로 표시된 문제 제외
    if (shouldRestoreSession) {
      return sortedQuestions.filter(q => {
        const progress = globalLearningProgress[q.id];
        // "완벽 이해"가 아니거나 이해도가 없는 문제만 포함
        return progress !== 6;
      });
    }
    
    return sortedQuestions;
  }, [sortedQuestions, savedSession, isTimedRandomMode, globalLearningProgress]);
  
  // 실전 모의고사 모드가 아닐 때만 세션 복원 시도
  // 원본 문제 세트와 세션 문제 세트를 비교 (필터링 전)
  const shouldRestoreSession = !isTimedRandomMode && // 실전 모의고사 모드가 아닐 때만
    savedSession && 
    savedSession.questions && 
    savedSession.questions.length > 0 &&
    sortedQuestions.length > 0 &&
    savedSession.questions.length === sortedQuestions.length;
  
  let initialAnswers: { [key: number]: number } = {};
  let initialLearningProgress: { [key: number]: number } = {};
  let initialStartTime = Date.now();
  let initialRemainingTime = 60 * 60; // 60분 = 3600초
  let initialMode: 'timedRandom' | 'untimedRandom' | 'random' | 'category' | 'wrong' | 'review' = determinedMode;
  const duration = 60 * 60; // 60분
  
  if (shouldRestoreSession) {
    // 문제 ID가 일치하는지 확인 (원본 문제 세트 기준 - "완벽 이해" 문제 제외 전)
    const savedQuestionIds = savedSession.questions.map(q => q.id).sort();
    const originalQuestionIds = sortedQuestions.map(q => q.id).sort();
    
    // 원본 문제 세트와 세션 문제 세트가 일치하는지 확인
    if (savedQuestionIds.length === originalQuestionIds.length &&
        savedQuestionIds.every((id, index) => id === originalQuestionIds[index])) {
      initialAnswers = savedSession.answers || {};
      // 세션의 이해도와 전역 이해도를 병합 (전역 이해도가 우선)
      initialLearningProgress = { ...globalLearningProgress, ...(savedSession.learningProgress || {}) };
      initialMode = (savedSession.mode as any) || 'untimedRandom';
      
      // 풀지 못한 문제 수 계산
      const answeredCount = Object.keys(initialAnswers).length;
      const unansweredCount = displayQuestions.length - answeredCount;
      
      // 답변 기록이 없으면 새로운 시작 시간으로 설정하고 60분 부여
      if (answeredCount === 0) {
        initialStartTime = Date.now(); // 새로운 시작 시간
        initialRemainingTime = 60 * 60; // 60분
        console.log(`⏰ 세션 복원: 답변 기록 없음. 새로운 시험으로 시작 (60분)`);
      } else {
        // 답변 기록이 있으면 이전 세션의 시작 시간 유지
        initialStartTime = savedSession.startTime;
        // 풀지 못한 문제당 1분(60초)씩 시간 부여
        const additionalTime = unansweredCount * 60;
        initialRemainingTime = additionalTime;
        
        if (unansweredCount > 0) {
          console.log(`⏰ 세션 복원: 풀지 못한 문제 ${unansweredCount}개에 대해 ${unansweredCount}분 시간이 부여되었습니다.`);
        } else {
          console.log(`⏰ 세션 복원: 모든 문제를 풀었습니다.`);
        }
      }
    }
  } else if (isTimedRandomMode && savedSession) {
    // 실전 모의고사 모드인 경우 세션 삭제 (새로 시작)
    console.log('🚫 실전 모의고사 모드: 이전 세션 무시하고 새로 시작');
    clearCurrentExamSession();
  }

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [key: number]: number }>(initialAnswers);
  // 초기화: 세션 이해도와 전역 이해도를 병합 (전역 이해도가 우선, 세션 이해도로 덮어쓰기)
  const [learningProgress, setLearningProgress] = useState<{ [key: number]: number }>(
    Object.keys(initialLearningProgress).length > 0 
      ? { ...globalLearningProgress, ...initialLearningProgress } 
      : globalLearningProgress
  );
  const [startTime, setStartTime] = useState(initialStartTime);
  const [remainingTime, setRemainingTime] = useState(initialRemainingTime);
  const [examMode] = useState<'timedRandom' | 'untimedRandom' | 'random' | 'category' | 'wrong' | 'review'>(initialMode as 'timedRandom' | 'untimedRandom' | 'random' | 'category' | 'wrong' | 'review');
  const [fontSize, setFontSize] = useState<100 | 150 | 200>(100);
  const [isMobile, setIsMobile] = useState(isMobileDevice());
  const [isTimeReset, setIsTimeReset] = useState(false); // 시간 초기화 여부
  const [showScoreModal, setShowScoreModal] = useState(false);

  // 화면 크기 변경 감지 (모바일/PC 전환 시)
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(isMobileDevice());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [showCalculator, setShowCalculator] = useState(false); // 계산기 표시 여부
  const [showFeedbackBoard, setShowFeedbackBoard] = useState(false); // 제보 게시판 표시 여부
  const [showHint, setShowHint] = useState(false); // 힌트 모달 표시 여부
  const [showPrintOptions, setShowPrintOptions] = useState(false); // 인쇄 옵션 모달 표시 여부
  const [printOption, setPrintOption] = useState<'questionsOnly' | 'withAnswers' | 'withExplanations'>('questionsOnly'); // 인쇄 옵션
  const [scoreResult, setScoreResult] = useState<{
    total: number;
    correct: number;
    wrong: number;
    unanswered: number;
    score: number;
    percentage: number;
    encouragement?: string; // 격려 메시지
    answeredCount?: number; // 응시한 문제 수 (오답노트 모드용)
  } | null>(null);

  // 세션 복원이 이미 완료되었는지 추적하는 ref
  const sessionRestoredRef = useRef(false);
  const lastQuestionIdsRef = useRef<string>('');

  // 세션 복원 (questions prop이 변경될 때마다 확인)
  // 실전 모의고사 모드는 세션 복원하지 않음
  useEffect(() => {
    if (displayQuestions.length === 0) return;
    
    // 실전 모의고사 모드인 경우 세션 복원하지 않음
    if (examMode === 'timedRandom') {
      // 실전 모의고사 모드에서는 세션 복원하지 않음
      sessionRestoredRef.current = true;
      lastQuestionIdsRef.current = displayQuestions.map(q => q.id).sort().join(',');
      return;
    }
    
    // 현재 문제 ID들을 문자열로 변환하여 비교
    const currentQuestionIds = displayQuestions.map(q => q.id).sort().join(',');
    
    // 문제 ID가 변경되지 않았고 이미 복원했다면 스킵
    if (sessionRestoredRef.current && lastQuestionIdsRef.current === currentQuestionIds) {
      return;
    }
    
    // 세션 복원 시작 전에 즉시 표시하여 중복 실행 방지
    sessionRestoredRef.current = true;
    lastQuestionIdsRef.current = currentQuestionIds;
    
    const savedSession = getCurrentExamSession();
    
    // 실전 모의고사 모드의 세션은 무시
    if (savedSession?.mode === 'timedRandom') {
      console.log('🚫 실전 모의고사 모드: 세션 복원하지 않음');
      return;
    }
    
    if (savedSession && savedSession.questions && savedSession.questions.length > 0) {
      // 문제 ID가 일치하는지 확인
      const savedQuestionIds = savedSession.questions.map(q => q.id).sort();
      const currentQuestionIdsArray = displayQuestions.map(q => q.id).sort();
      
      // 문제 ID가 모두 일치하면 세션 복원
      if (
        savedQuestionIds.length === currentQuestionIdsArray.length &&
        savedQuestionIds.every((id, index) => id === currentQuestionIdsArray[index])
      ) {
        const restoredAnswers = savedSession.answers || {};
        
        // 풀지 못한 문제 수 계산
        const answeredCount = Object.keys(restoredAnswers).length;
        const unansweredCount = displayQuestions.length - answeredCount;
        
        // 답변 기록이 없으면 새로운 시작 시간으로 설정하고 60분 부여
        if (answeredCount === 0) {
          // 상태 업데이트를 한 번에 처리하여 무한 루프 방지
          setAnswers(restoredAnswers);
          setStartTime(Date.now());
          setRemainingTime(60 * 60);
          console.log(`⏰ 세션 복원: 답변 기록 없음. 새로운 시험으로 시작 (60분)`);
        } else {
          // 답변 기록이 있으면 이전 세션의 시작 시간 유지
          // 상태 업데이트를 한 번에 처리하여 무한 루프 방지
          setAnswers(restoredAnswers);
          setStartTime(savedSession.startTime);
          const additionalTime = unansweredCount * 60;
          setRemainingTime(additionalTime);
          
          if (unansweredCount > 0) {
            console.log(`⏰ 세션 복원: 풀지 못한 문제 ${unansweredCount}개에 대해 ${unansweredCount}분 시간이 부여되었습니다.`);
          } else {
            console.log(`⏰ 세션 복원: 모든 문제를 풀었습니다.`);
          }
        }
      }
    }
  }, [displayQuestions, examMode]);

  // 학습 진도 변경 핸들러
  const handleLearningProgressChange = (questionId: number, progress: number) => {
    setLearningProgress(prev => ({
      ...prev,
      [questionId]: progress,
    }));
    // 전역 저장소에도 저장 (다음에 같은 문제가 나와도 이해도 표시)
    updateGlobalLearningProgress(questionId, progress);
  };

  // 세션 자동 저장
  useEffect(() => {
    // 실전 모의고사 모드는 세션 저장하지 않음 (한번 끝나면 다시 계속할 수 없음)
    if (examMode === 'timedRandom') {
      return;
    }
    
    const currentUserId = getCurrentUser();
    const session: ExamSession = {
      questions: displayQuestions,
      answers,
      learningProgress,
      startTime,
      mode: examMode as any,
      category: undefined,
      userId: currentUserId || undefined, // 현재 사용자 ID 저장
    };
    saveCurrentExamSession(session);
  }, [answers, learningProgress, displayQuestions, startTime, examMode]);

  // 타이머 (untimedRandom 모드는 시간 제한 없음)
  useEffect(() => {
    if (displayQuestions.length === 0) return;
    // untimedRandom 모드는 타이머 작동하지 않음
    if (examMode === 'untimedRandom') {
      return;
    }

    const timer = setInterval(() => {
      // 시간 초기화를 한 경우: 원래 시험 시간(60분) 기준으로 계산
      if (isTimeReset) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, duration - elapsed);
        setRemainingTime(remaining);
        
        // 시간이 모두 소진되면 자동 제출
        if (remaining === 0) {
          clearInterval(timer);
          alert('시험 시간이 종료되었습니다. 자동으로 제출됩니다.');
          handleSubmit(true);
        }
      } else {
        // 시간 초기화를 하지 않은 경우: 풀지 못한 문제당 1분씩 시간 부여
        const answeredCount = Object.keys(answers).length;
        const unansweredCount = displayQuestions.length - answeredCount;
        
        // 답변 기록이 없으면 60분부터 시작
        if (answeredCount === 0) {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          const remaining = Math.max(0, duration - elapsed);
          setRemainingTime(remaining);
          
          // 시간이 모두 소진되면 자동 제출
          if (remaining === 0) {
            clearInterval(timer);
            alert('시험 시간이 종료되었습니다. 자동으로 제출됩니다.');
            handleSubmit(true);
          }
        } else {
          // 답변 기록이 있으면 풀지 못한 문제당 1분씩 시간 부여
          // 실제 경과 시간을 계산하여 시간이 흐르도록 함
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          
          // 풀지 못한 문제당 1분(60초)씩 시간 부여
          const totalTime = unansweredCount * 60;
          const remaining = Math.max(0, totalTime - elapsed);
          setRemainingTime(remaining);
          
          // 시간이 모두 소진되면 자동 제출
          if (remaining === 0) {
            clearInterval(timer);
            alert('시험 시간이 종료되었습니다. 자동으로 제출됩니다.');
            handleSubmit(true);
          }
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [displayQuestions.length, answers, startTime, duration, isTimeReset]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerSelect = (answer: number) => {
    setAnswers({
      ...answers,
      [displayQuestions[currentIndex].id]: answer,
    });
  };

  const handleNext = () => {
    if (currentIndex < displayQuestions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNavigate = (index: number) => {
    setCurrentIndex(index);
  };

  const handleSubmit = (autoSubmit = false) => {
    if (!autoSubmit) {
      const unanswered = questions.filter(q => !answers[q.id]).length;

      // 실전 모의고사 모드일 때
      if (examMode === 'timedRandom') {
        // 미답변 문제가 있을 때만 확인
        if (unanswered > 0) {
          const confirmed = window.confirm(
            `아직 ${unanswered}문제가 미답변 상태입니다.\n제출하시겠습니까?`
          );
          if (!confirmed) return;
        }
        // 모든 문제를 답변했으면 확인 없이 바로 제출
      } else {
        // 일반 모드 (실전 모의고사가 아닐 때)
        if (unanswered > 0) {
          const confirmed = window.confirm(
            `아직 ${unanswered}문제가 미답변 상태입니다.\n제출하시겠습니까?`
          );
          if (!confirmed) return;
        } else {
          const confirmed = window.confirm('시험을 제출하시겠습니까?');
          if (!confirmed) return;
        }
      }
    }

    // 결과 계산
    let correctCount = 0;
    const wrongQuestions: Question[] = [];

    console.log('📊 시험 제출 시작 - 오답 저장 로직 실행');
    console.log('📋 총 문제 수:', questions.length);
    console.log('📋 답변한 문제 수:', Object.keys(answers).length);
    console.log('📋 답변 데이터:', answers);
    console.log('📋 시험 모드:', examMode);

    // 오답노트 모드일 때는 다른 로직 사용
    const isWrongMode = examMode === 'wrong';

    displayQuestions.forEach(q => {
      const userAnswer = answers[q.id];
      console.log(`문제 ${q.id} (${q.category}): 사용자 답변=${userAnswer}, 정답=${q.answer}`);
      
      if (userAnswer === q.answer) {
        correctCount++;
        // 오답노트 모드일 때는 정답을 맞춘 문제를 즉시 제거
        if (isWrongMode) {
          removeWrongAnswer(q.id);
          console.log(`✅ 정답: 문제 ${q.id} (${q.category}) - 오답노트에서 즉시 제거`);
        } else {
          // 일반 모드일 때는 correctStreak++, 3회 연속 시 오답노트에서 제거
          updateCorrectAnswer(q.id);
          console.log(`✅ 정답: 문제 ${q.id} (${q.category})`);
        }
      } else {
        wrongQuestions.push(q);
        // 오답 처리: wrongCount++, correctStreak=0
        // 사용자가 답변을 선택했고, 틀린 경우에만 오답 저장 (채점 기준)
        if (userAnswer !== undefined && userAnswer !== null && userAnswer !== q.answer) {
          const wrongAnswer: WrongAnswer = {
            questionId: q.id,
            question: q,
            userAnswer,
            timestamp: Date.now(),
            wrongCount: 1,
            correctStreak: 0,
          };
          console.log(`❌ 오답 저장 시도: 문제 ${q.id} (${q.category}) - 사용자 답변: ${userAnswer}, 정답: ${q.answer}`);
          addWrongAnswer(wrongAnswer);
          console.log(`✅ 오답 저장 완료: 문제 ${q.id} (${q.category})`);
        } else {
          console.log(`⚠️ 오답 저장 안됨: 문제 ${q.id} (${q.category}) - 사용자 답변: ${userAnswer} (답변 없음)`);
        }
      }
    });

    console.log('📊 오답 저장 완료 - 저장된 오답 수:', getWrongAnswers().length);

    // ExamResult 저장 (allQuestions는 용량 문제로 제거 - 문제 ID만 저장)
    const result: ExamResult = {
      totalQuestions: displayQuestions.length,
      correctAnswers: correctCount,
      wrongQuestions,
      // allQuestions 제거 - localStorage 용량 초과 방지
      // 통계 계산에는 totalQuestions와 correctAnswers만 필요
      timestamp: Date.now(),
      mode: examMode as any,
      category: undefined,
    };

    // ExamResult 저장 시도 (에러가 발생해도 채점 화면으로 이동)
    try {
      addExamResult(result);
      updateStatistics(result);
    } catch (error) {
      console.error('❌ 시험 결과 저장 실패:', error);
      // localStorage 용량 초과 시 오래된 결과 삭제 후 재시도
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        try {
          const results = getExamResults();
          // 오래된 결과 50% 삭제 (가장 오래된 것부터)
          const sortedResults = results.sort((a, b) => a.timestamp - b.timestamp);
          const keepCount = Math.floor(sortedResults.length / 2);
          const keptResults = sortedResults.slice(-keepCount);
          saveExamResults(keptResults);
          console.log(`🗑️ 오래된 시험 결과 ${sortedResults.length - keepCount}개 삭제`);

          // 재시도
          addExamResult(result);
          updateStatistics(result);
        } catch (retryError) {
          console.error('❌ 시험 결과 저장 재시도 실패:', retryError);
          // 그래도 채점 화면으로 이동
        }
      }
    }

    // 서버에 사용자 데이터 동기화 (PC/모바일 데이터 일치)
    const userId = getCurrentUser();
    if (userId) {
      saveUserDataToSupabase(userId, {
        wrongAnswers: getWrongAnswers(),
        examResults: getExamResults(),
        statistics: getStatistics()
      }).catch(err => {
        console.warn('⚠️ 서버 데이터 동기화 실패:', err);
      });
    }

    clearCurrentExamSession();

    // 결과 페이지로 이동 (answers를 배열로 변환)
    const answersArray: (number | null)[] = displayQuestions.map(q => answers[q.id] || null);
    onComplete(answersArray, examMode as any);
  };

  // 인쇄 버튼: 인쇄 옵션 모달 표시
  const handlePrint = () => {
    console.log('🖨️ handlePrint 호출됨, examMode:', examMode);
    console.log('🖨️ 현재 showPrintOptions:', showPrintOptions);
    setShowPrintOptions(true);
    console.log('🖨️ setShowPrintOptions(true) 실행됨');
  };

  // 인쇄 실행
  const handlePrintExecute = () => {
    setShowPrintOptions(false);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  // 나가기 버튼: 저장하고 나가기 (채점하지 않음, 나중에 이어서 풀기 가능)
  const handleExit = () => {
    try {
      const answeredCount = Object.keys(answers).length;
      const totalCount = displayQuestions.length;

      // 실전 모의고사 모드이고 새 창으로 열린 경우 창 닫기
      const params = new URLSearchParams(window.location.search);
      const isNewWindow = params.get('mode') === 'exam' && window.opener !== null;

      if (isNewWindow && examMode === 'timedRandom') {
        // 새 창 닫기
        window.close();
        return;
      }

      // 실전 모의고사 모드는 세션 저장하지 않음 (한번 끝나면 다시 계속할 수 없음)
      if (examMode === 'timedRandom') {
        // 실전 모의고사 모드: 1문제라도 풀었으면 자동 채점, 아니면 그냥 나가기
        if (answeredCount > 0) {
          // 1문제라도 풀었으면 자동 채점
          console.log('📊 실전 모의고사 나가기 - 자동 채점 (답변 있음)');
          handleSubmit(false);
        } else {
          // 한 문제도 안 풀었으면 그냥 나가기
          console.log('🚪 실전 모의고사 나가기 - 답변 없음, 그냥 나가기');
          clearCurrentExamSession();
          onExit();
        }
        return;
      }

      // 랜덤 60문제 모드 (untimedRandom): 팝업 없이 자동 저장하고 나가기
      if (examMode === 'untimedRandom') {
        // 저장하고 나가기 (세션 유지) - 팝업 없이
        const currentUserId = getCurrentUser();
        const session: ExamSession = {
          questions: displayQuestions,
          answers,
          learningProgress,
          startTime,
          mode: examMode as any,
          category: undefined,
          userId: currentUserId || undefined,
        };

        saveCurrentExamSession(session);
        console.log(`💾 시험 현황 자동 저장 완료: ${answeredCount}/${totalCount} 문제 풀이 완료`);

        // 팝업 없이 바로 홈으로 돌아가기 (세션은 유지)
        onExit();
        return;
      }

      // 기타 모드 (category, wrong, review): 저장하고 나가기 vs 채점하고 나가기 선택
      const choice = window.confirm(
        `💾 현재 진행 상황\n\n` +
        `답변한 문제: ${answeredCount}/${totalCount}개\n` +
        `문제 이해도: ${Object.keys(learningProgress).length}개 체크됨\n\n` +
        `✅ 확인: 저장하고 나가기 (나중에 이어서 풀기)\n` +
        `❌ 취소: 채점하고 나가기`
      );

      if (choice) {
        // 저장하고 나가기 (세션 유지)
        const currentUserId = getCurrentUser();
        const session: ExamSession = {
          questions: displayQuestions,
          answers,
          learningProgress,
          startTime,
          mode: examMode as any,
          category: undefined,
          userId: currentUserId || undefined,
        };

        saveCurrentExamSession(session);
        console.log(`💾 시험 현황 저장 완료: ${answeredCount}/${totalCount} 문제 풀이 완료`);

        alert(`💾 저장 완료!\n\n답변한 문제: ${answeredCount}/${totalCount}개\n문제 이해도: ${Object.keys(learningProgress).length}개 체크됨\n\n다음 로그인 시 이어서 풀 수 있습니다.`);

        // 홈으로 돌아가기 (세션은 유지)
        onExit();
      } else {
        // 채점하고 나가기
        console.log('📊 나가기 버튼 클릭 - 채점 후 나가기 선택');

        // 채점 결과 계산 및 오답 저장
        let correctCount = 0;
        let wrongCount = 0;
        let unansweredCount = 0;
        const wrongQuestions: Question[] = [];
        const isWrongMode = examMode === 'wrong';

        displayQuestions.forEach(q => {
          const userAnswer = answers[q.id];
          if (userAnswer === undefined || userAnswer === null) {
            unansweredCount++;
          } else {
            if (userAnswer === q.answer) {
              correctCount++;
              if (isWrongMode) {
                const currentWrongAnswers = getWrongAnswers();
                const existsInWrongAnswers = currentWrongAnswers.some(wa => wa.questionId === q.id);
                if (existsInWrongAnswers) {
                  removeWrongAnswer(q.id);
                  console.log(`✅ 정답: 문제 ${q.id} (${q.category}) - 오답노트에서 즉시 제거`);
                }
              } else {
                updateCorrectAnswer(q.id);
                console.log(`✅ 정답: 문제 ${q.id} (${q.category})`);
              }
            } else {
              wrongCount++;
              wrongQuestions.push(q);
              const wrongAnswer: WrongAnswer = {
                questionId: q.id,
                question: q,
                userAnswer,
                timestamp: Date.now(),
                wrongCount: 1,
                correctStreak: 0,
              };
              console.log(`❌ 오답 저장 시도: 문제 ${q.id} (${q.category}) - 사용자 답변: ${userAnswer}, 정답: ${q.answer}`);
              addWrongAnswer(wrongAnswer);
              console.log(`✅ 오답 저장 완료: 문제 ${q.id} (${q.category})`);
            }
          }
        });

        console.log('📊 오답 저장 완료 - 저장된 오답 수:', getWrongAnswers().length);

        const result: ExamResult = {
          totalQuestions: displayQuestions.length,
          correctAnswers: correctCount,
          wrongQuestions,
          timestamp: Date.now(),
          mode: examMode as any,
          category: undefined,
        };

        try {
          addExamResult(result);
          updateStatistics(result);
        } catch (error) {
          console.error('❌ 시험 결과 저장 실패:', error);
          if (error instanceof DOMException && error.name === 'QuotaExceededError') {
            try {
              const results = getExamResults();
              const sortedResults = results.sort((a, b) => a.timestamp - b.timestamp);
              const keepCount = Math.floor(sortedResults.length / 2);
              const keptResults = sortedResults.slice(-keepCount);
              saveExamResults(keptResults);
              console.log(`🗑️ 오래된 시험 결과 ${sortedResults.length - keepCount}개 삭제`);
              addExamResult(result);
              updateStatistics(result);
            } catch (retryError) {
              console.error('❌ 시험 결과 저장 재시도 실패:', retryError);
            }
          }
        }

        clearCurrentExamSession();

        const answersArray: (number | null)[] = displayQuestions.map(q => answers[q.id] || null);
        onComplete(answersArray, examMode as any);
      }
    } catch (error) {
      console.error('❌ 나가기 처리 실패:', error);
      alert('⚠️ 시험 현황 저장에 실패했습니다. 진행 상황이 손실될 수 있습니다.');

      const params = new URLSearchParams(window.location.search);
      const isNewWindow = params.get('mode') === 'exam' && window.opener !== null;

      if (isNewWindow && examMode === 'timedRandom') {
        window.close();
      } else {
        onExit();
      }
    }
  };
  
  // 저장하기 버튼
  const handleSave = () => {
    // 실전 모의고사 모드는 세션 저장하지 않음 (한번 끝나면 다시 계속할 수 없음)
    if (examMode === 'timedRandom') {
      alert('⚠️ 실전 모의고사 모드는 저장할 수 없습니다.\n\n실전 모의고사는 한번 끝나면 다시 계속할 수 없습니다.');
      return;
    }
    
    const currentUserId = getCurrentUser();
    // 세션 저장 (이미 useEffect에서 자동 저장되지만 명시적으로 저장)
    const session: ExamSession = {
      questions: displayQuestions,
      answers,
      learningProgress,
      startTime,
      mode: examMode as any,
      category: undefined,
      userId: currentUserId || undefined, // 현재 사용자 ID 저장
    };
    saveCurrentExamSession(session);
    
    alert(`💾 저장 완료!\n\n답변한 문제: ${Object.keys(answers).length}/${displayQuestions.length}개`);
  };

  // 시간 초기화 버튼
  const handleResetTime = () => {
    if (window.confirm('⏰ 시험 시간을 60분으로 초기화하시겠습니까?\n\n현재 진행 상황은 유지됩니다.')) {
      // 시작 시간을 현재 시간으로 재설정
      const newStartTime = Date.now();
      setStartTime(newStartTime);
      
      // 남은 시간을 60분(3600초)으로 설정
      setRemainingTime(60 * 60);
      
      // 시간 초기화 플래그 설정
      setIsTimeReset(true);
      
      // 실전 모의고사 모드는 세션 저장하지 않음 (한번 끝나면 다시 계속할 수 없음)
      if (examMode !== 'timedRandom') {
        const currentUserId = getCurrentUser();
        // 세션 저장
        const session: ExamSession = {
          questions: displayQuestions,
          answers,
          learningProgress,
          startTime: newStartTime,
          mode: examMode as any,
          category: undefined,
          userId: currentUserId || undefined, // 현재 사용자 ID 저장
        };
        saveCurrentExamSession(session);
      }
      
      alert('✅ 시험 시간이 60분으로 초기화되었습니다.');
    }
  };

  // 채점 버튼
  const handleScore = () => {
    // 모의고사 모드: 기존 상세 모달 표시
    if (examMode === 'timedRandom') {
      // 실전 모의고사 모드는 기존 로직 유지
      const currentUserId = getCurrentUser();
      // 세션 자동 저장
      const session: ExamSession = {
        questions,
        answers,
        learningProgress,
        startTime,
        mode: examMode as any,
        category: undefined,
        userId: currentUserId || undefined,
      };
      saveCurrentExamSession(session);

      console.log('📊 채점하기 버튼 클릭 - 오답 저장 로직 실행');
      console.log('📋 총 문제 수:', questions.length);
      console.log('📋 답변한 문제 수:', Object.keys(answers).length);
      console.log('📋 답변 데이터:', answers);
      console.log('📋 시험 모드:', examMode);

      // 채점 결과 계산 및 오답 저장
      let correctCount = 0;
      let wrongCount = 0;
      let unansweredCount = 0;
      let savedWrongCount = 0;

      displayQuestions.forEach(q => {
        const userAnswer = answers[q.id];
        if (userAnswer === undefined || userAnswer === null) {
          unansweredCount++;
        } else {
          if (userAnswer === q.answer) {
            correctCount++;
            updateCorrectAnswer(q.id);
            console.log(`✅ 정답: 문제 ${q.id} (${q.category})`);
          } else {
            wrongCount++;
            const wrongAnswer: WrongAnswer = {
              questionId: q.id,
              question: q,
              userAnswer,
              timestamp: Date.now(),
              wrongCount: 1,
              correctStreak: 0,
            };
            console.log(`❌ 오답 저장 시도: 문제 ${q.id} (${q.category}) - 사용자 답변: ${userAnswer}, 정답: ${q.answer}`);
            addWrongAnswer(wrongAnswer);
            savedWrongCount++;
            console.log(`✅ 오답 저장 완료: 문제 ${q.id} (${q.category})`);
          }
        }
      });

      console.log(`📊 채점하기 - 오답 저장 완료: ${savedWrongCount}개 오답 저장됨`);
      console.log(`📊 채점하기 - 저장된 총 오답 수: ${getWrongAnswers().length}`);

      const total = displayQuestions.length;
      const score = Math.round((correctCount / total) * 100);
      const percentage = ((correctCount / total) * 100);

      // 채점 결과 저장
      setScoreResult({
        total,
        correct: correctCount,
        wrong: wrongCount,
        unanswered: unansweredCount,
        score,
        percentage: parseFloat(percentage.toFixed(1)),
      });

      // 모달 표시
      setShowScoreModal(true);
      return;
    }

    // 학습 모드: 현재 문제만 간단하게 채점
    const currentQ = displayQuestions[currentIndex];
    const userAnswer = answers[currentQ.id];
    const correctAnswer = currentQ.answer;

    // 세션 저장
    const currentUserId = getCurrentUser();
    const session: ExamSession = {
      questions,
      answers,
      learningProgress,
      startTime,
      mode: examMode as any,
      category: undefined,
      userId: currentUserId || undefined,
    };
    saveCurrentExamSession(session);

    // 간단한 alert 메시지
    if (userAnswer === undefined || userAnswer === null) {
      alert(`정답은 ${correctAnswer}번입니다.`);
    } else if (userAnswer === correctAnswer) {
      alert(`맞았습니다. 정답은 ${correctAnswer}번입니다.`);
    } else {
      alert(`틀렸습니다. 정답은 ${correctAnswer}번입니다.`);
    }
  };

  const answeredCount = Object.keys(answers).length;
  const currentQuestion = displayQuestions[currentIndex];
  const selectedAnswer = answers[currentQuestion?.id];

  // 안 푼 문제로 이동
  const handleGoToUnanswered = () => {
    const unansweredIndex = displayQuestions.findIndex((q, idx) => 
      idx > currentIndex && !answers[q.id]
    );
    
    if (unansweredIndex !== -1) {
      setCurrentIndex(unansweredIndex);
    } else {
      const firstUnanswered = displayQuestions.findIndex(q => !answers[q.id]);
      if (firstUnanswered !== -1) {
        setCurrentIndex(firstUnanswered);
      } else {
        alert('모든 문제를 풀었습니다!');
      }
    }
  };

  const fontSizeClass = fontSize === 100 ? 'text-base' : fontSize === 150 ? 'text-lg' : 'text-xl';
  const currentUserId = getCurrentUser();
  const getMember = currentUserId ? getMemberById(currentUserId) : null;

  // 실전모의고사 CBT 레이아웃
  if (examMode === 'timedRandom') {
    // 새창인지 확인
    const params = new URLSearchParams(window.location.search);
    const isNewWindow = params.get('mode') === 'exam' && window.opener !== null;
    
    return (
      <div className={`flex justify-center bg-gray-100 ${isNewWindow ? 'p-[1px] h-screen' : 'h-screen'}`}>
        <div className={`flex flex-col bg-white w-full max-w-[1000px] ${isNewWindow ? 'h-full' : 'h-screen'}`}>
          {/* 1. 헤더 */}
          <div className="bg-blue-700 text-white px-4 md:px-6 py-3 flex-shrink-0">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 lg:gap-0">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-6">
                <h1 className="text-lg md:text-xl font-bold">⚡ 전기기능사 CBT 모의고사</h1>
                <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm">
                  <span>수험번호: {getMember?.id || '-----'}</span>
                  <span>수험자명: {getMember?.name || '게스트'}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm">제한시간:</span>
                  <span className="text-base sm:text-lg font-bold">60:00</span>
                </div>
                <div className={`flex items-center gap-2 ${remainingTime < 300 ? 'text-red-300' : ''}`}>
                  <span className="text-xs sm:text-sm">남은시간:</span>
                  <span className="text-xl sm:text-2xl font-bold">{formatTime(remainingTime)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <span>전체: {displayQuestions.length}</span>
                  <span className="text-yellow-300">안푼: {displayQuestions.length - answeredCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. 툴바 */}
          <div className="bg-white border-b border-gray-300 px-4 md:px-6 py-2 flex-shrink-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
              <div className="flex items-center gap-2 sm:gap-4">
                <span className="text-xs sm:text-sm font-semibold text-gray-700">글자 크기:</span>
                {[100, 150, 200].map((size) => (
                  <button
                    key={size}
                    onClick={() => setFontSize(size as 100 | 150 | 200)}
                    className={`px-2 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm rounded ${
                      fontSize === size
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {size}%
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {examMode !== 'timedRandom' && (
                  <button
                    onClick={handleSave}
                    className="px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm bg-green-600 hover:bg-green-700 text-white rounded"
                  >
                    💾 저장
                  </button>
                )}
                <button
                  onClick={handleExit}
                  className="px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm bg-gray-500 hover:bg-gray-600 text-white rounded"
                >
                  ← 나가기
                </button>
              </div>
            </div>
          </div>

          {/* 3. 메인 영역 (2분할) */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* 좌측: 문제 영역 - 최대 4문제 표시 */}
            <div className={`flex-1 overflow-y-auto bg-white p-4 md:p-6 lg:p-8 ${fontSizeClass}`}>
            <div className="space-y-12">
              {displayQuestions.slice(
                Math.floor(currentIndex / 4) * 4,
                Math.min(Math.floor(currentIndex / 4) * 4 + 4, displayQuestions.length)
              ).map((q, pageIdx) => {
                const questionIdx = Math.floor(currentIndex / 4) * 4 + pageIdx;
                const questionNum = questionIdx + 1;
                const userAnswer = answers[q.id];

                return (
                  <div key={q.id} className="pb-8 border-b border-gray-200 last:border-b-0">
                    <h2 className="text-lg text-gray-900 mb-4">
                      <span className="inline">{questionNum}. </span>
                      <span className="inline"><LatexRenderer text={q.question || ''} className="inline" /></span>
                    </h2>

                    {/* 이미지 영역: hasImage가 true면 항상 공간 확보 */}
                    {q.hasImage && (
                      <div className="mb-4 min-h-[200px] flex items-center justify-center bg-gray-50 rounded border border-gray-200">
                        {q.imageUrl ? (
                          <img 
                            src={q.imageUrl} 
                            alt={`문제 ${questionNum} 이미지`}
                            className="max-w-full h-auto rounded border border-gray-300"
                          />
                        ) : (
                          <div className="text-gray-400 text-sm">이미지 준비 중</div>
                        )}
                      </div>
                    )}

                    {(() => {
                      // 동적 레이아웃 계산: 각 옵션이 한 줄에 들어가는지 확인
                      const optionTexts = [q.option1, q.option2, q.option3, q.option4];
                      const maxLength = Math.max(...optionTexts.map(text => (text || '').length));
                      
                      // 레이아웃 결정: 매우 짧으면 4줄, 중간이면 2줄, 길면 세로 4줄
                      if (maxLength <= 8) {
                        // 매우 짧은 텍스트: 4개 옵션이 가로로 한 줄 (grid-cols-4)
                        return (
                          <div className="grid grid-cols-4 gap-1">
                            {[1, 2, 3, 4].map(optNum => {
                              const optionKey = `option${optNum}` as keyof Question;
                              const optionText = q[optionKey] as string;
                              const isSelected = userAnswer === optNum;
                              const answerSymbols = ['①', '②', '③', '④'];

                              return (
                                <button
                                  key={optNum}
                                  onClick={() => {
                                    setCurrentIndex(questionIdx);
                                    handleAnswerSelect(optNum);
                                  }}
                                  className={`text-left p-2 rounded-lg transition-all ${
                                    isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="flex items-start gap-1.5">
                                    <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm ${
                                      isSelected ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                                    }`}>
                                      {answerSymbols[optNum - 1]}
                                    </span>
                                    <span className="flex-1 text-base text-left">
                                      <LatexRenderer text={optionText || ''} />
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        );
                      } else if (maxLength <= 20) {
                        // 중간 텍스트: 2개씩 2줄 (grid-cols-2) - 1,2 한 줄, 3,4 한 줄
                        return (
                          <div className="grid grid-cols-2 gap-1">
                            {[1, 2, 3, 4].map(optNum => {
                              const optionKey = `option${optNum}` as keyof Question;
                              const optionText = q[optionKey] as string;
                              const isSelected = userAnswer === optNum;
                              const answerSymbols = ['①', '②', '③', '④'];

                              return (
                                <button
                                  key={optNum}
                                  onClick={() => {
                                    setCurrentIndex(questionIdx);
                                    handleAnswerSelect(optNum);
                                  }}
                                  className={`text-left p-2 rounded-lg transition-all ${
                                    isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="flex items-start gap-1.5">
                                    <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm ${
                                      isSelected ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                                    }`}>
                                      {answerSymbols[optNum - 1]}
                                    </span>
                                    <span className="flex-1 text-base text-left">
                                      <LatexRenderer text={optionText || ''} />
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        );
                      } else {
                        // 긴 텍스트: 각 옵션이 세로로 4줄 (space-y-1)
                        return (
                          <div className="space-y-1">
                            {[1, 2, 3, 4].map(optNum => {
                              const optionKey = `option${optNum}` as keyof Question;
                              const optionText = q[optionKey] as string;
                              const isSelected = userAnswer === optNum;
                              const answerSymbols = ['①', '②', '③', '④'];

                              return (
                                <button
                                  key={optNum}
                                  onClick={() => {
                                    setCurrentIndex(questionIdx);
                                    handleAnswerSelect(optNum);
                                  }}
                                  className={`w-full text-left p-2 rounded-lg transition-all ${
                                    isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="flex items-start gap-2">
                                    <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                                      isSelected ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                                    }`}>
                                      {answerSymbols[optNum - 1]}
                                    </span>
                                    <span className="flex-1 text-base text-left">
                                      <LatexRenderer text={optionText || ''} />
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        );
                      }
                    })()}

                    {/* 문제 이해도 체크 (PC 모드) - 모의시험 모드에서는 숨김 */}
                    {examMode !== 'timedRandom' && (
                    <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-yellow-500 text-sm">⭐</span>
                        <span className="text-xs font-semibold text-gray-700">문제 이해도:</span>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {[
                          { value: 1, label: '전혀 모름', short: '1' },
                          { value: 2, label: '어려움', short: '2' },
                          { value: 3, label: '매우 어려움', short: '3' },
                          { value: 4, label: '반복 필요', short: '4' },
                          { value: 5, label: '거의 이해', short: '5' },
                          { value: 6, label: '완벽 이해', short: '6' },
                        ].map(({ value, label, short }) => {
                          const isProgressSelected = learningProgress[q.id] === value;
                          return (
                            <button
                              key={value}
                              onClick={() => handleLearningProgressChange(q.id, value)}
                              title={label}
                              className={`px-2 py-1 text-xs rounded border transition-all ${
                                isProgressSelected
                                  ? 'bg-yellow-100 border-yellow-500 text-yellow-800 font-bold'
                                  : 'bg-white border-gray-300 text-gray-600 hover:border-yellow-400'
                              }`}
                            >
                              {short}
                            </button>
                          );
                        })}
                      </div>
                      {learningProgress[q.id] && (
                        <div className="mt-1 text-xs text-yellow-700">
                          선택됨: {[
                            { value: 1, label: '전혀 모름' },
                            { value: 2, label: '어려움' },
                            { value: 3, label: '매우 어려움' },
                            { value: 4, label: '반복 필요' },
                            { value: 5, label: '거의 이해' },
                            { value: 6, label: '완벽 이해' },
                          ].find(item => item.value === learningProgress[q.id])?.label}
                        </div>
                      )}
                    </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 우측: 답안표기란 */}
          <div className="w-full lg:w-48 xl:w-56 bg-gray-50 border-t lg:border-t-0 lg:border-l border-gray-300 overflow-y-auto flex-shrink-0 max-h-64 lg:max-h-none">
            <div className="sticky top-0 bg-blue-700 text-white text-center py-2 lg:py-3 font-bold text-sm lg:text-base">
              답안 표기란
            </div>
            <div className="p-2 space-y-1">
              {displayQuestions.map((q, idx) => {
                const userAnswer = answers[q.id];
                const isCurrent = idx === currentIndex;
                const answerSymbols = ['①', '②', '③', '④'];
                
                return (
                  <div
                    key={q.id}
                    className={`p-2 rounded border ${
                      isCurrent
                        ? 'bg-yellow-100 border-yellow-500'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentIndex(idx)}
                        className={`w-8 h-8 flex items-center justify-center rounded font-bold text-sm flex-shrink-0 ${
                          isCurrent
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {idx + 1}
                      </button>
                      
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((optNum) => (
                          <button
                            key={optNum}
                            onClick={() => {
                              setCurrentIndex(idx);
                              handleAnswerSelect(optNum);
                            }}
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all flex-shrink-0 ${
                              userAnswer === optNum
                                ? 'bg-blue-600 text-white scale-110'
                                : 'bg-white border-2 border-gray-300 text-gray-500 hover:border-blue-400'
                            }`}
                          >
                            {answerSymbols[optNum - 1]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 4. 푸터 */}
        <div className="bg-white border-t border-gray-300 px-4 md:px-6 py-3 flex-shrink-0">
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-0">
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
              <button
                onClick={() => setShowCalculator(true)}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-600 hover:bg-gray-700 text-white rounded font-semibold text-sm"
              >
                🔢 계산기
              </button>
              <div className="text-gray-700 text-sm sm:text-base">
                페이지 <span className="font-semibold">{Math.floor(currentIndex / 4) + 1}</span> / {Math.ceil(displayQuestions.length / 4)}
              </div>
              <button
                onClick={() => {
                  const prevPage = Math.floor(currentIndex / 4) - 1;
                  if (prevPage >= 0) {
                    setCurrentIndex(prevPage * 4);
                  }
                }}
                disabled={Math.floor(currentIndex / 4) === 0}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white rounded font-semibold disabled:cursor-not-allowed text-sm"
              >
                ◀ 이전
              </button>
              <button
                onClick={() => {
                  const nextPage = Math.floor(currentIndex / 4) + 1;
                  const nextPageStart = nextPage * 4;
                  if (nextPageStart < displayQuestions.length) {
                    setCurrentIndex(nextPageStart);
                  }
                }}
                disabled={Math.floor(currentIndex / 4) >= Math.ceil(displayQuestions.length / 4) - 1}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white rounded font-semibold disabled:cursor-not-allowed text-sm"
              >
                다음 ▶
              </button>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={handleGoToUnanswered}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 bg-orange-600 hover:bg-orange-700 text-white rounded font-semibold text-sm"
              >
                안 푼 문제
              </button>
              <button
                onClick={() => handleSubmit(false)}
                className="flex-1 sm:flex-none px-4 sm:px-6 py-1.5 sm:py-2 bg-green-600 hover:bg-green-700 text-white rounded font-bold text-base sm:text-lg"
              >
                답안 제출
              </button>
            </div>
          </div>
        </div>

          {/* 계산기 모달 */}
          {showCalculator && (
            <ScientificCalculator onClose={() => setShowCalculator(false)} />
          )}

          {/* 제보 게시판 모달 */}
          {showFeedbackBoard && (
            <FeedbackBoard 
              onClose={() => setShowFeedbackBoard(false)}
              currentQuestion={currentQuestion}
              currentQuestionIndex={currentIndex}
            />
          )}

          {/* 인쇄 옵션 선택 모달 */}
          {showPrintOptions && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 non-printable">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">🖨️ 인쇄 옵션 선택</h2>
                <p className="text-sm text-gray-600 mb-6">인쇄할 내용을 선택하세요</p>

                <div className="space-y-3 mb-6">
                  {/* 문제만 인쇄 */}
                  <button
                    onClick={() => setPrintOption('questionsOnly')}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      printOption === 'questionsOnly'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center">
                      <div
                        className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${
                          printOption === 'questionsOnly'
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        }`}
                      >
                        {printOption === 'questionsOnly' && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-gray-800">📝 문제만 인쇄</div>
                        <div className="text-sm text-gray-600">문제와 선택지만 인쇄 (정답 표시 없음)</div>
                      </div>
                    </div>
                  </button>

                  {/* 정답 표시 인쇄 */}
                  <button
                    onClick={() => setPrintOption('withAnswers')}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      printOption === 'withAnswers'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center">
                      <div
                        className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${
                          printOption === 'withAnswers'
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        }`}
                      >
                        {printOption === 'withAnswers' && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-gray-800">✅ 정답 표시 인쇄</div>
                        <div className="text-sm text-gray-600">문제 + 정답 표시 (파란색 ✓ 표시)</div>
                      </div>
                    </div>
                  </button>

                  {/* 정답 + 해설 인쇄 */}
                  <button
                    onClick={() => setPrintOption('withExplanations')}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      printOption === 'withExplanations'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center">
                      <div
                        className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${
                          printOption === 'withExplanations'
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        }`}
                      >
                        {printOption === 'withExplanations' && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-gray-800">📚 정답 + 해설 인쇄</div>
                        <div className="text-sm text-gray-600">문제 + 정답 + 해설 전체</div>
                      </div>
                    </div>
                  </button>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPrintOptions(false)}
                    className="flex-1 px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handlePrintExecute}
                    className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    인쇄하기
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 채점 결과 모달 */}
          {showScoreModal && scoreResult && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full mx-4">
                <h2 className="text-2xl font-bold text-center mb-4">📊 채점 결과</h2>
                <div className="text-center text-4xl font-bold mb-4">
                  {scoreResult.score}점
                </div>
                <div className="space-y-2 mb-6">
                  <div className="flex justify-between">
                    <span>정답:</span>
                    <span className="font-bold text-green-600">{scoreResult.correct}문제</span>
                  </div>
                  <div className="flex justify-between">
                    <span>오답:</span>
                    <span className="font-bold text-red-600">{scoreResult.wrong}문제</span>
                  </div>
                  <div className="flex justify-between">
                    <span>미답변:</span>
                    <span className="font-bold text-gray-600">{scoreResult.unanswered}문제</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowScoreModal(false)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded"
                >
                  확인
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 일반 모드: 기존 레이아웃
  return (
    <>
      {/* 인쇄용 콘텐츠 */}
      <div className="printable hidden">
        <h1 className="text-2xl font-bold text-center mb-8">전기기능사 CBT 문제</h1>
        <div className="space-y-6">
          {displayQuestions.map((q, index) => (
            <div key={q.id} className="break-inside-avoid-page p-4 border-b">
              <div className="flex items-start mb-2">
                <h3 className="text-lg font-bold mr-4">{index + 1}.</h3>
                <div className="text-base">
                  <LatexRenderer text={q.question || ''} className="inline" />
                  {printOption === 'withAnswers' && (
                    <span className="text-blue-600 font-bold ml-2">정답: {q.answer}번</span>
                  )}
                </div>
              </div>
              {q.imageUrl && (
                <div className="mb-2 pl-8">
                  <img src={q.imageUrl} alt={`문제 ${index + 1} 이미지`} className="max-w-xs rounded" />
                </div>
              )}
              <div className="space-y-2 pl-8">
                {[1, 2, 3, 4].map(optNum => {
                  const optionKey = `option${optNum}` as keyof Question;
                  // 정답 표시는 해설 모드에서만 선택지에 표시, 정답 표시 모드에서는 문제 끝에만 표시
                  const isCorrectAnswer = printOption === 'withExplanations' && q.answer === optNum;
                  return (
                    <div key={optNum} className="flex items-start">
                      <span className={`font-bold w-6 ${isCorrectAnswer ? 'text-blue-600' : ''}`}>
                        {optNum}.
                      </span>
                      <LatexRenderer text={q[optionKey] as string} className={`text-base ${isCorrectAnswer ? 'font-bold text-blue-600' : ''}`} />
                    </div>
                  );
                })}
              </div>
              {printOption === 'withExplanations' && (
                <div className="mt-2 pl-8 text-sm text-blue-600 font-bold">
                  정답: {q.answer}번
                </div>
              )}
              {printOption === 'withExplanations' && q.explanation && (
                <div className="mt-2 pl-8 p-2 bg-gray-50 rounded text-sm">
                  <span className="font-bold">해설:</span> <LatexRenderer text={q.explanation} className="inline" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 화면용 UI */}
      <div className="min-h-screen bg-gray-100 p-3 non-printable">
        <div className="max-w-7xl mx-auto">
          {/* 상단 헤더 */}
          <div className="bg-white rounded-lg shadow-md p-3 mb-2">
            <div className="flex justify-between items-center flex-wrap gap-3">
              <h1 className="text-xl font-bold text-gray-800">⚡ 전기기능사 CBT</h1>
              <div className="flex items-center gap-2">
                {/* 타이머 (랜덤 60문제 모드는 시간 제한 없음) */}
                {examMode === 'untimedRandom' ? (
                  <div className="px-4 py-2 rounded-lg font-bold text-lg bg-green-100 text-green-700">
                    ∞ 시간 제한 없음
                  </div>
                ) : (
                  <div
                    className={`px-4 py-2 rounded-lg font-bold text-lg ${
                      remainingTime < 300
                        ? 'bg-red-100 text-red-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    ⏱️ {formatTime(remainingTime)}
                  </div>
                )}
              <button
                onClick={() => setShowFeedbackBoard(true)}
                className="px-3 py-1.5 text-sm bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
                title="제보 게시판"
              >
                📋 제보
              </button>
              <button
                onClick={() => setShowCalculator(true)}
                className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                title="공학용 계산기"
              >
                🔢 계산기
              </button>
              {/* 인쇄 버튼 - 랜덤 모드에서만 표시, 모바일에서는 숨김 */}
              {!isMobile && (examMode === 'untimedRandom' || examMode === 'random' || examMode === 'category') && (
                <button
                  onClick={handlePrint}
                  className="px-3 py-1.5 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                  title="인쇄"
                >
                  🖨️ 인쇄
                </button>
              )}
              {/* 저장하기 버튼 */}
              <button
                onClick={handleSave}
                className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                💾 저장하기
              </button>
              {/* 시간 초기화 버튼 (시간 제한이 있는 모드만 표시) */}
              {examMode !== 'untimedRandom' && (
                <button
                  onClick={handleResetTime}
                  className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                  ⏰ 시간 초기화
                </button>
              )}
              {/* 채점하기 버튼 - 모바일에서는 숨김 */}
              {!isMobile && (
                <button
                  onClick={handleScore}
                  className="px-3 py-1.5 text-sm bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
                >
                  📊 채점하기
                </button>
              )}
              <button
                onClick={handleExit}
                className="px-3 py-1.5 text-sm bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                ← 나가기
              </button>
            </div>
          </div>
        </div>

          {/* 문제 표시 영역 */}
          <div className="mb-2">
            {currentQuestion && (
              <div>
                <div className="min-h-[300px]">
              {/* 문제 */}
              <div className="mb-4">
                {/* 문제 번호 및 카테고리 정보를 위에 한 줄로 */}
                <div className="bg-gray-50 p-3 mb-2 rounded">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="text-lg font-bold text-gray-800">
                      문제 {currentIndex + 1} / {displayQuestions.length}
                    </span>
                    {currentQuestion.category && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium">
                        {currentQuestion.category}
                      </span>
                    )}
                    {currentQuestion.standard && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm font-medium">
                        {currentQuestion.standard} - {getStandardTitle(currentQuestion.standard)}
                      </span>
                    )}
                    {currentQuestion.detailItem && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm font-medium">
                        세부항목: {currentQuestion.detailItem}
                      </span>
                    )}
                  </div>
                </div>
                {/* 문제 텍스트 */}
                <div className="bg-gray-50 border-l-2 border-blue-500 p-3 mb-4 rounded-r">
                  <div className="text-xl font-medium text-gray-900 leading-relaxed">
                    <LatexRenderer text={currentQuestion.question || ''} className="inline" />
                  </div>
                </div>
                {currentQuestion.hasImage && (
                  <div className="mt-4 flex justify-center">
                    {currentQuestion.imageUrl ? (
                      <img
                        src={currentQuestion.imageUrl}
                        alt="문제 이미지"
                        className="max-w-full h-auto rounded border border-gray-200"
                        style={{ maxWidth: '80%', display: 'block' }}
                      />
                    ) : (
                      <div className="min-h-[200px] flex items-center justify-center bg-gray-50 rounded border border-gray-200 w-full">
                        <div className="text-gray-400 text-sm">이미지 준비 중</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 선택지 - 각 옵션을 한 줄로 표시 */}
              <div className="space-y-2 mb-6">
                {[1, 2, 3, 4].map((optNum) => {
                  const optionKey = `option${optNum}` as keyof Question;
                  const optionText = currentQuestion[optionKey] as string;
                  const answerSymbols = ['①', '②', '③', '④'];

                  return (
                    <button
                      key={optNum}
                      onClick={() => handleAnswerSelect(optNum)}
                      className={`w-full text-left transition-all ${
                        selectedAnswer === optNum
                          ? 'text-blue-600'
                          : 'hover:text-blue-500'
                      }`}
                    >
                      <div className="flex items-center gap-5">
                        <span
                          className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                            selectedAnswer === optNum
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {answerSymbols[optNum - 1]}
                        </span>
                        <div className="flex-1 text-lg">
                          <LatexRenderer text={optionText || ''} />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 네비게이션 버튼 */}
              <div className="flex justify-between items-center mt-6">
                <button
                  onClick={handlePrevious}
                  disabled={currentIndex === 0}
                  className={`px-5 py-2 text-sm rounded-lg font-semibold transition-colors ${
                    currentIndex === 0
                      ? 'bg-gray-300 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-500 hover:bg-gray-600 text-white'
                  }`}
                >
                  ← 이전
                </button>

                {/* 힌트 버튼 */}
                {currentQuestion?.explanation && (
                  <button
                    onClick={() => setShowHint(true)}
                    className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                  >
                    💡 힌트 보기
                  </button>
                )}

                {/* 정답 버튼 */}
                <button
                  onClick={() => {
                    const answer = currentQuestion.answer;
                    alert(`정답은 ${answer}번입니다.`);
                  }}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                >
                  ✅ 정답 보기
                </button>

                {/* 학습 도움 자료 버튼 */}
                {currentQuestion?.helpResourceUrl && (
                  <button
                    onClick={() => {
                      window.open(currentQuestion.helpResourceUrl, '_blank');
                    }}
                    className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                  >
                    📚 학습도움자료 연결
                  </button>
                )}

                <button
                  onClick={handleNext}
                  disabled={currentIndex === displayQuestions.length - 1}
                  className={`px-5 py-2 text-sm rounded-lg font-semibold transition-colors ${
                    currentIndex === displayQuestions.length - 1
                      ? 'bg-gray-300 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  다음 →
                </button>
              </div>

              {/* 학습 진도 체크 - 모의시험 모드에서는 숨김 */}
              {currentQuestion && (examMode as string) !== 'timedRandom' && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-yellow-500">⭐</span>
                    <h3 className="text-sm font-semibold text-gray-700">문제 이해도 체크 (학습 진도):</h3>
                  </div>
                  <div className={isMobile ? 'grid grid-cols-2 gap-2' : 'flex gap-2 flex-wrap'}>
                    {[
                      { value: 1, label: '전혀 모름' },
                      { value: 2, label: '어려움' },
                      { value: 3, label: '매우 어려움' },
                      { value: 4, label: '반복 학습 필요' },
                      { value: 5, label: '거의 이해' },
                      { value: 6, label: '완벽 이해' },
                    ].map(({ value, label }) => {
                      const isSelected = learningProgress[currentQuestion.id] === value;
                      return (
                        <button
                          key={value}
                          onClick={() => handleLearningProgressChange(currentQuestion.id, value)}
                          className={`${isMobile ? 'px-2 py-1.5 text-xs' : 'px-4 py-2 text-sm'} rounded-lg border-2 transition-all font-medium ${
                            isSelected
                              ? 'bg-pink-50 border-red-500 text-red-700'
                              : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <div
                              className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                isSelected
                                  ? 'border-gray-700 bg-gray-700'
                                  : 'border-gray-400 bg-white'
                              }`}
                            >
                              {isSelected && (
                                <div className={`${isMobile ? 'w-1.5 h-1.5' : 'w-2 h-2'} rounded-full bg-white`}></div>
                              )}
                            </div>
                            <span className={isMobile ? 'text-xs' : ''}>{label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
                </div>
              </div>
            )}
          </div>

        {/* 문제 번호 그리드 - 카테고리별 그룹화 */}
        <div className="bg-white rounded-lg shadow-md p-3">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-gray-700">문제 선택</h3>
            <span className="text-xs text-gray-500">💡 클릭시 이동</span>
          </div>

          {/* 전기이론 1-20 */}
          <div className="mb-2">
            <div className="text-xs font-semibold text-purple-700 mb-1 px-2 py-0.5 bg-purple-50 rounded inline-block">
              전기이론 1-20
            </div>
            <div className={`grid ${isMobile ? 'grid-cols-10' : 'grid-cols-20'} gap-1`}>
              {displayQuestions.slice(0, 20).map((q, index) => {
                const isAnswered = !!answers[q.id];
                const isCurrent = index === currentIndex;

                return (
                  <button
                    key={q.id}
                    onClick={() => handleNavigate(index)}
                    className={`aspect-square rounded-full flex items-center justify-center text-base font-medium transition-all ${
                      isCurrent
                        ? 'bg-purple-500 text-white ring-2 ring-purple-300'
                        : isAnswered
                        ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 전기기기 21-40 */}
          <div className="mb-2">
            <div className="text-xs font-semibold text-blue-700 mb-1 px-2 py-0.5 bg-blue-50 rounded inline-block">
              전기기기 21-40
            </div>
            <div className={`grid ${isMobile ? 'grid-cols-10' : 'grid-cols-20'} gap-1`}>
              {displayQuestions.slice(20, 40).map((q, index) => {
                const actualIndex = index + 20;
                const isAnswered = !!answers[q.id];
                const isCurrent = actualIndex === currentIndex;

                return (
                  <button
                    key={q.id}
                    onClick={() => handleNavigate(actualIndex)}
                    className={`aspect-square rounded-full flex items-center justify-center text-base font-medium transition-all ${
                      isCurrent
                        ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                        : isAnswered
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {actualIndex + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 전기설비 41-60 */}
          <div>
            <div className="text-xs font-semibold text-green-700 mb-1 px-2 py-0.5 bg-green-50 rounded inline-block">
              전기설비 41-60
            </div>
            <div className={`grid ${isMobile ? 'grid-cols-10' : 'grid-cols-20'} gap-1`}>
              {displayQuestions.slice(40, 60).map((q, index) => {
                const actualIndex = index + 40;
                const isAnswered = !!answers[q.id];
                const isCurrent = actualIndex === currentIndex;

                return (
                  <button
                    key={q.id}
                    onClick={() => handleNavigate(actualIndex)}
                    className={`aspect-square rounded-full flex items-center justify-center text-base font-medium transition-all ${
                      isCurrent
                        ? 'bg-green-500 text-white ring-2 ring-green-300'
                        : isAnswered
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {actualIndex + 1}
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* 힌트 모달 */}
      {showHint && currentQuestion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* 헤더 */}
            <div className="bg-yellow-500 text-white p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2">
                💡 힌트
              </h2>
              <button
                onClick={() => setShowHint(false)}
                className="text-white hover:text-gray-200 text-2xl font-bold"
              >
                ✕
              </button>
            </div>

            {/* 내용 */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">문제</h3>
                <LatexRenderer
                  text={currentQuestion.question || ''}
                  className="text-gray-700 leading-relaxed"
                />
              </div>
              
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">문제 풀이</h3>
                <LatexRenderer
                  text={currentQuestion.explanation || ''}
                  className="text-gray-700 leading-relaxed"
                />
              </div>
            </div>

            {/* 하단 버튼 */}
            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowHint(false)}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 제보 게시판 모달 */}
      {showFeedbackBoard && (
        <FeedbackBoard 
          onClose={() => setShowFeedbackBoard(false)}
          currentQuestion={currentQuestion}
          currentQuestionIndex={currentIndex}
        />
      )}

      {/* 공학용 계산기 모달 */}
      {showCalculator && (
        <ScientificCalculator onClose={() => setShowCalculator(false)} />
      )}

      {/* 인쇄 옵션 선택 모달 */}
      {showPrintOptions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 non-printable">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">🖨️ 인쇄 옵션 선택</h2>
            <p className="text-sm text-gray-600 mb-6">인쇄할 내용을 선택하세요</p>

            <div className="space-y-3 mb-6">
              {/* 문제만 인쇄 */}
              <button
                onClick={() => setPrintOption('questionsOnly')}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  printOption === 'questionsOnly'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center">
                  <div
                    className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${
                      printOption === 'questionsOnly'
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`}
                  >
                    {printOption === 'questionsOnly' && (
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-gray-800">📝 문제만 인쇄</div>
                    <div className="text-sm text-gray-600">문제와 선택지만 인쇄 (정답 표시 없음)</div>
                  </div>
                </div>
              </button>

              {/* 정답 표시 인쇄 */}
              <button
                onClick={() => setPrintOption('withAnswers')}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  printOption === 'withAnswers'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center">
                  <div
                    className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${
                      printOption === 'withAnswers'
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`}
                  >
                    {printOption === 'withAnswers' && (
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-gray-800">✅ 정답 표시 인쇄</div>
                    <div className="text-sm text-gray-600">문제 + 정답 표시 (파란색 ✓ 표시)</div>
                  </div>
                </div>
              </button>

              {/* 정답 + 해설 인쇄 */}
              <button
                onClick={() => setPrintOption('withExplanations')}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  printOption === 'withExplanations'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center">
                  <div
                    className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${
                      printOption === 'withExplanations'
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`}
                  >
                    {printOption === 'withExplanations' && (
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-gray-800">📚 정답 + 해설 인쇄</div>
                    <div className="text-sm text-gray-600">문제 + 정답 + 해설 전체</div>
                  </div>
                </div>
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPrintOptions(false)}
                className="flex-1 px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                취소
              </button>
              <button
                onClick={handlePrintExecute}
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                인쇄하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 채점 결과 모달 */}
      {showScoreModal && scoreResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full mx-4">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-800 mb-6">📊 채점 결과</h2>
              
              {/* 오답노트 모드일 때 */}
              {examMode === 'wrong' && scoreResult.encouragement ? (
                <>
                  {/* 격려 메시지 */}
                  <div className="mb-6 p-6 rounded-lg bg-blue-100 border-4 border-blue-500">
                    <div className="text-2xl font-bold mb-3 text-blue-800">
                      {scoreResult.encouragement}
                    </div>
                    {scoreResult.answeredCount !== undefined && scoreResult.answeredCount > 0 && (
                      <div className="text-lg text-blue-700">
                        {scoreResult.answeredCount}문제 응시해서 {scoreResult.correct}문제 맞췄습니다
                      </div>
                    )}
                  </div>

                  {/* 상세 결과 */}
                  <div className="space-y-3 mb-6">
                    {scoreResult.answeredCount !== undefined && (
                      <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                        <span className="text-blue-700 font-semibold">응시한 문제</span>
                        <span className="text-blue-900 font-bold">{scoreResult.answeredCount}문제</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="text-green-700 font-semibold">정답</span>
                      <span className="text-green-900 font-bold">{scoreResult.correct}문제</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                      <span className="text-red-700 font-semibold">오답</span>
                      <span className="text-red-900 font-bold">{scoreResult.wrong}문제</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                      <span className="text-blue-700 font-semibold">정답률</span>
                      <span className="text-blue-900 font-bold">{scoreResult.percentage}%</span>
                    </div>
                  </div>
                </>
              ) : (
                /* 일반 모드일 때 */
                <>
                  {/* 점수 표시 */}
                  <div className={`mb-6 p-6 rounded-lg ${
                    scoreResult.score >= 60 
                      ? 'bg-green-100 border-4 border-green-500' 
                      : 'bg-red-100 border-4 border-red-500'
                  }`}>
                    <div className="text-5xl font-bold mb-2">
                      {scoreResult.score >= 60 ? '✅' : '❌'} {scoreResult.score}점
                    </div>
                    <div className="text-lg text-gray-700">
                      {scoreResult.score >= 60 ? '합격!' : '불합격'}
                    </div>
                  </div>

                  {/* 상세 결과 */}
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-700 font-semibold">총 문제 수</span>
                      <span className="text-gray-900 font-bold">{scoreResult.total}문제</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="text-green-700 font-semibold">정답</span>
                      <span className="text-green-900 font-bold">{scoreResult.correct}문제</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                      <span className="text-red-700 font-semibold">오답</span>
                      <span className="text-red-900 font-bold">{scoreResult.wrong}문제</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                      <span className="text-yellow-700 font-semibold">미답변</span>
                      <span className="text-yellow-900 font-bold">{scoreResult.unanswered}문제</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                      <span className="text-blue-700 font-semibold">정답률</span>
                      <span className="text-blue-900 font-bold">{scoreResult.percentage}%</span>
                    </div>
                  </div>
                </>
              )}

              {/* 안내 문구 */}
              <p className="text-sm text-gray-600 mb-6">
                💡 시험은 계속 진행할 수 있습니다. 완료 후 제출 버튼을 눌러주세요.
              </p>

              {/* 닫기 버튼 */}
              <button
                onClick={() => {
                  // 오답노트 모드일 때 정답 문제를 오답노트에서 제거
                  if (examMode === 'wrong' && scoreResult) {
                    console.log('📊 확인 버튼 클릭 - 정답 문제 제거 시작');
                    console.log('📋 시험 모드:', examMode);
                    console.log('📋 총 문제 수:', displayQuestions.length);
                    console.log('📋 답변 데이터:', answers);
                    
                    // 현재 오답노트 상태 확인
                    const currentWrongAnswers = getWrongAnswers();
                    console.log('📋 현재 오답노트 문제 ID:', currentWrongAnswers.map(wa => wa.questionId));
                    
                    let removedCount = 0;
                    const beforeCount = currentWrongAnswers.length;
                    
                    // 모든 문제를 순회하며 정답 문제 제거
                    displayQuestions.forEach(q => {
                      const userAnswer = answers[q.id];
                      const isCorrect = userAnswer !== undefined && userAnswer !== null && userAnswer === q.answer;
                      
                      console.log(`문제 ${q.id} (${q.category}): 사용자 답변=${userAnswer}, 정답=${q.answer}, 정답 여부=${isCorrect}`);
                      
                      // 정답을 맞춘 문제는 오답노트에서 제거
                      if (isCorrect) {
                        // 오답노트에 실제로 존재하는지 확인
                        const existsInWrongAnswers = currentWrongAnswers.some(wa => wa.questionId === q.id);
                        console.log(`문제 ${q.id} 오답노트 존재 여부: ${existsInWrongAnswers}`);
                        
                        if (existsInWrongAnswers) {
                          console.log(`✅ 확인 버튼 클릭 - 문제 ${q.id} (${q.category}) 정답 확인, 오답노트에서 제거 시도`);
                          removeWrongAnswer(q.id);
                          removedCount++;
                          console.log(`✅ 확인 버튼 클릭 - 문제 ${q.id} (${q.category}) 오답노트에서 제거 완료`);
                        } else {
                          console.log(`ℹ️ 문제 ${q.id} (${q.category})는 이미 오답노트에 없습니다.`);
                        }
                      }
                    });
                    
                    // 제거 후 오답노트 상태 확인
                    const afterWrongAnswers = getWrongAnswers();
                    const afterCount = afterWrongAnswers.length;
                    console.log('📋 제거 후 오답노트 문제 ID:', afterWrongAnswers.map(wa => wa.questionId));
                    console.log(`📊 확인 버튼 클릭 - 제거 전: ${beforeCount}개, 제거 후: ${afterCount}개, 제거된 문제: ${removedCount}개`);
                    
                    // 제거가 제대로 되지 않은 경우 경고
                    if (removedCount > 0 && beforeCount - afterCount !== removedCount) {
                      console.warn(`⚠️ 제거된 문제 수(${removedCount})와 실제 제거된 수(${beforeCount - afterCount})가 일치하지 않습니다.`);
                    }
                  }

                  // 실전 모의고사 모드일 때는 결과 페이지로 이동
                  if ((examMode as string) === 'timedRandom') {
                    setShowScoreModal(false);
                    // 답안 제출 처리 (결과 페이지로 이동)
                    handleSubmit(true);
                  } else {
                    // 일반 모드는 모달만 닫기
                    setShowScoreModal(false);
                  }
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                확인
              </button>
            </div>
      </div>
        </div>
      )}
      </div>
    </>
  );
}
