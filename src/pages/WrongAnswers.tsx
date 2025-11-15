import { useState, useEffect } from 'react';
import type { Question, WrongAnswer } from '../types';
import { getWrongAnswers, removeWrongAnswer, clearWrongAnswers } from '../services/storage';
import LatexRenderer from '../components/LatexRenderer';
import { getStandardTitle } from '../data/examStandards';

interface WrongAnswersProps {
  onBack: () => void;
  onStartReview: (questions: Question[]) => void;
}

export default function WrongAnswers({ onBack, onStartReview }: WrongAnswersProps) {
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<WrongAnswer | null>(null);

  useEffect(() => {
    loadWrongAnswers();
  }, []);

  const loadWrongAnswers = () => {
    const wrong = getWrongAnswers();
    // correctStreak < 3인 문제만 표시
    const eligible = wrong.filter(wa => wa.correctStreak < 3);
    setWrongAnswers(eligible);
  };

  const handleMarkAsLearned = (questionId: number) => {
    if (window.confirm('이 오답을 삭제하시겠습니까?')) {
      removeWrongAnswer(questionId);
      loadWrongAnswers();
      setSelectedQuestion(null);
    }
  };

  const handleClearAll = () => {
    if (window.confirm(`모든 오답 노트를 삭제하시겠습니까?\n\n총 ${wrongAnswers.length}문제가 삭제됩니다.\n\n⚠️ 이 작업은 되돌릴 수 없습니다.`)) {
      clearWrongAnswers();
      loadWrongAnswers();
      setSelectedQuestion(null);
      alert('✅ 오답 노트가 모두 삭제되었습니다.');
    }
  };

  const handleStartReview = () => {
    if (wrongAnswers.length === 0) {
      alert('복습할 오답이 없습니다.');
      return;
    }
    const questions = wrongAnswers.map(wa => wa.question);
    onStartReview(questions);
  };

  // 카테고리별로 그룹화
  const groupedByCategory = wrongAnswers.reduce((acc, wa) => {
    const category = wa.question.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(wa);
    return acc;
  }, {} as Record<string, WrongAnswer[]>);

  // 카테고리 순서 정의 (전기이론, 전기기기, 전기설비, 기타 순서)
  const categoryOrder = ['전기이론', '전기기기', '전기설비', '기타'];
  
  // 카테고리별로 정렬된 배열 생성
  const sortedCategories = Object.entries(groupedByCategory).sort(([a], [b]) => {
    const indexA = categoryOrder.indexOf(a);
    const indexB = categoryOrder.indexOf(b);
    // 카테고리 순서에 있으면 순서대로, 없으면 맨 뒤로
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">📝 오답 노트</h1>
              <p className="text-gray-600">
                틀린 문제를 복습하고 완벽하게 이해하세요!
              </p>
              <p className="text-sm text-blue-600 mt-2">
                💡 동일 문제를 연속 3회 정답 시 자동으로 제거됩니다
              </p>
            </div>
            <button
              onClick={onBack}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              ← 돌아가기
            </button>
          </div>
        </div>

        {/* 통계 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="text-sm text-gray-600 mb-1">총 오답 문제</div>
            <div className="text-3xl font-bold text-red-600">{wrongAnswers.length}문제</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="text-sm text-gray-600 mb-1">카테고리 수</div>
            <div className="text-3xl font-bold text-blue-600">
              {Object.keys(groupedByCategory).length}개
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="text-sm text-gray-600 mb-1">평균 틀린 횟수</div>
            <div className="text-3xl font-bold text-orange-600">
              {wrongAnswers.length > 0
                ? (
                    wrongAnswers.reduce((sum, wa) => sum + wa.wrongCount, 0) /
                    wrongAnswers.length
                  ).toFixed(1)
                : 0}
              회
            </div>
          </div>
        </div>

        {wrongAnswers.length === 0 ? (
          /* 오답 없음 */
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">오답이 없습니다!</h2>
            <p className="text-gray-600">
              모든 문제를 완벽하게 이해하셨네요. 축하합니다!
            </p>
          </div>
        ) : (
          <>
            {/* 액션 버튼 */}
            <div className="flex gap-4 mb-6">
              <button
                onClick={handleStartReview}
                className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors text-lg"
              >
                🔄 오답 복습하기 ({wrongAnswers.length}문제)
              </button>
              <button
                onClick={handleClearAll}
                className="px-6 py-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors text-lg"
              >
                🗑️ 전체 삭제
              </button>
            </div>

            {/* 카테고리별 오답 목록 */}
            <div className="space-y-6">
              {sortedCategories.map(([category, items]) => {
                // 카테고리별 색상 설정
                const categoryColors: Record<string, { bg: string; border: string; text: string }> = {
                  '전기이론': { bg: 'bg-blue-50', border: 'border-blue-500', text: 'text-blue-800' },
                  '전기기기': { bg: 'bg-purple-50', border: 'border-purple-500', text: 'text-purple-800' },
                  '전기설비': { bg: 'bg-orange-50', border: 'border-orange-500', text: 'text-orange-800' },
                  '기타': { bg: 'bg-gray-50', border: 'border-gray-500', text: 'text-gray-800' },
                };
                const colors = categoryColors[category] || categoryColors['기타'];
                
                return (
                <div key={category} className={`${colors.bg} rounded-lg shadow-md p-6 border-2 ${colors.border}`}>
                  <h2 className={`text-2xl font-bold ${colors.text} mb-4 flex items-center gap-2`}>
                    <span className="text-3xl">📚</span>
                    <span>{category} 오답문제</span>
                    <span className="text-lg text-gray-600">({items.length}문제)</span>
                  </h2>
                  <div className="space-y-2">
                    {items.map(wa => (
                      <div
                        key={wa.questionId}
                        className="border-2 border-red-200 rounded-lg p-4 hover:bg-red-50 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <button
                            onClick={() => setSelectedQuestion(wa)}
                            className="flex-1 text-left"
                          >
                            <div className="font-semibold text-gray-700 mb-1">
                              문제 {wa.questionId}
                            </div>
                            <div className="text-gray-600 text-sm mb-2">
                              {wa.question.question.slice(0, 80)}...
                            </div>
                            <div className="flex items-center gap-4 text-xs">
                              <span className="px-2 py-1 bg-red-100 text-red-700 rounded">
                                틀린 횟수: {wa.wrongCount}회
                              </span>
                              <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                                연속 정답: {wa.correctStreak}회
                              </span>
                              <span className="text-gray-500">
                                최근: {new Date(wa.timestamp).toLocaleDateString()}
                              </span>
                            </div>
                          </button>
                          <button
                            onClick={() => handleMarkAsLearned(wa.questionId)}
                            className="ml-4 px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm transition-colors"
                          >
                            ✓ 학습 완료
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                );
              })}
            </div>
          </>
        )}

        {/* 문제 상세 모달 */}
        {selectedQuestion && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">
                  오답 해설 (틀린 횟수: {selectedQuestion.wrongCount}회, 연속 정답:{' '}
                  {selectedQuestion.correctStreak}회)
                </h2>
                <button
                  onClick={() => setSelectedQuestion(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>
              <div className="p-6">
                <QuestionDetail
                  question={selectedQuestion.question}
                  userAnswer={selectedQuestion.userAnswer}
                />
                <div className="flex gap-4 mt-6">
                  <button
                    onClick={() => handleMarkAsLearned(selectedQuestion.questionId)}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    ✓ 학습 완료 표시
                  </button>
                  <button
                    onClick={() => setSelectedQuestion(null)}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 문제 상세 컴포넌트
function QuestionDetail({
  question,
  userAnswer,
}: {
  question: Question;
  userAnswer: number;
}) {
  return (
    <div>
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-bold text-gray-800">문제 {question.id}</h3>
          <div className="flex gap-2 items-center flex-wrap">
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
              {question.category}
            </span>
            {question.standard && (
              <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold">
                {question.standard} - {getStandardTitle(question.standard)}
              </span>
            )}
            {question.detailItem && (
              <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-semibold">
                {question.detailItem}
              </span>
            )}
          </div>
        </div>
        <LatexRenderer
          text={question.question}
          className="text-gray-700 text-lg leading-relaxed"
        />
      </div>

      {/* 이미지 (있으면) */}
      {question.imageUrl && (
        <div className="mb-4">
          <img
            src={question.imageUrl}
            alt="문제 이미지"
            className="max-w-full h-auto rounded-lg"
          />
        </div>
      )}

      {/* 선택지 */}
      <div className="space-y-3 mb-6">
        {[1, 2, 3, 4].map(optionNum => {
          const optionKey = `option${optionNum}` as keyof Question;
          const optionText = question[optionKey] as string;
          const isUserAnswer = userAnswer === optionNum;
          const isCorrectAnswer = question.answer === optionNum;

          return (
            <div
              key={optionNum}
              className={`p-4 rounded-lg border-2 ${
                isCorrectAnswer
                  ? 'border-green-500 bg-green-50'
                  : isUserAnswer
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-start">
                <span
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold mr-3 ${
                    isCorrectAnswer
                      ? 'bg-green-500 text-white'
                      : isUserAnswer
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {optionNum}
                </span>
                <div className="flex-1">
                  <LatexRenderer text={optionText} className="text-gray-700" />
                  {isCorrectAnswer && (
                    <span className="ml-2 text-green-600 font-semibold">✓ 정답</span>
                  )}
                  {isUserAnswer && !isCorrectAnswer && (
                    <span className="ml-2 text-red-600 font-semibold">✗ 선택한 답</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 결과 표시 */}
      <div className="p-4 rounded-lg mb-4 bg-red-100 border-red-500 border-2">
        <div className="font-bold text-lg mb-1">✗ 오답입니다</div>
        <div className="text-sm text-gray-700">
          정답: {question.answer}번 | 선택한 답: {userAnswer}번
        </div>
      </div>

      {/* 해설 */}
      {question.explanation && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <h4 className="font-bold text-blue-800 mb-2">📚 해설</h4>
          <LatexRenderer
            text={question.explanation}
            className="text-gray-700 leading-relaxed"
          />
        </div>
      )}
    </div>
  );
}
