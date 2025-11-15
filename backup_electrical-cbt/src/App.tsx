import { useState, useEffect } from 'react';
import type { Question } from './types';
import Home from './pages/Home';
import Exam from './pages/Exam';
import Result from './pages/Result';
import Login from './pages/Login';
import Admin from './pages/Admin';
import WrongAnswers from './pages/WrongAnswers';
import Statistics from './pages/Statistics';
import { getCurrentUser, initializeData, saveCurrentExamSession } from './services/storage';
import type { ExamSession } from './types';

type AppState = 'login' | 'home' | 'exam' | 'result' | 'admin' | 'wrongAnswers' | 'statistics';

function App() {
  const [state, setState] = useState<AppState>('login');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [examMode, setExamMode] = useState<'random' | 'category' | 'wrong'>('random');

  // 초기화
  useEffect(() => {
    initializeData();
    // 자동 샘플 데이터 로드 제거 - 로그인 시에만 서버 데이터 로드

    // URL 기반 라우팅 (관리자 페이지)
    const path = window.location.pathname;
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
  }, []);

  const handleLoginSuccess = () => {
    setState('home');
  };

  const handleGuestMode = () => {
    setState('home');
  };

  const handleStartExam = (selectedQuestions: Question[]) => {
    setQuestions(selectedQuestions);
    setStartTime(Date.now());
    setState('exam');
  };

  const handleCompleteExam = (examAnswers: (number | null)[], mode?: 'random' | 'category' | 'wrong') => {
    setAnswers(examAnswers);
    if (mode) {
      setExamMode(mode);
    }
    setState('result');
  };

  const handleRestart = () => {
    setQuestions([]);
    setAnswers([]);
    setStartTime(0);
    setState('home');
  };

  const handleExit = () => {
    setState('home');
  };

  const handleGoToWrongAnswers = () => {
    setState('wrongAnswers');
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
        <Login onLoginSuccess={handleLoginSuccess} onGuestMode={handleGuestMode} />
      )}
      {state === 'home' && (
        <Home
          onStartExam={handleStartExam}
          onGoToWrongAnswers={handleGoToWrongAnswers}
          onGoToStatistics={handleGoToStatistics}
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
        />
      )}
      {state === 'wrongAnswers' && (
        <WrongAnswers onBack={handleBackToHome} onStartReview={handleStartReview} />
      )}
      {state === 'statistics' && <Statistics onBack={handleBackToHome} />}
      {state === 'admin' && <Admin />}
    </div>
  );
}

export default App;
