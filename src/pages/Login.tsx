import { useState, useEffect } from 'react';
import { getMemberByAnyCredential, setCurrentUser, getCurrentExamSession, clearCurrentExamSession, saveCurrentExamSession, getMembers, initializeData, addLoginHistory, saveMembers } from '../services/storage';
import { saveLoginHistory, fetchAllMembersFromSupabase } from '../services/supabaseService';

interface LoginProps {
  onLoginSuccess: () => void;
  onResumeExam?: () => void;
  onGoToRegister?: () => void;
}

export default function Login({ onLoginSuccess, onResumeExam, onGoToRegister }: LoginProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 페이지 로드 시 초기화 (누락된 회원 자동 추가)
  useEffect(() => {
    initializeData();
    // Supabase에서 회원 목록 동기화
    syncMembersFromSupabase();
  }, []);

  // Supabase에서 회원 목록 동기화
  const syncMembersFromSupabase = async () => {
    try {
      console.log('🔄 Supabase에서 회원 목록 동기화 중...');
      const supabaseMembers = await fetchAllMembersFromSupabase();

      if (supabaseMembers.length > 0) {
        // Supabase 회원을 로컬 스토리지에 병합
        const localMembers = getMembers();
        const mergedMembers = [...localMembers];

        for (const sMember of supabaseMembers) {
          const existingIndex = mergedMembers.findIndex(m => m.id === sMember.id);
          if (existingIndex !== -1) {
            // 기존 회원 업데이트 (Supabase 데이터 우선)
            mergedMembers[existingIndex] = {
              ...mergedMembers[existingIndex],
              name: sMember.name,
              phone: sMember.phone,
              email: sMember.email,
              address: sMember.address,
              memo: sMember.memo || mergedMembers[existingIndex].memo
            };
          } else {
            // 새 회원 추가
            mergedMembers.push({
              id: sMember.id,
              name: sMember.name,
              phone: sMember.phone,
              email: sMember.email,
              address: sMember.address,
              registeredAt: sMember.registeredAt,
              memo: sMember.memo || ''
            });
          }
        }

        saveMembers(mergedMembers);
        console.log(`✅ 회원 목록 동기화 완료: ${supabaseMembers.length}명`);
      }
    } catch (err) {
      console.warn('⚠️ Supabase 회원 동기화 실패:', err);
    }
  };

  const handleLogin = async () => {
    setError(null);
    setLoading(true);

    // 입력값 검증
    if (!input.trim()) {
      setError('이름, 전화번호 또는 이메일 주소를 입력하세요.');
      setLoading(false);
      return;
    }

    // Supabase에서 최신 회원 정보 동기화 (로그인 시도 전)
    await syncMembersFromSupabase();

    // 사용자 찾기 (이름, 전화번호, 이메일 중 하나라도 일치하면 됨)
    const trimmedInput = input.trim();

    console.log('🔍 로그인 시도:', { input: trimmedInput });

    const member = getMemberByAnyCredential(trimmedInput);
    
    if (!member) {
      // 등록된 회원 목록 확인
      const allMembers = getMembers();
      console.log('📋 등록된 회원 목록:', allMembers.map(m => `${m.name} (${m.phone})`));
      
      let errorMessage = '';
      if (allMembers.length === 0) {
        errorMessage = '등록된 회원이 없습니다. 회원가입을 먼저 해주세요.';
      } else {
        errorMessage = `등록되지 않은 사용자입니다.\n\n입력한 값: "${trimmedInput}"\n\n※ 이름, 전화번호 또는 이메일 주소 중 하나를 정확히 입력하세요.\n※ 회원가입이 필요하시면 아래 '회원가입' 버튼을 눌러주세요.`;
      }
      
      setError(errorMessage);
      setLoading(false);
      return;
    }

    console.log('✅ 로그인 성공:', member.name, '(ID:', member.id + ')');

    // 로그인 성공
    setCurrentUser(member.id);

    // 로그인 기록 저장 (실패해도 로그인은 진행)
    const historySuccess = addLoginHistory(member.id, member.name);
    if (!historySuccess) {
      console.warn('⚠️ 로컬 로그인 기록 저장 실패');
    }

    // Supabase에 로그인 기록 저장 (비동기, 실패해도 무시)
    saveLoginHistory(member.id, member.name).then(success => {
      if (success) {
        console.log('✅ Supabase 로그인 기록 저장 성공');
      } else {
        console.warn('⚠️ Supabase 로그인 기록 저장 실패');
      }
    }).catch(err => {
      console.warn('⚠️ Supabase 로그인 기록 저장 오류:', err);
    });

    // 이전 시험 기록이 있는지 확인 (현재 사용자의 세션만 확인)
    const currentSession = getCurrentExamSession();
    
    // 다른 사용자의 세션이면 삭제
    if (currentSession && currentSession.userId !== undefined && currentSession.userId !== member.id) {
      console.log('⚠️ 다른 사용자의 세션 감지, 삭제합니다.');
      clearCurrentExamSession();
      setLoading(false);
      onLoginSuccess();
      return;
    }

    // 현재 사용자의 세션이 있는지 확인
    if (currentSession && currentSession.questions && currentSession.questions.length > 0) {
      // 세션에 userId가 없으면 현재 사용자로 설정 (기존 세션 호환성)
      if (currentSession.userId === undefined) {
        // 기존 세션에 userId 추가
        const updatedSession = { ...currentSession, userId: member.id };
        saveCurrentExamSession(updatedSession);
      }

      // 현재 사용자의 세션이면 팝업으로 선택하도록
      const confirmed = window.confirm(
        `⚠️ ${member.name}님, 이전에 풀던 시험이 있습니다!\n\n` +
        `진행 상황: ${Object.keys(currentSession.answers || {}).length}/${currentSession.questions.length} 문제 풀이 완료\n\n` +
        `✅ 확인: 이전 시험 이어서 풀기\n` +
        `❌ 취소: 새로운 시험 시작하기`
      );

      if (confirmed) {
        // 이전 시험 이어서 풀기
        setLoading(false);
        if (onResumeExam) {
          onResumeExam();
        } else {
          // 폴백: 홈으로 이동
          onLoginSuccess();
        }
        return;
      } else {
        // 취소하면 세션 삭제하고 새로운 시험 시작
        clearCurrentExamSession();
      }
    }

    setLoading(false);
    onLoginSuccess();
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">⚡ 전기기능사 CBT</h1>
          <p className="text-gray-600">로그인</p>
        </div>

        {/* 로그인 폼 */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이름, 전화번호 또는 이메일 주소
            </label>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="홍길동 또는 010-1234-5678 또는 example@email.com"
              autoFocus
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            />
            <p className="mt-2 text-xs text-gray-500">
              💡 이름, 전화번호, 이메일 주소 중 하나만 입력하세요.
            </p>
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded">
            <p className="text-red-800 text-sm whitespace-pre-line">{error}</p>
          </div>
        )}

        {/* 로그인 버튼 */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className={`w-full ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold py-4 px-6 rounded-lg transition-colors duration-200 text-lg mb-4`}
        >
          {loading ? '로그인 중...' : '🔑 로그인'}
        </button>

        {/* 회원가입 버튼 */}
        {onGoToRegister && (
          <div className="mt-4">
            <button
              onClick={onGoToRegister}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200"
            >
              📝 회원가입
            </button>
          </div>
        )}

        {/* 안내 */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            💡 <strong>회원가입 후 로그인하시면 학습 기록이 저장됩니다</strong>
          </p>
          <p className="text-xs text-blue-600 mt-2">
            이름, 전화번호 또는 이메일 주소 중 하나만 입력하면 로그인됩니다.
          </p>
        </div>

        {/* 관리자 페이지 링크 */}
        <div className="mt-4 text-center">
          <button
            onClick={() => (window.location.href = '/admin')}
            className="text-sm text-gray-500 hover:text-gray-700 underline transition-colors duration-200"
          >
            🔧 관리자 페이지
          </button>
        </div>
      </div>
    </div>
  );
}
