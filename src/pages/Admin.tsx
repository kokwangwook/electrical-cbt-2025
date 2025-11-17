import { useState, useEffect } from 'react';
import type { Question, Member, ExamConfig } from '../types';
import {
  getQuestions,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  getMembers,
  addMember,
  updateMember,
  deleteMember,
  exportData,
  importData,
  saveQuestions,
  deleteAllData,
  downloadBackup,
  restoreFromFile,
  getLoginHistory,
  deleteLoginHistory,
  clearLoginHistory,
  clearAllCaches,
  compressImage,
  getLocalStorageUsage,
} from '../services/storage';
import type { LoginHistory } from '../types';
import {
  getAllQuestionsFromSheets,
  bulkAddQuestionsToSheets,
} from '../services/googleSheetsService';
import LatexRenderer from '../components/LatexRenderer';
import { getStandardsByCategory, getStandardTitle, matchStandardByKeywords, matchDetailItemByKeywords, getDetailItemsByStandard } from '../data/examStandards';
import StandardStatistics from '../components/StandardStatistics';
import { getExamConfig, saveExamConfig, resetExamConfig } from '../services/examConfigService';
import {
  testSupabaseConnection,
  getSupabaseQuestionCount,
  migrateQuestionsToSupabase,
  getSupabaseUsageStats,
  type MigrationProgress,
  type SupabaseUsageStats,
} from '../services/supabaseMigration';
import {
  insertQuestions,
  fetchQuestionsFromGoogleSheet,
  parseCSVToQuestions,
  getCategoryCounts,
  updateMemberInSupabase,
  deleteMemberFromSupabase,
  updateQuestionInSupabase,
  deleteQuestionFromSupabase,
  saveMemberToSupabase,
  getLoginHistory as getLoginHistoryFromSupabase,
  fetchAllUserDataFromSupabase,
} from '../services/supabaseService';
import { useFeedbacks } from '../hooks/useFeedbacks';

