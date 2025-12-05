import { useState, useEffect } from 'react';
import type { Question } from './types';
import Home from './pages/Home';
import Exam from './pages/Exam';
import Result from './pages/Result';
import Login from './pages/Login';
import Register from './pages/Register';
import Admin from './pages/Admin';
import WrongAnswers from './pages/WrongAnswers';
import Statistics from './pages/Statistics';
import FinalStudy from './pages/FinalStudy';
import { getCurrentUser, initializeData, saveCurrentExamSession, getCurrentExamSession, getQuestions } from './services/storage';
import type { ExamSession } from './types';

type AppState = 'login' | 'register' | 'home' | 'exam' | 'result' | 'admin' | 'wrongAnswers' | 'statistics' | 'finalStudy';

function App() {
  const [state, setState] = useState<AppState>('login');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [examMode, setExamMode] = useState<'timedRandom' | 'untimedRandom' | 'category' | 'wrong' | 'review'>('timedRandom');

  // 초기화
  useEffect(() => {
    initializeData();
    // 자동 샘플 데이터 로드 제거 - 로그인 시에만 서버 데이터 로드

    // URL 기반 라우팅
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const examModeParam = params.get('mode');

    // 시험 모드 자동 시작 (새창으로 열린 경우)
    if (examModeParam === 'exam') {
      const session = getCurrentExamSession();
      if (session && session.questions && session.questions.length > 0) {
        // 세션의 문제에 이미지 복원 (세션 저장 시 용량 절약을 위해 이미지 제거됨)
        const allQuestions = getQuestions();
        const questionsWithImages = session.questions.map(sessionQ => {
          const originalQ = allQuestions.find(q => q.id === sessionQ.id);
          if (originalQ && originalQ.imageUrl) {
            return { ...sessionQ, imageUrl: originalQ.imageUrl };
          }
          return sessionQ;
        });

        setQuestions(questionsWithImages);
        setExamMode(session.mode || 'timedRandom');
        setStartTime(session.startTime || Date.now());
        setState('exam');
        console.log('✅ 시험 세션 복원 완료 (이미지 포함)');
        return;
      }
    }

    // 관리자 페이지
    if (path === '/admin') {
      setState('admin');
    } else {
      // 기존 로그인 상태 확인
      const userId = getCurrentUser();
      if (userId) {
        setState('home');
      } else {
        setState('login');
      }
    }

    // URL hash 기반 라우팅 (플래시카드)
    const handleHashChange = () => {
      if (window.location.hash === '#final-study') {
        setState('finalStudy');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // 초기 로드 시 체크

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const handleLoginSuccess = () => {
    setState('home');
  };

  // 로그인 시 이전 세션 복원
  const handleResumeExam = () => {
    const session = getCurrentExamSession();
    if (session && session.questions && session.questions.length > 0) {
      // 세션의 문제에 이미지 복원
      const allQuestions = getQuestions();
      const questionsWithImages = session.questions.map(sessionQ => {
        const originalQ = allQuestions.find(q => q.id === sessionQ.id);
        if (originalQ && originalQ.imageUrl) {
          return { ...sessionQ, imageUrl: originalQ.imageUrl };
        }
        return sessionQ;
      });

      setQuestions(questionsWithImages);
      setExamMode(session.mode || 'untimedRandom');
      setStartTime(session.startTime || Date.now());
      setState('exam');
      console.log('✅ 이전 시험 세션 복원 완료 (이미지 포함)');
    } else {
      // 세션이 없으면 홈으로
      setState('home');
    }
  };

  const handleGoToRegister = () => {
    setState('register');
  };

  const handleRegisterSuccess = () => {
    setState('login');
  };

  const handleBackToLogin = () => {
    setState('login');
  };

  const handleStartExam = (selectedQuestions: Question[], mode: 'timedRandom' | 'untimedRandom' | 'category' | 'wrong' | 'review') => {
    setQuestions(selectedQuestions);
    setExamMode(mode);
    setStartTime(Date.now());

    // 기존 세션이 있고 문제 세트가 같으면 세션을 덮어쓰지 않음 (answers 유지)
    const existingSession = getCurrentExamSession();
    const existingQuestionIds = existingSession?.questions?.map(q => q.id).sort().join(',') || '';
    const newQuestionIds = selectedQuestions.map(q => q.id).sort().join(',');

    if (existingSession && existingQuestionIds === newQuestionIds && Object.keys(existingSession.answers || {}).length > 0) {
      // 기존 세션에 답변이 있으면 세션을 덮어쓰지 않음
      console.log(`📋 기존 세션 유지: ${Object.keys(existingSession.answers || {}).length}개 답변 보존`);
    } else {
      // 새로운 세션 저장
      const session: ExamSession = {
        questions: selectedQuestions,
        answers: {},
        startTime: Date.now(),
        mode: mode as any,
        userId: getCurrentUser() || undefined,
      };
      saveCurrentExamSession(session);
    }

    setState('exam');
  };

  const handleCompleteExam = (examAnswers: (number | null)[], mode?: 'timedRandom' | 'untimedRandom' | 'random' | 'category' | 'wrong' | 'review') => {
    setAnswers(examAnswers);
    if (mode && mode !== 'random') {
      setExamMode(mode);
    }
    setState('result');
  };

  const handleRestart = () => {
    // 실전 모의고사 모드이고 새 창으로 열린 경우 창 닫기
    const params = new URLSearchParams(window.location.search);
    const isNewWindow = params.get('mode') === 'exam' && window.opener !== null;

    if (isNewWindow && examMode === 'timedRandom') {
      // 새 창 닫기
      window.close();
    } else {
      // 다시 시작: 기존에 푼 문제를 재로드 (세션 복원)
      const session = getCurrentExamSession();
      if (session && session.questions && session.questions.length > 0) {
        // 세션의 문제에 이미지 복원
        const allQuestions = getQuestions();
        const questionsWithImages = session.questions.map(sessionQ => {
          const originalQ = allQuestions.find(q => q.id === sessionQ.id);
          if (originalQ && originalQ.imageUrl) {
            return { ...sessionQ, imageUrl: originalQ.imageUrl };
          }
          return sessionQ;
        });

        setQuestions(questionsWithImages);
        setExamMode(session.mode || 'untimedRandom');
        setStartTime(session.startTime || Date.now());
        setState('exam');
      } else {
        // 세션이 없으면 홈으로
        setQuestions([]);
        setAnswers([]);
        setStartTime(0);
        setState('home');
      }
    }
  };

  const handleExit = () => {
    setState('home');
  };

  const handleGoToStatistics = () => {
    setState('statistics');
  };

  const handleBackToHome = () => {
    setState('home');
  };

  const handleStartReview = (reviewQuestions: Question[]) => {
    setQuestions(reviewQuestions);
    const startTime = Date.now();
    setStartTime(startTime);
    setExamMode('wrong'); // 오답노트 복습 모드

    // ExamSession 저장
    const currentUserId = getCurrentUser();
    const sessionData: ExamSession = {
      questions: reviewQuestions,
      answers: {},
      startTime,
      mode: 'wrong',
      category: undefined,
      userId: currentUserId || undefined, // 현재 사용자 ID 저장
    };
    saveCurrentExamSession(sessionData);

    setState('exam');
  };

  const timeSpent = state === 'result' ? Math.floor((Date.now() - startTime) / 1000) : 0;

  return (
    <div>
      {state === 'login' && (
        <Login
          onLoginSuccess={handleLoginSuccess}
          onResumeExam={handleResumeExam}
          onGoToRegister={handleGoToRegister}
        />
      )}
      {state === 'register' && (
        <Register
          onRegisterSuccess={handleRegisterSuccess}
          onBackToLogin={handleBackToLogin}
        />
      )}
      {state === 'home' && (
        <Home
          onStartExam={handleStartExam}
          onGoToStatistics={handleGoToStatistics}
          onGoToFinalStudy={() => setState('finalStudy')}
        />
      )}
      {state === 'exam' && (
        <Exam questions={questions} onComplete={handleCompleteExam} onExit={handleExit} />
      )}
      {state === 'result' && (
        <Result
          questions={questions}
          answers={answers}
          timeSpent={timeSpent}
          mode={examMode}
          onRestart={handleRestart}
          onGoHome={handleExit}
        />
      )}
      {state === 'wrongAnswers' && (
        <WrongAnswers onBack={handleBackToHome} onStartReview={handleStartReview} />
      )}
      {state === 'statistics' && <Statistics onBack={handleBackToHome} />}
      {state === 'admin' && <Admin />}
      {state === 'finalStudy' && (
        <FinalStudy
          onGoBack={() => {
            window.location.hash = '';
            setState('home');
          }}
        />
      )}
    </div>
  );
}

export default App;
