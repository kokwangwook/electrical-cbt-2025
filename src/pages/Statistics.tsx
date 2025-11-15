import { useState, useEffect } from 'react';
import type { Statistics } from '../types';
import { getStatistics, clearStatistics, clearCurrentExamSession } from '../services/storage';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface StatisticsProps {
  onBack: () => void;
}

export default function Statistics({ onBack }: StatisticsProps) {
  const [stats, setStats] = useState<Statistics>(getStatistics());

  // 통계를 주기적으로 갱신
  useEffect(() => {
    const updateStats = () => {
      const latestStats = getStatistics();
      setStats(latestStats);
    };

    // 초기 로드
    updateStats();

    // 주기적으로 갱신 (1초마다)
    const interval = setInterval(updateStats, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleClearStats = () => {
    const stats = getStatistics();
    let message = '모든 학습 통계를 초기화하시겠습니까?\n\n';
    if (stats.totalExams > 0) {
      message += `- 총 시험 횟수: ${stats.totalExams}회\n`;
      message += `- 평균 점수: ${stats.averageScore}점\n`;
      message += `- 최근 시험 기록: ${stats.recentResults?.length || 0}개\n`;
    }
    message += `- 진행 중인 시험 세션\n\n`;
    message += '⚠️ 이 작업은 되돌릴 수 없습니다.';
    
    if (window.confirm(message)) {
      clearStatistics();
      clearCurrentExamSession();
      alert('✅ 학습 통계가 모두 초기화되었습니다.');
      window.location.reload();
    }
  };

  // 안전한 기본값 설정
  const safeStats: Statistics = {
    totalExams: stats?.totalExams || 0,
    averageScore: stats?.averageScore || 0,
    categoryStats: stats?.categoryStats || {},
    recentResults: stats?.recentResults || [],
  };

  // 카테고리별 정답률 그래프 데이터
  const categoryData = Object.entries(safeStats.categoryStats || {}).map(([category, data]) => {
    const percentage = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
    return {
      카테고리: category,
      정답률: percentage,
      정답: data.correct,
      오답: data.total - data.correct,
    };
  });

  // 최근 시험 결과 데이터
  const recentResults = (safeStats.recentResults || []).slice(-10).map((result, index) => {
    const score = Math.round((result.correctAnswers / result.totalQuestions) * 100);
    return {
      시험: `${index + 1}회`,
      점수: score,
    };
  });

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">📊 학습 통계</h1>
              <p className="text-gray-600">학습 진도와 성취도를 확인하세요</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleClearStats}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                🗑️ 초기화
              </button>
              <button
                onClick={onBack}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                ← 돌아가기
              </button>
            </div>
          </div>
        </div>

        {safeStats.totalExams === 0 ? (
          /* 통계 없음 */
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-6xl mb-4">📈</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">아직 통계가 없습니다</h2>
            <p className="text-gray-600">
              시험을 완료하면 학습 통계가 여기에 표시됩니다.
            </p>
          </div>
        ) : (
          <>
            {/* 요약 통계 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="text-sm text-gray-600 mb-1">총 시험 횟수</div>
                <div className="text-3xl font-bold text-blue-600">{safeStats.totalExams}회</div>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="text-sm text-gray-600 mb-1">평균 점수</div>
                <div
                  className={`text-3xl font-bold ${
                    safeStats.averageScore >= 60 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {safeStats.averageScore}점
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="text-sm text-gray-600 mb-1">최근 시험</div>
                <div className="text-3xl font-bold text-purple-600">
                  {recentResults.length > 0
                    ? `${recentResults[recentResults.length - 1].점수}점`
                    : '-'}
                </div>
              </div>
            </div>

            {/* 카테고리별 정답률 */}
            {categoryData.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">📚 카테고리별 정답률</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categoryData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="카테고리" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="정답률" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 카테고리별 상세 통계 */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">📋 카테고리별 상세</h2>
              <div className="space-y-4">
                {Object.entries(safeStats.categoryStats || {}).map(([category, data]) => {
                  const percentage =
                    data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
                  const wrong = data.total - data.correct;

                  return (
                    <div key={category} className="border-b pb-3 last:border-b-0">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-gray-700">{category}</span>
                        <span
                          className={`text-lg font-bold ${
                            percentage >= 60 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {percentage}%
                        </span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>정답: {data.correct}개</span>
                        <span>오답: {wrong}개</span>
                        <span>총: {data.total}문제</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            percentage >= 60 ? 'bg-green-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 최근 시험 기록 */}
            {(safeStats.recentResults || []).length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">📝 최근 시험 기록</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4 text-gray-700">날짜</th>
                        <th className="text-left py-2 px-4 text-gray-700">모드</th>
                        <th className="text-left py-2 px-4 text-gray-700">카테고리</th>
                        <th className="text-right py-2 px-4 text-gray-700">점수</th>
                        <th className="text-right py-2 px-4 text-gray-700">정답/총문제</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(safeStats.recentResults || [])
                        .slice(-10)
                        .reverse()
                        .map((result, index) => {
                          const score = Math.round(
                            (result.correctAnswers / result.totalQuestions) * 100
                          );
                          const passed = score >= 60;

                          return (
                            <tr key={index} className="border-b hover:bg-gray-50">
                              <td className="py-2 px-4 text-sm text-gray-600">
                                {new Date(result.timestamp).toLocaleDateString()}
                              </td>
                              <td className="py-2 px-4 text-sm text-gray-600">
                                {result.mode === 'random'
                                  ? '랜덤'
                                  : result.mode === 'category'
                                  ? '카테고리'
                                  : '오답노트'}
                              </td>
                              <td className="py-2 px-4 text-sm text-gray-600">
                                {result.category || '-'}
                              </td>
                              <td
                                className={`py-2 px-4 text-right font-bold ${
                                  passed ? 'text-green-600' : 'text-red-600'
                                }`}
                              >
                                {score}점
                              </td>
                              <td className="py-2 px-4 text-right text-sm text-gray-600">
                                {result.correctAnswers} / {result.totalQuestions}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
