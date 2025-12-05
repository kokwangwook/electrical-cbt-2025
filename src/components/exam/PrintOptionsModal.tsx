interface PrintOptionsModalProps {
  printOption: 'questionsOnly' | 'withAnswers' | 'withExplanations';
  layoutOption: 'single' | 'double';
  fontSizeOption: 'small' | 'medium' | 'large';
  showAnswerSpace: boolean;
  onOptionChange: (option: 'questionsOnly' | 'withAnswers' | 'withExplanations') => void;
  onLayoutChange: (option: 'single' | 'double') => void;
  onFontSizeChange: (option: 'small' | 'medium' | 'large') => void;
  onAnswerSpaceChange: (show: boolean) => void;
  onPrint: () => void;
  onPreview: () => void;
  onClose: () => void;
}

export default function PrintOptionsModal({
  printOption,
  layoutOption,
  fontSizeOption,
  showAnswerSpace,
  onOptionChange,
  onLayoutChange,
  onFontSizeChange,
  onAnswerSpaceChange,
  onPrint,
  onPreview,
  onClose,
}: PrintOptionsModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 non-printable overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 my-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">🖨️ 인쇄 옵션 설정</h2>
        <p className="text-sm text-gray-600 mb-6">인쇄할 내용과 스타일을 선택하세요</p>

        {/* 인쇄 내용 선택 */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">📄 인쇄 내용</h3>
          <div className="space-y-2">
            {/* 문제만 인쇄 */}
            <button
              onClick={() => onOptionChange('questionsOnly')}
              className={`w-full text-left p-3 rounded-lg border-2 transition-all ${printOption === 'questionsOnly'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
                }`}
            >
              <div className="flex items-center">
                <div
                  className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${printOption === 'questionsOnly'
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300'
                    }`}
                >
                  {printOption === 'questionsOnly' && (
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  )}
                </div>
                <div>
                  <div className="font-semibold text-gray-800">📝 문제만 인쇄</div>
                  <div className="text-xs text-gray-600">문제와 선택지만 인쇄 (답안 작성란 포함)</div>
                </div>
              </div>
            </button>

            {/* 정답 표시 인쇄 */}
            <button
              onClick={() => onOptionChange('withAnswers')}
              className={`w-full text-left p-3 rounded-lg border-2 transition-all ${printOption === 'withAnswers'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
                }`}
            >
              <div className="flex items-center">
                <div
                  className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${printOption === 'withAnswers'
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300'
                    }`}
                >
                  {printOption === 'withAnswers' && (
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  )}
                </div>
                <div>
                  <div className="font-semibold text-gray-800">✅ 정답 표시</div>
                  <div className="text-xs text-gray-600">문제 + 정답 표시 (확인용)</div>
                </div>
              </div>
            </button>

            {/* 정답 + 해설 인쇄 */}
            <button
              onClick={() => onOptionChange('withExplanations')}
              className={`w-full text-left p-3 rounded-lg border-2 transition-all ${printOption === 'withExplanations'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
                }`}
            >
              <div className="flex items-center">
                <div
                  className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${printOption === 'withExplanations'
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300'
                    }`}
                >
                  {printOption === 'withExplanations' && (
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  )}
                </div>
                <div>
                  <div className="font-semibold text-gray-800">📚 정답 + 해설</div>
                  <div className="text-xs text-gray-600">문제 + 정답 + 해설 전체</div>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* 레이아웃 옵션 */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">🎨 레이아웃</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onLayoutChange('single')}
              className={`p-3 rounded-lg border-2 transition-all ${layoutOption === 'single'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-green-300'
                }`}
            >
              <div className="text-2xl mb-1">📄</div>
              <div className="font-semibold text-sm">1단 레이아웃</div>
              <div className="text-xs text-gray-600">가독성 우선</div>
            </button>
            <button
              onClick={() => onLayoutChange('double')}
              className={`p-3 rounded-lg border-2 transition-all ${layoutOption === 'double'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-green-300'
                }`}
            >
              <div className="text-2xl mb-1">📰</div>
              <div className="font-semibold text-sm">2단 레이아웃</div>
              <div className="text-xs text-gray-600">용지 절약</div>
            </button>
          </div>
        </div>

        {/* 폰트 크기 옵션 */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">📏 폰트 크기</h3>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onFontSizeChange('small')}
              className={`p-3 rounded-lg border-2 transition-all ${fontSizeOption === 'small'
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 hover:border-purple-300'
                }`}
            >
              <div className="text-2xl mb-1">🔍</div>
              <div className="font-semibold text-sm">작게</div>
              <div className="text-xs text-gray-600">12px</div>
            </button>
            <button
              onClick={() => onFontSizeChange('medium')}
              className={`p-3 rounded-lg border-2 transition-all ${fontSizeOption === 'medium'
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 hover:border-purple-300'
                }`}
            >
              <div className="text-2xl mb-1">📖</div>
              <div className="font-semibold text-sm">보통</div>
              <div className="text-xs text-gray-600">14px</div>
            </button>
            <button
              onClick={() => onFontSizeChange('large')}
              className={`p-3 rounded-lg border-2 transition-all ${fontSizeOption === 'large'
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 hover:border-purple-300'
                }`}
            >
              <div className="text-2xl mb-1">👓</div>
              <div className="font-semibold text-sm">크게</div>
              <div className="text-xs text-gray-600">16px</div>
            </button>
          </div>
        </div>

        {/* 답안 작성란 옵션 (문제만 인쇄일 때만) */}
        {printOption === 'questionsOnly' && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showAnswerSpace}
                onChange={(e) => onAnswerSpaceChange(e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div>
                <div className="font-semibold text-gray-800">✍️ 답안 작성란 추가</div>
                <div className="text-xs text-gray-600">각 문제 하단에 답 쓰는 공간을 추가합니다</div>
              </div>
            </label>
          </div>
        )}

        {/* 버튼 그룹 */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
          >
            취소
          </button>
          <button
            onClick={onPreview}
            className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
          >
            👁️ 미리보기
          </button>
          <button
            onClick={onPrint}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            🖨️ 인쇄
          </button>
        </div>
      </div>
    </div>
  );
}
