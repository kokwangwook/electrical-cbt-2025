import { useState, useEffect } from 'react';
import type { Feedback, Question } from '../types';
import { getFeedbacks, addFeedback, deleteFeedback, getCurrentUser, getMemberById } from '../services/storage';
import LatexRenderer from './LatexRenderer';

interface FeedbackBoardProps {
  onClose: () => void;
  currentQuestion?: Question; // 현재 문제 정보 (오류 제보 시 사용)
  currentQuestionIndex?: number; // 현재 문제 번호
}

export default function FeedbackBoard({ onClose, currentQuestion, currentQuestionIndex }: FeedbackBoardProps) {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [newFeedback, setNewFeedback] = useState('');
  // 문제가 있으면 기본값을 'bug'로, 없으면 'suggestion'으로 설정
  const [feedbackType, setFeedbackType] = useState<'suggestion' | 'bug' | 'question' | 'myFeedbacks'>(
    currentQuestion ? 'bug' : 'suggestion'
  );
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'myFeedbacks'>('all'); // 전체 보기 / 나의 제보 내역


  const loadFeedbacks = () => {
    const allFeedbacks = getFeedbacks();
    const currentUserId = getCurrentUser();
    
    if (viewMode === 'myFeedbacks' && currentUserId) {
      // 나의 제보 내역만 필터링
      const myFeedbacks = allFeedbacks.filter(f => f.userId === currentUserId);
      setFeedbacks(myFeedbacks);
    } else {
      // 전체 제보 또는 타입별 필터링
      if (feedbackType === 'suggestion' || feedbackType === 'bug' || feedbackType === 'question') {
        const filtered = allFeedbacks.filter(f => f.type === feedbackType);
        setFeedbacks(filtered);
      } else {
        setFeedbacks(allFeedbacks);
      }
    }
  };

  useEffect(() => {
    loadFeedbacks();
  }, [viewMode, feedbackType]);

  const handleSubmit = () => {
    if (!newFeedback.trim()) {
      alert('내용을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const currentUserId = getCurrentUser();
      const currentUser = currentUserId ? getMemberById(currentUserId) : null;
      const author = currentUser ? currentUser.name : '게스트';

      // 오류 제보이고 현재 문제가 있으면 문제 정보 포함
      const feedbackData: Omit<Feedback, 'id' | 'timestamp'> = {
        author,
        userId: currentUserId || undefined,
        content: newFeedback.trim(),
        type: feedbackType === 'myFeedbacks' ? undefined : feedbackType,
      };

      // 오류 제보이고 현재 문제가 있으면 문제 정보 추가
      if (feedbackType === 'bug' && currentQuestion) {
        feedbackData.questionId = currentQuestion.id;
        feedbackData.question = currentQuestion;
      }

      addFeedback(feedbackData);

      setNewFeedback('');
      setFeedbackType('bug'); // 기본값으로 리셋
      loadFeedbacks();
      alert('✅ 제보가 등록되었습니다. 감사합니다!');
    } catch (error) {
      console.error('피드백 등록 실패:', error);
      alert('❌ 제보 등록에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm('이 제보를 삭제하시겠습니까?')) {
      deleteFeedback(id);
      loadFeedbacks();
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  const getTypeLabel = (type?: string) => {
    switch (type) {
      case 'suggestion':
        return '건의사항';
      case 'bug':
        return '오류 제보';
      case 'question':
        return '문의사항';
      default:
        return '건의사항';
    }
  };

  const getTypeColor = (type?: string) => {
    switch (type) {
      case 'suggestion':
        return 'bg-blue-100 text-blue-800';
      case 'bug':
        return 'bg-red-100 text-red-800';
      case 'question':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">📋 제보 게시판</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-2xl font-bold"
          >
            ✕
          </button>
        </div>

        {/* 공지사항 */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 m-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className="text-yellow-400 text-xl">📢</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">안내</h3>
              <p className="mt-1 text-sm text-yellow-700">
                이 게시판은 수정사항이나 건의사항을 작성하는 공간입니다.
                <br />
                문제 오류, 개선 사항, 문의사항 등을 자유롭게 작성해주세요.
              </p>
            </div>
          </div>
        </div>

        {/* 내용 영역 */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* 피드백 목록 */}
          {viewMode === 'myFeedbacks' ? (
            <div className="space-y-4 mb-6">
              {feedbacks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  등록한 제보가 없습니다.
                </div>
              ) : (
                feedbacks.map((feedback) => (
                  <div
                    key={feedback.id}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getTypeColor(feedback.type)}`}>
                          {getTypeLabel(feedback.type)}
                        </span>
                        <span className="font-semibold text-gray-800">{feedback.author}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{formatDate(feedback.timestamp)}</span>
                        <button
                          onClick={() => handleDelete(feedback.id)}
                          className="text-red-500 hover:text-red-700 text-sm"
                          title="삭제"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    {feedback.question && (
                      <div className="mb-3 p-3 bg-blue-50 rounded border border-blue-200">
                        <div className="text-sm font-semibold text-blue-800 mb-2">
                          📋 문제 {feedback.questionId}
                        </div>
                        <div className="text-sm text-gray-700">
                          <LatexRenderer text={feedback.question.question} />
                        </div>
                      </div>
                    )}
                    <p className="text-gray-700 whitespace-pre-wrap">{feedback.content}</p>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4 mb-6">
              {feedbacks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  아직 등록된 제보가 없습니다.
                </div>
              ) : (
                feedbacks.map((feedback) => (
                  <div
                    key={feedback.id}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getTypeColor(feedback.type)}`}>
                          {getTypeLabel(feedback.type)}
                        </span>
                        <span className="font-semibold text-gray-800">{feedback.author}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{formatDate(feedback.timestamp)}</span>
                        <button
                          onClick={() => handleDelete(feedback.id)}
                          className="text-red-500 hover:text-red-700 text-sm"
                          title="삭제"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    {feedback.question && (
                      <div className="mb-3 p-3 bg-blue-50 rounded border border-blue-200">
                        <div className="text-sm font-semibold text-blue-800 mb-2">
                          📋 문제 {feedback.questionId}
                        </div>
                        <div className="text-sm text-gray-700">
                          <LatexRenderer text={feedback.question.question} />
                        </div>
                      </div>
                    )}
                    <p className="text-gray-700 whitespace-pre-wrap">{feedback.content}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 새 피드백 작성 */}
          {viewMode !== 'myFeedbacks' && (
            <div className="bg-white border-2 border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-3">새 제보 작성</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    유형 선택
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setFeedbackType('bug')}
                      className={`px-3 py-1 rounded text-sm ${
                        feedbackType === 'bug'
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      오류 제보
                    </button>
                    <button
                      onClick={() => setFeedbackType('suggestion')}
                      className={`px-3 py-1 rounded text-sm ${
                        feedbackType === 'suggestion'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      건의사항
                    </button>
                    <button
                      onClick={() => setFeedbackType('question')}
                      className={`px-3 py-1 rounded text-sm ${
                        feedbackType === 'question'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      문의사항
                    </button>
                    <button
                      onClick={() => {
                        setViewMode('myFeedbacks');
                        setFeedbackType('myFeedbacks' as any);
                      }}
                      className={`px-3 py-1 rounded text-sm ${
                        (viewMode as string) === 'myFeedbacks'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      나의 제보 내역
                    </button>
                  </div>
                </div>
                {feedbackType === 'bug' && currentQuestion && (
                  <div className="p-3 bg-red-50 rounded border border-red-200">
                    <div className="text-sm font-semibold text-red-800 mb-2">
                      📋 문제 {currentQuestionIndex !== undefined ? currentQuestionIndex + 1 : currentQuestion.id}
                    </div>
                    <div className="text-sm text-gray-700 mb-2">
                      <LatexRenderer text={currentQuestion.question} />
                    </div>
                    <div className="text-xs text-gray-500">
                      위 문제에 대한 오류를 작성해주세요.
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    내용
                  </label>
                  <textarea
                    value={newFeedback}
                    onChange={(e) => setNewFeedback(e.target.value)}
                    placeholder={feedbackType === 'bug' && currentQuestion ? "문제의 오류 사항을 작성해주세요..." : "수정사항이나 건의사항을 작성해주세요..."}
                    className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !newFeedback.trim() || feedbackType === 'myFeedbacks'}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  {loading ? '등록 중...' : '📝 제보 등록'}
                </button>
              </div>
            </div>
          )}
          {viewMode === 'myFeedbacks' && (
            <div className="bg-white border-2 border-purple-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-gray-800">나의 제보 내역</h3>
                <button
                  onClick={() => {
                    setViewMode('all');
                    setFeedbackType('bug');
                  }}
                  className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded"
                >
                  ← 제보 작성하기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