export default function Admin() {
  // 인증
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const ADMIN_PASSWORD = 'admin2024';

  // 탭
  const [activeTab, setActiveTab] = useState<'questions' | 'members' | 'sync' | 'statistics' | 'config' | 'login-history' | 'feedbacks' | 'upload' | 'student-records'>('questions');
  const [feedbackSubTab, setFeedbackSubTab] = useState<'bug' | 'suggestion' | 'question'>('bug'); // 제보 게시판 하위 탭

  // 문제 업로드
  const [uploadMethod, setUploadMethod] = useState<'googleSheet' | 'csv'>('googleSheet');
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<Partial<Question>[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  // 출제 설정
  const [examConfig, setExamConfig] = useState<ExamConfig>(getExamConfig());

  // 문제 관리
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showMustIncludeOnly, setShowMustIncludeOnly] = useState<boolean>(false);
  const [showMustExcludeOnly, setShowMustExcludeOnly] = useState<boolean>(false);
  const [weightFilter, setWeightFilter] = useState<string>('all'); // 가중치 필터 (all, 1-10)
  const [selectedQuestions, setSelectedQuestions] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const questionsPerPage = 100;
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showStandardApplyModal, setShowStandardApplyModal] = useState(false);
  const [standardApplyMode, setStandardApplyMode] = useState<'random' | 'manual'>('random');
  const [selectedStandard, setSelectedStandard] = useState<string>('');
  const [selectedDetailItem, setSelectedDetailItem] = useState<string>('');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('table');

  // 회원 관리
  const [members, setMembers] = useState<Member[]>([]);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);

  // 로그인 기록
  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([]);
  const [isLoadingLoginHistory, setIsLoadingLoginHistory] = useState(false);

  // 학생 학습 기록
  const [studentRecords, setStudentRecords] = useState<Array<{
    userId: number;
    userName: string;
    wrongAnswers: unknown[];
    examResults: unknown[];
    statistics: unknown;
    updatedAt: string;
  }>>([]);
  const [isLoadingStudentRecords, setIsLoadingStudentRecords] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);

  // 제보 게시판 - 커스텀 훅 사용
  const {
    feedbacks,
    allFeedbacksCount,
    loading: feedbacksLoading,
    error: feedbacksError,
    loadFeedbacks,
    deleteFeedbackItem
  } = useFeedbacks({
    isAdmin: true,
    filterType: feedbackSubTab
  });

  // 동기화
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [autoApplyStandard, setAutoApplyStandard] = useState<boolean>(true); // 자동 출제기준 적용 체크박스

  // Supabase 이전
  const [supabaseConnected, setSupabaseConnected] = useState<boolean | null>(null);
  const [supabaseQuestionCount, setSupabaseQuestionCount] = useState<number>(0);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress>({
    total: 0,
    current: 0,
    status: 'idle',
    message: ''
  });
  const [isMigrating, setIsMigrating] = useState(false);
  const [supabaseUsageStats, setSupabaseUsageStats] = useState<SupabaseUsageStats | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);

  // 서버 기반 문제 수
  const [serverQuestionCounts, setServerQuestionCounts] = useState<{
    total: number;
    전기이론: number;
    전기기기: number;
    전기설비: number;
  } | null>(null);
  const [isLoadingServerCounts, setIsLoadingServerCounts] = useState(false);

  // 새 문제 폼
  const [newQuestion, setNewQuestion] = useState({
    category: '전기이론',
    standard: undefined as string | undefined,
    detailItem: undefined as string | undefined,
    question: '',
    option1: '',
    option2: '',
    option3: '',
    option4: '',
    answer: 1,
    explanation: '',
    imageUrl: '',
    hasImage: false,
    mustInclude: false,
    weight: undefined as number | undefined,
    source: undefined as string | undefined,
  });

  // 새 회원 폼
  const [newMember, setNewMember] = useState({
    name: '',
    phone: '',
    address: '',
    memo: '',
  });

  // UserAgent를 기기 타입으로 변환하는 함수
  const getDeviceType = (userAgent?: string): string => {
    if (!userAgent) return 'Unknown';

    const ua = userAgent.toLowerCase();

    // 태블릿 체크 (태블릿은 모바일보다 먼저 체크)
    if (ua.includes('ipad') ||
        (ua.includes('tablet') && !ua.includes('mobile')) ||
        (ua.includes('android') && !ua.includes('mobile'))) {
      return '태블릿';
    }

    // 스마트폰 체크
    if (ua.includes('mobile') ||
        ua.includes('iphone') ||
        ua.includes('ipod') ||
        (ua.includes('android') && ua.includes('mobile'))) {
      return '스마트폰';
    }

    // PC
    return 'PC';
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadQuestions();
      loadMembers();
      loadLoginHistory();
      loadFeedbacks();
      loadServerQuestionCounts(); // 서버에서 문제 수 로드
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (activeTab === 'feedbacks') {
      loadFeedbacks();
    }
  }, [activeTab, feedbackSubTab, loadFeedbacks]);

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
    } else {
      alert('비밀번호가 틀렸습니다.');
    }
  };

  const loadQuestions = () => {
    const allQuestions = getQuestions();
    // 최신 문제가 맨 위로 오도록 ID 내림차순 정렬
    const sortedQuestions = [...allQuestions].sort((a, b) => b.id - a.id);
    setQuestions(sortedQuestions);
  };

  // 서버에서 문제 수 로드
  const loadServerQuestionCounts = async () => {
    setIsLoadingServerCounts(true);
    try {
      const counts = await getCategoryCounts();
      setServerQuestionCounts(counts);
      console.log('📊 서버 문제 현황:', counts);
    } catch (error) {
      console.error('서버 문제 수 로드 실패:', error);
      setServerQuestionCounts(null);
    } finally {
      setIsLoadingServerCounts(false);
    }
  };

  const loadMembers = () => {
    const allMembers = getMembers();
    setMembers(allMembers);
  };

  const loadLoginHistory = async () => {
    setIsLoadingLoginHistory(true);
    try {
      // Supabase에서 로그인 기록 불러오기
      const supabaseHistory = await getLoginHistoryFromSupabase();
      // localStorage에서도 로그인 기록 불러오기
      const localHistory = getLoginHistory();

      // 두 데이터 소스를 병합 (중복 제거)
      const mergedHistory = [...supabaseHistory];
      const supabaseIds = new Set(supabaseHistory.map(h => h.id));

      // localStorage에만 있는 기록 추가 (Supabase 저장 실패한 모바일 기록 포함)
      for (const local of localHistory) {
        if (!supabaseIds.has(local.id)) {
          mergedHistory.push(local);
        }
      }

      // 시간순 정렬 (최신순)
      mergedHistory.sort((a, b) => b.timestamp - a.timestamp);

      setLoginHistory(mergedHistory);
      console.log(`✅ 로그인 기록 로드: Supabase ${supabaseHistory.length}개, localStorage ${localHistory.length}개, 병합 후 ${mergedHistory.length}개`);
    } catch (err) {
      console.error('로그인 기록 로드 실패:', err);
      // 에러 시 localStorage 폴백
      const localHistory = getLoginHistory();
      setLoginHistory(localHistory);
    } finally {
      setIsLoadingLoginHistory(false);
    }
  };

  const loadStudentRecords = async () => {
    setIsLoadingStudentRecords(true);
    try {
      const allUserData = await fetchAllUserDataFromSupabase();
      // 회원 정보와 매칭
      const recordsWithNames = allUserData.map(userData => {
        const member = members.find(m => m.id === userData.userId);
        return {
          ...userData,
          userName: member?.name || `회원 #${userData.userId}`
        };
      });
      setStudentRecords(recordsWithNames);
      console.log('✅ 학생 학습 기록 로드:', recordsWithNames.length, '명');
    } catch (err) {
      console.error('학생 학습 기록 로드 실패:', err);
    } finally {
      setIsLoadingStudentRecords(false);
    }
  };

  // loadFeedbacks는 useFeedbacks 훅에서 제공됨

  // 문제 현황 계산
  const questionStats = {
    전체: questions.length,
    전기이론: questions.filter(q => q.category === '전기이론').length,
    전기기기: questions.filter(q => q.category === '전기기기').length,
    전기설비: questions.filter(q => q.category === '전기설비').length,
    기타: questions.filter(q => !['전기이론', '전기기기', '전기설비'].includes(q.category)).length,
  };

  // 문제 필터링 및 정렬 (ID 내림차순 - 최신 문제가 위로)
  const filteredQuestions = (
    selectedCategory === '전체'
      ? questions
      : selectedCategory === '기타'
      ? questions.filter(q => !['전기이론', '전기기기', '전기설비'].includes(q.category))
      : questions.filter(q => q.category === selectedCategory)
  )
    .filter(q => {
      // 반드시 포함 문제만 보기 필터
      if (showMustIncludeOnly && !q.mustInclude) return false;

      // 반드시 불포함 문제만 보기 필터
      if (showMustExcludeOnly && !q.mustExclude) return false;

      // 가중치 필터
      if (weightFilter !== 'all') {
        const targetWeight = parseInt(weightFilter);
        const questionWeight = q.weight || 5;
        if (questionWeight !== targetWeight) return false;
      }

      // 검색어가 없으면 모든 문제 표시
      if (!searchQuery.trim()) return true;
      
      const query = searchQuery.toLowerCase().trim();
      
      // 문제 ID 검색
      if (q.id.toString().includes(query)) return true;
      
      // 문제 내용 검색 (질문, 선택지, 해설)
      const searchableText = [
        q.question || '',
        q.option1 || '',
        q.option2 || '',
        q.option3 || '',
        q.option4 || '',
        q.explanation || '',
        q.category || '',
      ].join(' ').toLowerCase();
      
      return searchableText.includes(query);
    })
    .sort((a, b) => b.id - a.id); // ID 내림차순 정렬

  // 페이지네이션
  const totalPages = Math.ceil(filteredQuestions.length / questionsPerPage);
  const startIndex = (currentPage - 1) * questionsPerPage;
  const endIndex = startIndex + questionsPerPage;
  const currentQuestions = filteredQuestions.slice(startIndex, endIndex);

  // 문제 추가
  const handleAddQuestion = () => {
    if (!newQuestion.question || !newQuestion.option1) {
      alert('필수 항목을 입력해주세요.');
      return;
    }
    
    // 출제기준이 없고 자동 적용이 체크되어 있으면 자동으로 적용
    let questionToAdd = { ...newQuestion };
    // 임시 미리보기 데이터 제거
    delete (questionToAdd as any)._imagePreview;
    delete (questionToAdd as any)._imageExtension;
    
    if (!questionToAdd.standard && autoApplyStandard) {
      // 키워드 기반 자동 매칭 시도
      let matchedStandard = matchStandardByKeywords(questionToAdd);
      
      // 키워드 매칭이 실패하면 랜덤하게 적용
      if (!matchedStandard) {
        const standards = getStandardsByCategory(questionToAdd.category);
        if (standards.length > 0) {
          matchedStandard = standards[Math.floor(Math.random() * standards.length)];
        }
      }
      
      if (matchedStandard) {
        questionToAdd.standard = matchedStandard;
        
        // 출제기준이 할당된 후 세부항목 자동 할당
        if (autoApplyStandard && !questionToAdd.detailItem) {
          const matchedDetailItem = matchDetailItemByKeywords(questionToAdd);
          if (matchedDetailItem) {
            questionToAdd.detailItem = matchedDetailItem;
          }
        }
      }
    } else if (questionToAdd.standard && !questionToAdd.detailItem && autoApplyStandard) {
      // 출제기준은 있지만 세부항목이 없는 경우 세부항목 자동 할당
      const matchedDetailItem = matchDetailItemByKeywords(questionToAdd);
      if (matchedDetailItem) {
        questionToAdd.detailItem = matchedDetailItem;
      }
    }

    addQuestion(questionToAdd);

    // Supabase에 동기화 (비동기)
    insertQuestions([questionToAdd]).then(result => {
      if (result.success > 0) {
        console.log('✅ Supabase에 문제 추가 성공');
      } else {
        console.warn('⚠️ Supabase에 문제 추가 실패:', result.errors);
      }
    }).catch(err => {
      console.warn('⚠️ Supabase 동기화 오류:', err);
    });

    loadQuestions();
    setShowAddModal(false);
    resetNewQuestion();
    alert('문제가 추가되었습니다.');
  };

  // 문제 수정
  const handleUpdateQuestion = async () => {
    if (!editingQuestion) return;

    // 출제기준이 없고 자동 적용이 체크되어 있으면 자동으로 적용
    let questionToUpdate = { ...editingQuestion };
    // 임시 미리보기 데이터 제거
    delete (questionToUpdate as any)._imagePreview;
    delete (questionToUpdate as any)._imageExtension;

    if (!questionToUpdate.standard && autoApplyStandard) {
      // 키워드 기반 자동 매칭 시도
      let matchedStandard = matchStandardByKeywords(questionToUpdate);

      // 키워드 매칭이 실패하면 랜덤하게 적용
      if (!matchedStandard) {
        const standards = getStandardsByCategory(questionToUpdate.category);
        if (standards.length > 0) {
          matchedStandard = standards[Math.floor(Math.random() * standards.length)];
        }
      }

      if (matchedStandard) {
        questionToUpdate.standard = matchedStandard;

        // 출제기준이 할당된 후 세부항목 자동 할당
        if (autoApplyStandard && !questionToUpdate.detailItem) {
          const matchedDetailItem = matchDetailItemByKeywords(questionToUpdate);
          if (matchedDetailItem) {
            questionToUpdate.detailItem = matchedDetailItem;
          }
        }
      }
    } else if (questionToUpdate.standard && !questionToUpdate.detailItem && autoApplyStandard) {
      // 출제기준은 있지만 세부항목이 없는 경우 세부항목 자동 할당
      const matchedDetailItem = matchDetailItemByKeywords(questionToUpdate);
      if (matchedDetailItem) {
        questionToUpdate.detailItem = matchedDetailItem;
      }
    }

    // 로컬 스토리지 업데이트
    updateQuestion(questionToUpdate);

    // Supabase 동기화 (비동기)
    const supabaseSuccess = await updateQuestionInSupabase(questionToUpdate);

    loadQuestions();
    setShowEditModal(false);
    setEditingQuestion(null);

    if (supabaseSuccess) {
      alert('문제가 수정되었습니다. (서버 동기화 완료)');
    } else {
      alert('문제가 로컬에 수정되었습니다. (서버 동기화 실패)');
    }
  };

  // 문제 삭제
  const handleDeleteQuestion = async (id: number) => {
    if (window.confirm('이 문제를 삭제하시겠습니까?')) {
      // 로컬 스토리지에서 삭제
      deleteQuestion(id);

      // Supabase에서도 삭제 (비동기)
      const supabaseSuccess = await deleteQuestionFromSupabase(id);

      loadQuestions();

      if (!supabaseSuccess) {
        console.warn('⚠️ Supabase에서 문제 삭제 실패');
      }
    }
  };

  // 선택 문제 일괄 삭제
  const handleDeleteSelected = async () => {
    if (selectedQuestions.size === 0) {
      alert('삭제할 문제를 선택해주세요.');
      return;
    }
    if (window.confirm(`선택한 ${selectedQuestions.size}개의 문제를 삭제하시겠습니까?`)) {
      // 로컬 삭제
      selectedQuestions.forEach(id => deleteQuestion(id));

      // Supabase 삭제 (비동기)
      const deletePromises = Array.from(selectedQuestions).map(id => deleteQuestionFromSupabase(id));
      await Promise.all(deletePromises);

      setSelectedQuestions(new Set());
      loadQuestions();
      alert('선택한 문제가 삭제되었습니다.');
    }
  };

  // 출제기준 랜덤 적용
  const handleRandomApplyStandard = () => {
    if (selectedQuestions.size === 0) {
      alert('선택한 문제가 없습니다.');
      return;
    }

    const selectedCount = selectedQuestions.size; // 미리 저장

    const updatedQuestions = questions.map(q => {
      if (selectedQuestions.has(q.id)) {
        // 카테고리별 출제기준 목록 가져오기
        const standards = getStandardsByCategory(q.category);
        if (standards.length > 0) {
          // 랜덤하게 출제기준 선택
          const randomStandard = standards[Math.floor(Math.random() * standards.length)];
          const updatedQuestion: any = { ...q, standard: randomStandard };
          // 세부항목 자동 할당 시도
          if (autoApplyStandard) {
            const matchedDetailItem = matchDetailItemByKeywords(updatedQuestion);
            if (matchedDetailItem) {
              updatedQuestion.detailItem = matchedDetailItem;
            }
          }
          return updatedQuestion;
        }
      }
      return q;
    });

    try {
      saveQuestions(updatedQuestions);
      loadQuestions();
      setSelectedQuestions(new Set());
      setShowStandardApplyModal(false);
      alert(`✅ ${selectedCount}개 문제에 출제기준이 랜덤하게 적용되었습니다.`);
    } catch (error) {
      console.error('❌ 출제기준 적용 실패:', error);
      alert('❌ 출제기준 적용에 실패했습니다. 다시 시도해주세요.');
    }
  };

  // 출제기준 직접 적용
  const handleManualApplyStandard = () => {
    if (selectedQuestions.size === 0) {
      alert('선택한 문제가 없습니다.');
      return;
    }

    if (!selectedStandard) {
      alert('출제기준을 선택해주세요.');
      return;
    }

    const selectedQuestionsList = questions.filter(q => selectedQuestions.has(q.id));
    
    // 선택한 문제들의 카테고리 확인
    const categories = new Set(selectedQuestionsList.map(q => q.category));
    
    // 여러 카테고리가 섞여있는 경우 확인
    if (categories.size > 1) {
      const allStandards = Array.from(categories).flatMap(cat => getStandardsByCategory(cat));
      if (!allStandards.includes(selectedStandard)) {
        alert('선택한 출제기준이 일부 문제의 카테고리와 일치하지 않습니다.');
        return;
      }
    } else {
      // 단일 카테고리
      const category = Array.from(categories)[0] || '전기이론';
      const standards = getStandardsByCategory(category);
      if (!standards.includes(selectedStandard)) {
        alert('선택한 출제기준이 문제의 카테고리와 일치하지 않습니다.');
        return;
      }
    }

    const updatedQuestions = questions.map(q => {
      if (selectedQuestions.has(q.id)) {
        // 카테고리 확인
        const qStandards = getStandardsByCategory(q.category);
        if (qStandards.includes(selectedStandard)) {
          const updatedQuestion: any = { ...q, standard: selectedStandard };
          // 세부항목도 선택되어 있으면 적용
          if (selectedDetailItem) {
            updatedQuestion.detailItem = selectedDetailItem;
          } else if (autoApplyStandard) {
            // 자동 적용 체크박스가 켜져 있으면 키워드 기반 자동 할당 시도
            const matchedDetailItem = matchDetailItemByKeywords(updatedQuestion);
            if (matchedDetailItem) {
              updatedQuestion.detailItem = matchedDetailItem;
            }
          }
          return updatedQuestion;
        }
      }
      return q;
    });

    const selectedCount = selectedQuestions.size; // 미리 저장
    const appliedStandard = selectedStandard; // 미리 저장

    try {
      saveQuestions(updatedQuestions);
      loadQuestions();
      setSelectedQuestions(new Set());
      setShowStandardApplyModal(false);
      setSelectedStandard('');
      setSelectedDetailItem('');
      const detailItemMsg = selectedDetailItem ? ` (세부항목: ${selectedDetailItem})` : '';
      alert(`✅ ${selectedCount}개 문제에 출제기준 "${appliedStandard} - ${getStandardTitle(appliedStandard)}"${detailItemMsg}이 적용되었습니다.`);
    } catch (error) {
      console.error('❌ 출제기준 적용 실패:', error);
      alert('❌ 출제기준 적용에 실패했습니다. 다시 시도해주세요.');
    }
  };

  // 미리보기
  const handlePreview = (question: Question) => {
    setPreviewQuestion(question);
    setShowPreviewModal(true);
  };

  // 미리보기에서 수정으로 이동
  const handleEditFromPreview = () => {
    if (previewQuestion) {
      setEditingQuestion(previewQuestion);
      setShowPreviewModal(false);
      setShowEditModal(true);
    }
  };

  // 체크박스 처리
  const handleCheckboxChange = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedQuestions);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedQuestions(newSelected);
  };

  // 선택된 문제의 가중치 일괄 변경
  const handleBulkWeightChange = async (newWeight: number) => {
    if (selectedQuestions.size === 0) {
      alert('가중치를 변경할 문제를 선택해주세요.');
      return;
    }

    const confirmMessage = `선택한 ${selectedQuestions.size}개 문제의 가중치를 ${newWeight}로 변경하시겠습니까?\n\n가중치 ${newWeight} = ${newWeight === 1 ? '최고 빈도' : newWeight === 10 ? '최저 빈도' : '중간 빈도'}`;
    if (!window.confirm(confirmMessage)) return;

    try {
      // 로컬 상태 업데이트
      const updatedQuestions = questions.map(q => {
        if (selectedQuestions.has(q.id)) {
          return { ...q, weight: newWeight };
        }
        return q;
      });

      const selectedCount = selectedQuestions.size;

      // Supabase에 업데이트
      const updatePromises = Array.from(selectedQuestions).map(async id => {
        const question = updatedQuestions.find(q => q.id === id);
        if (question) {
          return updateQuestionInSupabase(question);
        }
        return true;
      });

      const results = await Promise.all(updatePromises);
      const failedCount = results.filter(r => !r).length;

      if (failedCount > 0) {
        alert(`⚠️ ${failedCount}개 문제 업데이트 실패. 나머지 ${selectedCount - failedCount}개는 성공.`);
      } else {
        alert(`✅ ${selectedCount}개 문제의 가중치가 ${newWeight}로 변경되었습니다.`);
      }

      saveQuestions(updatedQuestions);
      loadQuestions();
      setSelectedQuestions(new Set());
    } catch (error) {
      console.error('❌ 가중치 변경 실패:', error);
      alert('❌ 가중치 변경에 실패했습니다.');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(currentQuestions.map(q => q.id));
      setSelectedQuestions(allIds);
    } else {
      setSelectedQuestions(new Set());
    }
  };

  // 회원 추가
  const handleAddMember = async () => {
    if (!newMember.name || !newMember.name.trim()) {
      alert('이름을 입력해주세요.');
      return;
    }
    try {
      // 로컬 스토리지에 추가
      const addedMember = addMember(newMember);

      // Supabase에도 동기화
      const supabaseSuccess = await saveMemberToSupabase({
        id: addedMember.id,
        name: addedMember.name,
        phone: addedMember.phone,
        email: addedMember.email,
        address: addedMember.address,
        registeredAt: addedMember.registeredAt
      });

      loadMembers();
      setShowAddMemberModal(false);
      resetNewMember();

      if (supabaseSuccess) {
        alert('회원이 추가되었습니다. (서버 동기화 완료)');
      } else {
        alert('회원이 로컬에 추가되었습니다. (서버 동기화 실패)');
      }
    } catch (error) {
      console.error('회원 추가 실패:', error);
      alert(error instanceof Error ? error.message : '회원 추가에 실패했습니다.');
    }
  };

  // 회원 수정
  const handleUpdateMember = async () => {
    if (!editingMember) return;

    // 로컬 스토리지 업데이트
    updateMember(editingMember);

    // Supabase 업데이트 (비동기)
    const supabaseSuccess = await updateMemberInSupabase({
      id: editingMember.id,
      name: editingMember.name,
      phone: editingMember.phone,
      email: editingMember.email,
      address: editingMember.address,
      memo: editingMember.memo
    });

    loadMembers();
    setShowEditMemberModal(false);
    setEditingMember(null);

    if (supabaseSuccess) {
      alert('회원 정보가 수정되었습니다. (서버 동기화 완료)');
    } else {
      alert('회원 정보가 로컬에 수정되었습니다. (서버 동기화 실패 - 나중에 다시 시도해주세요)');
    }
  };

  // 회원 삭제
  const handleDeleteMember = async (id: number) => {
    if (window.confirm('이 회원을 삭제하시겠습니까?')) {
      // 로컬 스토리지에서 삭제
      deleteMember(id);

      // Supabase에서도 삭제 (비동기)
      const supabaseSuccess = await deleteMemberFromSupabase(id);

      loadMembers();

      if (!supabaseSuccess) {
        console.warn('⚠️ Supabase에서 회원 삭제 실패');
      }
    }
  };

  // 데이터 내보내기
  const handleExportData = () => {
    const jsonData = exportData();
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `electrical-cbt-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert('데이터가 내보내기되었습니다.');
  };

  // 데이터 가져오기
  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event: any) => {
          try {
            importData(event.target.result);
            loadQuestions();
            loadMembers();
            alert('데이터가 가져오기되었습니다.');
          } catch (error) {
            alert('데이터 가져오기 실패: ' + error);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  // 시트 선택 상태
  const [selectedSheets, setSelectedSheets] = useState<string[]>(['questions', '전기이론', '전기기기', '전기설비', '기타']);
  
  // 시트 선택 토글
  const toggleSheetSelection = (sheetName: string) => {
    setSelectedSheets(prev => 
      prev.includes(sheetName) 
        ? prev.filter(s => s !== sheetName)
        : [...prev, sheetName]
    );
  };
  
  // 전체 선택/해제
  const toggleAllSheets = (checked: boolean) => {
    setSelectedSheets(checked ? ['questions', '전기이론', '전기기기', '전기설비', '기타'] : []);
  };

  // 모든 문제에 출제기준 일괄 적용
  const handleApplyStandardsToAll = () => {
    if (!window.confirm('모든 문제에 출제기준과 세부항목을 일괄 적용하시겠습니까?\n\n이미 출제기준이 있는 문제는 건너뜁니다.')) {
      return;
    }

    const allQuestions = getQuestions();
    let appliedStandardCount = 0;
    let appliedDetailItemCount = 0;

    const updatedQuestions = allQuestions.map(q => {
      let updated = { ...q };

      // 1. 출제기준이 없으면 자동 적용
      if (!updated.standard) {
        // 키워드 기반 자동 매칭 시도
        let matchedStandard = matchStandardByKeywords(updated);

        // 키워드 매칭이 실패하면 랜덤하게 적용
        if (!matchedStandard) {
          const standards = getStandardsByCategory(updated.category);
          if (standards.length > 0) {
            matchedStandard = standards[Math.floor(Math.random() * standards.length)];
          }
        }

        if (matchedStandard) {
          updated.standard = matchedStandard;
          appliedStandardCount++;
        }
      }

      // 2. 출제기준은 있지만 세부항목이 없으면 자동 적용
      if (updated.standard && !updated.detailItem) {
        const matchedDetailItem = matchDetailItemByKeywords(updated);
        if (matchedDetailItem) {
          updated.detailItem = matchedDetailItem;
          appliedDetailItemCount++;
        }
      }

      return updated;
    });

    saveQuestions(updatedQuestions);
    loadQuestions();

    alert(
      `✅ 출제기준 일괄 적용 완료!\n\n` +
      `📌 출제기준 적용: ${appliedStandardCount}개\n` +
      `📌 세부항목 적용: ${appliedDetailItemCount}개\n` +
      `📊 전체 문제 수: ${updatedQuestions.length}개`
    );
  };

  // Google Sheets → LocalStorage 동기화
  const handleSyncFromSheets = async () => {
    if (selectedSheets.length === 0) {
      alert('⚠️ 가져올 시트를 최소 1개 이상 선택해주세요.');
      return;
    }

    // 동기화 모드 선택
    const syncMode = window.confirm(
      '📥 Google Sheets 동기화 모드를 선택하세요:\n\n' +
      '확인(OK): 병합 모드 - 시트 데이터로 업데이트하되 로컬 전용 문제는 유지\n' +
      '취소(Cancel): 교체 모드 - 시트 데이터로 완전히 교체 (기존 데이터는 백업됨)\n\n' +
      '⚠️ 권장: 병합 모드를 사용하세요.'
    );

    setSyncLoading(true);
    setSyncMessage(`${selectedSheets.length}개 시트에서 데이터를 가져오는 중... (${syncMode ? '병합' : '교체'} 모드)`);

    try {
      const sheetsQuestions = await getAllQuestionsFromSheets(selectedSheets);

      if (sheetsQuestions.length === 0) {
        setSyncMessage('⚠️ Google Sheets에 문제가 없습니다.');
        setSyncLoading(false);
        return;
      }

      // Google Sheets에서 가져온 데이터의 ID 중복 방지 및 정규화
      const existingQuestions = getQuestions();
      const existingIds = new Set(existingQuestions.map(q => q.id));
      
      // 사용 가능한 ID 찾기 함수
      const findAvailableId = (preferredId?: number): number => {
        // 선호하는 ID가 있고 사용 가능하면 사용
        if (preferredId && !existingIds.has(preferredId)) {
          return preferredId;
        }
        
        // 1000-1999 범위에서 사용 가능한 ID 찾기
        let id = preferredId && preferredId >= 1000 && preferredId <= 1999 ? preferredId : 1000;
        while (id <= 1999 && existingIds.has(id)) {
          id++;
        }
        
        if (id > 1999) {
          // 1000-1999 범위가 모두 사용 중이면 가장 큰 ID + 1 사용
          const maxId = existingQuestions.length > 0 
            ? Math.max(...existingQuestions.map(q => q.id))
            : 999;
          id = maxId + 1;
          // 새로 할당한 ID도 중복 체크
          while (existingIds.has(id)) {
            id++;
          }
        }
        return id;
      };
      
      const processedQuestions = sheetsQuestions.map((q: any) => {
        const originalId = q.id;
        
        // ID가 없거나 중복이면 새 ID 할당
        if (!originalId || existingIds.has(originalId)) {
          const newId = findAvailableId(originalId);
          existingIds.add(newId); // 사용 중인 ID 목록에 추가
          if (originalId && originalId !== newId) {
            console.log(`ID 조정: ${originalId} → ${newId} (중복 또는 범위 초과)`);
          } else if (!originalId) {
            console.log(`ID 생성: 없음 → ${newId}`);
          }
          return { ...q, id: newId };
        }
        
        // 기존 ID가 유효하면 그대로 사용 (원본 유지)
        existingIds.add(originalId); // 사용 중인 ID 목록에 추가
        return q;
      });

      // 출제기준이 없는 문제에 자동으로 출제기준 적용 (동기화 시 항상 적용)
      let appliedCount = 0;
      const questionsWithStandards = processedQuestions.map(q => {
        if (!q.standard) {
          // 키워드 기반 자동 매칭 시도
          let matchedStandard = matchStandardByKeywords(q);
          
          // 키워드 매칭이 실패하면 랜덤하게 적용
          if (!matchedStandard) {
            const standards = getStandardsByCategory(q.category);
            if (standards.length > 0) {
              matchedStandard = standards[Math.floor(Math.random() * standards.length)];
            }
          }
          
          if (matchedStandard) {
            appliedCount++;
            const questionWithStandard = { ...q, standard: matchedStandard };
            
            // 출제기준이 할당된 후 세부항목 자동 할당
            if (!questionWithStandard.detailItem) {
              const matchedDetailItem = matchDetailItemByKeywords(questionWithStandard);
              if (matchedDetailItem) {
                questionWithStandard.detailItem = matchedDetailItem;
              }
            }
            
            return questionWithStandard;
          }
        } else if (q.standard && !q.detailItem) {
          // 출제기준은 있지만 세부항목이 없는 경우 세부항목 자동 할당
          const matchedDetailItem = matchDetailItemByKeywords(q);
          if (matchedDetailItem) {
            return { ...q, detailItem: matchedDetailItem };
          }
        }
        return q;
      });

      // 기존 데이터 백업 (안전장치)
      const existingQuestionsForBackup = getQuestions();
      const backupKey = 'questions_backup_before_sync_' + Date.now();
      try {
        if (existingQuestionsForBackup.length > 0) {
          localStorage.setItem(backupKey, JSON.stringify(existingQuestionsForBackup));
          console.log(`⚠️ 동기화 전 기존 데이터를 ${backupKey}에 백업했습니다.`);
        }
      } catch (e) {
        console.warn('백업 생성 실패 (계속 진행):', e);
      }

      // LocalStorage에 저장
      try {
        let finalQuestions: Question[];

        if (syncMode) {
          // 병합 모드: 시트 데이터로 업데이트하되 로컬 전용 문제는 유지
          const sheetsIdSet = new Set(questionsWithStandards.map((q: Question) => q.id));
          const localOnlyQuestions = existingQuestions.filter(q => !sheetsIdSet.has(q.id));

          finalQuestions = [...questionsWithStandards, ...localOnlyQuestions];

          console.log(`📊 병합 결과:`);
          console.log(`  - 시트에서 가져온 문제: ${questionsWithStandards.length}개`);
          console.log(`  - 로컬 전용 문제 유지: ${localOnlyQuestions.length}개`);
          console.log(`  - 최종 문제 수: ${finalQuestions.length}개`);
        } else {
          // 교체 모드: 시트 데이터로 완전히 교체
          finalQuestions = questionsWithStandards;
          console.log(`📊 교체 모드: ${finalQuestions.length}개 문제로 완전 교체`);
        }

        saveQuestions(finalQuestions);
        loadQuestions();

        setSyncMessage(
          `✅ Google Sheets에서 ${processedQuestions.length}개 문제를 가져왔습니다.\n` +
          (syncMode ? `📌 로컬 전용 문제 ${existingQuestions.length - questionsWithStandards.length}개 유지됨\n` : '') +
          `📊 최종 문제 수: ${finalQuestions.length}개\n` +
          (appliedCount > 0 ? `📌 출제기준이 없는 ${appliedCount}개 문제에 출제기준을 자동으로 적용했습니다.` : '')
        );
      } catch (error) {
        console.error('❌ 저장 실패:', error);
        // 백업 데이터 복원 시도
        try {
          const backupData = localStorage.getItem(backupKey);
          if (backupData) {
            const backupQuestions = JSON.parse(backupData);
            saveQuestions(backupQuestions);
            console.log('⚠️ 백업 데이터로 복원했습니다.');
          }
        } catch (e) {
          console.error('복원 실패:', e);
        }
        throw error; // 상위 catch로 전달
      }
    } catch (error) {
      console.error('동기화 오류:', error);
      setSyncMessage(`❌ 동기화 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setSyncLoading(false);
    }
  };

  // LocalStorage → Google Sheets 동기화
  const handleSyncToSheets = async () => {
    if (selectedSheets.length === 0) {
      alert('⚠️ 업로드할 시트를 최소 1개 이상 선택해주세요.');
      return;
    }
    
    const confirmed = window.confirm(
      `⚠️ LocalStorage의 문제를 ${selectedSheets.length}개 시트로 업로드합니다.\n\n` +
      `선택된 시트: ${selectedSheets.join(', ')}\n\n` +
      '주의: 이 작업은 Google Sheets의 기존 데이터 위에 추가합니다.\n' +
      '중복 데이터가 생길 수 있으니, 필요시 Google Sheets를 먼저 정리하세요.\n\n' +
      '계속하시겠습니까?'
    );
    
    if (!confirmed) {
      return;
    }
    
    setSyncLoading(true);
    setSyncMessage(`${selectedSheets.length}개 시트로 데이터를 업로드하는 중...`);

    try {
      const localQuestions = getQuestions();

      if (localQuestions.length === 0) {
        setSyncMessage('⚠️ LocalStorage에 문제가 없습니다.');
        setSyncLoading(false);
        return;
      }

      const success = await bulkAddQuestionsToSheets(localQuestions, selectedSheets);

      if (success) {
        setSyncMessage(`✅ LocalStorage에서 ${localQuestions.length}개 문제를 Google Sheets로 업로드했습니다.`);
      } else {
        setSyncMessage('❌ 업로드 실패: Google Sheets API를 확인하세요.');
      }
    } catch (error) {
      console.error('동기화 오류:', error);
      setSyncMessage(`❌ 동기화 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setSyncLoading(false);
    }
  };

  const resetNewQuestion = () => {
    setNewQuestion({
      category: '전기이론',
      standard: undefined,
      detailItem: undefined,
      question: '',
      option1: '',
      option2: '',
      option3: '',
      option4: '',
      answer: 1,
      explanation: '',
      imageUrl: '',
      hasImage: false,
      mustInclude: false,
      weight: undefined,
      source: undefined,
    });
  };

  const resetNewMember = () => {
    setNewMember({
      name: '',
      phone: '',
      address: '',
      memo: '',
    });
  };

  // 출제 설정 저장
  const handleSaveExamConfig = () => {
    try {
      saveExamConfig(examConfig);
      alert('✅ 출제 설정이 저장되었습니다.');
    } catch (error) {
      console.error('출제 설정 저장 실패:', error);
      alert('❌ 출제 설정 저장에 실패했습니다.');
    }
  };

  // 출제 설정 초기화
  const handleResetExamConfig = () => {
    if (window.confirm('출제 설정을 초기화하시겠습니까?')) {
      resetExamConfig();
      setExamConfig(getExamConfig());
      alert('✅ 출제 설정이 초기화되었습니다.');
    }
  };

  // 가중치 선택/해제
  const toggleWeight = (weight: number) => {
    setExamConfig(prev => {
      const newWeights = prev.selectedWeights.includes(weight)
        ? prev.selectedWeights.filter(w => w !== weight)
        : [...prev.selectedWeights, weight].sort((a, b) => a - b);
      return { ...prev, selectedWeights: newWeights };
    });
  };

  // 가중치 비율 업데이트
  const updateWeightRatio = (weight: number, ratio: number) => {
    setExamConfig(prev => ({
      ...prev,
      weightRatios: {
        ...prev.weightRatios,
        [weight]: Math.max(0, Math.min(100, ratio)) // 0-100 범위 제한
      }
    }));
  };

  // 백업 생성 (파일 다운로드)
  const handleCreateBackup = () => {
    const name = prompt('백업 이름을 입력하세요 (선택사항):\n\n비워두면 자동으로 날짜/시간으로 생성됩니다.');
    try {
      downloadBackup(name || undefined);
      alert('✅ 백업 파일이 다운로드되었습니다.\n\n💡 다운로드한 파일을 D:\\cbtback 폴더에 저장하세요.');
    } catch (error) {
      console.error('백업 생성 실패:', error);
      const errorMessage = error instanceof Error ? error.message : '백업 생성에 실패했습니다.';
      alert(`❌ ${errorMessage}`);
    }
  };

  // 백업 파일 업로드 및 복원
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.confirm(`"${file.name}" 파일로 복원하시겠습니까?\n\n현재 데이터는 자동으로 백업됩니다.`)) {
      event.target.value = ''; // 파일 선택 초기화
      return;
    }

    restoreFromFile(file)
      .then(() => {
        loadQuestions();
        loadMembers();
        alert('✅ 백업에서 복원되었습니다.\n페이지를 새로고침합니다.');
        window.location.reload();
      })
      .catch((error) => {
        console.error('복원 실패:', error);
        alert(`❌ ${error.message || '복원에 실패했습니다.'}`);
        event.target.value = ''; // 파일 선택 초기화
      });
  };

  // 모든 데이터 삭제
  const handleDeleteAllData = async () => {
    const confirmation = window.prompt(
      '⚠️ 모든 데이터를 삭제합니다.\n\n삭제 전 자동으로 백업 파일이 다운로드됩니다.\n계속하려면 "삭제"를 입력하세요:'
    );

    if (confirmation === '삭제') {
      try {
        // 1. 데이터 삭제
        deleteAllData();

        // 2. 브라우저 캐시 삭제 (모바일/PC 모두 지원)
        await clearAllCaches();

        // 3. 서버에서 최신 데이터 로드
        console.log('📥 서버에서 최신 문제 데이터 가져오는 중...');
        const sheetsQuestions = await getAllQuestionsFromSheets();

        if (sheetsQuestions && sheetsQuestions.length > 0) {
          saveQuestions(sheetsQuestions);
          console.log(`✅ 서버에서 ${sheetsQuestions.length}개 문제 로드 완료`);
        } else {
          console.warn('⚠️ 서버에 문제 데이터가 없습니다.');
        }

        loadQuestions();
        loadMembers();
        alert(`✅ 모든 데이터와 브라우저 캐시가 삭제되었습니다.\n서버에서 ${sheetsQuestions?.length || 0}개 문제를 로드했습니다.\n백업 파일을 업로드하여 복원할 수 있습니다.`);
        window.location.reload();
      } catch (error) {
        console.error('데이터 삭제 실패:', error);
        alert('❌ 데이터 삭제에 실패했습니다.');
      }
    } else if (confirmation !== null) {
      alert('❌ 취소되었습니다. "삭제"를 정확히 입력해야 합니다.');
    }
  };

  // 로그인 기록 삭제 (단일)
  const handleDeleteLoginRecord = (id: number) => {
    if (window.confirm('이 로그인 기록을 삭제하시겠습니까?')) {
      try {
        deleteLoginHistory(id);
        loadLoginHistory();
        alert('✅ 로그인 기록이 삭제되었습니다.');
      } catch (error) {
        console.error('로그인 기록 삭제 실패:', error);
        alert('❌ 로그인 기록 삭제에 실패했습니다.');
      }
    }
  };

  // 모든 로그인 기록 삭제
  const handleClearLoginHistory = () => {
    if (window.confirm('⚠️ 모든 로그인 기록을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
      try {
        clearLoginHistory();
        loadLoginHistory();
        alert('✅ 모든 로그인 기록이 삭제되었습니다.');
      } catch (error) {
        console.error('로그인 기록 삭제 실패:', error);
        alert('❌ 로그인 기록 삭제에 실패했습니다.');
      }
    }
  };

  // Supabase 연결 테스트
  const checkSupabaseConnection = async () => {
    const connected = await testSupabaseConnection();
    setSupabaseConnected(connected);
    if (connected) {
      const count = await getSupabaseQuestionCount();
      setSupabaseQuestionCount(count);
    }
  };

  // Supabase로 데이터 이전
  const handleMigrateToSupabase = async () => {
    if (!supabaseConnected) {
      alert('❌ Supabase 연결을 먼저 확인해주세요.');
      return;
    }

    const localCount = questions.length;
    if (localCount === 0) {
      alert('❌ 이전할 문제가 없습니다.');
      return;
    }

    const confirmMessage = supabaseQuestionCount > 0
      ? `⚠️ Supabase에 이미 ${supabaseQuestionCount}개의 문제가 있습니다.\n\n로컬의 ${localCount}개 문제로 덮어쓰시겠습니까?\n\n(동일 ID의 문제는 업데이트됩니다)`
      : `로컬의 ${localCount}개 문제를 Supabase로 이전하시겠습니까?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsMigrating(true);
    setMigrationProgress({
      total: localCount,
      current: 0,
      status: 'running',
      message: '이전 준비 중...'
    });

    const result = await migrateQuestionsToSupabase(setMigrationProgress);

    setIsMigrating(false);

    if (result.success) {
      const newCount = await getSupabaseQuestionCount();
      setSupabaseQuestionCount(newCount);
      alert(`✅ ${result.totalMigrated}개의 문제를 성공적으로 이전했습니다!`);
    } else {
      alert(`⚠️ 이전 완료: ${result.totalMigrated}개 성공\n오류: ${result.errors.join('\n')}`);
    }
  };

  // Supabase 사용량 조회
  const loadSupabaseUsage = async () => {
    if (!supabaseConnected) {
      alert('❌ Supabase 연결을 먼저 확인해주세요.');
      return;
    }

    setIsLoadingUsage(true);
    const stats = await getSupabaseUsageStats();
    setSupabaseUsageStats(stats);
    setIsLoadingUsage(false);
  };

  // 로그인 화면
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
            🔧 관리자 페이지
          </h1>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleLogin()}
            placeholder="비밀번호 입력"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
          />
          <button
            onClick={handleLogin}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            로그인
          </button>
          <p className="text-sm text-gray-500 mt-4 text-center">
            기본 비밀번호: admin2024
          </p>
          <button
            onClick={() => (window.location.href = '/')}
            className="w-full mt-4 text-gray-600 hover:text-gray-800 text-sm"
          >
            ← 홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 관리자 화면
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-800">🔧 관리자 페이지</h1>
            <div className="flex gap-2">
              <button
                onClick={handleExportData}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
              >
                📥 내보내기
              </button>
              <button
                onClick={handleImportData}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                📤 가져오기
              </button>
              <button
                onClick={() => (window.location.href = '/')}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                ← 홈으로
              </button>
            </div>
          </div>
        </div>

        {/* 탭 */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('questions')}
              className={`flex-1 py-4 px-6 font-semibold transition-colors ${
                activeTab === 'questions'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              📚 문제 관리 ({questions.length})
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`flex-1 py-4 px-6 font-semibold transition-colors ${
                activeTab === 'members'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              👥 회원 관리 ({members.length})
            </button>
            <button
              onClick={() => setActiveTab('sync')}
              className={`flex-1 py-4 px-6 font-semibold transition-colors ${
                activeTab === 'sync'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              🔄 동기화
            </button>
            <button
              onClick={() => setActiveTab('statistics')}
              className={`flex-1 py-4 px-6 font-semibold transition-colors ${
                activeTab === 'statistics'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              📋 출제기준별 현황
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`flex-1 py-4 px-6 font-semibold transition-colors ${
                activeTab === 'config'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              ⚙️ 출제 설정
            </button>
            <button
              onClick={() => setActiveTab('login-history')}
              className={`flex-1 py-4 px-6 font-semibold transition-colors ${
                activeTab === 'login-history'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              📜 로그인 기록 ({loginHistory.length})
            </button>
            <button
              onClick={() => setActiveTab('feedbacks')}
              className={`flex-1 py-4 px-6 font-semibold transition-colors ${
                activeTab === 'feedbacks'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              📋 제보 게시판 ({allFeedbacksCount.bug + allFeedbacksCount.suggestion + allFeedbacksCount.question})
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex-1 py-4 px-6 font-semibold transition-colors ${
                activeTab === 'upload'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              📤 문제 업로드
            </button>
            <button
              onClick={() => {
                setActiveTab('student-records');
                if (studentRecords.length === 0) {
                  loadStudentRecords();
                }
              }}
              className={`flex-1 py-4 px-6 font-semibold transition-colors ${
                activeTab === 'student-records'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              📊 학생 학습 기록 ({studentRecords.length})
            </button>
          </div>
        </div>

        {/* 문제 관리 탭 */}
        {activeTab === 'questions' && (
          <div>
            {/* 문제 현황 */}
            <div className="bg-white rounded-lg shadow-md p-4 mb-6">
              <h2 className="text-lg font-bold text-gray-800 mb-3">
                📊 문제 현황
                {isLoadingServerCounts && <span className="text-sm text-gray-500 ml-2">(로딩 중...)</span>}
                <button
                  onClick={loadServerQuestionCounts}
                  className="ml-2 text-sm text-blue-500 hover:text-blue-700"
                  disabled={isLoadingServerCounts}
                >
                  🔄 새로고침
                </button>
              </h2>
              <div className="grid grid-cols-5 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {serverQuestionCounts?.total ?? questionStats.전체}
                  </div>
                  <div className="text-sm text-gray-600">전체 문제</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {serverQuestionCounts?.전기이론 ?? questionStats.전기이론}
                  </div>
                  <div className="text-sm text-gray-600">전기이론</div>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {serverQuestionCounts?.전기기기 ?? questionStats.전기기기}
                  </div>
                  <div className="text-sm text-gray-600">전기기기</div>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {serverQuestionCounts?.전기설비 ?? questionStats.전기설비}
                  </div>
                  <div className="text-sm text-gray-600">전기설비</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-600">{questionStats.기타}</div>
                  <div className="text-sm text-gray-600">기타</div>
                </div>
              </div>
            </div>

            {/* 카테고리 필터 및 액션 버튼 */}
            <div className="bg-white rounded-lg shadow-md p-4 mb-6">
              {/* 검색 바 */}
              <div className="mb-4">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1); // 검색 시 첫 페이지로 리셋
                    }}
                    placeholder="🔍 문제 검색 (ID, 질문, 선택지, 해설, 카테고리)"
                    className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setCurrentPage(1);
                      }}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {searchQuery && (
                  <div className="mt-2 text-sm text-gray-600">
                    검색 결과: {filteredQuestions.length}개 문제
                  </div>
                )}
              </div>

              <div className="mb-4">
                {/* 카테고리 필터 버튼 */}
                <div className="flex gap-2 mb-3">
                  {['전체', '전기이론', '전기기기', '전기설비', '기타'].map(cat => (
                    <button
                      key={cat}
                      onClick={() => {
                        setSelectedCategory(cat);
                        setCurrentPage(1);
                      }}
                      className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                        selectedCategory === cat
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                
                {/* 하단 버튼들 */}
                <div className="flex gap-2 flex-wrap">
                  <label className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border-2 border-yellow-400 rounded-lg cursor-pointer hover:bg-yellow-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={showMustIncludeOnly}
                      onChange={e => {
                        setShowMustIncludeOnly(e.target.checked);
                        setCurrentPage(1);
                      }}
                      className="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                    />
                    <span className="text-sm font-semibold text-yellow-800">⭐ 반드시 포함 문제만</span>
                  </label>
                  <label className="flex items-center gap-2 px-4 py-2 bg-red-50 border-2 border-red-400 rounded-lg cursor-pointer hover:bg-red-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={showMustExcludeOnly}
                      onChange={e => {
                        setShowMustExcludeOnly(e.target.checked);
                        setCurrentPage(1);
                      }}
                      className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                    />
                    <span className="text-sm font-semibold text-red-800">🚫 반드시 불포함 문제만</span>
                  </label>

                  {/* 가중치 필터 */}
                  <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-2 border-blue-400 rounded-lg">
                    <span className="text-sm font-semibold text-blue-800">⚖️ 가중치:</span>
                    <select
                      value={weightFilter}
                      onChange={e => {
                        setWeightFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="px-2 py-1 border border-blue-300 rounded bg-white text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">전체</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(w => (
                        <option key={w} value={w.toString()}>
                          {w} - {w === 1 ? '최고 빈도' : w === 10 ? '최저 빈도' : `레벨 ${w}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 가중치 일괄 변경 */}
                  {selectedQuestions.size > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 border-2 border-orange-400 rounded-lg">
                      <span className="text-sm font-semibold text-orange-800">⚖️ 일괄 변경:</span>
                      <select
                        onChange={e => {
                          if (e.target.value) {
                            handleBulkWeightChange(parseInt(e.target.value));
                            e.target.value = '';
                          }
                        }}
                        className="px-2 py-1 border border-orange-300 rounded bg-white text-sm focus:ring-2 focus:ring-orange-500"
                        defaultValue=""
                      >
                        <option value="" disabled>가중치 선택</option>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(w => (
                          <option key={w} value={w}>
                            {w} - {w === 1 ? '최고 빈도' : w === 10 ? '최저 빈도' : `레벨 ${w}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button
                    onClick={() => setViewMode(viewMode === 'card' ? 'table' : 'card')}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                  >
                    {viewMode === 'card' ? '📋 테이블 형식' : '📇 카드 형식'}
                  </button>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    ➕ 문제 추가
                  </button>
                  <button
                    onClick={() => {
                      if (selectedQuestions.size === 0) {
                        alert('선택한 문제가 없습니다.');
                        return;
                      }
                      setShowStandardApplyModal(true);
                      setStandardApplyMode('random');
                    }}
                    disabled={selectedQuestions.size === 0}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                  >
                    🎲 출제기준 적용 ({selectedQuestions.size})
                  </button>
                  <button
                    onClick={handleApplyStandardsToAll}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                  >
                    📚 모든 문제에 출제기준 일괄 적용
                  </button>
                  <button
                    onClick={handleDeleteSelected}
                    disabled={selectedQuestions.size === 0}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                  >
                    🗑️ 선택 삭제 ({selectedQuestions.size})
                  </button>
                </div>
              </div>
            </div>

            {/* 문제 목록 */}
            <div className="bg-white rounded-lg shadow-md p-4">
              {/* 상단 페이지네이션 - sticky로 고정 */}
              <div className="sticky top-0 bg-white z-10 py-2 mb-4 border-b border-gray-200 flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  총 {filteredQuestions.length}문제 | 페이지 {currentPage} / {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const newPage = Math.max(1, currentPage - 1);
                      setCurrentPage(newPage);
                      setTimeout(() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }, 100);
                    }}
                    disabled={currentPage === 1}
                    className="px-3 py-1 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white rounded transition-colors"
                  >
                    ← 이전
                  </button>
                  <button
                    onClick={() => {
                      const newPage = Math.min(totalPages, currentPage + 1);
                      setCurrentPage(newPage);
                      setTimeout(() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }, 100);
                    }}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white rounded transition-colors"
                  >
                    다음 →
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      currentQuestions.length > 0 &&
                      currentQuestions.every(q => selectedQuestions.has(q.id))
                    }
                    onChange={e => handleSelectAll(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="font-semibold text-gray-700">전체 선택</span>
                </label>
              </div>

              {/* 카드 형식 */}
              {viewMode === 'card' && (
                <div className="space-y-2">
                  {currentQuestions.map((q, index) => (
                    <div
                      key={`question-${q.id}-${index}-${startIndex}`}
                      onClick={() => handlePreview(q)}
                      className="border-2 rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedQuestions.has(q.id)}
                          onChange={e => {
                            e.stopPropagation();
                            handleCheckboxChange(q.id, e.target.checked);
                          }}
                          onClick={e => e.stopPropagation()}
                          className="mt-1 w-4 h-4"
                        />
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-gray-700">ID: {q.id}</span>
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={q.mustInclude || false}
                                  onChange={e => {
                                    e.stopPropagation();
                                    const updatedQuestion = { ...q, mustInclude: e.target.checked };
                                    updateQuestion(updatedQuestion);
                                    // Supabase 동기화 (비동기)
                                    updateQuestionInSupabase(updatedQuestion).catch(err => {
                                      console.warn('⚠️ Supabase 동기화 오류:', err);
                                    });
                                    loadQuestions();
                                  }}
                                  onClick={e => e.stopPropagation()}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                  title="반드시 포함 문제"
                                />
                                <span className="text-xs text-gray-600">반드시포함</span>
                              </label>
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={q.mustExclude || false}
                                  onChange={e => {
                                    e.stopPropagation();
                                    const updatedQuestion = { ...q, mustExclude: e.target.checked };
                                    updateQuestion(updatedQuestion);
                                    // Supabase 동기화 (비동기)
                                    updateQuestionInSupabase(updatedQuestion).catch(err => {
                                      console.warn('⚠️ Supabase 동기화 오류:', err);
                                    });
                                    loadQuestions();
                                  }}
                                  onClick={e => e.stopPropagation()}
                                  className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                  title="반드시 불포함 문제"
                                />
                                <span className="text-xs text-red-600">반드시불포함</span>
                              </label>
                              <div className="flex gap-1">
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    handlePreview(q);
                                  }}
                                  className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs transition-colors"
                                  title="미리보기"
                                >
                                  👁️
                                </button>
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    setEditingQuestion(q);
                                    setShowEditModal(true);
                                  }}
                                  className="px-2 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded text-xs transition-colors"
                                  title="수정"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    handleDeleteQuestion(q.id);
                                  }}
                                  className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs transition-colors"
                                  title="삭제"
                                >
                                  🗑️
                                </button>
                              </div>
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                                {q.category}
                              </span>
                              {q.standard && (
                                <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm">
                                  {q.standard} - {getStandardTitle(q.standard)}
                                </span>
                              )}
                              {q.detailItem && (
                                <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-sm">
                                  {q.detailItem}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-gray-600 text-sm">
                            {q.question.slice(0, 100)}...
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            정답: {q.answer}번
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 테이블 형식 */}
              {viewMode === 'table' && (
                <div className="overflow-x-auto overflow-y-visible" style={{ maxWidth: '100%' }}>
                  <table className="w-max min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '60px' }}>선택</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '80px' }}>ID</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '100px' }}>반드시포함</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '100px' }}>반드시불포함</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '120px' }}>작업</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '100px' }}>카테고리</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '200px' }}>출제기준</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '200px' }}>세부항목</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '300px' }}>문제</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '200px' }}>선택지 1</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '200px' }}>선택지 2</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '200px' }}>선택지 3</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '200px' }}>선택지 4</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '80px' }}>정답</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '300px' }}>해설</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '200px' }}>이미지URL</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '80px' }}>가중치</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '150px' }}>출처</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {currentQuestions.map((q, index) => (
                        <tr
                          key={`question-table-${q.id}-${index}-${startIndex}`}
                          className="hover:bg-gray-50"
                        >
                          <td className="px-3 py-2 whitespace-nowrap" style={{ minWidth: '60px' }}>
                            <input
                              type="checkbox"
                              checked={selectedQuestions.has(q.id)}
                              onChange={e => handleCheckboxChange(q.id, e.target.checked)}
                              className="w-4 h-4"
                            />
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900" style={{ minWidth: '80px' }}>{q.id}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-center" style={{ minWidth: '100px' }}>
                            <input
                              type="checkbox"
                              checked={q.mustInclude || false}
                              onChange={e => {
                                const updatedQuestion = { ...q, mustInclude: e.target.checked };
                                updateQuestion(updatedQuestion);
                                // Supabase 동기화 (비동기)
                                updateQuestionInSupabase(updatedQuestion).catch(err => {
                                  console.warn('⚠️ Supabase 동기화 오류:', err);
                                });
                                loadQuestions();
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              title="반드시 포함 문제"
                            />
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-center" style={{ minWidth: '100px' }}>
                            <input
                              type="checkbox"
                              checked={q.mustExclude || false}
                              onChange={e => {
                                const updatedQuestion = { ...q, mustExclude: e.target.checked };
                                updateQuestion(updatedQuestion);
                                // Supabase 동기화 (비동기)
                                updateQuestionInSupabase(updatedQuestion).catch(err => {
                                  console.warn('⚠️ Supabase 동기화 오류:', err);
                                });
                                loadQuestions();
                              }}
                              className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                              title="반드시 불포함 문제"
                            />
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm">
                            <div className="flex gap-1">
                              <button
                                onClick={() => handlePreview(q)}
                                className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs transition-colors"
                                title="미리보기"
                              >
                                👁️
                              </button>
                              <button
                                onClick={() => {
                                  setEditingQuestion(q);
                                  setShowEditModal(true);
                                }}
                                className="px-2 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded text-xs transition-colors"
                                title="수정"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDeleteQuestion(q.id)}
                                className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs transition-colors"
                                title="삭제"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900" style={{ minWidth: '100px' }}>{q.category}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500" style={{ minWidth: '200px' }}>
                            {q.standard ? `${q.standard} - ${getStandardTitle(q.standard)}` : '-'}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-500" style={{ minWidth: '200px' }}>{q.detailItem || '-'}</td>
                          <td className="px-3 py-2 text-sm text-gray-900" style={{ minWidth: '300px' }}>
                            {q.question}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-500" style={{ minWidth: '200px' }}>{q.option1}</td>
                          <td className="px-3 py-2 text-sm text-gray-500" style={{ minWidth: '200px' }}>{q.option2}</td>
                          <td className="px-3 py-2 text-sm text-gray-500" style={{ minWidth: '200px' }}>{q.option3}</td>
                          <td className="px-3 py-2 text-sm text-gray-500" style={{ minWidth: '200px' }}>{q.option4}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm font-semibold text-blue-600" style={{ minWidth: '80px' }}>{q.answer}번</td>
                          <td className="px-3 py-2 text-sm text-gray-500" style={{ minWidth: '300px' }}>
                            {q.explanation || '-'}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-500" style={{ minWidth: '200px' }}>{q.imageUrl || '-'}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500" style={{ minWidth: '80px' }}>{q.weight || '-'}</td>
                          <td className="px-3 py-2 text-sm text-gray-500" style={{ minWidth: '150px' }}>{q.source || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 하단 페이지네이션 */}
              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-gray-600">
                  총 {filteredQuestions.length}문제 | 페이지 {currentPage} / {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const newPage = Math.max(1, currentPage - 1);
                      setCurrentPage(newPage);
                      setTimeout(() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }, 100);
                    }}
                    disabled={currentPage === 1}
                    className="px-3 py-1 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white rounded transition-colors"
                  >
                    ← 이전
                  </button>
                  <button
                    onClick={() => {
                      const newPage = Math.min(totalPages, currentPage + 1);
                      setCurrentPage(newPage);
                      setTimeout(() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }, 100);
                    }}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white rounded transition-colors"
                  >
                    다음 →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 출제기준별 현황 탭 */}
        {activeTab === 'statistics' && (
          <div>
            <StandardStatistics />
          </div>
        )}

        {/* 출제 설정 탭 */}
        {activeTab === 'config' && (
          <div className="space-y-6">
            {/* 저장 공간 관리 */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <h2 className="text-xl font-bold text-gray-800 mb-4">💾 저장 공간 관리</h2>
              <div className="space-y-3">
                {/* localStorage 사용량 표시 */}
                <div className={`p-3 rounded-lg border ${(() => {
                  const usage = getLocalStorageUsage();
                  if (usage.percentage >= 90) return 'bg-red-50 border-red-300';
                  if (usage.percentage >= 75) return 'bg-orange-50 border-orange-300';
                  if (usage.percentage >= 50) return 'bg-yellow-50 border-yellow-300';
                  return 'bg-green-50 border-green-300';
                })()}`}>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm font-semibold text-gray-800">저장 공간 사용량</p>
                    <p className={`text-sm font-bold ${(() => {
                      const usage = getLocalStorageUsage();
                      if (usage.percentage >= 90) return 'text-red-700';
                      if (usage.percentage >= 75) return 'text-orange-700';
                      if (usage.percentage >= 50) return 'text-yellow-700';
                      return 'text-green-700';
                    })()}`}>
                      {getLocalStorageUsage().percentage.toFixed(1)}%
                    </p>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full ${(() => {
                        const usage = getLocalStorageUsage();
                        if (usage.percentage >= 90) return 'bg-red-600';
                        if (usage.percentage >= 75) return 'bg-orange-500';
                        if (usage.percentage >= 50) return 'bg-yellow-500';
                        return 'bg-green-500';
                      })()}`}
                      style={{ width: `${Math.min(getLocalStorageUsage().percentage, 100)}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {getLocalStorageUsage().used.toFixed(2)} MB / {getLocalStorageUsage().total} MB 사용 중
                  </p>
                </div>

                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800 mb-2">
                    <strong>⚠️ 저장 공간 부족 시:</strong>
                  </p>
                  <p className="text-xs text-yellow-700 mb-3">
                    이미지 파일이 LocalStorage 용량을 많이 차지합니다. 저장 공간이 부족하면 아래 버튼으로 모든 이미지를 제거할 수 있습니다.
                  </p>
                  <button
                    onClick={() => {
                      const questions = getQuestions();
                      const imageCount = questions.filter(q => q.imageUrl && q.imageUrl.startsWith('data:image')).length;
                      
                      if (imageCount === 0) {
                        alert('제거할 이미지가 없습니다.');
                        return;
                      }
                      
                      const confirmMessage = `모든 문제의 이미지를 제거하시겠습니까?\n\n제거될 이미지: ${imageCount}개\n문제 데이터는 유지됩니다.`;
                      if (window.confirm(confirmMessage)) {
                        const questionsWithoutImages = questions.map(q => ({ ...q, imageUrl: '' }));
                        saveQuestions(questionsWithoutImages);
                        loadQuestions();
                        alert(`✅ ${imageCount}개 이미지가 제거되었습니다.`);
                      }
                    }}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    🗑️ 모든 이미지 제거
                  </button>
                </div>
              </div>
            </div>

            {/* 설정 저장/초기화 버튼 */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">⚙️ 가중치 기반 출제 설정</h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveExamConfig}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    💾 설정 저장
                  </button>
                  <button
                    onClick={handleResetExamConfig}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    🔄 초기화
                  </button>
                </div>
              </div>
            </div>

            {/* 1. 출제 로직 활성화 토글 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">1️⃣ 출제 로직 활성화</h3>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-semibold text-gray-800">가중치 기반 출제 사용</p>
                  <p className="text-sm text-gray-600 mt-1">
                    활성화하면 문제 출제 시 가중치를 고려하여 랜덤 선택합니다.
                    <br />
                    <span className="text-purple-600 font-medium">
                      가중치 1 = 최고 빈도 (가장 많이 출제), 가중치 10 = 최저 빈도 (가장 적게 출제)
                    </span>
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={examConfig.weightBasedEnabled}
                    onChange={e =>
                      setExamConfig(prev => ({ ...prev, weightBasedEnabled: e.target.checked }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            {/* 2. 출제 모드 선택 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">2️⃣ 출제 모드 선택</h3>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setExamConfig(prev => ({ ...prev, mode: 'filter' }))}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    examConfig.mode === 'filter'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-300 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="radio"
                        checked={examConfig.mode === 'filter'}
                        onChange={() => {}}
                        className="w-4 h-4"
                      />
                      <span className="font-bold text-gray-800">필터 모드</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      선택한 가중치의 문제만 출제 대상으로 포함하고,
                      <br />
                      역 가중치 기반으로 랜덤 선택합니다.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setExamConfig(prev => ({ ...prev, mode: 'ratio' }))}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    examConfig.mode === 'ratio'
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-300 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="radio"
                        checked={examConfig.mode === 'ratio'}
                        onChange={() => {}}
                        className="w-4 h-4"
                      />
                      <span className="font-bold text-gray-800">비율 모드</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      가중치별로 정확한 비율을 할당하여
                      <br />
                      문제를 선택합니다.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* 3. 출제 대상 가중치 선택 (필터 모드) */}
            {examConfig.mode === 'filter' && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">
                  3️⃣ 출제 대상 가중치 선택 (필터 모드)
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  출제에 포함할 가중치 레벨을 선택하세요. 선택한 가중치의 문제만 출제됩니다.
                </p>
                <div className="grid grid-cols-5 gap-3">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(weight => {
                    const isSelected = examConfig.selectedWeights.includes(weight);
                    return (
                      <button
                        key={weight}
                        onClick={() => toggleWeight(weight)}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-300 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="w-4 h-4"
                          />
                          <span className="font-bold text-gray-800">가중치 {weight}</span>
                        </div>
                        <p className="text-xs text-gray-600">
                          {weight === 1
                            ? '최고 빈도'
                            : weight === 10
                            ? '최저 빈도'
                            : weight <= 3
                            ? '높은 빈도'
                            : weight <= 7
                            ? '중간 빈도'
                            : '낮은 빈도'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. 가중치별 출제 비율 할당 (비율 모드) */}
            {examConfig.mode === 'ratio' && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">
                  3️⃣ 가중치별 출제 비율 할당 (비율 모드)
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  각 가중치 레벨별로 출제 비율(%)을 설정하세요. 전체 합계가 100%일 필요는 없습니다.
                </p>

                <div className="space-y-3">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(weight => {
                    const ratio = examConfig.weightRatios?.[weight] || 0;
                    return (
                      <div key={weight} className="flex items-center gap-4">
                        <label className="w-32 font-semibold text-gray-700">
                          가중치 {weight}
                          <span className="text-xs text-gray-500 ml-2">
                            {weight === 1
                              ? '(최고 빈도)'
                              : weight === 10
                              ? '(최저 빈도)'
                              : ''}
                          </span>
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={ratio}
                          onChange={e => updateWeightRatio(weight, parseInt(e.target.value))}
                          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                        />
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={ratio}
                          onChange={e =>
                            updateWeightRatio(weight, parseInt(e.target.value) || 0)
                          }
                          className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                        <span className="text-gray-600">%</span>
                      </div>
                    );
                  })}
                </div>

                {/* 비율 합계 표시 */}
                <div className="mt-6 p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-purple-800">전체 비율 합계:</span>
                    <span className="text-2xl font-bold text-purple-600">
                      {Object.values(examConfig.weightRatios || {}).reduce(
                        (sum, ratio) => sum + ratio,
                        0
                      )}
                      %
                    </span>
                  </div>
                  <p className="text-sm text-purple-700 mt-2">
                    💡 합계가 100%를 초과하면 자동으로 비율이 조정됩니다.
                    <br />
                    합계가 100% 미만이면 나머지는 랜덤하게 채워집니다.
                  </p>
                </div>
              </div>
            )}

            {/* 설명 및 공식 안내 */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg shadow-md p-6 border-2 border-blue-200">
              <h3 className="text-lg font-bold text-gray-800 mb-4">📚 가중치 기반 출제 로직 안내</h3>

              <div className="space-y-4">
                <div className="bg-white rounded-lg p-4">
                  <h4 className="font-bold text-blue-800 mb-2">🎯 가중치 의미</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• <span className="font-semibold">가중치 1</span>: 최고 빈도 (가장 많이 출제되어야 하는 문제)</li>
                    <li>• <span className="font-semibold">가중치 10</span>: 최저 빈도 (가장 적게 출제되어야 하는 문제)</li>
                    <li>• <span className="font-semibold">가중치 5</span>: 중간 빈도 (기본값)</li>
                  </ul>
                </div>

                <div className="bg-white rounded-lg p-4">
                  <h4 className="font-bold text-purple-800 mb-2">📐 역 가중치 공식</h4>
                  <div className="bg-purple-100 rounded p-3 font-mono text-sm">
                    R<sub>i</sub> = 11 - W<sub>i</sub>
                  </div>
                  <p className="text-sm text-gray-700 mt-2">
                    • W<sub>i</sub>: 원본 가중치 (1~10)
                    <br />
                    • R<sub>i</sub>: 역 가중치 (1~10, 높을수록 선택 확률 높음)
                    <br />
                    • 예: 가중치 1 → 역가중치 10 (선택 확률 최고)
                    <br />
                    • 예: 가중치 10 → 역가중치 1 (선택 확률 최저)
                  </p>
                </div>

                <div className="bg-white rounded-lg p-4">
                  <h4 className="font-bold text-green-800 mb-2">🔀 출제 모드</h4>
                  <ul className="text-sm text-gray-700 space-y-2">
                    <li>
                      <span className="font-semibold">필터 모드:</span> 선택한 가중치의 문제만 출제 대상에 포함하고,
                      역 가중치 기반 확률로 랜덤 선택합니다.
                    </li>
                    <li>
                      <span className="font-semibold">비율 모드:</span> 가중치별로 정확한 비율(%)을 할당하여
                      문제를 선택합니다. 예: 가중치 1 = 30%, 가중치 2 = 20% 등
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 데이터 관리 섹션 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">🗄️ 데이터 관리</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* 백업 생성 */}
                <div className="p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">💾</span>
                    <h4 className="font-bold text-blue-800">백업 생성</h4>
                  </div>
                  <p className="text-sm text-gray-700 mb-3">
                    현재 모든 데이터를 백업합니다.
                    <br />
                    최대 10개까지 자동 보관됩니다.
                  </p>
                  <button
                    onClick={handleCreateBackup}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    💾 백업 생성
                  </button>
                </div>

                {/* 모든 데이터 삭제 */}
                <div className="p-4 border-2 border-red-200 rounded-lg bg-red-50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">🗑️</span>
                    <h4 className="font-bold text-red-800">모든 데이터 삭제</h4>
                  </div>
                  <p className="text-sm text-gray-700 mb-3">
                    모든 문제, 회원, 통계 데이터를 삭제합니다.
                    <br />
                    <span className="font-semibold text-red-600">삭제 전 자동 백업됩니다.</span>
                  </p>
                  <button
                    onClick={handleDeleteAllData}
                    className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    🗑️ 모든 데이터 삭제
                  </button>
                </div>
              </div>

              {/* 백업 파일 복원 */}
              <div className="border-t-2 border-gray-200 pt-4">
                <div className="p-4 border-2 border-green-200 rounded-lg bg-green-50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">📂</span>
                    <h4 className="font-bold text-green-800">백업 파일에서 복원</h4>
                  </div>
                  <p className="text-sm text-gray-700 mb-3">
                    이전에 다운로드한 백업 파일(cbt_backup_*.json)을 업로드하여 데이터를 복원합니다.
                    <br />
                    <span className="font-semibold text-green-600">복원 전 현재 데이터는 자동으로 백업됩니다.</span>
                  </p>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="block w-full text-sm text-gray-700
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-green-600 file:text-white
                      hover:file:bg-green-700
                      file:transition-colors
                      cursor-pointer"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    💡 D:\cbtback 폴더에 저장한 백업 파일을 선택하세요.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 회원 관리 탭 */}
        {activeTab === 'members' && (
          <div>
            <div className="bg-white rounded-lg shadow-md p-4 mb-6">
              <button
                onClick={() => setShowAddMemberModal(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                ➕ 회원 추가
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="space-y-2">
                {members.map(m => (
                  <div
                    key={m.id}
                    className="border-2 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-gray-700 mb-1">
                          {m.name} (ID: {m.id})
                        </div>
                        <div className="text-sm text-gray-600">
                          전화번호: {m.phone}
                        </div>
                        <div className="text-sm text-gray-600">주소: {m.address}</div>
                        <div className="text-sm text-gray-600">메모: {m.memo}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          가입일: {new Date(m.registeredAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingMember(m);
                            setShowEditMemberModal(true);
                          }}
                          className="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded text-sm transition-colors"
                        >
                          ✏️ 수정
                        </button>
                        <button
                          onClick={() => handleDeleteMember(m.id)}
                          className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm transition-colors"
                        >
                          🗑️ 삭제
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 동기화 탭 */}
        {activeTab === 'sync' && (
          <div>
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">🔄 Google Sheets 동기화</h2>
              <p className="text-gray-600 mb-4">
                Google Sheets와 LocalStorage 간 데이터를 동기화합니다.
              </p>

              {/* 시트 선택 */}
              <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4 mb-6">
                <h3 className="font-bold text-gray-800 mb-3">📋 동기화할 시트 선택</h3>
                <p className="text-sm text-gray-600 mb-3">
                  속도 개선을 위해 필요한 시트만 선택하세요.
                </p>
                
                <div className="space-y-2">
                  {/* 전체 선택 */}
                  <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={selectedSheets.length === 5}
                      onChange={(e) => toggleAllSheets(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="font-semibold text-gray-800">전체 선택</span>
                  </label>
                  
                  <hr className="border-gray-300" />
                  
                  {/* 개별 시트 선택 */}
                  {['questions', '전기이론', '전기기기', '전기설비', '기타'].map((sheetName) => (
                    <label key={sheetName} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={selectedSheets.includes(sheetName)}
                        onChange={() => toggleSheetSelection(sheetName)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-gray-700">{sheetName}</span>
                    </label>
                  ))}
                </div>
                
                <p className="text-sm text-blue-600 mt-3">
                  ✅ 선택된 시트: {selectedSheets.length}개 ({selectedSheets.join(', ')})
                </p>
              </div>

              <div className="space-y-4">
                <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                  <h3 className="font-bold text-blue-800 mb-2">📥 Google Sheets → LocalStorage</h3>
                  <p className="text-sm text-blue-700 mb-3">
                    선택한 시트의 데이터를 가져와서 LocalStorage에 저장합니다.
                  </p>
                  
                  {/* 자동 출제기준 적용 체크박스 */}
                  <div className="mb-3 p-3 bg-white rounded-lg border border-blue-300">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoApplyStandard}
                        onChange={(e) => setAutoApplyStandard(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        출제기준이 없는 문제에 자동으로 출제기준 적용
                      </span>
                    </label>
                    <p className="text-xs text-gray-600 mt-1 ml-6">
                      (키워드 기반 자동 매칭 실패 시 랜덤하게 적용)
                    </p>
                  </div>
                  
                  <button
                    onClick={handleSyncFromSheets}
                    disabled={syncLoading || selectedSheets.length === 0}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors"
                  >
                    {syncLoading ? '동기화 중...' : `🔄 ${selectedSheets.length}개 시트에서 가져오기`}
                  </button>
                </div>

                <div className="border-2 border-green-200 rounded-lg p-4 bg-green-50">
                  <h3 className="font-bold text-green-800 mb-2">📤 LocalStorage → Google Sheets</h3>
                  <p className="text-sm text-green-700 mb-3">
                    LocalStorage의 데이터를 선택한 시트로 업로드합니다.
                  </p>
                  <button
                    onClick={handleSyncToSheets}
                    disabled={syncLoading || selectedSheets.length === 0}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors"
                  >
                    {syncLoading ? '동기화 중...' : `🔄 ${selectedSheets.length}개 시트로 업로드`}
                  </button>
                </div>

                {syncMessage && (
                  <div
                    className={`p-4 rounded-lg ${
                      syncMessage.includes('✅')
                        ? 'bg-green-100 text-green-800'
                        : syncMessage.includes('⚠️')
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {syncMessage}
                  </div>
                )}
              </div>
            </div>

            {/* Supabase 이전 섹션 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">🚀 Supabase 데이터베이스 이전</h2>
              <p className="text-gray-600 mb-4">
                LocalStorage의 문제 데이터를 클라우드 데이터베이스(Supabase)로 이전합니다.
              </p>

              {/* 연결 상태 */}
              <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4 mb-6">
                <h3 className="font-bold text-gray-800 mb-3">📡 Supabase 연결 상태</h3>

                <div className="flex items-center gap-4 mb-3">
                  <button
                    onClick={checkSupabaseConnection}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    🔌 연결 테스트
                  </button>

                  <div className="flex items-center gap-2">
                    {supabaseConnected === null && (
                      <span className="text-gray-500">연결 상태를 확인해주세요</span>
                    )}
                    {supabaseConnected === true && (
                      <>
                        <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                        <span className="text-green-700 font-semibold">연결됨</span>
                      </>
                    )}
                    {supabaseConnected === false && (
                      <>
                        <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                        <span className="text-red-700 font-semibold">연결 실패</span>
                      </>
                    )}
                  </div>
                </div>

                {supabaseConnected && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="bg-white p-3 rounded border">
                      <p className="text-sm text-gray-600">로컬 문제 수</p>
                      <p className="text-2xl font-bold text-blue-600">{questions.length}개</p>
                    </div>
                    <div className="bg-white p-3 rounded border">
                      <p className="text-sm text-gray-600">Supabase 문제 수</p>
                      <p className="text-2xl font-bold text-purple-600">{supabaseQuestionCount}개</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 이전 버튼 */}
              <div className="border-2 border-purple-200 rounded-lg p-4 bg-purple-50">
                <h3 className="font-bold text-purple-800 mb-2">📤 LocalStorage → Supabase</h3>
                <p className="text-sm text-purple-700 mb-3">
                  로컬에 저장된 모든 문제를 Supabase 클라우드 데이터베이스로 이전합니다.
                </p>

                <button
                  onClick={handleMigrateToSupabase}
                  disabled={isMigrating || !supabaseConnected}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors"
                >
                  {isMigrating ? '이전 중...' : '🚀 Supabase로 이전하기'}
                </button>

                {/* 이전 진행 상황 */}
                {migrationProgress.status !== 'idle' && (
                  <div className="mt-4">
                    <div className="mb-2">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>진행률</span>
                        <span>{migrationProgress.current}/{migrationProgress.total}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all duration-300 ${
                            migrationProgress.status === 'success'
                              ? 'bg-green-500'
                              : migrationProgress.status === 'error'
                              ? 'bg-red-500'
                              : 'bg-purple-500'
                          }`}
                          style={{
                            width: migrationProgress.total > 0
                              ? `${(migrationProgress.current / migrationProgress.total) * 100}%`
                              : '0%'
                          }}
                        ></div>
                      </div>
                    </div>
                    <p className={`text-sm ${
                      migrationProgress.status === 'success'
                        ? 'text-green-700'
                        : migrationProgress.status === 'error'
                        ? 'text-red-700'
                        : 'text-purple-700'
                    }`}>
                      {migrationProgress.message}
                    </p>
                  </div>
                )}
              </div>

              {/* 사용량 모니터링 */}
              <div className="border-2 border-indigo-200 rounded-lg p-4 bg-indigo-50 mt-6">
                <h3 className="font-bold text-indigo-800 mb-2">📊 Supabase 사용량 모니터링</h3>
                <p className="text-sm text-indigo-700 mb-3">
                  현재 Supabase 데이터베이스의 사용량을 확인합니다.
                </p>

                <button
                  onClick={loadSupabaseUsage}
                  disabled={isLoadingUsage || !supabaseConnected}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors"
                >
                  {isLoadingUsage ? '조회 중...' : '📊 사용량 조회'}
                </button>

                {supabaseUsageStats && (
                  <div className="mt-4 space-y-4">
                    {/* 기본 통계 */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-4 rounded-lg border border-indigo-200">
                        <p className="text-sm text-gray-600 mb-1">총 문제 수</p>
                        <p className="text-3xl font-bold text-indigo-600">{supabaseUsageStats.questionsCount.toLocaleString()}개</p>
                      </div>
                      <div className="bg-white p-4 rounded-lg border border-indigo-200">
                        <p className="text-sm text-gray-600 mb-1">예상 데이터 크기</p>
                        <p className="text-3xl font-bold text-indigo-600">
                          {supabaseUsageStats.estimatedSizeKB >= 1024
                            ? `${(supabaseUsageStats.estimatedSizeKB / 1024).toFixed(2)} MB`
                            : `${supabaseUsageStats.estimatedSizeKB} KB`}
                        </p>
                      </div>
                    </div>

                    {/* 카테고리별 통계 */}
                    <div className="bg-white p-4 rounded-lg border border-indigo-200">
                      <p className="text-sm font-semibold text-gray-700 mb-3">카테고리별 문제 수</p>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">전기이론</span>
                          <span className="font-semibold text-blue-600">{supabaseUsageStats.categoryCounts.전기이론.toLocaleString()}개</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${(supabaseUsageStats.categoryCounts.전기이론 / supabaseUsageStats.questionsCount) * 100}%` }}
                          ></div>
                        </div>

                        <div className="flex justify-between items-center mt-2">
                          <span className="text-sm text-gray-600">전기기기</span>
                          <span className="font-semibold text-green-600">{supabaseUsageStats.categoryCounts.전기기기.toLocaleString()}개</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${(supabaseUsageStats.categoryCounts.전기기기 / supabaseUsageStats.questionsCount) * 100}%` }}
                          ></div>
                        </div>

                        <div className="flex justify-between items-center mt-2">
                          <span className="text-sm text-gray-600">전기설비</span>
                          <span className="font-semibold text-orange-600">{supabaseUsageStats.categoryCounts.전기설비.toLocaleString()}개</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-orange-500 h-2 rounded-full"
                            style={{ width: `${(supabaseUsageStats.categoryCounts.전기설비 / supabaseUsageStats.questionsCount) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* Supabase 무료 한도 정보 */}
                    <div className="bg-white p-4 rounded-lg border border-indigo-200">
                      <p className="text-sm font-semibold text-gray-700 mb-2">💡 Supabase 무료 플랜 한도</p>
                      <ul className="text-xs text-gray-600 space-y-1">
                        <li>• 데이터베이스: 500MB (현재 약 {(supabaseUsageStats.estimatedSizeKB / 1024).toFixed(2)}MB 사용 중)</li>
                        <li>• 행 수: 무제한</li>
                        <li>• API 요청: 500K/월</li>
                        <li>• 대역폭: 5GB/월</li>
                      </ul>
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>데이터베이스 사용량</span>
                          <span>{((supabaseUsageStats.estimatedSizeKB / 1024) / 500 * 100).toFixed(2)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-indigo-500 h-2 rounded-full"
                            style={{ width: `${Math.min((supabaseUsageStats.estimatedSizeKB / 1024) / 500 * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 text-right">
                      마지막 업데이트: {supabaseUsageStats.lastUpdated}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 로그인 기록 탭 */}
        {activeTab === 'login-history' && (
          <div>
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">📜 로그인 기록</h2>
                <div className="flex gap-2">
                  <button
                    onClick={loadLoginHistory}
                    disabled={isLoadingLoginHistory}
                    className={`px-4 py-2 ${isLoadingLoginHistory ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg transition-colors`}
                  >
                    {isLoadingLoginHistory ? '로딩 중...' : '🔄 새로고침'}
                  </button>
                  <button
                    onClick={handleClearLoginHistory}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    🗑️ 전체 삭제
                  </button>
                </div>
              </div>

              {isLoadingLoginHistory ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg">로그인 기록을 불러오는 중...</p>
                </div>
              ) : loginHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg">로그인 기록이 없습니다.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">No</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">회원 이름</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">회원 ID</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">로그인 시간</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">기기 유형</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">IP 주소</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loginHistory.map((record, index) => (
                        <tr key={record.id} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-800">{index + 1}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-800">{record.userName}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{record.userId}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {new Date(record.timestamp).toLocaleString('ko-KR', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold">
                            <span className={`px-2 py-1 rounded ${
                              getDeviceType(record.userAgent) === 'PC' ? 'bg-blue-100 text-blue-800' :
                              getDeviceType(record.userAgent) === '태블릿' ? 'bg-green-100 text-green-800' :
                              getDeviceType(record.userAgent) === '스마트폰' ? 'bg-purple-100 text-purple-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {getDeviceType(record.userAgent)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {record.ipAddress || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleDeleteLoginRecord(record.id)}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-4 text-sm text-gray-600">
                    <p>총 {loginHistory.length}개의 로그인 기록</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 제보 게시판 탭 */}
        {activeTab === 'feedbacks' && (
          <div>
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">📋 제보 게시판</h2>
                <button
                  onClick={loadFeedbacks}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  🔄 새로고침
                </button>
              </div>

              {/* 하위 탭 */}
              <div className="flex gap-2 mb-4 border-b">
                <button
                  onClick={() => setFeedbackSubTab('bug')}
                  className={`px-4 py-2 font-semibold transition-colors ${
                    feedbackSubTab === 'bug'
                      ? 'border-b-2 border-red-500 text-red-600'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  오류 제보 ({allFeedbacksCount.bug})
                </button>
                <button
                  onClick={() => setFeedbackSubTab('suggestion')}
                  className={`px-4 py-2 font-semibold transition-colors ${
                    feedbackSubTab === 'suggestion'
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  건의사항 ({allFeedbacksCount.suggestion})
                </button>
                <button
                  onClick={() => setFeedbackSubTab('question')}
                  className={`px-4 py-2 font-semibold transition-colors ${
                    feedbackSubTab === 'question'
                      ? 'border-b-2 border-green-500 text-green-600'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  문의사항 ({allFeedbacksCount.question})
                </button>
              </div>

              {/* 에러 메시지 */}
              {feedbacksError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-red-800">
                    ⚠️ {feedbacksError}
                  </p>
                </div>
              )}

              {feedbacksLoading ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg">로딩 중...</p>
                </div>
              ) : feedbacks.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg">등록된 제보가 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {feedbacks.map((feedback) => (
                    <div
                      key={feedback.id}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            feedback.type === 'bug' ? 'bg-red-100 text-red-800' :
                            feedback.type === 'suggestion' ? 'bg-blue-100 text-blue-800' :
                            feedback.type === 'question' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {feedback.type === 'bug' ? '오류 제보' :
                             feedback.type === 'suggestion' ? '건의사항' :
                             feedback.type === 'question' ? '문의사항' : '기타'}
                          </span>
                          <span className="font-semibold text-gray-800">{feedback.author}</span>
                          {feedback.userId && (
                            <span className="text-xs text-gray-500">(ID: {feedback.userId})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">
                            {new Date(feedback.timestamp).toLocaleString('ko-KR')}
                          </span>
                          <button
                            onClick={async () => {
                              if (window.confirm('이 제보를 삭제하시겠습니까?')) {
                                const success = await deleteFeedbackItem(feedback.id);
                                if (!success) {
                                  alert('❌ 제보 삭제에 실패했습니다.');
                                }
                              }
                            }}
                            className="text-red-500 hover:text-red-700 text-sm px-2 py-1"
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
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 문제 업로드 탭 */}
        {activeTab === 'upload' && (
          <div>
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">📤 문제 업로드</h2>
              <p className="text-gray-600 mb-6">
                구글 시트 또는 CSV 파일에서 문제를 가져와 Supabase DB에 저장합니다.
              </p>

              {/* 업로드 방법 선택 */}
              <div className="flex gap-4 mb-6">
                <button
                  onClick={() => setUploadMethod('googleSheet')}
                  className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                    uploadMethod === 'googleSheet'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-blue-300'
                  }`}
                >
                  <div className="text-2xl mb-2">📊</div>
                  <div className="font-semibold">구글 시트 URL</div>
                  <div className="text-sm text-gray-600">URL 입력만으로 자동 가져오기</div>
                </button>
                <button
                  onClick={() => setUploadMethod('csv')}
                  className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                    uploadMethod === 'csv'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-blue-300'
                  }`}
                >
                  <div className="text-2xl mb-2">📄</div>
                  <div className="font-semibold">CSV 파일 업로드</div>
                  <div className="text-sm text-gray-600">파일 직접 선택</div>
                </button>
              </div>

              {/* 구글 시트 URL 입력 */}
              {uploadMethod === 'googleSheet' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    구글 시트 URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={googleSheetUrl}
                      onChange={(e) => setGoogleSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={async () => {
                        if (!googleSheetUrl) {
                          alert('구글 시트 URL을 입력하세요.');
                          return;
                        }
                        setUploadStatus('구글 시트에서 데이터 가져오는 중...');
                        setIsUploading(true);
                        try {
                          const questions = await fetchQuestionsFromGoogleSheet(googleSheetUrl);
                          setUploadPreview(questions);
                          setUploadStatus(`✅ ${questions.length}개 문제를 가져왔습니다.`);
                        } catch (err) {
                          setUploadStatus(`❌ 오류: ${err}`);
                          setUploadPreview([]);
                        } finally {
                          setIsUploading(false);
                        }
                      }}
                      disabled={isUploading}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isUploading ? '가져오는 중...' : '가져오기'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    ⚠️ 구글 시트가 "링크가 있는 모든 사용자"로 공유되어 있어야 합니다.
                  </p>
                </div>
              )}

              {/* CSV 파일 업로드 */}
              {uploadMethod === 'csv' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CSV 파일 선택
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setCsvFile(file);
                        }
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={async () => {
                        if (!csvFile) {
                          alert('CSV 파일을 선택하세요.');
                          return;
                        }
                        setUploadStatus('CSV 파일 파싱 중...');
                        setIsUploading(true);
                        try {
                          const text = await csvFile.text();
                          const questions = parseCSVToQuestions(text);
                          setUploadPreview(questions);
                          setUploadStatus(`✅ ${questions.length}개 문제를 파싱했습니다.`);
                        } catch (err) {
                          setUploadStatus(`❌ 오류: ${err}`);
                          setUploadPreview([]);
                        } finally {
                          setIsUploading(false);
                        }
                      }}
                      disabled={isUploading || !csvFile}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isUploading ? '파싱 중...' : '파싱하기'}
                    </button>
                  </div>
                </div>
              )}

              {/* 상태 메시지 */}
              {uploadStatus && (
                <div className={`p-4 rounded-lg mb-6 ${
                  uploadStatus.includes('✅') ? 'bg-green-50 text-green-800' :
                  uploadStatus.includes('❌') ? 'bg-red-50 text-red-800' :
                  'bg-blue-50 text-blue-800'
                }`}>
                  {uploadStatus}
                </div>
              )}

              {/* 미리보기 */}
              {uploadPreview.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3">미리보기 (처음 5개)</h3>
                  <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                    {uploadPreview.slice(0, 5).map((q, idx) => (
                      <div key={idx} className="mb-4 p-3 bg-white rounded border">
                        <div className="text-sm text-gray-500 mb-1">문제 {idx + 1}</div>
                        <div className="font-semibold mb-2">{q.question}</div>
                        <div className="text-sm text-gray-600">
                          카테고리: {q.category} | 정답: {q.answer}번
                        </div>
                      </div>
                    ))}
                    {uploadPreview.length > 5 && (
                      <div className="text-center text-gray-500 mt-2">
                        ... 외 {uploadPreview.length - 5}개 문제
                      </div>
                    )}
                  </div>

                  {/* 카테고리별 통계 */}
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-xl font-bold text-green-600">
                        {uploadPreview.filter(q => q.category === '전기이론').length}
                      </div>
                      <div className="text-sm text-gray-600">전기이론</div>
                    </div>
                    <div className="text-center p-3 bg-yellow-50 rounded-lg">
                      <div className="text-xl font-bold text-yellow-600">
                        {uploadPreview.filter(q => q.category === '전기기기').length}
                      </div>
                      <div className="text-sm text-gray-600">전기기기</div>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className="text-xl font-bold text-purple-600">
                        {uploadPreview.filter(q => q.category === '전기설비').length}
                      </div>
                      <div className="text-sm text-gray-600">전기설비</div>
                    </div>
                  </div>

                  {/* DB에 저장 버튼 */}
                  <div className="mt-6">
                    <button
                      onClick={async () => {
                        if (!window.confirm(`${uploadPreview.length}개 문제를 Supabase DB에 저장하시겠습니까?`)) {
                          return;
                        }
                        setUploadStatus('DB에 저장 중...');
                        setIsUploading(true);
                        try {
                          const result = await insertQuestions(uploadPreview);
                          setUploadStatus(
                            `✅ 완료! 성공: ${result.success}개, 실패: ${result.failed}개`
                          );
                          if (result.errors.length > 0) {
                            console.error('업로드 오류:', result.errors);
                          }
                          setUploadPreview([]);
                          // 문제 수 자동 갱신
                          if (result.success > 0) {
                            const newCount = await getSupabaseQuestionCount();
                            setSupabaseQuestionCount(newCount);
                          }
                        } catch (err) {
                          setUploadStatus(`❌ 저장 실패: ${err}`);
                        } finally {
                          setIsUploading(false);
                        }
                      }}
                      disabled={isUploading}
                      className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isUploading ? '저장 중...' : `📥 ${uploadPreview.length}개 문제를 DB에 저장`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 학생 학습 기록 탭 */}
        {activeTab === 'student-records' && (
          <div>
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">📊 학생 학습 기록</h2>
                <button
                  onClick={loadStudentRecords}
                  disabled={isLoadingStudentRecords}
                  className={`px-4 py-2 ${isLoadingStudentRecords ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg transition-colors`}
                >
                  {isLoadingStudentRecords ? '로딩 중...' : '🔄 새로고침'}
                </button>
              </div>

              {isLoadingStudentRecords ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg">학생 학습 기록을 불러오는 중...</p>
                </div>
              ) : studentRecords.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg">학습 기록이 없습니다.</p>
                  <p className="text-sm mt-2">학생들이 시험을 보면 여기에 기록이 표시됩니다.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 학생 목록 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {studentRecords.map(record => (
                      <div
                        key={record.userId}
                        onClick={() => setSelectedStudentId(selectedStudentId === record.userId ? null : record.userId)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedStudentId === record.userId
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-lg text-gray-800">{record.userName}</h3>
                          <span className="text-xs text-gray-500">ID: {record.userId}</span>
                        </div>
                        <div className="space-y-1 text-sm">
                          <p className="text-gray-600">
                            📝 시험 횟수: <span className="font-semibold">{(record.examResults as unknown[]).length}회</span>
                          </p>
                          <p className="text-gray-600">
                            ❌ 오답 문제: <span className="font-semibold">{(record.wrongAnswers as unknown[]).length}개</span>
                          </p>
                          {(() => {
                            const stats = record.statistics as { averageScore?: number } | null;
                            if (stats && typeof stats === 'object' && stats.averageScore !== undefined) {
                              return (
                                <p className="text-gray-600">
                                  📊 평균 점수: <span className="font-semibold">{Number(stats.averageScore).toFixed(1)}점</span>
                                </p>
                              );
                            }
                            return null;
                          })()}
                          <p className="text-xs text-gray-400 mt-2">
                            마지막 업데이트: {new Date(record.updatedAt).toLocaleString('ko-KR')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 선택된 학생의 상세 정보 */}
                  {selectedStudentId && (() => {
                    const selectedRecord = studentRecords.find(r => r.userId === selectedStudentId);
                    if (!selectedRecord) return null;

                    const examResults = selectedRecord.examResults as Array<{
                      timestamp: number;
                      totalQuestions: number;
                      correctAnswers: number;
                      mode?: string;
                    }>;

                    const wrongAnswers = selectedRecord.wrongAnswers as Array<{
                      questionId: number;
                      wrongCount: number;
                      timestamp: number;
                    }>;

                    return (
                      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">
                          📋 {selectedRecord.userName}님의 상세 기록
                        </h3>

                        {/* 최근 시험 결과 */}
                        <div className="mb-4">
                          <h4 className="font-semibold text-gray-700 mb-2">최근 시험 결과 (최근 10개)</h4>
                          {examResults.length === 0 ? (
                            <p className="text-gray-500 text-sm">시험 기록이 없습니다.</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-gray-200">
                                    <th className="px-3 py-2 text-left">날짜</th>
                                    <th className="px-3 py-2 text-left">모드</th>
                                    <th className="px-3 py-2 text-center">문제 수</th>
                                    <th className="px-3 py-2 text-center">정답</th>
                                    <th className="px-3 py-2 text-center">점수</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {examResults.slice(0, 10).map((result, idx) => (
                                    <tr key={idx} className="border-b">
                                      <td className="px-3 py-2">
                                        {new Date(result.timestamp).toLocaleString('ko-KR', {
                                          month: '2-digit',
                                          day: '2-digit',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </td>
                                      <td className="px-3 py-2">{result.mode || '일반'}</td>
                                      <td className="px-3 py-2 text-center">{result.totalQuestions}</td>
                                      <td className="px-3 py-2 text-center">{result.correctAnswers}</td>
                                      <td className="px-3 py-2 text-center font-semibold">
                                        {result.totalQuestions > 0
                                          ? ((result.correctAnswers / result.totalQuestions) * 100).toFixed(1)
                                          : 0}%
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {/* 자주 틀리는 문제 */}
                        <div>
                          <h4 className="font-semibold text-gray-700 mb-2">자주 틀리는 문제 (상위 10개)</h4>
                          {wrongAnswers.length === 0 ? (
                            <p className="text-gray-500 text-sm">오답 기록이 없습니다.</p>
                          ) : (
                            <div className="space-y-2">
                              {wrongAnswers
                                .sort((a, b) => b.wrongCount - a.wrongCount)
                                .slice(0, 10)
                                .map((wa, idx) => (
                                  <div key={idx} className="flex justify-between items-center p-2 bg-white rounded border">
                                    <span className="text-gray-700">문제 #{wa.questionId}</span>
                                    <span className="text-red-600 font-semibold">{wa.wrongCount}회 오답</span>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 문제 추가 모달 */}
        {showAddModal && (
          <QuestionModal
            title="문제 추가"
            question={newQuestion}
            onChange={setNewQuestion}
            onSave={handleAddQuestion}
            onClose={() => {
              setShowAddModal(false);
              resetNewQuestion();
            }}
            autoApplyStandard={autoApplyStandard}
            setAutoApplyStandard={setAutoApplyStandard}
          />
        )}

        {/* 문제 수정 모달 */}
        {showEditModal && editingQuestion && (
          <QuestionModal
            title="문제 수정"
            question={editingQuestion}
            onChange={setEditingQuestion}
            onSave={handleUpdateQuestion}
            onClose={() => {
              setShowEditModal(false);
              setEditingQuestion(null);
            }}
            autoApplyStandard={autoApplyStandard}
            setAutoApplyStandard={setAutoApplyStandard}
          />
        )}

        {/* 문제 미리보기 모달 */}
        {showPreviewModal && previewQuestion && (
          <QuestionPreviewModal
            question={previewQuestion}
            onEdit={handleEditFromPreview}
            onClose={() => {
              setShowPreviewModal(false);
              setPreviewQuestion(null);
            }}
          />
        )}

        {/* 출제기준 적용 모달 */}
        {showStandardApplyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
              <div className="border-b p-4 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">📋 출제기준 적용</h2>
                <button
                  onClick={() => {
                    setShowStandardApplyModal(false);
                    setSelectedStandard('');
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    선택한 문제: <span className="font-bold">{selectedQuestions.size}개</span>
                  </p>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      적용 방식
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setStandardApplyMode('random')}
                        className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
                          standardApplyMode === 'random'
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        🎲 랜덤 적용
                      </button>
                      <button
                        onClick={() => setStandardApplyMode('manual')}
                        className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
                          standardApplyMode === 'manual'
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        ✏️ 직접 적용
                      </button>
                    </div>
                  </div>

                  {standardApplyMode === 'manual' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          출제기준 선택
                        </label>
                        {(() => {
                          const selectedQuestionsList = questions.filter(q => selectedQuestions.has(q.id));
                          const categories = new Set(selectedQuestionsList.map(q => q.category));
                          const allStandards = Array.from(categories).flatMap(cat => 
                            getStandardsByCategory(cat).map(code => ({ code, category: cat }))
                          );
                          
                          if (categories.size > 1) {
                            // 여러 카테고리가 섞여있는 경우
                            return (
                              <select
                                value={selectedStandard}
                                onChange={e => {
                                  setSelectedStandard(e.target.value);
                                  setSelectedDetailItem(''); // 출제기준 변경 시 세부항목 초기화
                                }}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                              >
                                <option value="">선택하세요</option>
                                {allStandards.map(({ code, category }) => (
                                  <option key={code} value={code}>
                                    [{category}] {code} - {getStandardTitle(code)}
                                  </option>
                                ))}
                              </select>
                            );
                          } else {
                            // 단일 카테고리
                            const category = Array.from(categories)[0] || '전기이론';
                            const standards = getStandardsByCategory(category);
                            return (
                              <select
                                value={selectedStandard}
                                onChange={e => {
                                  setSelectedStandard(e.target.value);
                                  setSelectedDetailItem(''); // 출제기준 변경 시 세부항목 초기화
                                }}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                              >
                                <option value="">선택하세요</option>
                                {standards.map(code => (
                                  <option key={code} value={code}>
                                    {code} - {getStandardTitle(code)}
                                  </option>
                                ))}
                              </select>
                            );
                          }
                        })()}
                      </div>
                      
                      {/* 세부항목 선택 (출제기준이 선택된 경우에만 표시) */}
                      {selectedStandard && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            세부항목 선택 (선택사항)
                          </label>
                          <select
                            value={selectedDetailItem}
                            onChange={e => setSelectedDetailItem(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          >
                            <option value="">미지정 (자동 적용 시도)</option>
                            {getDetailItemsByStandard(selectedStandard).map(detailItem => (
                              <option key={detailItem} value={detailItem}>
                                {detailItem}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-600 mt-1">
                            미지정으로 두면 자동으로 키워드 기반 매칭을 시도합니다.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {standardApplyMode === 'random' && (
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <p className="text-sm text-purple-800">
                        선택한 문제들의 카테고리에 맞는 출제기준을 랜덤하게 적용합니다.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => {
                      if (standardApplyMode === 'random') {
                        handleRandomApplyStandard();
                      } else {
                        handleManualApplyStandard();
                      }
                    }}
                    disabled={standardApplyMode === 'manual' && !selectedStandard}
                    className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors"
                  >
                    적용
                  </button>
                  <button
                    onClick={() => {
                      setShowStandardApplyModal(false);
                      setSelectedStandard('');
                      setSelectedDetailItem('');
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

        {/* 회원 추가 모달 */}
        {showAddMemberModal && (
          <MemberModal
            title="회원 추가"
            member={newMember}
            onChange={setNewMember}
            onSave={handleAddMember}
            onClose={() => {
              setShowAddMemberModal(false);
              resetNewMember();
            }}
          />
        )}

        {/* 회원 수정 모달 */}
        {showEditMemberModal && editingMember && (
          <MemberModal
            title="회원 수정"
            member={editingMember}
            onChange={setEditingMember}
            onSave={handleUpdateMember}
            onClose={() => {
              setShowEditMemberModal(false);
              setEditingMember(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

// 문제 모달 컴포넌트
function QuestionModal({
  title,
  question,
  onChange,
  onSave,
  onClose,
  autoApplyStandard,
  setAutoApplyStandard,
}: {
  title: string;
  question: any;
  onChange: (q: any) => void;
  onSave: () => void;
  onClose: () => void;
  autoApplyStandard?: boolean;
  setAutoApplyStandard?: (value: boolean) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
            ✕
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              카테고리
            </label>
            <select
              value={question.category}
              onChange={e => {
                const newCategory = e.target.value;
                onChange({ ...question, category: newCategory, standard: undefined, detailItem: undefined }); // 카테고리 변경 시 출제기준 및 세부항목 초기화
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="전기이론">전기이론</option>
              <option value="전기기기">전기기기</option>
              <option value="전기설비">전기설비</option>
              <option value="기타">기타</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              출제기준 (선택)
            </label>
            <select
              value={question.standard || ''}
              onChange={e => {
                const newStandard = e.target.value || undefined;
                // 출제기준이 변경되면 세부항목도 초기화하고, 새로운 출제기준에 맞는 세부항목을 자동 할당 시도
                const updatedQuestion = { ...question, standard: newStandard, detailItem: undefined };
                if (newStandard && autoApplyStandard) {
                  const matchedDetailItem = matchDetailItemByKeywords(updatedQuestion);
                  if (matchedDetailItem) {
                    updatedQuestion.detailItem = matchedDetailItem;
                  }
                }
                onChange(updatedQuestion);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">선택 안함</option>
              {getStandardsByCategory(question.category || '전기이론').map((code: string) => (
                <option key={code} value={code}>
                  {code} - {getStandardTitle(code)}
                </option>
              ))}
            </select>
            
            {/* 자동 출제기준 적용 체크박스 */}
            {setAutoApplyStandard !== undefined && (
              <div className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoApplyStandard ?? false}
                    onChange={(e) => setAutoApplyStandard(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    출제기준이 없으면 자동으로 적용
                  </span>
                </label>
                <p className="text-xs text-gray-600 mt-1 ml-6">
                  (키워드 기반 자동 매칭 실패 시 랜덤하게 적용)
                </p>
              </div>
            )}
          </div>

          {/* 세부항목 선택 (출제기준이 선택된 경우에만 표시) */}
          {question.standard && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                세부항목 (선택)
              </label>
              <select
                value={question.detailItem || ''}
                onChange={e => onChange({ ...question, detailItem: e.target.value || undefined })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">미지정</option>
                {getDetailItemsByStandard(question.standard).map(detailItem => (
                  <option key={detailItem} value={detailItem}>
                    {detailItem}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              질문 (LaTeX 지원: $ ... $)
            </label>
            <textarea
              value={question.question}
              onChange={e => onChange({ ...question, question: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {[1, 2, 3, 4].map(num => (
            <div key={num}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                선택지 {num}
              </label>
              <input
                type="text"
                value={question[`option${num}`]}
                onChange={e =>
                  onChange({ ...question, [`option${num}`]: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              정답 번호
            </label>
            <select
              value={question.answer}
              onChange={e => onChange({ ...question, answer: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>1번</option>
              <option value={2}>2번</option>
              <option value={3}>3번</option>
              <option value={4}>4번</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              해설 (LaTeX 지원: $ ... $)
            </label>
            <textarea
              value={question.explanation}
              onChange={e => onChange({ ...question, explanation: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={question.hasImage || false}
                onChange={e => onChange({ ...question, hasImage: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">이미지 영역 확보</span>
            </label>
            {question.hasImage ? (
              <div className="space-y-2">
                <div className="flex gap-2 items-center">
                  <input
                    type="file"
                    id={`image-file-${question.id || 'new'}`}
                    accept="image/png,image/jpeg,image/jpg"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        // 파일 크기 제한 (500KB)
                        const maxSize = 500 * 1024; // 500KB
                        if (file.size > maxSize) {
                          alert(`이미지 파일 크기가 너무 큽니다. (최대 500KB)\n현재 크기: ${(file.size / 1024).toFixed(1)}KB\n\n이미지를 압축하거나 크기를 줄여주세요.`);
                          return;
                        }
                        
                        // 파일 확장자 추출
                        const fileName = file.name;
                        const fileExtension = fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase();
                        
                        // PNG 또는 JPG/JPG만 허용
                        if (fileExtension !== 'png' && fileExtension !== 'jpg' && fileExtension !== 'jpeg') {
                          alert('PNG 또는 JPG 파일만 선택할 수 있습니다.');
                          return;
                        }

                        // localStorage 용량 체크
                        const usage = getLocalStorageUsage();
                        if (usage.percentage > 80) {
                          const confirmMessage = `⚠️ 저장 공간이 ${usage.percentage.toFixed(1)}% 사용 중입니다.\n\n계속하시겠습니까? (이미지가 크면 저장에 실패할 수 있습니다)`;
                          if (!confirm(confirmMessage)) {
                            return;
                          }
                        }

                        // 이미지 압축 (최대 50KB, 600px 너비)
                        compressImage(file, 50, 600)
                          .then((compressedDataUrl) => {
                            // 임시로 base64 데이터와 파일 확장자를 저장 (미리보기용)
                            onChange({ ...question, _imagePreview: compressedDataUrl, _imageExtension: fileExtension });
                          })
                          .catch((error) => {
                            alert(`이미지 압축 실패: ${error.message}`);
                          });
                      }
                    }}
                  />
                  <label
                    htmlFor={`image-file-${question.id || 'new'}`}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg cursor-pointer text-sm font-medium transition-colors"
                  >
                    📁 파일 찾기 (PNG/JPG)
                  </label>
                  {question._imagePreview && (
                    <button
                      onClick={() => {
                        // base64 이미지 데이터를 imageUrl에 직접 저장
                        // 이렇게 하면 파일 시스템에 별도로 저장할 필요 없이 바로 표시됩니다
                        const imageData = question._imagePreview as string;
                        onChange({ ...question, imageUrl: imageData, _imagePreview: undefined, _imageExtension: undefined });
                        alert('이미지가 적용되었습니다. 저장 버튼을 클릭하여 문제를 저장하세요.');
                      }}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      ✅ 적용
                    </button>
                  )}
                  {question.imageUrl && (
                    <button
                      onClick={() => onChange({ ...question, imageUrl: '', _imagePreview: undefined, _imageExtension: undefined })}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      🗑️ 이미지 제거
                    </button>
                  )}
                </div>
                {question._imagePreview && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-600 mb-1">미리보기:</p>
                    <img
                      src={question._imagePreview}
                      alt="이미지 미리보기"
                      className="max-w-full h-auto max-h-48 rounded border border-gray-300"
                    />
                  </div>
                )}
                {question.imageUrl && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-600 mb-1">현재 이미지 URL:</p>
                    <input
                      type="text"
                      value={question.imageUrl}
                      readOnly
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                    />
                  </div>
                )}
                <p className="text-xs text-gray-500">
                  PNG 또는 JPG 파일을 선택하고 적용 버튼을 누르면 이미지가 자동으로 압축되어 저장됩니다. (최대 100KB, 800px 너비로 자동 리사이즈)
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이미지 URL (선택)
                </label>
                <input
                  type="text"
                  value={question.imageUrl || ''}
                  onChange={e => onChange({ ...question, imageUrl: e.target.value })}
                  placeholder="예: /img/전기이론/q1.png"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  이미지 영역 확보를 체크하면 이미지가 없어도 공간이 확보됩니다.
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                출제 가중치 (선택)
              </label>
              <select
                value={question.weight || ''}
                onChange={e =>
                  onChange({ ...question, weight: e.target.value ? parseInt(e.target.value) : undefined })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">미지정 (기본값: 5)</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(w => (
                  <option key={w} value={w}>
                    {w} - {w === 1 ? '최고 빈도' : w === 10 ? '최저 빈도' : w <= 3 ? '높은 빈도' : w <= 7 ? '중간 빈도' : '낮은 빈도'}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-600 mt-1">
                1 = 최고 빈도, 10 = 최저 빈도
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                문제 출처 (선택)
              </label>
              <input
                type="text"
                value={question.source || ''}
                onChange={e => onChange({ ...question, source: e.target.value || undefined })}
                placeholder="예: 2023년 기출, 교재명 등"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-600 mt-1">
                교재명, 기출연도 등
              </p>
            </div>
          </div>

          <div className="pt-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={question.mustInclude || false}
                onChange={e => onChange({ ...question, mustInclude: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">반드시 포함 문제</span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              체크하면 랜덤 출제 시 항상 포함됩니다. (가중치와 무관하게 항상 선택)
            </p>
          </div>

          <div className="pt-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={question.mustExclude || false}
                onChange={e => onChange({ ...question, mustExclude: e.target.checked })}
                className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <span className="text-sm font-medium text-gray-700">반드시 불포함 문제</span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              체크하면 랜덤 출제 시 항상 제외됩니다. (가중치와 무관하게 항상 제외)
            </p>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              onClick={onSave}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
            >
              저장
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 문제 미리보기 모달 컴포넌트
function QuestionPreviewModal({
  question,
  onEdit,
  onClose,
}: {
  question: Question;
  onEdit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">문제 미리보기</h2>
          <div className="flex gap-2">
            <button
              onClick={onEdit}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors"
            >
              ✏️ 수정
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
              ✕
            </button>
          </div>
        </div>
        <div className="p-6">
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <div className="flex gap-2 items-center">
                <h3 className="text-lg font-bold text-gray-800">ID: {question.id}</h3>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                  {question.category}
                </span>
                {question.standard && (
                  <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold">
                    {question.standard} - {getStandardTitle(question.standard)}
                  </span>
                )}
              </div>
            </div>
            <LatexRenderer
              text={question.question || ''}
              className="text-gray-700 text-lg leading-relaxed"
            />
          </div>

          {question.imageUrl && (
            <div className="mb-4">
              <img
                src={question.imageUrl}
                alt="문제 이미지"
                className="max-w-full h-auto rounded-lg"
              />
            </div>
          )}

          <div className="space-y-3 mb-6">
            {[1, 2, 3, 4].map(optionNum => {
              const optionKey = `option${optionNum}` as keyof Question;
              const optionText = (question[optionKey] as string) || '';
              const isCorrectAnswer = question.answer === optionNum;

              return (
                <div
                  key={optionNum}
                  className={`p-4 rounded-lg border-2 ${
                    isCorrectAnswer
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-start">
                    <span
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold mr-3 ${
                        isCorrectAnswer
                          ? 'bg-green-500 text-white'
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
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {question.explanation && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-4">
              <h4 className="font-bold text-blue-800 mb-2">📚 해설</h4>
              <LatexRenderer
                text={question.explanation || ''}
                className="text-gray-700 leading-relaxed"
              />
            </div>
          )}

          {/* 출제기준 및 세부항목 (항상 표시, 없으면 "미지정" 표시) */}
          <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4 mt-4">
            <h4 className="font-bold text-purple-800 mb-2">📋 출제기준</h4>
            <div className="space-y-2">
              {question.standard ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold">
                      {question.standard} - {getStandardTitle(question.standard)}
                    </span>
                  </div>
                  {question.detailItem && (
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-purple-700 text-sm">세부항목:</span>
                      <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                        {question.detailItem}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                  미지정
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 회원 모달 컴포넌트
function MemberModal({
  title,
  member,
  onChange,
  onSave,
  onClose,
}: {
  title: string;
  member: any;
  onChange: (m: any) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full">
        <div className="border-b p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
            ✕
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
            <input
              type="text"
              value={member.name}
              onChange={e => onChange({ ...member, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              전화번호
            </label>
            <input
              type="text"
              value={member.phone}
              onChange={e => onChange({ ...member, phone: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
            <input
              type="text"
              value={member.address}
              onChange={e => onChange({ ...member, address: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
            <textarea
              value={member.memo}
              onChange={e => onChange({ ...member, memo: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button
              onClick={onSave}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
            >
              저장
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
