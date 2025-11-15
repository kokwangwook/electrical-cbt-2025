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

  // 10개씩 묶어서 행으로 표시
  const rows = [];
  for (let i = 0; i < totalQuestions; i += 10) {
    const rowQuestions = Array.from(
      { length: Math.min(10, totalQuestions - i) },
      (_, j) => i + j
    );
    rows.push(rowQuestions);
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-3">
      <h3 className="text-base font-semibold mb-2 text-gray-800">문제 번호</h3>

      {/* 10개씩 한 줄로 표시 */}
      <div className="space-y-2">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-1.5 justify-start">
            {row.map((index) => renderQuestionButton(index))}
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
