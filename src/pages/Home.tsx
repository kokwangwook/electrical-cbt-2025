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
  getReviewQuestions,
} from '../services/storage';
import type { ExamSession } from '../types';
import {
  fetchRandom60Questions,
  fetchRandomQuestions,
  getCategoryCounts,
} from '../services/supabaseService';

interface HomeProps {
  onStartExam: (questions: Question[], mode: 'timedRandom' | 'untimedRandom' | 'category' | 'wrong' | 'review') => void;
  onGoToWrongAnswers: () => void;
  onGoToStatistics: () => void;
}

export default function Home({ onStartExam, onGoToWrongAnswers, onGoToStatistics }: HomeProps) {
  const [mode, setMode] = useState<'timedRandom' | 'untimedRandom' | 'category' | 'wrong' | 'review'>('untimedRandom');
  const [selectedCategory, setSelectedCategory] = useState<string>('전기이론');
  const [loading, setLoading] = useState<boolean>(false);
  const [hasPreviousSession, setHasPreviousSession] = useState<boolean>(false);
  const [previousSession, setPreviousSession] = useState<ExamSession | null>(null);
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

  // 문제 수 로드 함수 (서버에서 직접 COUNT)
  const loadQuestionCounts = async () => {
    try {
      const counts = await getCategoryCounts();
      setQuestionCounts(counts);
      console.log(`📊 문제 현황 (서버): 전기이론 ${counts.전기이론}개, 전기기기 ${counts.전기기기}개, 전기설비 ${counts.전기설비}개 (총 ${counts.total}개)`);
      return counts.total;
    } catch (error) {
      console.error('서버 문제 수 로드 실패:', error);
      // 실패 시 로컬 캐시에서 로드
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

      console.log(`📊 문제 현황 (로컬 캐시): 전기이론 ${전기이론}개, 전기기기 ${전기기기}개, 전기설비 ${전기설비}개 (총 ${total}개)`);
      return total;
    }
  };

  // 초기화 및 문제 현황 표시
  useEffect(() => {
    initializeData();

    // 서버에서 문제 수 로드 (더 이상 전체 다운로드 불필요)
    loadQuestionCounts();

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

      let examQuestions: Question[] = [];

      // 모드별 문제 선택 (서버에서 직접 가져오기)
      if (mode === 'timedRandom' || mode === 'untimedRandom') {
        // 랜덤출제 모드: 서버에서 직접 60문제 가져오기
        const modeLabel = mode === 'timedRandom' ? '실전 모의고사' : '랜덤 60문제';
        console.log(`🎲 ${modeLabel}: 서버에서 직접 60문제 가져오기`);

        setLoadingProgress('서버에서 랜덤 60문제를 가져오는 중...');
        examQuestions = await fetchRandom60Questions();
        console.log(`✅ 서버에서 가져온 문제: ${examQuestions.length}개`);

        // 문제 수 부족 경고
        if (examQuestions.length < 60) {
          alert(
            `일부 카테고리에 문제가 부족합니다.\n\n` +
            `서버에서 가져온 문제: ${examQuestions.length}개\n\n` +
            `${examQuestions.length}문제로 시작합니다.`
          );
        }

        if (examQuestions.length === 0) {
          alert('❌ 서버에서 문제를 가져올 수 없습니다.\n\n네트워크 연결을 확인하거나 관리자에게 문의하세요.');
          setLoading(false);
          setLoadingProgress('');
          return;
        }
      } else if (mode === 'category') {
        // 카테고리별 모드: 서버에서 해당 카테고리 20문제 가져오기
        console.log(`📚 카테고리 모드: ${selectedCategory} (서버에서 직접 가져오기)`);

        setLoadingProgress(`${selectedCategory}에서 20문제를 가져오는 중...`);
        examQuestions = await fetchRandomQuestions(selectedCategory, 20);
        console.log(`✅ 서버에서 가져온 문제: ${examQuestions.length}개`);

        if (examQuestions.length === 0) {
          alert(`${selectedCategory} 카테고리에 문제가 없습니다.`);
          setLoading(false);
          setLoadingProgress('');
          return;
        }

        if (examQuestions.length < 20) {
          alert(
            `${selectedCategory} 카테고리에 문제가 ${examQuestions.length}개뿐입니다.\n${examQuestions.length}문제로 시작합니다.`
          );
        }
      } else if (mode === 'wrong') {
        // 오답노트 모드: 로컬 오답 데이터 사용 (연속 3회 정답 미만인 문제만)
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
      } else if (mode === 'review') {
        // 복습 모드: 학습 진도 1-5만 포함 (완벽 이해 6 제외)
        console.log('📚 복습 모드: 학습 진도 기반 문제 선택');
        
        setLoadingProgress('학습 진도 기반 문제를 선택하는 중...');
        examQuestions = getReviewQuestions();
        
        if (examQuestions.length === 0) {
          alert('복습할 문제가 없습니다.\n\n학습 진도를 체크한 문제가 없거나, 모든 문제가 완벽 이해 상태입니다.');
          setLoading(false);
          setLoadingProgress('');
          return;
        }
        
        if (examQuestions.length < 60) {
          alert(
            `학습 진도가 있는 문제가 ${examQuestions.length}개뿐입니다.\n${examQuestions.length}문제로 시작합니다.`
          );
        }
      }

      setLoadingProgress('');

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
      alert('시험을 시작하는 중 오류가 발생했습니다.\n\n네트워크 연결을 확인해주세요.');
    } finally {
      setLoading(false);
      setLoadingProgress('');
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

                {/* C-3: 학습 진도 기반 복습 */}
                <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                  mode === 'review'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <input
                    type="radio"
                    name="mode"
                    value="review"
                    checked={mode === 'review'}
                    onChange={() => setMode('review')}
                    className="mr-3 w-4 h-4"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800">📚 학습 진도 기반 복습</div>
                    <div className="text-sm text-gray-600">
                      학습 진도 1-5 문제만 복습 (완벽 이해 제외)
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      전기이론 20 + 전기기기 20 + 전기설비 20 = 총 60문제
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
              {loading ? (loadingProgress || '서버에서 문제 불러오는 중...') : '🚀 시험 시작'}
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
