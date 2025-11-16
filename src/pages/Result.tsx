import { useState } from 'react';
import type { Question } from '../types';
import LatexRenderer from '../components/LatexRenderer';
import { getStandardTitle } from '../data/examStandards';

interface ResultProps {
  questions: Question[];
  answers: (number | null)[];
  timeSpent: number;
  mode?: 'timedRandom' | 'untimedRandom' | 'random' | 'category' | 'wrong' | 'review';
  onRestart: () => void;
  onGoHome?: () => void; // 나가기 버튼용
}

export default function Result({ questions, answers, timeSpent, mode = 'timedRandom', onRestart, onGoHome }: ResultProps) {
  const [showReview, setShowReview] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);

  // 채점
  const correctAnswers = questions.filter((q, i) => answers[i] === q.answer).length;
  const wrongAnswers = questions.length - correctAnswers;
  const score = Math.round((correctAnswers / questions.length) * 100);
  const passed = score >= 60;
  const isWrongMode = mode === 'wrong';

  // 오답 노트 저장은 Exam.tsx에서 이미 완료됨
  // 중복 저장 방지를 위해 Result.tsx에서는 저장하지 않음

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}분 ${secs}초`;
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* 결과 카드 */}
        {isWrongMode ? (
          /* 오답노트 복습 모드 */
          <div className="rounded-2xl shadow-2xl p-8 mb-6 bg-gradient-to-br from-blue-400 to-blue-600">
            <div className="text-center text-white">
              <h1 className="text-4xl font-bold mb-2">📚 오답노트 복습 결과</h1>
              <p className="text-xl mb-6">재응시 결과를 확인하세요!</p>

              <div className="bg-white bg-opacity-20 rounded-lg p-6 mb-6">
                <div className="text-5xl font-bold mb-2">
                  재응시 문제 {questions.length}문제 응시해서 {correctAnswers}문제 맞췄습니다
                </div>
                <div className="text-lg mt-4">
                  정답률: {((correctAnswers / questions.length) * 100).toFixed(1)}%
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-white bg-opacity-20 rounded-lg p-4">
                  <div className="text-3xl font-bold">{questions.length}</div>
                  <div className="text-sm">재응시 문제</div>
                </div>
                <div className="bg-white bg-opacity-20 rounded-lg p-4">
                  <div className="text-3xl font-bold">{correctAnswers}</div>
                  <div className="text-sm">정답</div>
                </div>
                <div className="bg-white bg-opacity-20 rounded-lg p-4">
                  <div className="text-3xl font-bold">{wrongAnswers}</div>
                  <div className="text-sm">오답</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* 일반 시험 모드 */
          <div
            className={`rounded-2xl shadow-2xl p-8 mb-6 ${
              passed
                ? 'bg-gradient-to-br from-green-400 to-green-600'
                : 'bg-gradient-to-br from-red-400 to-red-600'
            }`}
          >
            <div className="text-center text-white">
              <h1 className="text-4xl font-bold mb-2">
                {passed ? '🎉 합격!' : '😔 불합격'}
              </h1>
              <p className="text-xl mb-6">{passed ? '축하합니다!' : '다시 도전하세요!'}</p>

              <div className="bg-white bg-opacity-20 rounded-lg p-6 mb-6">
                <div className="text-6xl font-bold mb-2">{score}점</div>
                <div className="text-lg">합격 기준: 60점 이상</div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-white bg-opacity-20 rounded-lg p-4">
                  <div className="text-3xl font-bold">{correctAnswers}</div>
                  <div className="text-sm">정답</div>
                </div>
                <div className="bg-white bg-opacity-20 rounded-lg p-4">
                  <div className="text-3xl font-bold">{wrongAnswers}</div>
                  <div className="text-sm">오답</div>
                </div>
                <div className="bg-white bg-opacity-20 rounded-lg p-4">
                  <div className="text-3xl font-bold">{formatTime(timeSpent)}</div>
                  <div className="text-sm">소요 시간</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 분야별 통계 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">📊 분야별 정답률</h2>
          <CategoryStats questions={questions} answers={answers} />
        </div>

        {/* 버튼 그룹 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <button
            onClick={onRestart}
            className="px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors text-lg"
          >
            🔄 다시 시작
          </button>
          <button
            onClick={() => setShowReview(true)}
            className="px-6 py-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors text-lg"
          >
            📝 해설 보기
          </button>
          <button
            onClick={onGoHome || onRestart}
            className="px-6 py-4 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors text-lg"
          >
            ← 나가기
          </button>
        </div>

        {/* 문제 목록 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">문제 목록</h2>

          <div className="space-y-2">
            {questions.map((q, idx) => {
              const userAnswer = answers[idx];
              const isCorrect = userAnswer === q.answer;

              return (
                <button
                  key={q.id}
                  onClick={() => {
                    setReviewIndex(idx);
                    setShowReview(true);
                  }}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                    isCorrect
                      ? 'border-green-500 bg-green-50'
                      : 'border-red-500 bg-red-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <span className="font-semibold text-gray-700">문제 {idx + 1}.</span>
                      <span className="ml-2 text-gray-600">
                        {q.question.slice(0, 50)}...
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          isCorrect
                            ? 'bg-green-500 text-white'
                            : 'bg-red-500 text-white'
                        }`}
                      >
                        {isCorrect ? '✓ 정답' : '✗ 오답'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 해설 모달 */}
        {showReview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">문제 해설</h2>
                <button
                  onClick={() => setShowReview(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>
              <div className="p-6">
                <QuestionReview
                  question={questions[reviewIndex]}
                  questionNumber={reviewIndex + 1}
                  userAnswer={answers[reviewIndex]}
                />
                <div className="flex justify-between mt-6">
                  <button
                    onClick={() => setReviewIndex(Math.max(0, reviewIndex - 1))}
                    disabled={reviewIndex === 0}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
                  >
                    ← 이전
                  </button>
                  <button
                    onClick={() =>
                      setReviewIndex(Math.min(questions.length - 1, reviewIndex + 1))
                    }
                    disabled={reviewIndex === questions.length - 1}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
                  >
                    다음 →
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

// 분야별 통계 컴포넌트
function CategoryStats({
  questions,
  answers,
}: {
  questions: Question[];
  answers: (number | null)[];
}) {
  const categories = Array.from(new Set(questions.map(q => q.category)));

  const stats = categories.map(category => {
    const categoryQuestions = questions.filter(q => q.category === category);
    const correct = categoryQuestions.filter(
      q => answers[questions.indexOf(q)] === q.answer
    ).length;
    const total = categoryQuestions.length;
    const percentage = Math.round((correct / total) * 100);

    return { category, correct, total, percentage };
  });

  return (
    <div className="space-y-3">
      {stats.map(stat => (
        <div key={stat.category} className="border-b pb-3 last:border-b-0">
          <div className="flex justify-between items-center mb-2">
            <span className="font-medium text-gray-700">{stat.category}</span>
            <span className="text-sm text-gray-600">
              {stat.correct} / {stat.total} ({stat.percentage}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                stat.percentage >= 60 ? 'bg-green-500' : 'bg-red-500'
              }`}
              style={{ width: `${stat.percentage}%` }}
            ></div>
          </div>
        </div>
      ))}
    </div>
  );
}

// 문제 해설 컴포넌트
function QuestionReview({
  question,
  questionNumber,
  userAnswer,
}: {
  question: Question;
  questionNumber: number;
  userAnswer: number | null;
}) {
  const isCorrect = userAnswer === question.answer;

  return (
    <div>
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-bold text-gray-800">문제 {questionNumber}</h3>
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
      <div
        className={`p-4 rounded-lg mb-4 ${
          isCorrect ? 'bg-green-100 border-green-500' : 'bg-red-100 border-red-500'
        } border-2`}
      >
        <div className="font-bold text-lg mb-1">
          {isCorrect ? '✓ 정답입니다!' : '✗ 오답입니다'}
        </div>
        <div className="text-sm text-gray-700">
          정답: {question.answer}번
          {userAnswer && !isCorrect && ` | 선택한 답: ${userAnswer}번`}
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
