import { useState } from 'react';
import type { Flashcard as FlashcardType } from '../types';
import LatexRenderer from './LatexRenderer';

interface FlashcardProps {
    flashcard: FlashcardType;
    questionNumber: number; // 현재 문제 번호 (1부터 시작)
    totalQuestions: number; // 전체 문제 수
    onNext: () => void;
    onPrevious: () => void;
    isFirst: boolean;
    isLast: boolean;
}

export default function Flashcard({
    flashcard,
    questionNumber,
    totalQuestions,
    onNext,
    onPrevious,
    isFirst,
    isLast,
}: FlashcardProps) {
    const [isFlipped, setIsFlipped] = useState(false);

    const handleFlip = () => {
        setIsFlipped(!isFlipped);
    };

    const handleNext = () => {
        setIsFlipped(false); // 다음 카드로 넘어갈 때 뒷면 상태 초기화
        onNext();
    };

    const handlePrevious = () => {
        setIsFlipped(false); // 이전 카드로 돌아갈 때 뒷면 상태 초기화
        onPrevious();
    };

    return (
        <div className="flex flex-col items-center justify-center w-full h-full landscape:h-screen p-3 sm:p-4 landscape:p-2 landscape:py-4">
            {/* 진행률 표시 */}
            <div className="mb-3 sm:mb-4 landscape:mb-2 text-center w-full shrink-0">
                <span className="text-xs sm:text-sm text-gray-600">
                    문제 {questionNumber} / {totalQuestions}
                </span>
                <div className="mt-2 landscape:mt-1 w-full max-w-xs sm:max-w-sm mx-auto h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
                    />
                </div>
            </div>

            {/* 카드 컨테이너 */}
            <div className="perspective-1000 w-full max-w-2xl flex-1 flex items-center justify-center min-h-0">
                <div
                    className={`flashcard-container relative w-full h-[60vh] sm:h-[550px] landscape:h-[70vh] cursor-pointer transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''
                        }`}
                    onClick={handleFlip}
                >
                    {/* 앞면 */}
                    <div className="flashcard-face flashcard-front absolute w-full h-full backface-hidden bg-white rounded-xl sm:rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8 landscape:p-5 flex flex-col justify-center items-center border-2 border-blue-200">
                        <div className="text-xs font-semibold text-blue-600 mb-3 sm:mb-4 landscape:mb-3 px-3 py-1 bg-blue-50 rounded-full shrink-0">
                            {flashcard.category}
                        </div>
                        <div className="flex-1 flex items-center justify-center w-full overflow-hidden">
                            <div className="text-sm sm:text-base md:text-lg landscape:text-base text-gray-800 text-center leading-relaxed overflow-y-auto max-h-full w-full px-2">
                                <LatexRenderer text={flashcard.question} />
                            </div>
                        </div>
                        <div className="mt-4 sm:mt-6 landscape:mt-3 text-xs landscape:text-[11px] text-gray-400 shrink-0">
                            💡 카드를 클릭하면 답을 볼 수 있습니다
                        </div>
                    </div>

                    {/* 뒷면 */}
                    <div className="flashcard-face flashcard-back absolute w-full h-full backface-hidden rotate-y-180 bg-gradient-to-br from-green-50 to-blue-50 rounded-xl sm:rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8 landscape:p-5 flex flex-col justify-center items-center border-2 border-green-200 overflow-hidden">
                        <div className="text-xs font-semibold text-green-700 mb-3 sm:mb-4 landscape:mb-2 px-3 py-1 bg-green-100 rounded-full shrink-0">
                            정답
                        </div>
                        <div className="text-lg sm:text-xl md:text-2xl landscape:text-xl font-bold text-green-700 mb-4 sm:mb-6 landscape:mb-4 text-center shrink-0">
                            {flashcard.answer_keyword}
                        </div>
                        <div className="w-full border-t-2 border-green-200 my-3 sm:my-4 landscape:my-3 shrink-0"></div>
                        <div className="text-xs font-semibold text-gray-600 mb-2 landscape:mb-2 shrink-0">📖 해설 및 암기 팁</div>
                        <div className="flex-1 w-full overflow-hidden">
                            <div className="text-xs sm:text-sm landscape:text-sm text-gray-700 text-center leading-relaxed h-full overflow-y-auto px-2">
                                <LatexRenderer text={flashcard.explanation} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 버튼 그룹 - 항상 가로 배치 */}
            <div className="mt-2 sm:mt-6 landscape:mt-2 flex flex-row gap-2 sm:gap-4 landscape:gap-3 w-full px-2 sm:px-0 max-w-2xl shrink-0">
                <button
                    onClick={handlePrevious}
                    disabled={isFirst}
                    className="flex-1 px-2 sm:px-4 py-3 landscape:py-2.5 min-h-[44px] landscape:min-h-[40px] bg-gray-200 hover:bg-gray-300 active:bg-gray-400 disabled:bg-gray-100 disabled:text-gray-400 text-gray-700 font-semibold rounded-lg transition-colors text-xs sm:text-base landscape:text-sm"
                >
                    <span className="hidden sm:inline">◀ 이전</span>
                    <span className="sm:hidden">◀</span>
                </button>

                <button
                    onClick={handleFlip}
                    className="flex-1 px-3 sm:px-6 py-3 landscape:py-2.5 min-h-[44px] landscape:min-h-[40px] bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-lg transition-colors shadow-md text-xs sm:text-base landscape:text-sm"
                >
                    <span className="hidden sm:inline">{isFlipped ? '🔄 앞면 보기' : '🔍 답 보기'}</span>
                    <span className="sm:hidden">{isFlipped ? '🔄 앞면' : '🔍 답'}</span>
                </button>

                <button
                    onClick={handleNext}
                    disabled={isLast}
                    className="flex-1 px-2 sm:px-4 py-3 landscape:py-2.5 min-h-[44px] landscape:min-h-[40px] bg-gray-200 hover:bg-gray-300 active:bg-gray-400 disabled:bg-gray-100 disabled:text-gray-400 text-gray-700 font-semibold rounded-lg transition-colors text-xs sm:text-base landscape:text-sm"
                >
                    <span className="hidden sm:inline">다음 ▶</span>
                    <span className="sm:hidden">▶</span>
                </button>
            </div>

            {/* CSS 스타일 */}
            <style>{`
        .perspective-1000 {
          perspective: 1000px;
        }

        .transform-style-3d {
          transform-style: preserve-3d;
        }

        .backface-hidden {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }

        .rotate-y-180 {
          transform: rotateY(180deg);
        }

        .flashcard-container {
          transition: transform 0.6s;
        }
      `}</style>
        </div>
    );
}
