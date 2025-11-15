import { useState } from 'react';
import { saveMemberToSupabase } from '../services/supabaseService';
import { addMember, getMemberByName } from '../services/storage';

interface RegisterProps {
  onRegisterSuccess: () => void;
  onBackToLogin: () => void;
}

export default function Register({ onRegisterSuccess, onBackToLogin }: RegisterProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) {
      return '이름을 입력해주세요.';
    }
    if (formData.name.trim().length < 2) {
      return '이름은 2글자 이상이어야 합니다.';
    }
    if (!formData.phone.trim()) {
      return '전화번호를 입력해주세요.';
    }
    // 전화번호 형식 검증 (간단)
    const phoneRegex = /^[0-9-]{10,13}$/;
    if (!phoneRegex.test(formData.phone.replace(/\s/g, ''))) {
      return '올바른 전화번호 형식이 아닙니다. (예: 010-1234-5678)';
    }
    if (!formData.email.trim()) {
      return '이메일을 입력해주세요.';
    }
    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return '올바른 이메일 형식이 아닙니다.';
    }
    if (!formData.address.trim()) {
      return '주소를 입력해주세요.';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // 폼 검증
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      setLoading(false);
      return;
    }

    try {
      // 이름 중복 확인 (로컬)
      const existingMember = getMemberByName(formData.name.trim());
      if (existingMember) {
        setError('이미 등록된 이름입니다. 다른 이름을 사용해주세요.');
        setLoading(false);
        return;
      }

      // 로컬 저장소에 회원 추가
      const newMember = addMember({
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        memo: `이메일: ${formData.email.trim()}\n가입일: ${new Date().toLocaleString('ko-KR')}`
      });

      if (!newMember) {
        setError('회원 등록에 실패했습니다. 다시 시도해주세요.');
        setLoading(false);
        return;
      }

      // Supabase에도 저장 (비동기, 실패해도 로컬은 성공)
      saveMemberToSupabase({
        id: newMember.id,
        name: newMember.name,
        phone: newMember.phone,
        email: formData.email.trim(),
        address: newMember.address,
        registeredAt: newMember.registeredAt
      }).then(success => {
        if (success) {
          console.log('✅ Supabase 회원 저장 성공');
        } else {
          console.warn('⚠️ Supabase 회원 저장 실패 (로컬은 성공)');
        }
      }).catch(err => {
        console.warn('⚠️ Supabase 저장 오류:', err);
      });

      setSuccess(true);
      console.log('✅ 회원가입 성공:', newMember.name);

      // 3초 후 로그인 페이지로 이동
      setTimeout(() => {
        onRegisterSuccess();
      }, 3000);

    } catch (err) {
      console.error('회원가입 오류:', err);
      setError('회원가입 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-green-700 mb-4">회원가입 완료!</h2>
          <p className="text-gray-600 mb-2">
            <strong>{formData.name}</strong>님, 환영합니다!
          </p>
          <p className="text-gray-500 text-sm mb-6">
            이제 로그인하여 학습을 시작할 수 있습니다.
          </p>
          <div className="bg-green-50 p-4 rounded-lg mb-6">
            <p className="text-green-700 text-sm">
              ✅ 3초 후 로그인 페이지로 이동합니다...
            </p>
          </div>
          <button
            onClick={onRegisterSuccess}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition-colors"
          >
            지금 로그인하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        {/* 헤더 */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">📝 회원가입</h1>
          <p className="text-gray-600">전기기능사 CBT 학습을 시작하세요</p>
        </div>

        {/* 회원가입 폼 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="홍길동"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* 전화번호 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              전화번호 <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="010-1234-5678"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* 이메일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이메일 <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="example@email.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* 주소 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              주소 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              placeholder="전라남도 나주시"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* 가입 버튼 */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full ${
              loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            } text-white font-bold py-3 rounded-lg transition-colors`}
          >
            {loading ? '가입 처리 중...' : '회원가입'}
          </button>
        </form>

        {/* 로그인 링크 */}
        <div className="mt-6 text-center">
          <p className="text-gray-600 text-sm">
            이미 계정이 있으신가요?{' '}
            <button
              onClick={onBackToLogin}
              className="text-blue-600 hover:text-blue-700 font-semibold underline"
            >
              로그인하기
            </button>
          </p>
        </div>

        {/* 안내 */}
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs text-yellow-800">
            ⚠️ <strong>주의:</strong> 입력하신 정보는 학습 기록 관리 및 연락 목적으로만 사용됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
