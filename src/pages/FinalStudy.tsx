import { useState, useEffect } from 'react';
import Flashcard from '../components/Flashcard';
import { fetchAllFlashcards } from '../services/flashcardService';
import { getFinalStudyProgress, saveFinalStudyProgress, clearFinalStudyProgress } from '../services/storage';
import type { Flashcard as FlashcardType } from '../types';

interface FinalStudyProps {
    onGoBack?: () => void; // 홈으로 돌아가기 콜백 (선택사항)
}

export default function FinalStudy({ onGoBack }: FinalStudyProps) {
    const [flashcards, setFlashcards] = useState<FlashcardType[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isCompleted, setIsCompleted] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 데이터 로드 및 진도 복원
    useEffect(() => {
        const loadData = async () => {
            try {
                setIsLoading(true);
                const data = await fetchAllFlashcards();
                if (data.length === 0) {
                    setError('학습 데이터를 불러올 수 없습니다. (데이터 없음)');
                } else {
                    setFlashcards(data);

                    // 저장된 진도 복원
                    const savedProgress = getFinalStudyProgress();
                    if (savedProgress && savedProgress.currentIndex < data.length) {
                        setCurrentIndex(savedProgress.currentIndex);
                        console.log(`학습 진도 복원: ${savedProgress.currentIndex + 1}번 문제`);
                    }
                }
            } catch (err) {
                console.error(err);
                setError('데이터 로딩 중 오류가 발생했습니다.');
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    // 진도 자동 저장
    useEffect(() => {
        if (flashcards.length > 0 && currentIndex >= 0) {
            saveFinalStudyProgress(currentIndex);
        }
    }, [currentIndex, flashcards.length]);

    const handleNext = () => {
        if (currentIndex < flashcards.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            setIsCompleted(true);
            clearFinalStudyProgress(); // 완료 시 진도 초기화
        }
    };

    const handlePrevious = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    const handleRestart = () => {
        setCurrentIndex(0);
        setIsCompleted(false);
    };

    // 로딩 중 화면
    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
                <div className="animate-spin text-4xl mb-4">⏳</div>
                <h2 className="text-xl font-bold text-gray-800">학습 데이터 로딩 중...</h2>
                <p className="text-gray-600 mt-2">잠시만 기다려주세요.</p>
            </div>
        );
    }

    // 에러 화면
    if (error || flashcards.length === 0) {
        return (
            <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
                <div className="text-4xl mb-4">⚠️</div>
                <h2 className="text-xl font-bold text-red-600 mb-2">오류 발생</h2>
                <p className="text-gray-700 mb-6 text-center">{error || '데이터를 찾을 수 없습니다.'}</p>
                {onGoBack && (
                    <button
                        onClick={onGoBack}
                        className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition"
                    >
                        홈으로 돌아가기
                    </button>
                )}
            </div>
        );
    }

    // 학습 완료 화면
    if (isCompleted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl p-8 sm:p-12 max-w-md w-full text-center">
                    <div className="text-5xl sm:text-6xl mb-4 sm:mb-6">🎉</div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3 sm:mb-4">학습 완료!</h1>
                    <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8">
                        총 {flashcards.length}개의 플래시카드를 모두 학습했습니다.
                    </p>
                    <div className="flex flex-col gap-2 sm:gap-3">
                        <button
                            onClick={handleRestart}
                            className="w-full min-h-[47px] bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3 px-6 rounded-lg transition-colors text-sm sm:text-base"
                        >
                            🔄 다시 학습하기
                        </button>
                        {onGoBack && (
                            <button
                                onClick={onGoBack}
                                className="w-full min-h-[47px] bg-gray-200 hover:bg-gray-300 active:bg-gray-400 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-colors text-sm sm:text-base"
                            >
                                🏠 홈으로 돌아가기
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // 플래시카드 표시
    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex flex-col landscape:flex-row overflow-hidden">
            {/* 헤더 (세로 모드) / 사이드바 (가로 모드) */}
            <header className="bg-white shadow-md z-10 
                landscape:w-14 landscape:h-screen landscape:flex-col landscape:justify-between landscape:py-4 landscape:border-r border-gray-200
                flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 shrink-0 transition-all duration-300">

                {/* 로고 및 타이틀 */}
                <div className="flex items-center gap-2 landscape:flex-col landscape:gap-6 landscape:mt-2">
                    <span className="text-xl sm:text-2xl landscape:text-2xl">🎴</span>
                    <span className="text-lg sm:text-xl font-bold text-gray-800 
                        landscape:[writing-mode:vertical-rl] landscape:[text-orientation:upright] landscape:text-sm landscape:tracking-[0.2em] landscape:font-extrabold landscape:text-gray-600">
                        파이널학습
                    </span>
                </div>

                {/* 뒤로가기 버튼 */}
                {onGoBack && (
                    <button
                        onClick={onGoBack}
                        className="text-xs sm:text-sm text-gray-600 hover:text-gray-800 active:text-gray-900 flex items-center gap-1 min-h-[39px] px-2
                            landscape:flex-col landscape:min-h-0 landscape:p-2 landscape:gap-1 landscape:hover:bg-gray-100 landscape:rounded-lg"
                        title="홈으로 돌아가기"
                    >
                        <span className="landscape:hidden">← 뒤로</span>
                        <span className="hidden landscape:block text-xl">🏠</span>
                        <span className="hidden landscape:block text-[10px] font-bold mt-0.5">나가기</span>
                    </button>
                )}
            </header>

            {/* 플래시카드 메인 영역 */}
            <main className="flex-1 w-full h-full max-w-4xl mx-auto p-2 sm:p-4 landscape:p-0 landscape:h-screen landscape:flex landscape:items-center landscape:justify-center overflow-hidden">
                <Flashcard
                    flashcard={flashcards[currentIndex]}
                    questionNumber={currentIndex + 1}
                    totalQuestions={flashcards.length}
                    onNext={handleNext}
                    onPrevious={handlePrevious}
                    isFirst={currentIndex === 0}
                    isLast={currentIndex === flashcards.length - 1}
                />
            </main>
        </div>
    );
}
