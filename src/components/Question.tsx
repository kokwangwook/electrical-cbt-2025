import type { Question as QuestionType } from '../types';
import LatexRenderer from './LatexRenderer';
import { getStandardTitle } from '../data/examStandards';

interface QuestionProps {
  question: QuestionType;
  questionNumber: number;
  selectedAnswer: number | null;
  onAnswerSelect: (answer: number) => void;
  showResult?: boolean;
}

export default function Question({
  question,
  questionNumber,
  selectedAnswer,
  onAnswerSelect,
  showResult = false,
}: QuestionProps) {
  const options = [
    { number: 1, text: question.option1 },
    { number: 2, text: question.option2 },
    { number: 3, text: question.option3 },
    { number: 4, text: question.option4 },
  ];

  const getOptionStyle = (optionNumber: number) => {
    if (!showResult) {
      return selectedAnswer === optionNumber
        ? 'bg-blue-100 border-blue-500 border-2'
        : 'bg-white border-gray-300 border hover:bg-gray-50';
    }

    // 결과 표시 모드
    if (optionNumber === question.answer) {
      return 'bg-green-100 border-green-500 border-2';
    }
    if (selectedAnswer === optionNumber && optionNumber !== question.answer) {
      return 'bg-red-100 border-red-500 border-2';
    }
    return 'bg-white border-gray-300 border';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* 문제 번호와 카테고리 */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-800 mb-2">문제 {questionNumber}</h2>
        <div className="flex gap-2 items-center justify-center">
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
            {question.category}
          </span>
          {question.standard && (
            <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold">
              {question.standard} - {getStandardTitle(question.standard)}
            </span>
          )}
        </div>
      </div>

      {/* 문제 이미지 (있는 경우) */}
      {question.hasImage && (
        <div className="mb-4">
          {question.imageUrl ? (
            <img
              src={question.imageUrl}
              alt="문제 이미지"
              className="max-w-full h-auto rounded-lg border border-gray-300"
            />
          ) : (
            <div className="min-h-[200px] flex items-center justify-center bg-gray-50 rounded-lg border border-gray-300">
              <div className="text-gray-400 text-sm">이미지 준비 중</div>
            </div>
          )}
        </div>
      )}

      {/* 문제 텍스트 */}
      <div className="mb-6">
        <LatexRenderer text={question.question} className="text-lg text-gray-800 leading-relaxed" />
      </div>

      {/* 선택지 */}
      <div className="space-y-3">
        {options.map((option) => (
          <button
            key={option.number}
            onClick={() => !showResult && onAnswerSelect(option.number)}
            disabled={showResult}
            className={`w-full text-left p-4 rounded-lg transition-all duration-200 ${getOptionStyle(
              option.number
            )} ${!showResult ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <div className="flex items-start">
              <span className="font-bold text-gray-700 mr-3">{option.number}.</span>
              <LatexRenderer text={option.text} className="text-gray-800 flex-1" />
              {showResult && option.number === question.answer && (
                <span className="text-green-600 font-bold ml-2">✓ 정답</span>
              )}
              {showResult &&
                selectedAnswer === option.number &&
                option.number !== question.answer && (
                  <span className="text-red-600 font-bold ml-2">✗ 오답</span>
                )}
            </div>
          </button>
        ))}
      </div>

      {/* 해설 (결과 표시 모드일 때만) */}
      {showResult && question.explanation && (
        <div className="mt-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
          <p className="text-sm font-semibold text-blue-800 mb-1">💡 해설</p>
          <LatexRenderer text={question.explanation} className="text-sm text-gray-700" />
        </div>
      )}
    </div>
  );
}
