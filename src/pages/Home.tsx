import { useState, useEffect, useRef } from 'react';
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
  getReviewQuestions,
  clearAllData,
} from '../services/storage';
import type { ExamSession } from '../types';
import {
  fetchRandom60Questions,
  fetchRandomQuestions,
  getCategoryCounts,
  fetchAllQuestions,
} from '../services/supabaseService';
import { getExamConfig } from '../services/examConfigService';
import { selectBalancedQuestionsByWeight, selectCategoryQuestionsByWeight } from '../services/weightedRandomService';

interface HomeProps {
  onStartExam: (questions: Question[], mode: 'timedRandom' | 'untimedRandom' | 'category' | 'wrong' | 'review') => void;
  onGoToStatistics: () => void;
}

export default function Home({ onStartExam, onGoToStatistics }: HomeProps) {
  const [activeTab, setActiveTab] = useState<'learning' | 'exam'>('learning');
  const [learningMode, setLearningMode] = useState<'untimedRandom' | 'category' | 'wrong' | 'review'>('untimedRandom');
  const [selectedCategory, setSelectedCategory] = useState<string>('전기이론');
  const [loading, setLoading] = useState<boolean>(false);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [hasPreviousSession, setHasPreviousSession] = useState<boolean>(false);
  const [previousSession, setPreviousSession] = useState<ExamSession | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
    loadQuestionCounts();

    // 페이지가 다시 포커스될 때 자동 업데이트
    const handleFocus = () => {
      loadQuestionCounts();
      console.log('🔄 페이지 포커스 - 문제 현황 자동 업데이트');
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 이전 시험 세션 확인
  useEffect(() => {
    const existingSession = getCurrentExamSession();

    if (existingSession && existingSession.questions && existingSession.questions.length > 0) {
      // 실전 모의고사 세션이 아닐 때만 이전 세션 표시
      if (existingSession.mode !== 'timedRandom') {
        setHasPreviousSession(true);
        setPreviousSession(existingSession);
      } else {
        setHasPreviousSession(false);
        setPreviousSession(null);
      }
    } else {
      setHasPreviousSession(false);
      setPreviousSession(null);
    }
  }, []);

  const handleStartLearning = async () => {
    setLoading(true);

    try {
      // 이전 시험 세션 삭제
      const existingSession = getCurrentExamSession();
      if (existingSession && existingSession.questions.length > 0) {
        clearCurrentExamSession();
        setHasPreviousSession(false);
        setPreviousSession(null);
      }

      let examQuestions: Question[] = [];

      if (learningMode === 'untimedRandom') {
        // 가중치 기반 출제 설정 확인
        const examConfig = getExamConfig();

        // 디버깅: 설정 상세 로그
        console.log('🔧 [디버깅] 출제 설정 로드됨:', JSON.stringify(examConfig, null, 2));
        console.log(`🔧 [디버깅] weightBasedEnabled: ${examConfig.weightBasedEnabled} (타입: ${typeof examConfig.weightBasedEnabled})`);
        console.log(`🔧 [디버깅] mode: ${examConfig.mode}`);
        console.log(`🔧 [디버깅] selectedWeights: [${examConfig.selectedWeights.join(', ')}]`);
        if (examConfig.weightRatios) {
          console.log(`🔧 [디버깅] weightRatios:`, examConfig.weightRatios);
        }

        if (examConfig.weightBasedEnabled) {
          console.log('🎯 가중치 기반 출제 모드 활성화');
          console.log(`📋 모드: ${examConfig.mode}, 선택된 가중치: ${examConfig.selectedWeights.join(', ')}`);

          // 모든 문제 가져오기
          const allQuestions = await fetchAllQuestions();
          console.log(`📚 서버에서 전체 문제 로드: ${allQuestions.length}개`);

          if (allQuestions.length === 0) {
            alert('❌ 서버에서 문제를 가져올 수 없습니다.\n\n네트워크 연결을 확인하거나 관리자에게 문의하세요.');
            setLoading(false);
            return;
          }

          // 전체 문제 가중치 분포 로그
          const totalWeightDist: { [key: number]: number } = {};
          allQuestions.forEach(q => {
            const w = q.weight || 5;
            totalWeightDist[w] = (totalWeightDist[w] || 0) + 1;
          });
          console.log('📊 [디버깅] 전체 문제 가중치 분포:', totalWeightDist);

          // 가중치 기반 문제 선택
          examQuestions = selectBalancedQuestionsByWeight(allQuestions, 60, examConfig);
          console.log(`✅ 가중치 기반 선택 완료: ${examQuestions.length}개`);

          // 선택된 문제의 가중치 분포 로그
          const weightDist: { [key: number]: number } = {};
          examQuestions.forEach(q => {
            const w = q.weight || 5;
            weightDist[w] = (weightDist[w] || 0) + 1;
          });
          console.log('📊 선택된 문제 가중치 분포:', weightDist);

          // 카테고리별 분포도 확인
          const categoryDist: { [key: string]: number } = {};
          examQuestions.forEach(q => {
            categoryDist[q.category] = (categoryDist[q.category] || 0) + 1;
          });
          console.log('📊 [디버깅] 선택된 문제 카테고리 분포:', categoryDist);
        } else {
          console.log('🎲 랜덤 60문제: 서버에서 직접 60문제 가져오기 (가중치 비활성화)');
          console.log('⚠️ [주의] Admin에서 "가중치 기반 출제 사용"을 활성화해야 합니다!');
          examQuestions = await fetchRandom60Questions();
          console.log(`✅ 서버에서 가져온 문제: ${examQuestions.length}개`);
        }

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
          return;
        }
      } else if (learningMode === 'category') {
        console.log(`📚 카테고리 모드: ${selectedCategory}`);

        // 가중치 기반 출제 설정 확인
        const examConfig = getExamConfig();
        console.log('📊 카테고리 모드 - 가중치 설정:', examConfig);

        if (examConfig.weightBasedEnabled) {
          console.log(`🎯 가중치 기반 출제 활성화됨 - 선택된 가중치: ${examConfig.selectedWeights.join(', ')}`);

          // 모든 문제를 가져와서 가중치 필터링 적용
          const allQuestions = await fetchAllQuestions();
          console.log(`📥 전체 문제 로드: ${allQuestions.length}개`);

          if (allQuestions.length === 0) {
            alert('❌ 서버에서 문제를 가져올 수 없습니다.');
            setLoading(false);
            return;
          }

          // 카테고리 + 가중치 기반 선택
          examQuestions = selectCategoryQuestionsByWeight(
            allQuestions,
            selectedCategory,
            20,
            examConfig
          );
          console.log(`✅ 가중치 필터링 후 문제: ${examQuestions.length}개`);

          if (examQuestions.length === 0) {
            alert(
              `❌ ${selectedCategory} 카테고리에서 선택된 가중치 [${examConfig.selectedWeights.join(', ')}]에 해당하는 문제가 없습니다.\n\n` +
              '관리자 페이지에서 가중치 설정을 확인하거나, 문제에 가중치를 설정해주세요.'
            );
            setLoading(false);
            return;
          }
        } else {
          // 가중치 기반 출제 비활성화 - 기존 로직 사용
          console.log('📚 가중치 기반 출제 비활성화 - 랜덤 선택');
          examQuestions = await fetchRandomQuestions(selectedCategory, 20);
          console.log(`✅ 서버에서 가져온 문제: ${examQuestions.length}개`);

          if (examQuestions.length === 0) {
            alert(`${selectedCategory} 카테고리에 문제가 없습니다.`);
            setLoading(false);
            return;
          }
        }

        if (examQuestions.length < 20) {
          alert(
            `${selectedCategory} 카테고리에 문제가 ${examQuestions.length}개뿐입니다.\n${examQuestions.length}문제로 시작합니다.`
          );
        }
      } else if (learningMode === 'wrong') {
        const wrongAnswers = getWrongAnswers();
        const eligibleWrong = wrongAnswers.filter(wa => wa.correctStreak < 3);

        if (eligibleWrong.length === 0) {
          alert('오답노트에 풀 문제가 없습니다.');
          setLoading(false);
          return;
        }

        let wrongQuestions = eligibleWrong.map(wa => wa.question);

        if (wrongQuestions.length > 20) {
          const shuffled = [...wrongQuestions].sort(() => Math.random() - 0.5);
          wrongQuestions = shuffled.slice(0, 20);
        }

        examQuestions = wrongQuestions;
      } else if (learningMode === 'review') {
        console.log('📚 복습 모드: 학습 진도 기반 문제 선택');
        examQuestions = getReviewQuestions();

        if (examQuestions.length === 0) {
          alert('복습할 문제가 없습니다.\n\n학습 진도를 체크한 문제가 없거나, 모든 문제가 완벽 이해 상태입니다.');
          setLoading(false);
          return;
        }

        if (examQuestions.length < 60) {
          alert(
            `학습 진도가 있는 문제가 ${examQuestions.length}개뿐입니다.\n${examQuestions.length}문제로 시작합니다.`
          );
        }
      }

      const currentUserId = getCurrentUser();
      const sessionData: ExamSession = {
        questions: examQuestions,
        answers: {},
        startTime: Date.now(),
        mode: learningMode,
        category: learningMode === 'category' ? selectedCategory : undefined,
        userId: currentUserId || undefined,
      };
      saveCurrentExamSession(sessionData);

      onStartExam(examQuestions, learningMode);
    } catch (error) {
      console.error('학습 시작 오류:', error);
      alert('학습을 시작하는 중 오류가 발생했습니다.\n\n네트워크 연결을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = async () => {
    setLoading(true);

    try {
      const existingSession = getCurrentExamSession();
      if (existingSession && existingSession.questions.length > 0) {
        clearCurrentExamSession();
        setHasPreviousSession(false);
        setPreviousSession(null);
      }

      console.log('🎯 실전 모의고사: 서버에서 직접 60문제 가져오기');

      // 가중치 기반 출제 설정 확인
      const examConfig = getExamConfig();
      let examQuestions: Question[];

      // 디버깅: 설정 상세 로그
      console.log('🔧 [디버깅] 실전 모의고사 - 출제 설정 로드됨:', JSON.stringify(examConfig, null, 2));
      console.log(`🔧 [디버깅] weightBasedEnabled: ${examConfig.weightBasedEnabled} (타입: ${typeof examConfig.weightBasedEnabled})`);

      if (examConfig.weightBasedEnabled) {
        console.log('🎯 가중치 기반 출제 모드 활성화 (실전 모의고사)');
        console.log(`📋 모드: ${examConfig.mode}, 선택된 가중치: ${examConfig.selectedWeights.join(', ')}`);

        // 모든 문제 가져오기
        const allQuestions = await fetchAllQuestions();
        console.log(`📚 서버에서 전체 문제 로드: ${allQuestions.length}개`);

        if (allQuestions.length === 0) {
          alert('❌ 서버에서 문제를 가져올 수 없습니다.\n\n네트워크 연결을 확인하거나 관리자에게 문의하세요.');
          setLoading(false);
          return;
        }

        // 전체 문제 가중치 분포 로그
        const totalWeightDist: { [key: number]: number } = {};
        allQuestions.forEach(q => {
          const w = q.weight || 5;
          totalWeightDist[w] = (totalWeightDist[w] || 0) + 1;
        });
        console.log('📊 [디버깅] 전체 문제 가중치 분포:', totalWeightDist);

        // 가중치 기반 문제 선택
        examQuestions = selectBalancedQuestionsByWeight(allQuestions, 60, examConfig);
        console.log(`✅ 가중치 기반 선택 완료: ${examQuestions.length}개`);

        // 선택된 문제의 가중치 분포 로그
        const weightDist: { [key: number]: number } = {};
        examQuestions.forEach(q => {
          const w = q.weight || 5;
          weightDist[w] = (weightDist[w] || 0) + 1;
        });
        console.log('📊 선택된 문제 가중치 분포:', weightDist);

        // 카테고리별 분포도 확인
        const categoryDist: { [key: string]: number } = {};
        examQuestions.forEach(q => {
          categoryDist[q.category] = (categoryDist[q.category] || 0) + 1;
        });
        console.log('📊 [디버깅] 선택된 문제 카테고리 분포:', categoryDist);
      } else {
        console.log('🎲 가중치 비활성화 - 일반 랜덤 선택');
        console.log('⚠️ [주의] Admin에서 "가중치 기반 출제 사용"을 활성화해야 합니다!');
        examQuestions = await fetchRandom60Questions();
        console.log(`✅ 서버에서 가져온 문제: ${examQuestions.length}개 (가중치 비활성화)`);
      }

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
        return;
      }

      const currentUserId = getCurrentUser();
      const sessionData: ExamSession = {
        questions: examQuestions,
        answers: {},
        startTime: Date.now(),
        mode: 'timedRandom',
        userId: currentUserId || undefined,
      };
      saveCurrentExamSession(sessionData);

      const width = 1400;
      const height = 900;
      const left = (window.screen.width - width) / 2;
      const top = 100; // Y축 위치를 100픽셀로 고정

      const newWindow = window.open(
        `${window.location.origin}${window.location.pathname}?mode=exam`,
        '_blank',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      if (newWindow) {
        console.log('✅ 실전 모의고사 새창 열림');
      } else {
        alert('⚠️ 팝업이 차단되었습니다.\n\n브라우저 설정에서 팝업을 허용해주세요.');
      }
    } catch (error) {
      console.error('시험 시작 오류:', error);
      alert('시험을 시작하는 중 오류가 발생했습니다.\n\n네트워크 연결을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleResumePreviousExam = () => {
    if (previousSession && previousSession.questions && previousSession.questions.length > 0) {
      const allQuestions = getQuestions();
      const questionsWithImages = previousSession.questions.map(sessionQ => {
        const originalQ = allQuestions.find(q => q.id === sessionQ.id);
        if (originalQ && originalQ.imageUrl) {
          return { ...sessionQ, imageUrl: originalQ.imageUrl };
        }
        return sessionQ;
      });

      onStartExam(questionsWithImages, previousSession.mode as 'untimedRandom' | 'category' | 'wrong' | 'review');
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
    message += `- 학습 통계\n`;
    message += `- 문제 이해도\n\n`;
    message += '⚠️ 이 작업은 되돌릴 수 없습니다.';

    if (window.confirm(message)) {
      clearAllData();
      alert('✅ 모든 데이터가 초기화되었습니다.');
      window.location.reload();
    }
    setMenuOpen(false);
  };

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case 'untimedRandom': return '랜덤 60문제';
      case 'category': return '카테고리별';
      case 'wrong': return '오답노트';
      case 'review': return '진도 기반 복습';
      default: return mode;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* 헤더 */}
      <header className="bg-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* 로고 */}
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <span className="text-xl font-bold text-gray-800">전기기능사 CBT</span>
          </div>

          {/* 사용자명 & 햄버거 메뉴 */}
          <div className="flex items-center gap-3">
            {currentUser && (
              <span className="text-sm text-gray-600 hidden sm:inline">
                👤 {currentUser.name}
              </span>
            )}
            {!currentUser && (
              <span className="text-xs text-yellow-600 hidden sm:inline">
                게스트 모드
              </span>
            )}

            {/* 햄버거 메뉴 */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="메뉴"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* 드롭다운 메뉴 */}
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <button
                    onClick={() => {
                      onGoToStatistics();
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 flex items-center gap-2"
                  >
                    📊 학습 통계
                  </button>
                  <button
                    onClick={handleClearAllData}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 flex items-center gap-2"
                  >
                    🗑️ 데이터 초기화
                  </button>
                  <hr className="my-1" />
                  <button
                    onClick={() => {
                      handleLogout();
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    🚪 로그아웃
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-4xl mx-auto p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          {/* 문제 현황 */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">📊 문제 현황</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{questionCounts.total ?? 0}</div>
                <div className="text-xs text-gray-600 mt-1">전체 문제</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{questionCounts.전기이론 ?? 0}</div>
                <div className="text-xs text-gray-600 mt-1">전기이론</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{questionCounts.전기기기 ?? 0}</div>
                <div className="text-xs text-gray-600 mt-1">전기기기</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{questionCounts.전기설비 ?? 0}</div>
                <div className="text-xs text-gray-600 mt-1">전기설비</div>
              </div>
            </div>
          </div>

          {/* 탭 전환 */}
          <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('learning')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-colors ${
                activeTab === 'learning'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              📚 학습·복습
            </button>
            <button
              onClick={() => setActiveTab('exam')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-colors ${
                activeTab === 'exam'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              🎯 시험
            </button>
          </div>

          {/* 학습·복습 탭 */}
          {activeTab === 'learning' && (
            <div className="space-y-4">
              {/* 모드 선택 (라디오 버튼) */}
              <div className="space-y-3">
                {/* 랜덤 60문제 */}
                <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                  learningMode === 'untimedRandom' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'
                }`}>
                  <input
                    type="radio"
                    name="learningMode"
                    value="untimedRandom"
                    checked={learningMode === 'untimedRandom'}
                    onChange={(e) => setLearningMode(e.target.value as 'untimedRandom')}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-semibold text-gray-800">🎲 랜덤 60문제</div>
                    <div className="text-sm text-gray-600">시간 제한 없이 자유롭게 학습</div>
                  </div>
                </label>

                {/* 카테고리별 집중 학습 */}
                <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                  learningMode === 'category' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'
                }`}>
                  <input
                    type="radio"
                    name="learningMode"
                    value="category"
                    checked={learningMode === 'category'}
                    onChange={(e) => setLearningMode(e.target.value as 'category')}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800">📚 카테고리별 집중 학습</div>
                    <div className="text-sm text-gray-600 mb-2">선택한 카테고리에서 20문제 출제</div>
                    {learningMode === 'category' && (
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full p-2 border border-purple-300 rounded bg-white text-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="전기이론">전기이론</option>
                        <option value="전기기기">전기기기</option>
                        <option value="전기설비">전기설비</option>
                      </select>
                    )}
                  </div>
                </label>

                {/* 오답노트 복습 */}
                <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                  learningMode === 'wrong' ? 'border-pink-500 bg-pink-50' : 'border-gray-200 hover:border-pink-300'
                }`}>
                  <input
                    type="radio"
                    name="learningMode"
                    value="wrong"
                    checked={learningMode === 'wrong'}
                    onChange={(e) => setLearningMode(e.target.value as 'wrong')}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-semibold text-gray-800">📝 오답노트 복습</div>
                    <div className="text-sm text-gray-600">틀렸던 문제만 재출제 (최대 20문제)</div>
                  </div>
                </label>

                {/* 진도 기반 복습 */}
                <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                  learningMode === 'review' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'
                }`}>
                  <input
                    type="radio"
                    name="learningMode"
                    value="review"
                    checked={learningMode === 'review'}
                    onChange={(e) => setLearningMode(e.target.value as 'review')}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-semibold text-gray-800">📊 진도 기반 복습</div>
                    <div className="text-sm text-gray-600">학습 진도 1-5 문제만 복습 (완벽 이해 제외)</div>
                  </div>
                </label>
              </div>

              {/* 이전 세션 복원 버튼 */}
              {hasPreviousSession && previousSession && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="text-sm text-yellow-800 mb-2">
                    📖 이전에 진행하던 {getModeLabel(previousSession.mode)} 세션이 있습니다
                    <span className="ml-2 text-xs">
                      ({Object.keys(previousSession.answers || {}).length}/{previousSession.questions.length} 완료)
                    </span>
                  </div>
                  <button
                    onClick={handleResumePreviousExam}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
                  >
                    📖 이전 세션 이어하기
                  </button>
                </div>
              )}

              {/* 학습 시작 버튼 */}
              <button
                onClick={handleStartLearning}
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg shadow-md"
              >
                {loading ? '불러오는 중...' : '▶️ 학습 시작'}
              </button>
            </div>
          )}

          {/* 시험 탭 */}
          {activeTab === 'exam' && (
            <div className="space-y-4">
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                <div className="font-bold text-red-800 text-lg mb-2">⏱️ 실전 모의고사</div>
                <div className="text-sm text-red-700 space-y-1">
                  <p>• 전기이론 20 + 전기기기 20 + 전기설비 20 = 총 60문제</p>
                  <p>• 실전과 동일한 <strong>60분 타이머</strong> 적용</p>
                  <p>• 새 창에서 시험이 진행됩니다</p>
                </div>
              </div>

              {/* 시험 시작 버튼 */}
              <button
                onClick={handleStartExam}
                disabled={loading}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg shadow-md"
              >
                {loading ? '불러오는 중...' : '🚀 시험 시작'}
              </button>

              <p className="text-center text-xs text-gray-500">
                ⚠️ 시험이 시작되면 타이머가 작동하며, 60분 후 자동으로 제출됩니다.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
