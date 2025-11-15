import { useState, useEffect } from 'react';
import type { Question } from '../types';
import {
  getQuestions,
  getWrongAnswers,
  getCurrentExamSession,
  clearCurrentExamSession,
  saveCurrentExamSession,
  getCurrentUser,
  getMemberById,
  logout,
  initializeData,
  clearWrongAnswers,
  clearStatistics,
  saveQuestions,
} from '../services/storage';
import type { ExamSession } from '../types';
import { getExamConfig } from '../services/examConfigService';
import { selectBalancedQuestionsByWeight, selectCategoryQuestionsByWeight } from '../services/weightedRandomService';

interface HomeProps {
  onStartExam: (questions: Question[], mode: 'timedRandom' | 'untimedRandom' | 'category' | 'wrong') => void;
  onGoToWrongAnswers: () => void;
  onGoToStatistics: () => void;
}

export default function Home({ onStartExam, onGoToWrongAnswers, onGoToStatistics }: HomeProps) {
  const [mode, setMode] = useState<'timedRandom' | 'untimedRandom' | 'category' | 'wrong'>('untimedRandom');
  const [selectedCategory, setSelectedCategory] = useState<string>('전기이론');
  const [randomize, setRandomize] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasPreviousSession, setHasPreviousSession] = useState<boolean>(false);
  const [previousSession, setPreviousSession] = useState<ExamSession | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<string>('');

  const currentUserId = getCurrentUser();
  const currentUser = currentUserId ? getMemberById(currentUserId) : null;


  const [questionCounts, setQuestionCounts] = useState<{
    전기이론: number;
    전기기기: number;
    전기설비: number;
    total: number;
  }>({
    전기이론: 0,
    전기기기: 0,
    전기설비: 0,
    total: 0,
  });

  // 문제 수 로드 함수
  const loadQuestionCounts = () => {
    const allQuestions = getQuestions();
    const 전기이론 = allQuestions.filter(q => q.category === '전기이론').length;
    const 전기기기 = allQuestions.filter(q => q.category === '전기기기').length;
    const 전기설비 = allQuestions.filter(q => q.category === '전기설비').length;
    const total = 전기이론 + 전기기기 + 전기설비;

    setQuestionCounts({
      전기이론,
      전기기기,
      전기설비,
      total,
    });

    console.log(`📊 문제 현황: 전기이론 ${전기이론}개, 전기기기 ${전기기기}개, 전기설비 ${전기설비}개 (총 ${total}개)`);
    return total;
  };

  // 자동 TSV 데이터 로딩 함수
  const autoLoadTSVData = async () => {
    setIsInitialLoading(true);
    setLoadingProgress('문제 데이터를 확인하는 중...');

    try {
      // 약간의 딜레이로 UI 업데이트
      await new Promise(resolve => setTimeout(resolve, 500));

      setLoadingProgress('TSV 파일에서 문제 데이터를 다운로드하는 중...\n약 30초 정도 소요될 수 있습니다.');

      console.log('📂 TSV 파일에서 자동 문제 로드 시작...');
      const response = await fetch('/converted_questions.tsv');

      if (!response.ok) {
        throw new Error('TSV 파일을 찾을 수 없습니다.');
      }

      setLoadingProgress('TSV 파일 다운로드 완료...\n데이터를 파싱하는 중...');
      const text = await response.text();
      const lines = text.split('\n').filter(line => line.trim());
      const dataLines = lines.slice(1); // 헤더 제외

      setLoadingProgress(`${dataLines.length}개의 문제를 처리하는 중...\n잠시만 기다려주세요.`);
      await new Promise(resolve => setTimeout(resolve, 300));

      // 모든 문제 파싱
      const allTsvQuestions: Question[] = dataLines.map((line, index) => {
        const columns = line.split('\t');

        // 진행 상황 업데이트 (100개마다)
        if (index % 100 === 0) {
          setLoadingProgress(`문제 파싱 중... ${index}/${dataLines.length}\n(${Math.round((index / dataLines.length) * 100)}% 완료)`);
        }

        return {
          id: parseInt(columns[0]) || 0,
          category: columns[1] || '',
          question: columns[2] || '',
          option1: columns[3] || '',
          option2: columns[4] || '',
          option3: columns[5] || '',
          option4: columns[6] || '',
          answer: parseInt(columns[7]) || 1,
          explanation: columns[8] || '',
          imageUrl: columns[9] || undefined,
          hasImage: columns[10] === 'TRUE' || columns[10] === 'true',
        };
      }).filter(q => q.id > 0 && q.question.length > 0);

      if (allTsvQuestions.length > 0) {
        setLoadingProgress(`${allTsvQuestions.length}개의 문제를 저장하는 중...`);
        await new Promise(resolve => setTimeout(resolve, 300));

        // localStorage에 저장
        saveQuestions(allTsvQuestions);
        loadQuestionCounts();

        setLoadingProgress(`✅ ${allTsvQuestions.length}개의 문제를 성공적으로 로드했습니다!`);
        await new Promise(resolve => setTimeout(resolve, 1500));

        console.log(`✅ TSV 파일에서 ${allTsvQuestions.length}개 문제를 자동 로드 완료`);
      } else {
        throw new Error('TSV 파일에 유효한 문제가 없습니다.');
      }
    } catch (error) {
      console.error('TSV 자동 로드 실패:', error);
      setLoadingProgress(`⚠️ 문제 데이터 로드에 실패했습니다.\n\n관리자 페이지에서 수동으로 데이터를 추가해주세요.`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    } finally {
      setIsInitialLoading(false);
      setLoadingProgress('');
    }
  };

  // 초기화 및 문제 현황 표시
  useEffect(() => {
    initializeData();
    const totalQuestions = loadQuestionCounts();

    // 문제 데이터가 없으면 자동으로 TSV에서 로드
    if (totalQuestions === 0) {
      console.log('⚠️ 문제 데이터가 없습니다. 자동으로 TSV 파일에서 로드를 시작합니다.');
      autoLoadTSVData();
    }

    // 이전 세션이 없거나 실전 모의고사 세션일 때 기본값으로 랜덤 60문제 선택
    const existingSession = getCurrentExamSession();
    if (!existingSession || !existingSession.questions || existingSession.questions.length === 0 || existingSession.mode === 'timedRandom') {
      setMode('untimedRandom');
    }

    // 페이지가 다시 포커스될 때 자동 업데이트 (사용자가 관리자 페이지에서 돌아올 때)
    const handleFocus = () => {
      loadQuestionCounts();
      console.log('🔄 페이지 포커스 - 문제 현황 자동 업데이트');
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // 이전 시험 세션 확인 - mode가 변경될 때마다 체크
  useEffect(() => {
    const existingSession = getCurrentExamSession();
    
    // 실전모의고사 모드일 때는 이전 세션을 무시 (60분 시험이므로 새로 시작)
    if (mode === 'timedRandom') {
      setHasPreviousSession(false);
      setPreviousSession(null);
      return;
    }
    
    // 다른 모드일 때만 이전 세션 복원 허용
    if (existingSession && existingSession.questions && existingSession.questions.length > 0) {
      // 실전 모의고사 세션이 아닐 때만 이전 세션 표시
      if (existingSession.mode !== 'timedRandom') {
        setHasPreviousSession(true);
        setPreviousSession(existingSession);
      } else {
        // 실전 모의고사 세션이면 무시하고 랜덤 60문제로 설정
        setHasPreviousSession(false);
        setPreviousSession(null);
        if (mode !== 'untimedRandom') {
          setMode('untimedRandom');
        }
      }
    } else {
      setHasPreviousSession(false);
      setPreviousSession(null);
      // 이전 세션이 없을 때 기본값으로 랜덤 60문제 선택
      if (mode !== 'untimedRandom') {
        setMode('untimedRandom');
      }
    }
  }, [mode]);

  const handleStartExam = async () => {
    setLoading(true);

    try {
      // 이전 시험 세션이 있으면 삭제하고 새로 시작
      const existingSession = getCurrentExamSession();
      if (existingSession && existingSession.questions.length > 0) {
        clearCurrentExamSession();
        setHasPreviousSession(false);
        setPreviousSession(null);
      }

      // 문제 데이터 다시 로드 시도 (모바일에서 localStorage 동기화 문제 대응)
      initializeData();
      loadQuestionCounts(); // 문제 수 다시 확인
      const allQuestions = getQuestions();

      // 디버깅 정보
      console.log('📊 문제 로드 상태:', {
        questionsCount: allQuestions.length,
        localStorageAvailable: typeof Storage !== 'undefined',
        questionsKey: localStorage.getItem('questions') ? '존재' : '없음',
        questionsKeyLength: localStorage.getItem('questions')?.length || 0,
        userAgent: navigator.userAgent,
        questionCounts: questionCounts,
      });

      if (allQuestions.length === 0) {
        // localStorage 상태 확인
        const hasQuestionsKey = localStorage.getItem('questions') !== null;
        const questionsData = localStorage.getItem('questions');
        
        let errorMessage = '등록된 문제가 없습니다.\n\n';
        
        if (!hasQuestionsKey) {
          errorMessage += '문제 데이터가 저장되어 있지 않습니다.\n';
        } else if (questionsData) {
          try {
            const parsed = JSON.parse(questionsData);
            if (Array.isArray(parsed) && parsed.length === 0) {
              errorMessage += '문제 데이터는 있지만 비어있습니다.\n\n';
              errorMessage += '가능한 원인:\n';
              errorMessage += '1. 관리자 페이지에서 문제를 추가하지 않았습니다.\n';
              errorMessage += '2. PC와 모바일이 다른 브라우저/도메인을 사용합니다.\n';
              errorMessage += '3. 시크릿 모드에서 localStorage가 제한되었습니다.\n\n';
              errorMessage += '해결 방법:\n';
              errorMessage += '1. 관리자 페이지에서 문제를 추가한 후 저장하세요.\n';
              errorMessage += '2. 모바일에서 페이지를 새로고침하세요.\n';
              errorMessage += '3. 같은 도메인/포트를 사용하는지 확인하세요.';
            } else {
              errorMessage += `문제 데이터 파싱 오류가 발생했습니다.\n`;
            }
          } catch (e) {
            errorMessage += `문제 데이터 파싱 오류: ${e}\n`;
          }
        }
        
        errorMessage += '\n\n관리자 페이지에서 문제를 추가해주세요.';
        
        // TSV 파일 또는 Google Sheets 동기화 시도 옵션 제공
        const shouldTrySync = confirm(
          errorMessage + 
          '\n\n로컬 TSV 파일 또는 Google Sheets에서 문제를 가져오시겠습니까?'
        );
        
        if (shouldTrySync) {
          try {
            setLoading(true);
            
            // 먼저 TSV 파일에서 필요한 문제만 선택해서 로드 시도
            console.log('📂 TSV 파일에서 문제 로드 시도 중...');
            try {
              const response = await fetch('/converted_questions.tsv');
              if (response.ok) {
                const text = await response.text();
                const lines = text.split('\n').filter(line => line.trim());
                const dataLines = lines.slice(1); // 헤더 제외
                
                // 모든 문제 파싱
                const allTsvQuestions: Question[] = dataLines.map(line => {
                  const columns = line.split('\t');
                  return {
                    id: parseInt(columns[0]) || 0,
                    category: columns[1] || '',
                    question: columns[2] || '',
                    option1: columns[3] || '',
                    option2: columns[4] || '',
                    option3: columns[5] || '',
                    option4: columns[6] || '',
                    answer: parseInt(columns[7]) || 1,
                    explanation: columns[8] || '',
                    imageUrl: columns[9] || undefined,
                  };
                }).filter(q => q.id > 0 && q.question.length > 0);
                
                if (allTsvQuestions.length > 0) {
                  // 필요한 60문제만 선택 (가중치 기반)
                  const examConfig = getExamConfig();
                  const { selectBalancedQuestionsByWeight } = await import('../services/weightedRandomService');
                  
                  // 시험 모드에 따라 필요한 문제 수 결정
                  const neededCount = (mode === 'timedRandom' || mode === 'untimedRandom') ? 60 : 20;
                  
                  // 필요한 문제만 선택
                  const selectedQuestions = selectBalancedQuestionsByWeight(allTsvQuestions, neededCount, examConfig);
                  
                  // 선택된 문제만 localStorage에 저장 (빠른 로딩)
                  saveQuestions(selectedQuestions);
                  loadQuestionCounts();
                  alert(`✅ TSV 파일에서 ${selectedQuestions.length}개 문제를 선택하여 가져왔습니다.\n\n다시 시험 시작 버튼을 클릭해주세요.`);
                  setLoading(false);
                  return;
                }
              }
            } catch (tsvError) {
              console.warn('TSV 파일 로드 실패:', tsvError);
            }
            
            // TSV 실패 시 Google Sheets 시도
            console.log('🌐 Google Sheets에서 문제 로드 시도 중...');
            const { getAllQuestionsFromSheets } = await import('../services/googleSheetsService');
            const allSheetsQuestions = await getAllQuestionsFromSheets(['questions', '전기이론', '전기기기', '전기설비', '기타']);
            
            if (allSheetsQuestions && allSheetsQuestions.length > 0) {
              // 필요한 60문제만 선택 (가중치 기반)
              const examConfig = getExamConfig();
              const { selectBalancedQuestionsByWeight } = await import('../services/weightedRandomService');
              
              // 시험 모드에 따라 필요한 문제 수 결정
              const neededCount = (mode === 'timedRandom' || mode === 'untimedRandom') ? 60 : 20;
              
              // 필요한 문제만 선택
              const selectedQuestions = selectBalancedQuestionsByWeight(allSheetsQuestions, neededCount, examConfig);
              
              // 선택된 문제만 localStorage에 저장 (빠른 로딩)
              saveQuestions(selectedQuestions);
              loadQuestionCounts();
              alert(`✅ Google Sheets에서 ${selectedQuestions.length}개 문제를 선택하여 가져왔습니다.\n\n다시 시험 시작 버튼을 클릭해주세요.`);
              setLoading(false);
              return;
            } else {
              alert('⚠️ TSV 파일과 Google Sheets에서 문제를 가져올 수 없습니다.\n\n관리자 페이지에서 문제를 추가해주세요.');
            }
          } catch (syncError) {
            console.error('문제 로드 실패:', syncError);
            alert('❌ 문제 로드에 실패했습니다.\n\n관리자 페이지에서 문제를 추가해주세요.');
          }
        }
        
        setLoading(false);
        return;
      }

      let examQuestions: Question[] = [];

      // 출제 설정 불러오기
      const examConfig = getExamConfig();
      console.log('📋 출제 설정:', examConfig);

      // 모드별 문제 선택
      if (mode === 'timedRandom' || mode === 'untimedRandom') {
        // 랜덤출제 모드: 가중치 기반 균등 배분 (총 60문제)
        const modeLabel = mode === 'timedRandom' ? '실전 모의고사' : '랜덤 60문제';
        console.log(`🎲 ${modeLabel}: 가중치 기반 균등 배분`);
        examQuestions = selectBalancedQuestionsByWeight(allQuestions, 60, examConfig);
        console.log(`✅ 선택된 문제: ${examQuestions.length}개`);

        // 문제 수 부족 경고
        if (examQuestions.length < 60) {
          const categories = ['전기이론', '전기기기', '전기설비'];
          const categoryDetails = categories
            .map(cat => `${cat}: ${allQuestions.filter(q => q.category === cat).length}개`)
            .join(', ');

          alert(
            `일부 카테고리에 문제가 부족합니다.\n\n` +
            `현재 DB 문제 수: ${allQuestions.length}개\n` +
            `카테고리별: ${categoryDetails}\n\n` +
            `${examQuestions.length}문제로 시작합니다.`
          );
        }
      } else if (mode === 'category') {
        // 카테고리별 모드: 선택한 카테고리에서 가중치 기반 20문제 선택
        console.log(`📚 카테고리 모드: ${selectedCategory} (가중치 기반)`);

        const categoryQuestions = allQuestions.filter(q => q.category === selectedCategory);

        if (categoryQuestions.length === 0) {
          alert(`${selectedCategory} 카테고리에 문제가 없습니다.`);
          setLoading(false);
          return;
        }

        // 가중치 기반 선택
        examQuestions = selectCategoryQuestionsByWeight(allQuestions, selectedCategory, 20, examConfig);
        console.log(`✅ 선택된 문제: ${examQuestions.length}개`);

        if (examQuestions.length < 20) {
          alert(
            `${selectedCategory} 카테고리에 문제가 ${categoryQuestions.length}개뿐입니다.\n${examQuestions.length}문제로 시작합니다.`
          );
        }
      } else if (mode === 'wrong') {
        // 오답노트 모드: 연속 3회 정답 미만인 문제만 선택 (최대 20문제)
        const wrongAnswers = getWrongAnswers();
        const eligibleWrong = wrongAnswers.filter(wa => wa.correctStreak < 3);

        if (eligibleWrong.length === 0) {
          alert('오답노트에 풀 문제가 없습니다.');
          setLoading(false);
          return;
        }

        let wrongQuestions = eligibleWrong.map(wa => wa.question);

        // 20문제 초과 시 랜덤 선택
        if (wrongQuestions.length > 20) {
          const shuffled = [...wrongQuestions].sort(() => Math.random() - 0.5);
          wrongQuestions = shuffled.slice(0, 20);
        }

        examQuestions = wrongQuestions;
      }

      const currentUserId = getCurrentUser();
      // 세션 저장
      const sessionData: ExamSession = {
        questions: examQuestions,
        answers: {},
        startTime: Date.now(),
        mode,
        category: mode === 'category' ? selectedCategory : undefined,
        userId: currentUserId || undefined, // 현재 사용자 ID 저장
      };
      saveCurrentExamSession(sessionData);

      // 실전 모의고사 모드는 새창으로 시험 진행
      if (mode === 'timedRandom') {
        const width = 1400;
        const height = 900;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;

        const newWindow = window.open(
          `${window.location.origin}${window.location.pathname}?mode=exam`,
          '_blank',
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );

        if (newWindow) {
          console.log('✅ 실전 모의고사 새창 열림');
          // 새창이 성공적으로 열렸으면 현재 창은 홈 화면 유지
        } else {
          alert('⚠️ 팝업이 차단되었습니다.\n\n브라우저 설정에서 팝업을 허용해주세요.');
        }
      } else {
        // 기타 모드는 현재 창에서 시험 진행
        onStartExam(examQuestions, mode);
      }
    } catch (error) {
      console.error('시험 시작 오류:', error);
      alert('시험을 시작하는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleResumePreviousExam = () => {
    if (previousSession && previousSession.questions && previousSession.questions.length > 0) {
      // 실전 모의고사 모드는 새창으로 이어서 풀기
      if (previousSession.mode === 'timedRandom') {
        const width = 1400;
        const height = 900;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;

        const newWindow = window.open(
          `${window.location.origin}${window.location.pathname}?mode=exam`,
          '_blank',
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );

        if (newWindow) {
          console.log('✅ 실전 모의고사 새창 열림 (이어하기)');
        } else {
          alert('⚠️ 팝업이 차단되었습니다.\n\n브라우저 설정에서 팝업을 허용해주세요.');
        }
      } else {
        // 기타 모드는 현재 창에서 이어서 풀기
        // 세션의 문제에 이미지 복원
        const allQuestions = getQuestions();
        const questionsWithImages = previousSession.questions.map(sessionQ => {
          const originalQ = allQuestions.find(q => q.id === sessionQ.id);
          if (originalQ && originalQ.imageUrl) {
            return { ...sessionQ, imageUrl: originalQ.imageUrl };
          }
          return sessionQ;
        });

        onStartExam(questionsWithImages, previousSession.mode as 'timedRandom' | 'untimedRandom' | 'category' | 'wrong');
      }
    }
  };

  const handleLogout = () => {
    if (window.confirm('로그아웃하시겠습니까?')) {
      logout();
      window.location.reload();
    }
  };

  const handleClearAllData = () => {
    const wrongCount = getWrongAnswers().length;
    const stats = getCurrentExamSession();
    const hasStats = stats && stats.questions && stats.questions.length > 0;
    
    let message = '모든 데이터를 초기화하시겠습니까?\n\n';
    if (wrongCount > 0) {
      message += `- 오답 노트: ${wrongCount}문제\n`;
    }
    if (hasStats) {
      message += `- 진행 중인 시험 세션\n`;
    }
    message += `- 학습 통계\n\n`;
    message += '⚠️ 이 작업은 되돌릴 수 없습니다.';
    
    if (window.confirm(message)) {
      clearWrongAnswers();
      clearStatistics();
      clearCurrentExamSession();
      alert('✅ 모든 데이터가 초기화되었습니다.');
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      {/* 초기 데이터 로딩 오버레이 */}
      {isInitialLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center">
            <div className="mb-6">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">📚 문제 데이터 로딩 중</h2>
              <p className="text-gray-600 mb-4">처음 접속 시 문제 데이터를 다운로드합니다.</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 mb-4">
              <p className="text-blue-800 whitespace-pre-line font-medium">
                {loadingProgress}
              </p>
            </div>
            <div className="text-sm text-gray-500">
              <p>⏱️ 약 30초 정도 소요될 수 있습니다.</p>
              <p className="mt-1">이 작업은 처음 한 번만 실행됩니다.</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">⚡ 전기기능사 CBT</h1>
          <p className="text-gray-600">Computer Based Test</p>

          {/* 로그인 상태 표시 */}
          {currentUser && (
            <div className="mt-4 flex justify-center items-center gap-3">
              <div className="bg-blue-100 px-4 py-2 rounded-full">
                <span className="text-blue-800 font-semibold">
                  👤 {currentUser.name}님 환영합니다!
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
              >
                로그아웃
              </button>
            </div>
          )}
          {!currentUser && (
            <div className="mt-4">
              <span className="bg-yellow-100 px-4 py-2 rounded-full text-yellow-800 text-sm">
                👤 게스트 모드 (기록 저장 안됨)
              </span>
            </div>
          )}
        </div>

        {/* 문제 출제 */}
        <>
            {/* 문제 현황 - 카드 형식 */}
            <div className="mb-6">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-800">📊 문제 현황</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* 전체 문제 */}
                <div className="text-center p-2 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {questionCounts.total ?? 0}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">전체 문제</div>
                </div>
                {/* 전기이론 */}
                <div className="text-center p-2 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {questionCounts.전기이론 ?? 0}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">전기이론</div>
                </div>
                {/* 전기기기 */}
                <div className="text-center p-2 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {questionCounts.전기기기 ?? 0}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">전기기기</div>
                </div>
                {/* 전기설비 */}
                <div className="text-center p-2 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {questionCounts.전기설비 ?? 0}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">전기설비</div>
                </div>
              </div>
            </div>

            {/* 시험 모드 선택 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">시험 모드 선택</label>
              <div className="space-y-2">
                {/* B-2: 랜덤 60문제 (시간 제한 없음) - 초록색 */}
                <div>
                  <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    mode === 'untimedRandom'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:bg-green-50 hover:border-green-300'
                  }`}>
                    <input
                      type="radio"
                      name="mode"
                      value="untimedRandom"
                      checked={mode === 'untimedRandom'}
                      onChange={() => setMode('untimedRandom')}
                      className="mr-3 w-4 h-4"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-green-700">🎲 랜덤 60문제 (시간 제한 없음)</div>
                      <div className="text-sm text-green-600">
                        전기이론 20 + 전기기기 20 + 전기설비 20 = 총 60문제
                      </div>
                      <div className="text-xs text-green-500 mt-1">
                        ⏰ 시간 제한 없이 자유롭게 학습
                      </div>
                    </div>
                  </label>
                  
                  {/* 이전 시험 계속하기 버튼 - 랜덤 60문제 영역 아래 */}
                  {hasPreviousSession && previousSession && previousSession.mode === 'untimedRandom' && (
                    <div className="mt-2 ml-7">
                      <button
                        onClick={handleResumePreviousExam}
                        className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded transition-colors duration-200 flex items-center gap-1"
                      >
                        <span>📖 이전 시험 계속하기</span>
                      </button>
                      <div className="mt-1 text-xs text-gray-500">
                        진행: {Object.keys(previousSession.answers || {}).length} / {previousSession.questions.length} 문제
                      </div>
                    </div>
                  )}
                </div>

                {/* C-1: 카테고리별 집중 학습 */}
                <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                  mode === 'category'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <input
                    type="radio"
                    name="mode"
                    value="category"
                    checked={mode === 'category'}
                    onChange={() => setMode('category')}
                    className="mr-3 w-4 h-4"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800">📚 카테고리별 집중 학습</div>
                    <div className="text-sm text-gray-600">선택한 카테고리에서 20문제 출제</div>
                  </div>
                </label>

                {/* C-2: 스마트 오답노트 복습 */}
                <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                  mode === 'wrong'
                    ? 'border-pink-500 bg-pink-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <input
                    type="radio"
                    name="mode"
                    value="wrong"
                    checked={mode === 'wrong'}
                    onChange={() => setMode('wrong')}
                    className="mr-3 w-4 h-4"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800">📝 스마트 오답노트 복습</div>
                    <div className="text-sm text-gray-600">
                      틀렸던 문제만 재출제 (최대 20문제)
                    </div>
                  </div>
                </label>

                {/* B-1: 실전 모의고사 (60분 제한) - 파란색 강조 */}
                <label className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  mode === 'timedRandom'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:bg-blue-50 hover:border-blue-300'
                }`}>
                  <input
                    type="radio"
                    name="mode"
                    value="timedRandom"
                    checked={mode === 'timedRandom'}
                    onChange={() => setMode('timedRandom')}
                    className="mr-3 w-4 h-4"
                  />
                  <div className="flex-1">
                    <div className="font-bold text-blue-700 text-lg">🎯 실전 모의고사 (60분 제한)</div>
                    <div className="text-sm text-blue-600 mt-1">
                      전기이론 20 + 전기기기 20 + 전기설비 20 = 총 60문제
                    </div>
                    <div className="text-xs text-blue-500 mt-1">
                      ⏱️ 실전과 동일한 60분 타이머 적용
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* 카테고리 선택 (카테고리별 모드 시) */}
            {mode === 'category' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">카테고리 선택</label>
                <div className="space-y-2">
                  {['전기이론', '전기기기', '전기설비'].map(cat => (
                    <label
                      key={cat}
                      className="flex items-center p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <input
                        type="radio"
                        name="category"
                        value={cat}
                        checked={selectedCategory === cat}
                        onChange={() => setSelectedCategory(cat)}
                        className="mr-3 w-4 h-4"
                      />
                      <span className="font-medium text-gray-800">{cat}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* 시작 버튼 */}
            <button
              onClick={handleStartExam}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-lg transition-colors duration-200 text-lg"
            >
              {loading ? '문제 불러오는 중...' : '🚀 시험 시작'}
            </button>

            {/* 학습 도구 버튼 */}
            <div className="flex gap-4 mt-6">
              <button
                onClick={onGoToWrongAnswers}
                className="flex-1 px-4 py-3 bg-pink-100 hover:bg-pink-200 text-red-800 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                📝 오답 노트
              </button>
              <button
                onClick={onGoToStatistics}
                className="flex-1 px-4 py-3 bg-green-100 hover:bg-green-200 text-green-800 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                📊 학습 통계
              </button>
              <button
                onClick={handleClearAllData}
                className="px-4 py-3 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
              >
                🗑️ 데이터초기화
              </button>
            </div>

            {/* 안내 문구 */}
            <p className="text-center text-sm text-gray-500 mt-6">
              ⚠️ 시험이 시작되면 타이머가 작동하며, 60분 후 자동으로 제출됩니다.
            </p>
        </>

      </div>
    </div>
  );
}
