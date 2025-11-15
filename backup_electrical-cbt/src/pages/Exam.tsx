import { useState, useEffect, useMemo } from 'react';
import type { Question } from '../types';
import ScientificCalculator from '../components/ScientificCalculator';
import { getStandardTitle } from '../data/examStandards';
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
} from '../services/storage';
import type { ExamSession, ExamResult, WrongAnswer } from '../types';
import LatexRenderer from '../components/LatexRenderer';
import FeedbackBoard from '../components/FeedbackBoard';

interface ExamProps {
  questions: Question[];
  onComplete: (answers: (number | null)[], mode?: 'random' | 'category' | 'wrong') => void;
  onExit: () => void;
}

export default function Exam({ questions, onComplete, onExit }: ExamProps) {
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

  // 정렬된 문제 사용
  const displayQuestions = sortedQuestions;

  // 초기 세션 복원
  const savedSession = getCurrentExamSession();
  const shouldRestoreSession = savedSession && 
    savedSession.questions && 
    savedSession.questions.length > 0 &&
    displayQuestions.length > 0 &&
    savedSession.questions.length === displayQuestions.length;
  
  let initialAnswers: { [key: number]: number } = {};
  let initialStartTime = Date.now();
  let initialRemainingTime = 60 * 60; // 60분 = 3600초
  let initialMode: 'random' | 'category' | 'wrong' = 'random';
  const duration = 60 * 60; // 60분
  
  if (shouldRestoreSession) {
    // 문제 ID가 일치하는지 확인 (정렬된 문제 기준)
    const savedQuestionIds = savedSession.questions.map(q => q.id).sort();
    const currentQuestionIds = displayQuestions.map(q => q.id).sort();
    
    if (savedQuestionIds.length === currentQuestionIds.length &&
        savedQuestionIds.every((id, index) => id === currentQuestionIds[index])) {
      initialAnswers = savedSession.answers || {};
      initialMode = savedSession.mode || 'random';
      
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
  }

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [key: number]: number }>(initialAnswers);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [remainingTime, setRemainingTime] = useState(initialRemainingTime);
  const [examMode, setExamMode] = useState<'random' | 'category' | 'wrong'>(initialMode);
  const [isTimeReset, setIsTimeReset] = useState(false); // 시간 초기화 여부
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false); // 계산기 표시 여부
  const [showFeedbackBoard, setShowFeedbackBoard] = useState(false); // 제보 게시판 표시 여부
  const [showHint, setShowHint] = useState(false); // 힌트 모달 표시 여부
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

  // 세션 복원 (questions prop이 변경될 때마다 확인)
  useEffect(() => {
    if (displayQuestions.length === 0) return;
    
    const savedSession = getCurrentExamSession();
    if (savedSession && savedSession.questions && savedSession.questions.length > 0) {
      // 문제 ID가 일치하는지 확인
      const savedQuestionIds = savedSession.questions.map(q => q.id).sort();
      const currentQuestionIds = displayQuestions.map(q => q.id).sort();
      
      // 문제 ID가 모두 일치하면 세션 복원
      if (
        savedQuestionIds.length === currentQuestionIds.length &&
        savedQuestionIds.every((id, index) => id === currentQuestionIds[index])
      ) {
        const restoredAnswers = savedSession.answers || {};
        setAnswers(restoredAnswers);
        setExamMode(savedSession.mode || 'random');
        
        // 풀지 못한 문제 수 계산
        const answeredCount = Object.keys(restoredAnswers).length;
        const unansweredCount = displayQuestions.length - answeredCount;
        
        // 답변 기록이 없으면 새로운 시작 시간으로 설정하고 60분 부여
        if (answeredCount === 0) {
          setStartTime(Date.now()); // 새로운 시작 시간
          setRemainingTime(60 * 60); // 60분
          console.log(`⏰ 세션 복원: 답변 기록 없음. 새로운 시험으로 시작 (60분)`);
        } else {
          // 답변 기록이 있으면 이전 세션의 시작 시간 유지
          setStartTime(savedSession.startTime);
          // 풀지 못한 문제당 1분(60초)씩 시간 부여
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
  }, [questions, duration]);

  // 세션 자동 저장
  useEffect(() => {
    const currentUserId = getCurrentUser();
    const session: ExamSession = {
      questions: displayQuestions,
      answers,
      startTime,
      mode: examMode,
      category: undefined,
      userId: currentUserId || undefined, // 현재 사용자 ID 저장
    };
    saveCurrentExamSession(session);
  }, [answers, displayQuestions, startTime, examMode]);

  // 타이머
  useEffect(() => {
    if (displayQuestions.length === 0) return;

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

    // ExamResult 저장
    const result: ExamResult = {
      totalQuestions: displayQuestions.length,
      correctAnswers: correctCount,
      wrongQuestions,
      allQuestions: displayQuestions, // 전체 문제 목록 추가 (통계 계산용)
      timestamp: Date.now(),
      mode: examMode,
      category: undefined,
    };

    addExamResult(result);
    updateStatistics(result);
    clearCurrentExamSession();

    // 결과 페이지로 이동 (answers를 배열로 변환)
    const answersArray: (number | null)[] = displayQuestions.map(q => answers[q.id] || null);
    onComplete(answersArray, examMode);
  };

  // 나가기 버튼: 자동 저장 + 나가기
  const handleExit = () => {
    try {
      const currentUserId = getCurrentUser();
      // 시험 현황 명시적으로 저장 (사용자가 저장 버튼을 누르지 않아도 자동 저장)
      const session: ExamSession = {
        questions: displayQuestions,
        answers,
        startTime,
        mode: examMode,
        category: undefined,
        userId: currentUserId || undefined, // 현재 사용자 ID 저장
      };
      
      // 세션 저장 (에러 처리 포함)
      saveCurrentExamSession(session);
      
      const answeredCount = Object.keys(answers).length;
      const totalCount = displayQuestions.length;
      
      // 저장 완료 로그
      console.log(`💾 시험 현황 자동 저장 완료: ${answeredCount}/${totalCount} 문제 풀이 완료`);
      
      // 저장 완료 후 나가기
      onExit();
    } catch (error) {
      console.error('❌ 시험 현황 저장 실패:', error);
      // 저장 실패해도 나가기는 진행 (사용자 경험)
      alert('⚠️ 시험 현황 저장에 실패했습니다. 진행 상황이 손실될 수 있습니다.');
      onExit();
    }
  };
  
  // 저장하기 버튼
  const handleSave = () => {
    const currentUserId = getCurrentUser();
    // 세션 저장 (이미 useEffect에서 자동 저장되지만 명시적으로 저장)
    const session: ExamSession = {
      questions: displayQuestions,
      answers,
      startTime,
      mode: examMode,
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
      
      const currentUserId = getCurrentUser();
      // 세션 저장
      const session: ExamSession = {
        questions: displayQuestions,
        answers,
        startTime: newStartTime,
        mode: examMode,
        category: undefined,
        userId: currentUserId || undefined, // 현재 사용자 ID 저장
      };
      saveCurrentExamSession(session);
      
      alert('✅ 시험 시간이 60분으로 초기화되었습니다.');
    }
  };

  // 채점 버튼
  const handleScore = () => {
    const currentUserId = getCurrentUser();
    // 세션 자동 저장
    const session: ExamSession = {
      questions,
      answers,
      startTime,
      mode: examMode,
      category: undefined,
      userId: currentUserId || undefined, // 현재 사용자 ID 저장
    };
    saveCurrentExamSession(session);

    console.log('📊 채점하기 버튼 클릭 - 오답 저장 로직 실행');
    console.log('📋 총 문제 수:', questions.length);
    console.log('📋 답변한 문제 수:', Object.keys(answers).length);
    console.log('📋 답변 데이터:', answers);
    console.log('📋 시험 모드:', examMode);

    // 오답노트 모드일 때는 다른 채점 로직 사용
    const isWrongMode = examMode === 'wrong';

    // 채점 결과 계산 및 오답 저장
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;
    let savedWrongCount = 0;
    let answeredCount = 0; // 응시한 문제 수 (오답노트 모드용)

    displayQuestions.forEach(q => {
      const userAnswer = answers[q.id];
      if (userAnswer === undefined || userAnswer === null) {
        unansweredCount++;
      } else {
        answeredCount++; // 응시한 문제 카운트
        if (userAnswer === q.answer) {
          correctCount++;
          // 오답노트 모드일 때는 정답을 맞춘 문제를 즉시 제거
          if (isWrongMode) {
            // 오답노트에 실제로 존재하는지 확인 후 제거
            const currentWrongAnswers = getWrongAnswers();
            const existsInWrongAnswers = currentWrongAnswers.some(wa => wa.questionId === q.id);
            if (existsInWrongAnswers) {
              removeWrongAnswer(q.id);
              console.log(`✅ 정답: 문제 ${q.id} (${q.category}) - 오답노트에서 즉시 제거`);
            } else {
              console.log(`ℹ️ 정답: 문제 ${q.id} (${q.category}) - 이미 오답노트에 없음`);
            }
          } else {
            // 일반 모드일 때는 correctStreak++, 3회 연속 시 오답노트에서 제거
            updateCorrectAnswer(q.id);
            console.log(`✅ 정답: 문제 ${q.id} (${q.category})`);
          }
        } else {
          wrongCount++;
          // 오답 처리: wrongCount++, correctStreak=0
          // 사용자가 답변을 선택했고, 틀린 경우에만 오답 저장 (채점 기준)
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

    // 오답노트 모드일 때는 응시한 문제만 대상으로 채점
    let total: number;
    let score: number;
    let percentage: number;
    let encouragement: string = '';

    if (isWrongMode) {
      // 오답노트 모드: 응시한 문제만 대상으로 채점
      total = answeredCount; // 응시한 문제 수
      if (total === 0) {
        score = 0;
        percentage = 0;
        encouragement = '답변을 선택해주세요! 💪';
      } else {
        score = Math.round((correctCount / total) * 100);
        percentage = ((correctCount / total) * 100);
        
        // 격려 메시지 생성
        if (percentage === 100) {
          encouragement = '아주 잘하였어요! 완벽합니다! 🎉';
        } else if (percentage >= 80) {
          encouragement = '훌륭합니다! 잘하고 있어요! 👍';
        } else if (percentage >= 60) {
          encouragement = '좋아요! 계속 노력하세요! 💪';
        } else {
          encouragement = '조금 더 노력하면 더 좋아질 거예요! 화이팅! 💪';
        }
      }
    } else {
      // 일반 모드: 전체 문제 대상으로 채점
      total = displayQuestions.length;
      score = Math.round((correctCount / total) * 100);
      percentage = ((correctCount / total) * 100);
    }

    // 채점 결과 저장
    setScoreResult({
      total,
      correct: correctCount,
      wrong: wrongCount,
      unanswered: unansweredCount,
      score,
      percentage: parseFloat(percentage.toFixed(1)),
      encouragement: isWrongMode ? encouragement : undefined,
      answeredCount: isWrongMode ? answeredCount : undefined,
    });

    // 모달 표시
    setShowScoreModal(true);
  };

  const answeredCount = Object.keys(answers).length;
  const currentQuestion = displayQuestions[currentIndex];
  const selectedAnswer = answers[currentQuestion?.id];

  return (
    <div className="min-h-screen bg-gray-100 p-3">
      <div className="max-w-7xl mx-auto">
        {/* 상단 헤더 */}
        <div className="bg-white rounded-lg shadow-md p-3 mb-2">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <h1 className="text-xl font-bold text-gray-800">⚡ 전기기능사 CBT</h1>
            <div className="flex items-center gap-2">
              {/* 타이머 */}
              <div
                className={`px-4 py-2 rounded-lg font-bold text-lg ${
                  remainingTime < 300
                    ? 'bg-red-100 text-red-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                ⏱️ {formatTime(remainingTime)}
              </div>
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
              <button
                onClick={handleSave}
                className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                💾 저장하기
              </button>
              <button
                onClick={handleResetTime}
                className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                ⏰ 시간 초기화
              </button>
              <button
                onClick={handleScore}
                className="px-3 py-1.5 text-sm bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
              >
                📊 채점하기
              </button>
              <button
                onClick={handleExit}
                className="px-3 py-1.5 text-sm bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                ← 나가기
              </button>
            </div>
          </div>
        </div>

        {/* 진행률 */}
        <div className="bg-white rounded-lg shadow-md p-3 mb-2">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-gray-700">
              문제 {currentIndex + 1} / {displayQuestions.length}
            </span>
            <span className="text-sm font-semibold text-gray-700">
              답변: {answeredCount} / {displayQuestions.length}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${((currentIndex + 1) / displayQuestions.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* 문제 영역 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-3">
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-bold text-gray-800">
                {(() => {
                  // 카테고리별 문제 번호 계산
                  const category = currentQuestion?.category || '기타';
                  let questionNumber = currentIndex + 1;
                  
                  // 카테고리별로 문제 번호 재계산
                  if (category === '전기이론') {
                    // 전기이론은 1-20번
                    const theoryQuestions = displayQuestions.filter(q => q.category === '전기이론');
                    const theoryIndex = theoryQuestions.findIndex(q => q.id === currentQuestion?.id);
                    questionNumber = theoryIndex >= 0 ? theoryIndex + 1 : currentIndex + 1;
                  } else if (category === '전기기기') {
                    // 전기기기는 21-40번
                    const deviceQuestions = displayQuestions.filter(q => q.category === '전기기기');
                    const deviceIndex = deviceQuestions.findIndex(q => q.id === currentQuestion?.id);
                    questionNumber = deviceIndex >= 0 ? 21 + deviceIndex : currentIndex + 1;
                  } else if (category === '전기설비') {
                    // 전기설비는 41-60번
                    const facilityQuestions = displayQuestions.filter(q => q.category === '전기설비');
                    const facilityIndex = facilityQuestions.findIndex(q => q.id === currentQuestion?.id);
                    questionNumber = facilityIndex >= 0 ? 41 + facilityIndex : currentIndex + 1;
                  }
                  
                  return `문제 ${questionNumber}`;
                })()}
              </h2>
              <div className="flex gap-2 items-center flex-wrap">
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                  {currentQuestion?.category}
                </span>
                {currentQuestion?.standard && (
                  <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold">
                    {currentQuestion.standard} - {getStandardTitle(currentQuestion.standard)}
                  </span>
                )}
                {currentQuestion?.detailItem && (
                  <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-semibold">
                    {currentQuestion.detailItem}
                  </span>
                )}
              </div>
            </div>
            <LatexRenderer
              text={currentQuestion?.question || ''}
              className="text-gray-700 text-lg leading-relaxed"
            />
          </div>

          {/* 이미지 (있으면) */}
          {currentQuestion?.imageUrl && (
            <div className="mb-4">
              <img
                src={currentQuestion.imageUrl}
                alt="문제 이미지"
                className="max-w-full h-auto rounded-lg"
              />
            </div>
          )}

          {/* 선택지 */}
          <div className="space-y-3">
            {[1, 2, 3, 4].map(optionNum => {
              const optionKey = `option${optionNum}` as keyof Question;
              const optionText = currentQuestion?.[optionKey] as string;
              const isSelected = selectedAnswer === optionNum;

              return (
                <button
                  key={optionNum}
                  onClick={() => handleAnswerSelect(optionNum)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start">
                    <span
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold mr-3 ${
                        isSelected
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {optionNum}
                    </span>
                    <LatexRenderer text={optionText || ''} className="flex-1 text-gray-700" />
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
              className="px-5 py-2 text-sm bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white rounded-lg font-semibold transition-colors disabled:cursor-not-allowed"
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

            <div className="flex gap-2">
              {currentIndex === displayQuestions.length - 1 ? (
                <button
                  onClick={() => handleSubmit(false)}
                  className="px-5 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
                >
                  ✓ 시험 제출
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                >
                  다음 →
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 문제 번호 네비게이션 - 카테고리별 구분 */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">문제 번호</h3>
          
          {/* 카테고리 범례 */}
          <div className="flex flex-wrap gap-4 mb-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span className="text-gray-600">현재 문제</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-green-100 border-2 border-green-500 rounded"></div>
              <span className="text-gray-600">답변 완료</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-gray-200 rounded"></div>
              <span className="text-gray-600">미답변</span>
            </div>
          </div>
          
          {/* 카테고리별 문제 번호 - 실제 카테고리로 그룹화 */}
          <div className="space-y-4">
            {(() => {
              // 카테고리별로 문제 그룹화
              const categoryGroups: Record<string, { question: Question; index: number }[]> = {
                '전기이론': [],
                '전기기기': [],
                '전기설비': [],
                '기타': [],
              };

              displayQuestions.forEach((q, idx) => {
                const category = q.category || '기타';
                if (!categoryGroups[category]) {
                  categoryGroups[category] = [];
                }
                categoryGroups[category].push({ question: q, index: idx });
              });

              // 카테고리별 색상 설정
              const categoryColors: Record<string, { bg: string; text: string; label: string }> = {
                '전기이론': { bg: 'bg-blue-100', text: 'text-blue-700', label: '전기이론' },
                '전기기기': { bg: 'bg-purple-100', text: 'text-purple-700', label: '전기기기' },
                '전기설비': { bg: 'bg-orange-100', text: 'text-orange-700', label: '전기설비' },
                '기타': { bg: 'bg-gray-100', text: 'text-gray-700', label: '기타' },
              };

              // 카테고리 순서 정의
              const categoryOrder = ['전기이론', '전기기기', '전기설비', '기타'];

              // 카테고리별 시작 번호 계산
              let questionNumberOffset = 0;
              
              return categoryOrder.map(category => {
                const group = categoryGroups[category];
                if (!group || group.length === 0) return null;

                const colors = categoryColors[category] || categoryColors['기타'];
                
                // 카테고리별 문제 번호 범위 계산
                let startNumber: number;
                let endNumber: number;
                
                if (category === '전기이론') {
                  startNumber = 1;
                  endNumber = 20;
                } else if (category === '전기기기') {
                  startNumber = 21;
                  endNumber = 40;
                } else if (category === '전기설비') {
                  startNumber = 41;
                  endNumber = 60;
                } else {
                  startNumber = questionNumberOffset + 1;
                  endNumber = questionNumberOffset + group.length;
                }

                return (
                  <div key={category}>
                    <h4 className={`text-xs font-semibold ${colors.text} mb-2 flex items-center gap-2`}>
                      <span className={`px-2 py-0.5 ${colors.bg} rounded`}>{colors.label}</span>
                      <span className="text-gray-500">({startNumber}-{endNumber})</span>
                    </h4>
                    <div className="grid grid-cols-10 gap-2">
                      {group.map(({ question, index }, groupIndex) => {
                        const isAnswered = !!answers[question.id];
                        const isCurrent = index === currentIndex;
                        
                        // 카테고리별 문제 번호 계산
                        let questionNumber: number;
                        if (category === '전기이론') {
                          questionNumber = groupIndex + 1; // 1-20
                        } else if (category === '전기기기') {
                          questionNumber = 21 + groupIndex; // 21-40
                        } else if (category === '전기설비') {
                          questionNumber = 41 + groupIndex; // 41-60
                        } else {
                          questionNumber = questionNumberOffset + groupIndex + 1;
                        }

                        return (
                          <button
                            key={question.id}
                            onClick={() => handleNavigate(index)}
                            className={`p-2 rounded text-sm font-semibold transition-all ${
                              isCurrent
                                ? 'bg-blue-500 text-white'
                                : isAnswered
                                ? 'bg-green-100 text-green-800 border-2 border-green-500 hover:bg-green-200'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                            title={`문제 ${questionNumber}: ${question.category} (실제 인덱스: ${index + 1})`}
                          >
                            {questionNumber}
                          </button>
                        );
                      })}
                    </div>
                    {(() => {
                      // 다음 카테고리를 위한 오프셋 업데이트
                      if (category === '전기이론') {
                        questionNumberOffset = 20;
                      } else if (category === '전기기기') {
                        questionNumberOffset = 40;
                      } else if (category === '전기설비') {
                        questionNumberOffset = 60;
                      } else {
                        questionNumberOffset += group.length;
                      }
                      return null;
                    })()}
                  </div>
                );
              });
            })()}
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
        <FeedbackBoard onClose={() => setShowFeedbackBoard(false)} />
      )}

      {/* 공학용 계산기 모달 */}
      {showCalculator && (
        <ScientificCalculator onClose={() => setShowCalculator(false)} />
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
                  setShowScoreModal(false);
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
  );
}
