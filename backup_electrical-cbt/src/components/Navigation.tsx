interface NavigationProps {
  totalQuestions: number;
  currentIndex: number;
  answers: (number | null)[];
  onNavigate: (index: number) => void;
}

export default function Navigation({
  totalQuestions,
  currentIndex,
  answers,
  onNavigate,
}: NavigationProps) {
  // 카테고리별로 문제 번호 그룹화 (20문제씩)
  const categories = [
    { name: '전기이론', start: 0, end: 20 },
    { name: '전기기기', start: 20, end: 40 },
    { name: '전기설비', start: 40, end: 60 },
  ];

  // 답안 표시 심볼
  const answerSymbols = ['①', '②', '③', '④'];

  const renderQuestionButton = (index: number) => {
    const isAnswered = answers[index] !== null;
    const isCurrent = index === currentIndex;
    const selectedAnswer = answers[index];

    return (
      <button
        key={index}
        onClick={() => onNavigate(index)}
        className={`
          w-12 h-12 rounded-md font-semibold text-sm transition-all duration-200 flex-shrink-0
          ${
            isCurrent
              ? 'bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-2'
              : isAnswered
              ? 'bg-green-500 text-white hover:bg-green-600'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }
        `}
      >
        <div className="flex flex-col items-center justify-center leading-tight">
          <span>{index + 1}</span>
          {selectedAnswer !== null && (
            <span className="text-xs mt-0.5">
              {answerSymbols[selectedAnswer - 1]}
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-3">
      <h3 className="text-base font-semibold mb-2 text-gray-800">문제 번호</h3>

      {/* 모든 카테고리 표시 - 각 20개씩 */}
      <div className="space-y-3">
        {categories.map((category) => (
          <div key={category.name}>
            {/* 카테고리 라벨 */}
            <div className="text-sm font-semibold text-gray-700 mb-2">
              {category.name} ({category.start + 1}-{category.end})
            </div>

            {/* 문제 번호 그리드 - 20개씩 한 줄 */}
            <div className="flex flex-wrap gap-1.5">
              {Array.from(
                { length: Math.min(category.end, totalQuestions) - category.start },
                (_, i) => category.start + i
              )
                .filter((index) => index < totalQuestions)
                .map((index) => renderQuestionButton(index))}
            </div>
          </div>
        ))}
      </div>

      {/* 범례 */}
      <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span>답변 완료</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gray-200 rounded"></div>
          <span>미답변</span>
        </div>
      </div>
    </div>
  );
}
