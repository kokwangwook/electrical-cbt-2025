import { useState, useMemo } from 'react';
import { getQuestions, updateQuestion } from '../services/storage';
import { EXAM_STANDARDS, getDetailItemsByStandard, getStandardsByCategory, getStandardTitle, matchDetailItemByKeywords } from '../data/examStandards';
import type { Question } from '../types';

export default function StandardStatistics() {
  const [questions, setQuestions] = useState<Question[]>(getQuestions());
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [selectedStandard, setSelectedStandard] = useState<string>('');
  const [selectedDetailItem, setSelectedDetailItem] = useState<string>('');
  const [autoApplyStandard, setAutoApplyStandard] = useState(true);
  const [questionList, setQuestionList] = useState<Question[]>([]); // 현재 문제 목록
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(-1); // 현재 문제 인덱스
  
  // 문제 목록 새로고침
  const refreshQuestions = () => {
    setQuestions(getQuestions());
  };

  // 출제기준별 문제 통계 계산
  const standardStats = useMemo(() => {
    const stats: Record<string, { count: number; category: string; title: string }> = {};
    
    // 모든 출제기준 초기화
    Object.keys(EXAM_STANDARDS).forEach(standard => {
      const category = standard.startsWith('1.') ? '전기이론' 
        : standard.startsWith('2.') ? '전기기기'
        : standard.startsWith('3.') ? '전기설비'
        : '기타';
      
      stats[standard] = {
        count: 0,
        category,
        title: EXAM_STANDARDS[standard],
      };
    });
    
    // 출제기준이 없는 문제도 카운트
    stats['미지정'] = {
      count: 0,
      category: '기타',
      title: '출제기준 미지정',
    };
    
    // 문제별로 출제기준 카운트
    questions.forEach(q => {
      if (q.standard && stats[q.standard]) {
        stats[q.standard].count++;
      } else {
        stats['미지정'].count++;
      }
    });
    
    return stats;
  }, [questions]);

  // 카테고리별 출제기준 통계
  const categoryStandardStats = useMemo(() => {
    const categoryStats: Record<string, Array<{ standard: string; count: number; title: string }>> = {
      '전기이론': [],
      '전기기기': [],
      '전기설비': [],
      '기타': [],
    };
    
    Object.entries(standardStats).forEach(([standard, data]) => {
      if (data.count > 0 || standard === '미지정') {
        categoryStats[data.category].push({
          standard,
          count: data.count,
          title: data.title,
        });
      }
    });
    
    return categoryStats;
  }, [standardStats]);

  // 카테고리별 총 문제 수
  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {
      '전기이론': 0,
      '전기기기': 0,
      '전기설비': 0,
      '기타': 0,
    };
    
    questions.forEach(q => {
      const category = q.category || '기타';
      if (totals.hasOwnProperty(category)) {
        totals[category]++;
      } else {
        totals['기타']++;
      }
    });
    
    return totals;
  }, [questions]);

  return (
    <div className="space-y-6">
      {/* 전체 현황 요약 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">📊 전체 문제 현황</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-3xl font-bold text-blue-600">{questions.length}</div>
            <div className="text-sm text-gray-600 mt-1">전체 문제</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-3xl font-bold text-green-600">{categoryTotals['전기이론']}</div>
            <div className="text-sm text-gray-600 mt-1">전기이론</div>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <div className="text-3xl font-bold text-yellow-600">{categoryTotals['전기기기']}</div>
            <div className="text-sm text-gray-600 mt-1">전기기기</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-3xl font-bold text-purple-600">{categoryTotals['전기설비']}</div>
            <div className="text-sm text-gray-600 mt-1">전기설비</div>
          </div>
        </div>
      </div>

      {/* 출제기준별 문제 통계 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">📋 출제기준별 문제 현황</h2>
        
        {/* 카테고리별로 그룹화하여 표시 */}
        {Object.entries(categoryStandardStats).map(([category, standards]) => {
          if (standards.length === 0) return null;
          
          const categoryBg = {
            '전기이론': 'bg-green-50',
            '전기기기': 'bg-yellow-50',
            '전기설비': 'bg-purple-50',
            '기타': 'bg-gray-50',
          }[category] || 'bg-gray-50';
          
          const categoryText = {
            '전기이론': 'text-green-700',
            '전기기기': 'text-yellow-700',
            '전기설비': 'text-purple-700',
            '기타': 'text-gray-700',
          }[category] || 'text-gray-700';
          
          const categoryBorder = {
            '전기이론': 'border-green-200',
            '전기기기': 'border-yellow-200',
            '전기설비': 'border-purple-200',
            '기타': 'border-gray-200',
          }[category] || 'border-gray-200';
          
          // 카테고리의 실제 총 문제 수 (출제기준 미지정 문제 포함)
          const categoryTotalCount = categoryTotals[category] || 0;
          
          return (
            <div key={category} className={`mb-6 ${categoryBg} rounded-lg p-4 border ${categoryBorder}`}>
              <div className="flex justify-between items-center mb-3">
                <h3 className={`text-lg font-bold ${categoryText}`}>
                  {category === '전기이론' ? '⚡ 전기이론' :
                   category === '전기기기' ? '🔧 전기기기' :
                   category === '전기설비' ? '🏗️ 전기설비' :
                   '📦 기타'}
                  <span className="ml-2 text-sm font-normal text-gray-600">
                    ({categoryTotalCount}개)
                  </span>
                  {['전기이론', '전기기기', '전기설비'].includes(category) && (
                    <span className="ml-2 text-sm font-normal text-gray-600">
                      20문항 출제
                    </span>
                  )}
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {standards.map(({ standard, count, title }) => {
                  // 카테고리 전체 문제 수 대비 비율 계산
                  const percentage = categoryTotalCount > 0 
                    ? ((count / categoryTotalCount) * 100).toFixed(1) 
                    : '0.0';
                  
                  // 해당 출제기준의 문제들
                  const standardQuestions = questions.filter(q => q.standard === standard);
                  
                  // 세부항목별 문제 수 계산
                  const detailItems = getDetailItemsByStandard(standard);
                  const detailItemStats: Record<string, number> = {};
                  detailItems.forEach(item => {
                    detailItemStats[item] = standardQuestions.filter(q => q.detailItem === item).length;
                  });
                  // 세부항목이 지정되지 않은 문제 수 (항상 계산하되, 0개여도 표시)
                  const unspecifiedCount = standardQuestions.filter(q => !q.detailItem || !detailItems.includes(q.detailItem)).length;
                  detailItemStats['미지정'] = unspecifiedCount;
                  
                  return (
                    <div
                      key={standard}
                      className={`bg-white rounded-lg p-3 border ${categoryBorder} ${
                        count === 0 ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-sm font-semibold ${categoryText}`}>
                          {standard}
                        </span>
                        <div className="text-right">
                          <span className={`text-xl font-bold ${categoryText}`}>
                            {count}개
                          </span>
                          {categoryTotalCount > 0 && (
                            <span className={`text-xs ${categoryText} ml-1`}>
                              ({percentage}%)
                            </span>
                          )}
                          {['전기이론', '전기기기', '전기설비'].includes(category) && categoryTotalCount > 0 && (
                            <span className="text-sm font-bold text-red-600 ml-2">
                              {((parseFloat(percentage) / 100) * 20).toFixed(1)}문제
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 line-clamp-2 mb-2">
                        {title}
                      </div>
                      
                      {/* 세부항목별 문제 수 및 비율 */}
                      {detailItems.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="text-xs font-semibold text-gray-700 mb-2">
                            세부항목:
                          </div>
                          <div className="space-y-1">
                            {detailItems.map(detailItem => {
                              const detailCount = detailItemStats[detailItem] || 0;
                              // 출제기준의 문제 수가 0보다 크면 비율 계산, 아니면 0.0%
                              const detailPercentage = count > 0 
                                ? ((detailCount / count) * 100).toFixed(1) 
                                : '0.0';
                              
                              // 출제기준별 예상 출제 문제 수 계산
                              const standardExpectedCount = categoryTotalCount > 0 && ['전기이론', '전기기기', '전기설비'].includes(category)
                                ? (parseFloat(percentage) / 100) * 20
                                : 0;
                              
                              // 세부항목별 예상 출제 문제 수 계산
                              const detailExpectedCount = count > 0 && standardExpectedCount > 0
                                ? (parseFloat(detailPercentage) / 100) * standardExpectedCount
                                : 0;
                              
                              return (
                                <div key={detailItem} className={`flex justify-between items-center text-xs ${detailCount === 0 ? 'opacity-50' : ''}`}>
                                  <span className="text-gray-600 truncate flex-1 mr-2">
                                    • {detailItem}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-700 font-medium whitespace-nowrap">
                                      {detailCount}개
                                      <span className="text-gray-500 ml-1">
                                        ({detailPercentage}%)
                                      </span>
                                      {['전기이론', '전기기기', '전기설비'].includes(category) && (
                                        <span className="text-red-600 font-bold ml-2">
                                          {detailExpectedCount.toFixed(1)}문제
                                        </span>
                                      )}
                                    </span>
                                    <button
                                      onClick={() => {
                                        const detailQuestions = standardQuestions.filter(q => q.detailItem === detailItem);
                                        if (detailQuestions.length > 0) {
                                          setQuestionList(detailQuestions);
                                          setCurrentQuestionIndex(0);
                                          setSelectedQuestion(detailQuestions[0]);
                                          setSelectedStandard(standard);
                                          setSelectedDetailItem(detailItem);
                                          setShowAssignModal(true);
                                        }
                                      }}
                                      className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-semibold transition-colors whitespace-nowrap"
                                      title="세부항목 수정"
                                    >
                                      수정
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                            {/* 미지정 세부항목 표시 (항상 표시, 0개여도) */}
                            {(() => {
                              const unspecifiedCount = detailItemStats['미지정'] || 0;
                              const unspecifiedPercentage = count > 0 
                                ? ((unspecifiedCount / count) * 100).toFixed(1) 
                                : '0.0';
                              
                              // 출제기준별 예상 출제 문제 수 계산
                              const standardExpectedCount = categoryTotalCount > 0 && ['전기이론', '전기기기', '전기설비'].includes(category)
                                ? (parseFloat(percentage) / 100) * 20
                                : 0;
                              
                              // 미지정 세부항목별 예상 출제 문제 수 계산
                              const unspecifiedExpectedCount = count > 0 && standardExpectedCount > 0
                                ? (parseFloat(unspecifiedPercentage) / 100) * standardExpectedCount
                                : 0;
                              
                              return (
                                <div className={`flex justify-between items-center text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100 ${unspecifiedCount === 0 ? 'opacity-50' : ''}`}>
                                  <span className="truncate flex-1 mr-2">
                                    • 미지정
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium whitespace-nowrap">
                                      {unspecifiedCount}개
                                      <span className="ml-1">
                                        ({unspecifiedPercentage}%)
                                      </span>
                                      {['전기이론', '전기기기', '전기설비'].includes(category) && (
                                        <span className="text-red-600 font-bold ml-2">
                                          {unspecifiedExpectedCount.toFixed(1)}문제
                                        </span>
                                      )}
                                    </span>
                                    {unspecifiedCount > 0 && (
                                      <button
                                        onClick={() => {
                                          const unspecifiedQuestions = standardQuestions.filter(
                                            q => !q.detailItem || !detailItems.includes(q.detailItem)
                                          );
                                          if (unspecifiedQuestions.length > 0) {
                                            setQuestionList(unspecifiedQuestions);
                                            setCurrentQuestionIndex(0);
                                            setSelectedQuestion(unspecifiedQuestions[0]);
                                            setSelectedStandard(standard);
                                            setSelectedDetailItem('');
                                            setShowAssignModal(true);
                                          }
                                        }}
                                        className="px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs font-semibold transition-colors whitespace-nowrap"
                                        title="미지정 세부항목 지정"
                                      >
                                        지정
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                      
                      {/* 진행 바 - 카테고리 전체 문제 수 대비 비율 */}
                      {categoryTotalCount > 0 && (
                        <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              category === '전기이론' ? 'bg-green-500' :
                              category === '전기기기' ? 'bg-yellow-500' :
                              category === '전기설비' ? 'bg-purple-500' :
                              'bg-gray-500'
                            }`}
                            style={{ width: `${Math.max((count / categoryTotalCount) * 100, 2)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        
        {/* 출제기준이 없는 문제 수 표시 */}
        {standardStats['미지정'] && standardStats['미지정'].count > 0 && (() => {
          const unspecifiedQuestions = questions.filter(q => !q.standard);
          
          return (
            <div className="bg-red-50 rounded-lg p-4 border border-red-200 mt-4">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h3 className="text-md font-bold text-red-700 mb-1">
                    ⚠️ 출제기준 미지정 문제
                  </h3>
                  <p className="text-sm text-red-600">
                    {standardStats['미지정'].count}개 문제에 출제기준이 지정되지 않았습니다.
                  </p>
                </div>
                <span className="text-3xl font-bold text-red-600">
                  {standardStats['미지정'].count}
                </span>
              </div>
              
              {/* 미지정 문제 목록 */}
              <div className="mt-4">
                <div className="space-y-2">
                  {unspecifiedQuestions.map((question) => (
                    <div
                      key={question.id}
                      className="bg-white rounded-lg p-3 border border-red-200 flex justify-between items-center"
                    >
                      <div className="flex-1 mr-4">
                        <div className="text-sm font-semibold text-gray-800 mb-1">
                          ID: {question.id} - {question.category}
                        </div>
                        <div className="text-xs text-gray-600 line-clamp-2">
                          {question.question.replace(/<[^>]*>/g, '').substring(0, 100)}...
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const unspecifiedQuestions = questions.filter(q => !q.standard);
                          const index = unspecifiedQuestions.findIndex(q => q.id === question.id);
                          setQuestionList(unspecifiedQuestions);
                          setCurrentQuestionIndex(index);
                          setSelectedQuestion(question);
                          setSelectedStandard('');
                          setSelectedDetailItem('');
                          setShowAssignModal(true);
                        }}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors whitespace-nowrap"
                      >
                        출제기준 지정
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
        
        {/* 미지정 세부항목 문제 표시 */}
        {Object.entries(categoryStandardStats).map(([category, standards]) => {
          const categoryQuestions = questions.filter(q => q.category === category);
          const unspecifiedDetailItemQuestions: Array<{ standard: string; questions: Question[] }> = [];
          
          standards.forEach(({ standard }) => {
            if (standard === '미지정') return;
            
            const standardQuestions = categoryQuestions.filter(q => q.standard === standard);
            const detailItems = getDetailItemsByStandard(standard);
            const unspecifiedQuestions = standardQuestions.filter(
              q => !q.detailItem || !detailItems.includes(q.detailItem)
            );
            
            if (unspecifiedQuestions.length > 0) {
              unspecifiedDetailItemQuestions.push({
                standard,
                questions: unspecifiedQuestions,
              });
            }
          });
          
          if (unspecifiedDetailItemQuestions.length === 0) return null;
          
          return (
            <div key={category} className="bg-orange-50 rounded-lg p-4 border border-orange-200 mt-4">
              <h3 className="text-md font-bold text-orange-700 mb-3">
                ⚠️ {category} - 세부항목 미지정 문제
              </h3>
              <div className="space-y-3">
                {unspecifiedDetailItemQuestions.map(({ standard, questions: standardQuestions }) => (
                  <div key={standard} className="bg-white rounded-lg p-3 border border-orange-200">
                    <div className="text-sm font-semibold text-orange-800 mb-2">
                      {standard} - {getStandardTitle(standard)} ({standardQuestions.length}개)
                    </div>
                    <div className="space-y-2">
                      {standardQuestions.map((question) => (
                        <div
                          key={question.id}
                          className="bg-gray-50 rounded p-2 flex justify-between items-center"
                        >
                          <div className="flex-1 mr-4">
                            <div className="text-xs font-semibold text-gray-700 mb-1">
                              ID: {question.id}
                            </div>
                            <div className="text-xs text-gray-600 line-clamp-1">
                              {question.question.replace(/<[^>]*>/g, '').substring(0, 80)}...
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const index = standardQuestions.findIndex(q => q.id === question.id);
                              setQuestionList(standardQuestions);
                              setCurrentQuestionIndex(index);
                              setSelectedQuestion(question);
                              setSelectedStandard(question.standard || '');
                              setSelectedDetailItem('');
                              setShowAssignModal(true);
                            }}
                            className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs font-semibold transition-colors whitespace-nowrap"
                          >
                            세부항목 지정
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        
        {/* 출제기준/세부항목 지정 모달 */}
        {showAssignModal && selectedQuestion && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">
                  출제기준/세부항목 지정
                </h2>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedQuestion(null);
                    setSelectedStandard('');
                    setSelectedDetailItem('');
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>
              
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                {/* 문제 정보 */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm font-semibold text-gray-700 mb-2">
                    문제 정보
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div>ID: {selectedQuestion.id}</div>
                    <div>카테고리: {selectedQuestion.category}</div>
                    <div className="line-clamp-3">
                      {selectedQuestion.question.replace(/<[^>]*>/g, '')}
                    </div>
                  </div>
                </div>
                
                {/* 출제기준 선택 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    출제기준
                  </label>
                  <select
                    value={selectedStandard}
                    onChange={(e) => {
                      const newStandard = e.target.value || undefined;
                      setSelectedStandard(newStandard || '');
                      setSelectedDetailItem(''); // 출제기준 변경 시 세부항목 초기화
                      
                      // 자동 적용이 체크되어 있으면 세부항목 자동 매칭 시도
                      if (newStandard && autoApplyStandard) {
                        const updatedQuestion = { ...selectedQuestion, standard: newStandard };
                        const matchedDetailItem = matchDetailItemByKeywords(updatedQuestion);
                        if (matchedDetailItem) {
                          setSelectedDetailItem(matchedDetailItem);
                        }
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">미지정</option>
                    {getStandardsByCategory(selectedQuestion.category).map(code => (
                      <option key={code} value={code}>
                        {code} - {getStandardTitle(code)}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* 세부항목 선택 (출제기준이 선택된 경우에만 표시) */}
                {selectedStandard && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      세부항목
                    </label>
                    <select
                      value={selectedDetailItem}
                      onChange={(e) => setSelectedDetailItem(e.target.value || undefined || '')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">미지정</option>
                      {getDetailItemsByStandard(selectedStandard).map(item => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                {/* 자동 적용 체크박스 */}
                <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoApplyStandard}
                      onChange={(e) => setAutoApplyStandard(e.target.checked)}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">
                      출제기준/세부항목 자동 적용
                    </span>
                  </label>
                  <p className="text-xs text-gray-600 mt-1 ml-6">
                    (키워드 기반 자동 매칭)
                  </p>
                </div>
                
                {/* 버튼 */}
                <div className="flex gap-4 pt-4 border-t">
                  <button
                    onClick={() => {
                      if (!selectedQuestion) return;
                      
                      const updatedQuestion: Question = {
                        ...selectedQuestion,
                        standard: selectedStandard || undefined,
                        detailItem: selectedDetailItem || undefined,
                      };
                      
                      updateQuestion(updatedQuestion);
                      refreshQuestions();
                      setShowAssignModal(false);
                      setSelectedQuestion(null);
                      setSelectedStandard('');
                      setSelectedDetailItem('');
                      setQuestionList([]);
                      setCurrentQuestionIndex(-1);
                      alert('출제기준/세부항목이 지정되었습니다.');
                    }}
                    className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    적용
                  </button>
                  <button
                    onClick={() => {
                      // 저장하지 않고 다음 문제로 이동
                      const nextIndex = currentQuestionIndex + 1;
                      if (nextIndex < questionList.length) {
                        const nextQuestion = questionList[nextIndex];
                        setCurrentQuestionIndex(nextIndex);
                        setSelectedQuestion(nextQuestion);
                        setSelectedStandard(nextQuestion.standard || '');
                        setSelectedDetailItem(nextQuestion.detailItem || '');
                        // 다음 문제가 이미 지정되어 있으면 세부항목만 초기화
                        if (nextQuestion.standard && !nextQuestion.detailItem) {
                          setSelectedDetailItem('');
                        }
                      } else {
                        // 마지막 문제면 모달 닫기
                        setShowAssignModal(false);
                        setSelectedQuestion(null);
                        setSelectedStandard('');
                        setSelectedDetailItem('');
                        setQuestionList([]);
                        setCurrentQuestionIndex(-1);
                        alert('마지막 문제입니다.');
                      }
                    }}
                    disabled={currentQuestionIndex < 0 || currentQuestionIndex >= questionList.length - 1}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
                  >
                    다음
                  </button>
                  <button
                    onClick={() => {
                      setShowAssignModal(false);
                      setSelectedQuestion(null);
                      setSelectedStandard('');
                      setSelectedDetailItem('');
                      setQuestionList([]);
                      setCurrentQuestionIndex(-1);
                    }}
                    className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
                  >
                    취소
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

