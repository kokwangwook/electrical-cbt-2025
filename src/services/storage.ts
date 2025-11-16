import type { Question, Member, WrongAnswer, ExamSession, ExamResult, Statistics, Feedback } from '../types';
import { initialMembers } from '../data/initialMembers';

// ========== 이미지 압축 유틸리티 ==========

/**
 * 이미지를 압축하여 base64로 반환
 * @param file 이미지 파일
 * @param maxSizeKB 최대 크기 (KB, 기본 50KB)
 * @param maxWidth 최대 너비 (기본 600px)
 * @returns 압축된 base64 이미지
 */
export function compressImage(file: File, maxSizeKB: number = 50, maxWidth: number = 600): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // 캔버스 생성
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // 이미지 크기 조정
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context를 생성할 수 없습니다.'));
          return;
        }

        // 이미지 그리기
        ctx.drawImage(img, 0, 0, width, height);

        // 압축 품질 조정 (0.1 ~ 0.95)
        let quality = 0.8;
        let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

        // 목표 크기에 맞출 때까지 품질 조정
        while (compressedDataUrl.length > maxSizeKB * 1024 * 4/3 && quality > 0.1) {
          quality -= 0.1;
          compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        console.log(`✅ 이미지 압축 완료: ${(compressedDataUrl.length / 1024).toFixed(1)}KB (품질: ${(quality * 100).toFixed(0)}%)`);
        resolve(compressedDataUrl);
      };

      img.onerror = () => {
        reject(new Error('이미지를 로드할 수 없습니다.'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('파일을 읽을 수 없습니다.'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * localStorage의 현재 사용량 확인 (MB)
 */
export function getLocalStorageUsage(): { used: number; total: number; percentage: number } {
  let total = 0;
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += localStorage[key].length + key.length;
    }
  }

  const usedMB = total / (1024 * 1024);
  const totalMB = 10; // 대부분의 브라우저는 5-10MB 제한
  const percentage = (usedMB / totalMB) * 100;

  return {
    used: usedMB,
    total: totalMB,
    percentage: percentage
  };
}

/**
 * 저장 전 용량 체크 - 저장이 가능한지 예측
 * @param questions 저장할 문제 배열
 * @returns 저장 가능 여부와 경고 메시지
 */
export function checkStorageCapacity(questions: Question[]): {
  canSave: boolean;
  warning?: string;
  estimatedSize: number;
  currentUsage: number;
} {
  const jsonData = JSON.stringify(questions);
  const estimatedSize = jsonData.length / (1024 * 1024); // MB
  const currentUsage = getLocalStorageUsage();
  const projectedPercentage = ((currentUsage.used + estimatedSize) / currentUsage.total) * 100;

  if (projectedPercentage >= 95) {
    return {
      canSave: false,
      warning: `⚠️ 저장 공간 부족!\n\n예상 사용량: ${projectedPercentage.toFixed(1)}%\n현재 사용량: ${currentUsage.percentage.toFixed(1)}%\n추가 필요량: ${estimatedSize.toFixed(2)}MB\n\n저장이 실패할 수 있습니다.\n이미지를 줄이거나 문제를 삭제해주세요.`,
      estimatedSize,
      currentUsage: currentUsage.percentage
    };
  } else if (projectedPercentage >= 85) {
    return {
      canSave: true,
      warning: `⚠️ 저장 공간 경고\n\n예상 사용량: ${projectedPercentage.toFixed(1)}%\n현재 사용량: ${currentUsage.percentage.toFixed(1)}%\n\n저장 공간이 부족해지고 있습니다.`,
      estimatedSize,
      currentUsage: currentUsage.percentage
    };
  }

  return {
    canSave: true,
    estimatedSize,
    currentUsage: currentUsage.percentage
  };
}

// ========== LocalStorage 키 ==========
const QUESTIONS_KEY = 'questions';
const MEMBERS_KEY = 'members';
const CURRENT_USER_KEY = 'currentUser';
const WRONG_ANSWERS_KEY = 'wrongAnswers';
const EXAM_RESULTS_KEY = 'examResults';
const STATISTICS_KEY = 'statistics';
const CURRENT_EXAM_SESSION_KEY = 'currentExamSession';
const FEEDBACKS_KEY = 'feedbacks';
const LAST_SERVER_SYNC_KEY = 'lastServerSync'; // 마지막 서버 동기화 정보
const GLOBAL_LEARNING_PROGRESS_KEY = 'globalLearningProgress'; // 전역 문제 이해도

// ========== 초기화 ==========
export function initializeData(): void {
  // 회원 데이터 초기화 및 병합
  const existingMembers = getMembers();
  
  if (existingMembers.length === 0) {
    // 회원 데이터가 없으면 초기 회원 데이터로 초기화
    const members: Member[] = initialMembers.map((m, idx) => ({
      ...m,
      id: idx + 1,
      registeredAt: Date.now(),
    }));
    saveMembers(members);
    console.log(`✅ 초기 회원 ${initialMembers.length}명 등록 완료`);
  } else {
    // 기존 회원 데이터가 있으면 누락된 회원만 추가
    const existingNames = new Set(
      existingMembers.map(m => m.name.trim().toLowerCase().replace(/\s+/g, ' '))
    );
    
    const newMembers: Member[] = [];
    let maxId = existingMembers.length > 0 
      ? Math.max(...existingMembers.map(m => m.id)) 
      : 0;
    
    initialMembers.forEach(initialMember => {
      const normalizedName = initialMember.name.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!existingNames.has(normalizedName)) {
        maxId++;
        newMembers.push({
          ...initialMember,
          id: maxId,
          registeredAt: Date.now(),
        });
        console.log(`➕ 새 회원 추가: ${initialMember.name}`);
      }
    });
    
    if (newMembers.length > 0) {
      const updatedMembers = [...existingMembers, ...newMembers];
      saveMembers(updatedMembers);
      console.log(`✅ 누락된 회원 ${newMembers.length}명 추가 완료 (총 ${updatedMembers.length}명)`);
    } else {
      console.log(`✅ 모든 초기 회원이 이미 등록되어 있습니다. (총 ${existingMembers.length}명)`);
    }
  }

  // 문제 데이터 초기화 (관리자가 추가)
  if (!localStorage.getItem(QUESTIONS_KEY)) {
    saveQuestions([]);
  }

  // 통계 초기화
  if (!localStorage.getItem(STATISTICS_KEY)) {
    const stats: Statistics = {
      totalExams: 0,
      averageScore: 0,
      categoryStats: {},
      recentResults: [],
    };
    saveStatistics(stats);
  }

  // 오답 노트 초기화
  if (!localStorage.getItem(WRONG_ANSWERS_KEY)) {
    saveWrongAnswers([]);
  }

  // 시험 결과 초기화
  if (!localStorage.getItem(EXAM_RESULTS_KEY)) {
    saveExamResults([]);
  }

  // 피드백 초기화
  if (!localStorage.getItem(FEEDBACKS_KEY)) {
    saveFeedbacks([]);
  }
}

// ========== 문제 (Question) 관리 ==========

export function getQuestions(): Question[] {
  try {
    const data = localStorage.getItem(QUESTIONS_KEY);
    if (!data) {
      return [];
    }
    
    const questions = JSON.parse(data);
    
    // 데이터 유효성 검사
    if (!Array.isArray(questions)) {
      console.error('❌ 문제 데이터가 배열이 아닙니다. 데이터를 초기화합니다.');
      // 백업 시도
      try {
        const backupKey = QUESTIONS_KEY + '_backup_' + Date.now();
        localStorage.setItem(backupKey, data);
        console.log(`⚠️ 손상된 데이터를 ${backupKey}에 백업했습니다.`);
      } catch (e) {
        console.error('백업 저장 실패:', e);
      }
      return [];
    }
    
    // 최신 문제가 맨 위로 오도록 ID 내림차순 정렬
    return questions.sort((a: Question, b: Question) => b.id - a.id);
  } catch (error) {
    console.error('❌ 문제 데이터 읽기 실패:', error);
    // 백업 시도
    try {
      const data = localStorage.getItem(QUESTIONS_KEY);
      if (data) {
        const backupKey = QUESTIONS_KEY + '_backup_' + Date.now();
        localStorage.setItem(backupKey, data);
        console.log(`⚠️ 손상된 데이터를 ${backupKey}에 백업했습니다.`);
      }
    } catch (e) {
      console.error('백업 저장 실패:', e);
    }
    return [];
  }
}

export function saveQuestions(questions: Question[]): void {
  try {
    // 데이터 유효성 검사
    if (!Array.isArray(questions)) {
      throw new Error('저장할 데이터가 배열이 아닙니다.');
    }

    // 큰 base64 이미지 제거 또는 압축 (저장 공간 절약)
    let removedCount = 0;
    const processedQuestions = questions.map(q => {
      if (q.imageUrl && q.imageUrl.startsWith('data:image')) {
        // base64 이미지인 경우 크기 확인
        const base64Size = (q.imageUrl.length * 3) / 4; // base64는 약 33% 더 큼
        const maxSize = 80 * 1024; // 80KB (압축된 이미지는 50KB 이하여야 함)

        if (base64Size > maxSize) {
          console.warn(`문제 ID ${q.id}: 이미지가 너무 큽니다 (${(base64Size / 1024).toFixed(1)}KB). 이미지를 제거합니다.`);
          removedCount++;
          // 이미지 URL 제거 (hasImage는 유지하여 공간은 확보)
          return { ...q, imageUrl: '' };
        }
      }
      return q;
    });

    if (removedCount > 0) {
      console.warn(`⚠️ ${removedCount}개 문제의 이미지가 너무 커서 제거되었습니다. (80KB 이상)`);
    }

    // 저장 전 용량 체크
    const capacityCheck = checkStorageCapacity(processedQuestions);
    let finalQuestions = processedQuestions;

    if (capacityCheck.warning) {
      console.warn(capacityCheck.warning);
      if (!capacityCheck.canSave) {
        // 저장 불가능한 경우 이미지 모두 제거하고 재시도
        const questionsWithoutImages = processedQuestions.map(q => ({ ...q, imageUrl: '' }));
        const recheckCapacity = checkStorageCapacity(questionsWithoutImages);
        if (!recheckCapacity.canSave) {
          throw new Error('저장 공간이 심각하게 부족합니다. 문제를 줄여주세요.');
        }
        console.log('⚠️ 용량 부족으로 모든 이미지를 제거하고 저장합니다.');
        alert('⚠️ 저장 공간 부족으로 모든 이미지를 제거하고 저장합니다.\n\n더 많은 데이터를 저장하려면 불필요한 문제를 삭제해주세요.');
        // 이미지 없는 버전으로 계속 진행
        finalQuestions = questionsWithoutImages;
      }
    }
    
    // 기존 데이터 백업 (안전장치)
    try {
      const existingData = localStorage.getItem(QUESTIONS_KEY);
      if (existingData) {
        const backupKey = QUESTIONS_KEY + '_backup_' + Date.now();
        localStorage.setItem(backupKey, existingData);
        // 백업이 너무 많아지면 오래된 것 삭제 (최근 5개만 유지)
        const backupKeys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(QUESTIONS_KEY + '_backup_')) {
            backupKeys.push(key);
          }
        }
        if (backupKeys.length > 5) {
          backupKeys.sort().slice(0, backupKeys.length - 5).forEach(key => {
            localStorage.removeItem(key);
          });
        }
      }
    } catch (e) {
      console.warn('백업 생성 실패 (계속 진행):', e);
    }
    
    const jsonData = JSON.stringify(finalQuestions);
    localStorage.setItem(QUESTIONS_KEY, jsonData);
    console.log(`✅ ${finalQuestions.length}개 문제 저장 완료`);
  } catch (error) {
    console.error('❌ 문제 데이터 저장 실패:', error);

    // QuotaExceededError 처리
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.error('저장 공간 부족 - 자동 복구 시도');

      // 1차 시도: 모든 이미지 제거하고 저장
      try {
        const questionsWithoutImages = questions.map(q => ({ ...q, imageUrl: '' }));
        const jsonData = JSON.stringify(questionsWithoutImages);

        // 백업 삭제를 통한 공간 확보
        const backupKeys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(QUESTIONS_KEY + '_backup_')) {
            backupKeys.push(key);
          }
        }
        backupKeys.forEach(key => localStorage.removeItem(key));
        console.log(`🗑️ ${backupKeys.length}개 백업 파일 삭제로 공간 확보`);

        // 재시도
        localStorage.setItem(QUESTIONS_KEY, jsonData);

        const usage = getLocalStorageUsage();
        alert(`⚠️ 저장 공간이 부족하여 모든 이미지를 제거하고 저장했습니다.\n\n현재 사용량: ${usage.percentage.toFixed(1)}%\n\n더 많은 이미지를 추가하려면:\n1. 관리자 페이지 > 출제 설정에서 저장 공간 확인\n2. 불필요한 문제 삭제\n3. 이미지는 최대 50KB로 압축하여 사용`);
        console.log(`✅ ${questionsWithoutImages.length}개 문제 저장 완료 (이미지 자동 제거됨)`);
        return;
      } catch (e) {
        console.error('이미지 제거 후에도 저장 실패:', e);
        const usage = getLocalStorageUsage();
        alert(`❌ 저장 공간이 심각하게 부족합니다.\n\n현재 사용량: ${usage.percentage.toFixed(1)}%\n문제 개수: ${questions.length}개\n\n해결 방법:\n1. 브라우저 설정에서 사이트 데이터 삭제\n2. 관리자 페이지에서 불필요한 문제 삭제\n3. Google Sheets에 백업 후 로컬 데이터 정리\n4. 다른 브라우저 사용 시도`);
        throw e;
      }
    }
    // SecurityError 처리 (프라이빗 모드 등)
    else if (error instanceof Error && error.name === 'SecurityError') {
      console.error('보안 오류로 인한 저장 실패');
      alert('❌ 저장이 차단되었습니다.\n\n가능한 원인:\n1. 브라우저가 프라이빗/시크릿 모드인 경우\n2. 브라우저 설정에서 쿠키/저장소가 차단된 경우\n\n해결 방법:\n1. 일반 모드로 전환\n2. 브라우저 설정에서 저장소 허용');
      throw error;
    }
    // 기타 오류
    else {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      console.error('저장 실패 상세:', errorMessage);
      alert(`❌ 데이터 저장에 실패했습니다.\n\n오류: ${errorMessage}\n\n해결 방법:\n1. 페이지 새로고침 후 재시도\n2. 브라우저 콘솔(F12)에서 오류 확인\n3. 문제가 계속되면 브라우저 캐시 삭제`);
      throw error;
    }
  }
}

export function addQuestion(question: Omit<Question, 'id'>): Question {
  const questions = getQuestions();
  
  // 중복 방지를 위해 사용 중인 ID 확인
  const usedIds = new Set(questions.map(q => q.id));
  
  // 1000-1999 범위에서 사용 가능한 ID 찾기
  let newId: number | null = null;
  
  // 1000부터 시작해서 사용 가능한 ID 찾기
  for (let i = 1000; i <= 1999; i++) {
    if (!usedIds.has(i)) {
      newId = i;
      break;
    }
  }
  
  // 1000-1999 범위가 모두 사용 중이면 2000 이상 사용
  if (newId === null) {
    const maxId = questions.length > 0 ? Math.max(...questions.map(q => q.id)) : 999;
    newId = maxId + 1;
    console.warn(`⚠️ 1000-1999 범위가 모두 사용 중입니다. ID ${newId}를 사용합니다.`);
  }
  
  // 중복 체크 (안전장치)
  if (usedIds.has(newId)) {
    throw new Error(`ID ${newId}는 이미 사용 중입니다. ID 생성에 실패했습니다.`);
  }
  
  const newQuestion: Question = { ...question, id: newId };
  questions.push(newQuestion);
  // 최신 문제가 맨 위로 오도록 ID 내림차순 정렬
  questions.sort((a, b) => b.id - a.id);
  saveQuestions(questions);
  console.log(`✅ 문제 추가 완료: ID ${newId}`);
  return newQuestion;
}

export function updateQuestion(question: Question): void {
  const questions = getQuestions();
  const index = questions.findIndex(q => q.id === question.id);
  if (index !== -1) {
    questions[index] = question;
    // 최신 문제가 맨 위로 오도록 ID 내림차순 정렬
    questions.sort((a, b) => b.id - a.id);
    saveQuestions(questions);
  }
}

export function deleteQuestion(id: number): void {
  const questions = getQuestions();
  const filtered = questions.filter(q => q.id !== id);
  saveQuestions(filtered);
}

export function getQuestionById(id: number): Question | null {
  const questions = getQuestions();
  return questions.find(q => q.id === id) || null;
}

export function getQuestionsByCategory(category: string): Question[] {
  const questions = getQuestions();
  return questions.filter(q => q.category === category);
}

// ========== 회원 (Member) 관리 ==========

export function getMembers(): Member[] {
  try {
    const data = localStorage.getItem(MEMBERS_KEY);
    if (!data) {
      console.log('⚠️ 회원 데이터가 없습니다. 초기화를 시도합니다.');
      // 초기 회원 데이터가 없으면 초기화
      if (initialMembers && initialMembers.length > 0) {
        const members: Member[] = initialMembers.map((m, idx) => ({
          ...m,
          id: idx + 1,
          registeredAt: Date.now(),
        }));
        saveMembers(members);
        console.log('✅ 초기 회원 데이터 복원 완료');
        return members;
      }
      return [];
    }
    
    const members = JSON.parse(data);
    
    // 데이터 유효성 검사
    if (!Array.isArray(members)) {
      console.error('❌ 회원 데이터가 배열이 아닙니다.');
      return [];
    }
    
    return members;
  } catch (error) {
    console.error('❌ 회원 데이터 읽기 실패:', error);
    return [];
  }
}

export function saveMembers(members: Member[]): void {
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
}

export function addMember(member: Omit<Member, 'id' | 'registeredAt'>): Member {
  const members = getMembers();
  
  // 이름 중복 체크 (공백 제거 및 대소문자 구분 없이)
  const normalizedName = member.name.trim().toLowerCase();
  const existingMember = members.find(m => m.name.trim().toLowerCase() === normalizedName);
  if (existingMember) {
    throw new Error(`이미 등록된 이름입니다: ${member.name}`);
  }
  
  const newId = members.length > 0 ? Math.max(...members.map(m => m.id)) + 1 : 1;
  const newMember: Member = {
    ...member,
    name: member.name.trim(), // 이름 앞뒤 공백 제거
    id: newId,
    registeredAt: Date.now(),
  };
  members.push(newMember);
  saveMembers(members);
  console.log(`✅ 회원 추가 완료: ${newMember.name} (ID: ${newId})`);
  return newMember;
}

export function updateMember(member: Member): void {
  const members = getMembers();
  const index = members.findIndex(m => m.id === member.id);
  if (index !== -1) {
    members[index] = member;
    saveMembers(members);
  }
}

export function deleteMember(id: number): void {
  const members = getMembers();
  const filtered = members.filter(m => m.id !== id);
  saveMembers(filtered);
}

export function getMemberById(id: number): Member | null {
  const members = getMembers();
  return members.find(m => m.id === id) || null;
}

/**
 * 이름, 전화번호, 이메일로 회원 찾기
 */
export function getMemberByCredentials(name: string, phone: string, email: string): Member | null {
  try {
    const members = getMembers();
    
    if (members.length === 0) {
      console.warn('⚠️ 등록된 회원이 없습니다.');
      return null;
    }
    
    // 입력값 정규화
    const normalizedName = name.trim().toLowerCase().replace(/\s+/g, ' ');
    const normalizedPhone = phone.trim().replace(/[-\s]/g, ''); // 하이픈과 공백 제거
    const normalizedEmail = email.trim().toLowerCase();
    
    console.log('🔍 로그인 시도:', { name: normalizedName, phone: normalizedPhone, email: normalizedEmail });
    
    // 이름, 전화번호, 이메일이 모두 일치하는 회원 찾기
    const member = members.find(m => {
      const memberName = m.name.trim().toLowerCase().replace(/\s+/g, ' ');
      const memberPhone = m.phone.trim().replace(/[-\s]/g, '');
      const memberEmail = (m.email || '').trim().toLowerCase();
      
      const nameMatch = memberName === normalizedName;
      const phoneMatch = memberPhone === normalizedPhone;
      const emailMatch = normalizedEmail && memberEmail ? memberEmail === normalizedEmail : true; // 이메일이 없으면 무시
      
      // 이름과 전화번호는 필수, 이메일은 선택
      return nameMatch && phoneMatch && (normalizedEmail === '' || emailMatch);
    });
    
    if (member) {
      console.log('✅ 로그인 성공:', member.name);
    } else {
      console.log('❌ 일치하는 회원을 찾을 수 없습니다.');
    }
    
    return member || null;
  } catch (error) {
    console.error('❌ 회원 검색 오류:', error);
    return null;
  }
}

/**
 * 하나의 입력값으로 이름/전화번호/이메일 중 하나라도 일치하는 회원 찾기
 */
export function getMemberByAnyCredential(input: string): Member | null {
  try {
    const members = getMembers();
    
    if (members.length === 0) {
      console.warn('⚠️ 등록된 회원이 없습니다.');
      return null;
    }
    
    if (!input || !input.trim()) {
      return null;
    }
    
    // 입력값 정규화
    const normalizedInput = input.trim();
    const normalizedInputLower = normalizedInput.toLowerCase();
    const normalizedInputPhone = normalizedInput.replace(/[-\s]/g, ''); // 전화번호용 (하이픈/공백 제거)
    const normalizedInputName = normalizedInputLower.replace(/\s+/g, ' '); // 이름용 (공백 정규화)
    
    console.log('🔍 유연한 로그인 시도:', { input: normalizedInput });
    
    // 이름, 전화번호, 이메일 중 하나라도 일치하는 회원 찾기
    const member = members.find(m => {
      const memberName = m.name.trim().toLowerCase().replace(/\s+/g, ' ');
      const memberPhone = m.phone.trim().replace(/[-\s]/g, '');
      const memberEmail = (m.email || '').trim().toLowerCase();
      
      // 이름 매칭
      const nameMatch = memberName === normalizedInputName;
      
      // 전화번호 매칭 (하이픈/공백 제거 후 비교)
      const phoneMatch = memberPhone === normalizedInputPhone;
      
      // 이메일 매칭
      const emailMatch = memberEmail && normalizedInputLower === memberEmail;
      
      return nameMatch || phoneMatch || emailMatch;
    });
    
    if (member) {
      console.log('✅ 로그인 성공:', member.name, '(매칭 방식: 이름/전화번호/이메일)');
    } else {
      console.log('❌ 일치하는 회원을 찾을 수 없습니다.');
    }
    
    return member || null;
  } catch (error) {
    console.error('❌ 회원 검색 오류:', error);
    return null;
  }
}

export function getMemberByName(name: string): Member | null {
  try {
    const members = getMembers();
    
    if (members.length === 0) {
      console.warn('⚠️ 등록된 회원이 없습니다.');
      return null;
    }
    
    // 이름 비교 시 공백 제거 및 대소문자 구분 없이 비교
    const normalizedName = name.trim().toLowerCase().replace(/\s+/g, ' '); // 연속 공백을 하나로
    console.log('🔍 검색 이름 (정규화):', normalizedName);
    console.log('📋 등록된 회원 수:', members.length);
    
    const member = members.find(m => {
      const memberName = m.name.trim().toLowerCase().replace(/\s+/g, ' ');
      const match = memberName === normalizedName;
      if (match) {
        console.log('✅ 매칭 성공:', m.name, '→', normalizedName);
      }
      return match;
    });
    
    if (!member) {
      // 디버깅: 모든 회원 이름 출력
      console.log('📋 등록된 회원 목록:', members.map(m => `"${m.name}"`));
      console.log('❌ 매칭 실패. 입력:', `"${name}"`, '→ 정규화:', `"${normalizedName}"`);
    }
    
    return member || null;
  } catch (error) {
    console.error('❌ 회원 검색 실패:', error);
    return null;
  }
}

// ========== 현재 사용자 관리 ==========

export function getCurrentUser(): number | null {
  const data = localStorage.getItem(CURRENT_USER_KEY);
  return data ? parseInt(data) : null;
}

export function setCurrentUser(userId: number | null): void {
  if (userId === null) {
    localStorage.removeItem(CURRENT_USER_KEY);
  } else {
    localStorage.setItem(CURRENT_USER_KEY, userId.toString());
  }
}

export function logout(): void {
  setCurrentUser(null);
}

// ========== 오답 노트 (WrongAnswer) 관리 - 스마트 시스템 ==========

export function getWrongAnswers(): WrongAnswer[] {
  const data = localStorage.getItem(WRONG_ANSWERS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveWrongAnswers(wrongAnswers: WrongAnswer[]): void {
  localStorage.setItem(WRONG_ANSWERS_KEY, JSON.stringify(wrongAnswers));
}

/**
 * 오답 추가 (스마트 로직)
 * - 문제를 틀렸을 때: wrongCount++, correctStreak = 0
 */
export function addWrongAnswer(wrongAnswer: WrongAnswer): void {
  console.log('💾 addWrongAnswer 호출:', wrongAnswer);
  const wrongAnswers = getWrongAnswers();
  console.log('📋 기존 오답 수:', wrongAnswers.length);
  const existingIndex = wrongAnswers.findIndex(wa => wa.questionId === wrongAnswer.questionId);

  if (existingIndex !== -1) {
    // 기존 오답: wrongCount 증가, correctStreak 리셋
    console.log(`🔄 기존 오답 업데이트: 문제 ${wrongAnswer.questionId} (${wrongAnswer.question.category})`);
    wrongAnswers[existingIndex] = {
      ...wrongAnswer,
      wrongCount: wrongAnswers[existingIndex].wrongCount + 1,
      correctStreak: 0,
      timestamp: Date.now(),
    };
  } else {
    // 새 오답: wrongCount=1, correctStreak=0
    console.log(`➕ 새 오답 추가: 문제 ${wrongAnswer.questionId} (${wrongAnswer.question.category})`);
    wrongAnswers.push({
      ...wrongAnswer,
      wrongCount: 1,
      correctStreak: 0,
      timestamp: Date.now(),
    });
  }

  saveWrongAnswers(wrongAnswers);
  console.log('💾 오답 저장 완료 - 저장된 오답 수:', wrongAnswers.length);
  console.log('💾 저장된 오답 목록:', wrongAnswers.map(wa => `문제 ${wa.questionId} (${wa.question.category})`));
}

/**
 * 정답 처리 (스마트 로직)
 * - 문제를 맞았을 때: correctStreak++
 * - correctStreak >= 3: 오답노트에서 자동 제거
 */
export function updateCorrectAnswer(questionId: number): void {
  const wrongAnswers = getWrongAnswers();
  const existingIndex = wrongAnswers.findIndex(wa => wa.questionId === questionId);

  if (existingIndex !== -1) {
    // correctStreak 증가
    wrongAnswers[existingIndex].correctStreak += 1;

    // 연속 3회 정답 시 제거
    if (wrongAnswers[existingIndex].correctStreak >= 3) {
      wrongAnswers.splice(existingIndex, 1);
      console.log(`✅ 문제 ${questionId} - 연속 3회 정답으로 오답노트에서 제거`);
    }

    saveWrongAnswers(wrongAnswers);
  }
}

export function removeWrongAnswer(questionId: number): void {
  console.log(`🗑️ removeWrongAnswer 호출: 문제 ${questionId}`);
  const wrongAnswers = getWrongAnswers();
  console.log(`📋 제거 전 오답 수: ${wrongAnswers.length}`);
  console.log(`📋 제거 전 오답 목록:`, wrongAnswers.map(wa => wa.questionId));
  
  const beforeCount = wrongAnswers.length;
  const filtered = wrongAnswers.filter(wa => wa.questionId !== questionId);
  const afterCount = filtered.length;
  
  console.log(`📋 제거 후 오답 수: ${afterCount}`);
  console.log(`📋 제거된 문제: ${beforeCount - afterCount}개`);
  
  if (beforeCount === afterCount) {
    console.log(`⚠️ 문제 ${questionId}가 오답노트에 없습니다.`);
  } else {
    console.log(`✅ 문제 ${questionId}가 오답노트에서 제거되었습니다.`);
  }
  
  saveWrongAnswers(filtered);
  console.log(`💾 오답노트 저장 완료`);
}

export function clearWrongAnswers(): void {
  saveWrongAnswers([]);
}

// ========== 시험 세션 (ExamSession) 관리 ==========

export function getCurrentExamSession(): ExamSession | null {
  const data = localStorage.getItem(CURRENT_EXAM_SESSION_KEY);
  return data ? JSON.parse(data) : null;
}

export function saveCurrentExamSession(session: ExamSession): void {
  try {
    // 세션 저장 시 이미지 제거 (용량 절약)
    // 문제 데이터는 ID로 나중에 다시 조회할 수 있으므로 이미지는 제거
    const sessionWithoutImages: ExamSession = {
      ...session,
      questions: session.questions.map(q => ({
        ...q,
        imageUrl: '' // 이미지 URL 제거
      }))
    };

    const jsonData = JSON.stringify(sessionWithoutImages);

    // 용량 체크 (세션은 중요하므로 크기 제한)
    const sessionSizeKB = jsonData.length / 1024;
    if (sessionSizeKB > 500) {
      console.warn(`⚠️ 시험 세션 크기가 큽니다: ${sessionSizeKB.toFixed(1)}KB`);
      // 500KB 이상이면 추가로 불필요한 데이터 제거
      const minimalSession: ExamSession = {
        questions: session.questions.map(q => ({
          id: q.id,
          category: q.category,
          question: q.question,
          option1: q.option1,
          option2: q.option2,
          option3: q.option3,
          option4: q.option4,
          answer: q.answer,
          explanation: q.explanation,
          imageUrl: '',
          hasImage: q.hasImage
        } as Question)),
        answers: session.answers,
        startTime: session.startTime,
        mode: session.mode,
        category: session.category,
        userId: session.userId
      };
      localStorage.setItem(CURRENT_EXAM_SESSION_KEY, JSON.stringify(minimalSession));
      console.log('✅ 최소화된 세션 저장 완료');
    } else {
      localStorage.setItem(CURRENT_EXAM_SESSION_KEY, jsonData);
      console.log(`✅ 시험 세션 저장 완료: ${sessionSizeKB.toFixed(1)}KB`);
    }
  } catch (error) {
    console.error('❌ 시험 세션 저장 실패:', error);

    if (error instanceof Error && error.name === 'QuotaExceededError') {
      // 저장 공간 부족 시 최소 데이터만 저장
      try {
        const minimalSession: ExamSession = {
          questions: session.questions.map(q => ({
            id: q.id,
            category: q.category,
            question: q.question,
            option1: q.option1,
            option2: q.option2,
            option3: q.option3,
            option4: q.option4,
            answer: q.answer,
            explanation: q.explanation,
            imageUrl: ''
          } as Question)),
          answers: session.answers,
          startTime: session.startTime,
          mode: session.mode,
          category: session.category
        };
        localStorage.setItem(CURRENT_EXAM_SESSION_KEY, JSON.stringify(minimalSession));
        console.log('⚠️ 최소 데이터로 세션 저장 완료');
      } catch (e) {
        console.error('최소 세션 저장도 실패:', e);
        throw new Error('시험을 시작할 수 없습니다. 저장 공간이 부족합니다.\n\n관리자 페이지에서 불필요한 데이터를 삭제해주세요.');
      }
    } else {
      throw error;
    }
  }
}

export function clearCurrentExamSession(): void {
  localStorage.removeItem(CURRENT_EXAM_SESSION_KEY);
}

// ========== 전역 문제 이해도 (Global Learning Progress) 관리 ==========

/**
 * 전역 문제 이해도 불러오기
 * 문제 ID를 키로 하는 객체: { [questionId]: progress }
 */
export function getGlobalLearningProgress(): { [questionId: number]: number } {
  const data = localStorage.getItem(GLOBAL_LEARNING_PROGRESS_KEY);
  return data ? JSON.parse(data) : {};
}

/**
 * 전역 문제 이해도 저장
 */
export function saveGlobalLearningProgress(progress: { [questionId: number]: number }): void {
  try {
    localStorage.setItem(GLOBAL_LEARNING_PROGRESS_KEY, JSON.stringify(progress));
  } catch (error) {
    console.error('❌ 전역 문제 이해도 저장 실패:', error);
  }
}

/**
 * 특정 문제의 이해도 업데이트
 */
export function updateGlobalLearningProgress(questionId: number, progress: number): void {
  const currentProgress = getGlobalLearningProgress();
  currentProgress[questionId] = progress;
  saveGlobalLearningProgress(currentProgress);
}

/**
 * 복습 모드 문제 가져오기
 * 학습 진도 1-5만 포함 (완벽 이해 6 제외)
 * 각 영역별 20문제씩 총 60문제 랜덤 출제
 */
export function getReviewQuestions(): Question[] {
  const allQuestions = getQuestions();
  const globalProgress = getGlobalLearningProgress();
  
  // 학습 진도 1-5만 필터링 (6 제외)
  const eligibleQuestions = allQuestions.filter(q => {
    const progress = globalProgress[q.id];
    // 학습 진도가 있고, 완벽 이해(6)가 아닌 문제만 포함
    return progress !== undefined && progress !== 6;
  });
  
  // 카테고리별로 20문제씩 선택
  const categories = ['전기이론', '전기기기', '전기설비'];
  const selectedQuestions: Question[] = [];
  
  categories.forEach(category => {
    const categoryQuestions = eligibleQuestions
      .filter(q => q.category === category)
      .sort(() => Math.random() - 0.5) // 랜덤 섞기
      .slice(0, 20); // 각 카테고리에서 최대 20문제
    
    selectedQuestions.push(...categoryQuestions);
  });
  
  console.log(`📚 복습 모드: 학습 진도 1-5 문제 중 ${selectedQuestions.length}문제 선택`);
  console.log(`   - 전기이론: ${selectedQuestions.filter(q => q.category === '전기이론').length}문제`);
  console.log(`   - 전기기기: ${selectedQuestions.filter(q => q.category === '전기기기').length}문제`);
  console.log(`   - 전기설비: ${selectedQuestions.filter(q => q.category === '전기설비').length}문제`);
  
  return selectedQuestions;
}

// ========== 시험 결과 (ExamResult) 관리 ==========

export function getExamResults(): ExamResult[] {
  const data = localStorage.getItem(EXAM_RESULTS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveExamResults(results: ExamResult[]): void {
  localStorage.setItem(EXAM_RESULTS_KEY, JSON.stringify(results));
}

export function addExamResult(result: ExamResult): void {
  const results = getExamResults();
  results.push(result);
  saveExamResults(results);
}

export function clearExamResults(): void {
  saveExamResults([]);
}

// ========== 통계 (Statistics) 관리 ==========

export function getStatistics(): Statistics {
  const data = localStorage.getItem(STATISTICS_KEY);
  if (!data) {
    return {
      totalExams: 0,
      averageScore: 0,
      categoryStats: {},
      recentResults: [],
    };
  }

  try {
    const parsed = JSON.parse(data);
    // 안전한 기본값 보장
    return {
      totalExams: parsed?.totalExams || 0,
      averageScore: parsed?.averageScore || 0,
      categoryStats: parsed?.categoryStats || {},
      recentResults: parsed?.recentResults || [],
    };
  } catch (error) {
    console.error('통계 데이터 파싱 오류:', error);
    return {
      totalExams: 0,
      averageScore: 0,
      categoryStats: {},
      recentResults: [],
    };
  }
}

export function saveStatistics(stats: Statistics): void {
  localStorage.setItem(STATISTICS_KEY, JSON.stringify(stats));
}

/**
 * 통계 업데이트
 * - 시험 완료 시 호출
 * - 평균 점수, 카테고리별 통계, 최근 결과 업데이트
 */
export function updateStatistics(result: ExamResult): void {
  const stats = getStatistics();

  // 기본 통계 업데이트
  stats.totalExams += 1;

  // 평균 점수 계산
  const score = Math.round((result.correctAnswers / result.totalQuestions) * 100);
  stats.averageScore =
    stats.totalExams === 1
      ? score
      : Math.round((stats.averageScore * (stats.totalExams - 1) + score) / stats.totalExams);

  // 전체 문제 목록 사용 (있으면)
  const allQuestions = result.allQuestions || [];
  
  if (allQuestions.length > 0) {
    // 전체 문제를 카테고리별로 그룹화
    const categoryGroups: Record<string, Question[]> = {};
    allQuestions.forEach(q => {
      const category = q.category || '기타';
      if (!categoryGroups[category]) {
        categoryGroups[category] = [];
      }
      categoryGroups[category].push(q);
    });

    // 각 카테고리별 통계 업데이트
    Object.entries(categoryGroups).forEach(([category, questions]) => {
      if (!stats.categoryStats[category]) {
        stats.categoryStats[category] = { correct: 0, total: 0 };
      }

      // 해당 카테고리의 전체 문제 수 추가
      stats.categoryStats[category].total += questions.length;

      // 해당 카테고리의 오답 수 계산
      const wrongInCategory = result.wrongQuestions.filter(q => q.category === category).length;
      
      // 해당 카테고리의 정답 수 계산 (전체 - 오답)
      const correctInCategory = questions.length - wrongInCategory;
      stats.categoryStats[category].correct += correctInCategory;
    });
  } else {
    // 전체 문제 목록이 없으면 오답 문제만 사용 (기존 로직)
    result.wrongQuestions.forEach(q => {
      const category = q.category || '기타';
      if (!stats.categoryStats[category]) {
        stats.categoryStats[category] = { correct: 0, total: 0 };
      }
      stats.categoryStats[category].total += 1;
    });
  }

  // 최근 결과 추가 (최대 10개)
  stats.recentResults.push(result);
  if (stats.recentResults.length > 10) {
    stats.recentResults.shift();
  }

  saveStatistics(stats);
  console.log('✅ 통계 업데이트 완료:', stats);
}

export function clearStatistics(): void {
  const stats: Statistics = {
    totalExams: 0,
    averageScore: 0,
    categoryStats: {},
    recentResults: [],
  };
  saveStatistics(stats);
}

// ========== 유틸리티 함수 ==========

/**
 * 모든 데이터 초기화 (개발용)
 */
export function clearAllData(): void {
  localStorage.clear();
  initializeData();
  console.log('✅ 모든 데이터 초기화 완료');
}

/**
 * 데이터 내보내기 (JSON)
 */
export function exportData(): string {
  const data = {
    questions: getQuestions(),
    members: getMembers(),
    wrongAnswers: getWrongAnswers(),
    examResults: getExamResults(),
    statistics: getStatistics(),
    feedbacks: getFeedbacks(),
  };
  return JSON.stringify(data, null, 2);
}

/**
 * 데이터 가져오기 (JSON)
 */
export function importData(jsonData: string): void {
  try {
    const data = JSON.parse(jsonData);
    if (data.questions) saveQuestions(data.questions);
    if (data.members) saveMembers(data.members);
    if (data.wrongAnswers) saveWrongAnswers(data.wrongAnswers);
    if (data.examResults) saveExamResults(data.examResults);
    if (data.statistics) saveStatistics(data.statistics);
    if (data.feedbacks) saveFeedbacks(data.feedbacks);
    console.log('✅ 데이터 가져오기 완료');
  } catch (error) {
    console.error('❌ 데이터 가져오기 실패:', error);
    throw new Error('잘못된 JSON 형식입니다.');
  }
}

// ========== 피드백 (Feedback) 관리 ==========

export function getFeedbacks(): Feedback[] {
  try {
    const data = localStorage.getItem(FEEDBACKS_KEY);
    if (!data) {
      return [];
    }
    
    const feedbacks = JSON.parse(data);
    
    // 데이터 유효성 검사
    if (!Array.isArray(feedbacks)) {
      console.error('❌ 피드백 데이터가 배열이 아닙니다.');
      return [];
    }
    
    // 최신 피드백이 맨 위로 오도록 시간 내림차순 정렬
    return feedbacks.sort((a: Feedback, b: Feedback) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('❌ 피드백 데이터 읽기 실패:', error);
    return [];
  }
}

export function saveFeedbacks(feedbacks: Feedback[]): void {
  try {
    // 데이터 유효성 검사
    if (!Array.isArray(feedbacks)) {
      throw new Error('저장할 데이터가 배열이 아닙니다.');
    }
    
    const jsonData = JSON.stringify(feedbacks);
    localStorage.setItem(FEEDBACKS_KEY, jsonData);
    console.log(`✅ ${feedbacks.length}개 피드백 저장 완료`);
  } catch (error) {
    console.error('❌ 피드백 데이터 저장 실패:', error);
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      alert('❌ 저장 공간이 부족합니다. 브라우저의 로컬 스토리지를 정리해주세요.');
    } else {
      alert('❌ 데이터 저장에 실패했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
    }
    throw error;
  }
}

export function addFeedback(feedback: Omit<Feedback, 'id' | 'timestamp'>): Feedback {
  const feedbacks = getFeedbacks();
  
  // ID 생성 (기존 ID 중 최대값 + 1)
  const maxId = feedbacks.length > 0 ? Math.max(...feedbacks.map(f => f.id)) : 0;
  const newId = maxId + 1;
  
  const newFeedback: Feedback = {
    ...feedback,
    id: newId,
    timestamp: Date.now(),
  };
  
  feedbacks.push(newFeedback);
  saveFeedbacks(feedbacks);
  console.log(`✅ 피드백 추가 완료: ID ${newId}`);
  return newFeedback;
}

export function deleteFeedback(id: number): void {
  const feedbacks = getFeedbacks();
  const filtered = feedbacks.filter(f => f.id !== id);
  saveFeedbacks(filtered);
  console.log(`✅ 피드백 삭제 완료: ID ${id}`);
}

// ========== 로그인 기록 관리 ==========

const LOGIN_HISTORY_KEY = 'loginHistory';

/**
 * 로그인 기록 저장 (모바일 환경 강화)
 */
export function addLoginHistory(userId: number, userName: string): boolean {
  try {
    console.log(`🔄 로그인 기록 저장 시도: ${userName} (ID: ${userId})`);

    // 1. 기존 기록 가져오기
    const history = getLoginHistory();
    console.log(`📊 현재 로그인 기록 수: ${history.length}개`);

    // 2. 새 기록 생성
    const newRecord: import('../types').LoginHistory = {
      id: Date.now(),
      userId,
      userName,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
    };

    // 3. 기록 추가
    history.push(newRecord);

    // 4. LocalStorage에 저장 (3번 재시도)
    let saveSuccess = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        localStorage.setItem(LOGIN_HISTORY_KEY, JSON.stringify(history));

        // 저장 확인
        const savedData = localStorage.getItem(LOGIN_HISTORY_KEY);
        if (savedData) {
          const savedHistory = JSON.parse(savedData);
          const isSaved = savedHistory.some((h: any) => h.id === newRecord.id);

          if (isSaved) {
            console.log(`✅ 로그인 기록 저장 성공 (시도 ${attempt}/3): ${userName} (ID: ${userId})`);
            console.log(`📊 저장된 기록 수: ${savedHistory.length}개`);
            saveSuccess = true;
            break;
          }
        }
      } catch (e) {
        console.warn(`⚠️ 로그인 기록 저장 실패 (시도 ${attempt}/3):`, e);
        if (attempt === 3) {
          throw e; // 마지막 시도에서도 실패하면 에러 발생
        }
      }
    }

    if (!saveSuccess) {
      throw new Error('로그인 기록 저장 확인 실패');
    }

    return true;
  } catch (error) {
    console.error('❌ 로그인 기록 저장 실패:', error);
    console.error('Error details:', {
      userId,
      userName,
      error: error instanceof Error ? error.message : String(error),
      userAgent: navigator.userAgent,
      localStorageAvailable: typeof localStorage !== 'undefined',
    });

    // 모바일 환경에서 사용자에게 알림 (선택적)
    if (typeof window !== 'undefined' && window.navigator.userAgent.includes('Mobile')) {
      console.warn('📱 모바일 환경에서 로그인 기록 저장 실패');
    }

    return false;
  }
}

/**
 * 로그인 기록 조회
 */
export function getLoginHistory(): import('../types').LoginHistory[] {
  try {
    const data = localStorage.getItem(LOGIN_HISTORY_KEY);
    if (!data) return [];
    const history = JSON.parse(data);
    // 최신 기록이 먼저 오도록 정렬
    return history.sort((a: import('../types').LoginHistory, b: import('../types').LoginHistory) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('❌ 로그인 기록 조회 실패:', error);
    return [];
  }
}

/**
 * 로그인 기록 삭제 (특정 기록)
 */
export function deleteLoginHistory(id: number): void {
  try {
    const history = getLoginHistory();
    const filtered = history.filter(h => h.id !== id);
    localStorage.setItem(LOGIN_HISTORY_KEY, JSON.stringify(filtered));
    console.log(`✅ 로그인 기록 삭제 완료: ID ${id}`);
  } catch (error) {
    console.error('❌ 로그인 기록 삭제 실패:', error);
  }
}

/**
 * 모든 로그인 기록 삭제
 */
export function clearLoginHistory(): void {
  try {
    localStorage.removeItem(LOGIN_HISTORY_KEY);
    console.log('✅ 모든 로그인 기록 삭제 완료');
  } catch (error) {
    console.error('❌ 로그인 기록 삭제 실패:', error);
  }
}

// ========== 데이터 백업 및 복원 (파일 기반) ==========

/**
 * 날짜를 YYYYMMDDHHMMSS 형식으로 포맷
 */
function formatDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

export interface BackupData {
  timestamp: number;
  name: string;
  version: string;
  data: {
    questions: Question[];
    members: Member[];
    wrongAnswers: WrongAnswer[];
    examResults: ExamResult[];
    statistics: Statistics;
    feedbacks: Feedback[];
  };
}

/**
 * 현재 모든 데이터를 파일로 다운로드
 */
export function downloadBackup(name?: string): void {
  try {
    const timestamp = Date.now();
    const dateStr = formatDateTime(new Date(timestamp));
    const backupName = name || `백업_${dateStr}`;

    const backup: BackupData = {
      timestamp,
      name: backupName,
      version: '1.0.0',
      data: {
        questions: getQuestions(),
        members: getMembers(),
        wrongAnswers: getWrongAnswers(),
        examResults: getExamResults(),
        statistics: getStatistics(),
        feedbacks: getFeedbacks(),
      },
    };

    // JSON 문자열 생성
    const jsonString = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // 다운로드 링크 생성 및 클릭
    const a = document.createElement('a');
    a.href = url;
    a.download = `cbt_backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`✅ 백업 파일 다운로드 완료: ${backupName}`);
    console.log(`📁 파일명: cbt_backup_${dateStr}.json`);
    console.log(`💡 이 파일을 D:\\cbtback 폴더에 저장하세요.`);
  } catch (error) {
    console.error('❌ 백업 파일 다운로드 실패:', error);
    throw new Error('백업 파일 다운로드에 실패했습니다.');
  }
}

/**
 * 백업 파일에서 데이터 복원
 */
export function restoreFromFile(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const jsonString = e.target?.result as string;
        const backup: BackupData = JSON.parse(jsonString);

        // 데이터 유효성 검증
        if (!backup.data) {
          throw new Error('유효하지 않은 백업 파일입니다.');
        }

        // 복원 전 현재 데이터 자동 백업
        downloadBackup('복원 전 자동 백업');

        // 데이터 복원
        if (backup.data.questions) saveQuestions(backup.data.questions);
        if (backup.data.members) saveMembers(backup.data.members);
        if (backup.data.wrongAnswers) saveWrongAnswers(backup.data.wrongAnswers);
        if (backup.data.examResults) saveExamResults(backup.data.examResults);
        if (backup.data.statistics) saveStatistics(backup.data.statistics);
        if (backup.data.feedbacks) saveFeedbacks(backup.data.feedbacks);

        console.log(`✅ 백업에서 복원 완료: ${backup.name}`);
        resolve();
      } catch (error) {
        console.error('❌ 백업 복원 실패:', error);
        reject(new Error('백업 파일을 읽는 중 오류가 발생했습니다.'));
      }
    };

    reader.onerror = () => {
      reject(new Error('파일을 읽을 수 없습니다.'));
    };

    reader.readAsText(file);
  });
}

/**
 * 모든 데이터 삭제 (백업 생성 후)
 */
export function deleteAllData(): void {
  try {
    // 삭제 전 자동 백업
    downloadBackup('전체 삭제 전 자동 백업');

    // 모든 데이터 삭제
    saveQuestions([]);
    saveMembers([]);
    saveWrongAnswers([]);
    saveExamResults([]);
    clearStatistics();
    saveFeedbacks([]);
    clearCurrentExamSession();
    setCurrentUser(null);

    console.log('✅ 모든 데이터 삭제 완료');
  } catch (error) {
    console.error('❌ 데이터 삭제 실패:', error);
    throw new Error('데이터 삭제에 실패했습니다.');
  }
}

/**
 * 브라우저 캐시 완전 삭제 (모바일/PC 모두 지원)
 */
export async function clearAllCaches(): Promise<void> {
  try {
    console.log('🧹 브라우저 캐시 삭제 시작...');

    // 1. LocalStorage 완전 삭제
    localStorage.clear();
    console.log('✅ LocalStorage 삭제 완료');

    // 2. SessionStorage 삭제
    sessionStorage.clear();
    console.log('✅ SessionStorage 삭제 완료');

    // 3. Cache API를 사용하여 모든 캐시 삭제 (Service Worker 캐시)
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => {
          console.log(`🗑️ 캐시 삭제: ${cacheName}`);
          return caches.delete(cacheName);
        })
      );
      console.log('✅ Cache API 삭제 완료');
    }

    // 4. IndexedDB 삭제 (사용 중이라면)
    if ('indexedDB' in window) {
      try {
        const databases = await indexedDB.databases();
        for (const db of databases) {
          if (db.name) {
            indexedDB.deleteDatabase(db.name);
            console.log(`🗑️ IndexedDB 삭제: ${db.name}`);
          }
        }
        console.log('✅ IndexedDB 삭제 완료');
      } catch (e) {
        console.log('ℹ️ IndexedDB 삭제 스킵 (지원되지 않음)');
      }
    }

    console.log('✅ 모든 브라우저 캐시 삭제 완료');
  } catch (error) {
    console.error('❌ 캐시 삭제 중 오류:', error);
    throw error;
  }
}

// ========== 서버 동기화 정보 관리 ==========

export interface LastServerSync {
  timestamp: number; // 마지막 동기화 시간
  questionCount: number; // 마지막 동기화 시 문제 개수
}

/**
 * 마지막 서버 동기화 정보 조회
 */
export function getLastServerSync(): LastServerSync | null {
  try {
    const data = localStorage.getItem(LAST_SERVER_SYNC_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ 마지막 동기화 정보 조회 실패:', error);
    return null;
  }
}

/**
 * 마지막 서버 동기화 정보 저장
 */
export function saveLastServerSync(questionCount: number): void {
  try {
    const syncInfo: LastServerSync = {
      timestamp: Date.now(),
      questionCount: questionCount,
    };
    localStorage.setItem(LAST_SERVER_SYNC_KEY, JSON.stringify(syncInfo));
    console.log(`✅ 서버 동기화 정보 저장: ${questionCount}개 문제, ${new Date(syncInfo.timestamp).toLocaleString()}`);
  } catch (error) {
    console.error('❌ 서버 동기화 정보 저장 실패:', error);
  }
}

/**
 * 서버 동기화가 필요한지 확인
 * @param localQuestionCount 현재 로컬 문제 개수
 * @param serverQuestionCount 서버 문제 개수
 * @returns 동기화 필요 여부
 */
export function needsServerSync(localQuestionCount: number, serverQuestionCount: number): boolean {
  // 문제 개수가 다르면 동기화 필요
  if (localQuestionCount !== serverQuestionCount) {
    console.log(`📊 문제 개수 차이 감지: 로컬 ${localQuestionCount}개 vs 서버 ${serverQuestionCount}개`);
    return true;
  }

  const lastSync = getLastServerSync();

  // 동기화 기록이 없으면 동기화 필요
  if (!lastSync) {
    console.log('📊 동기화 기록 없음 → 동기화 필요');
    return true;
  }

  // 마지막 동기화 이후 24시간 경과 시 동기화 필요
  const hoursSinceLastSync = (Date.now() - lastSync.timestamp) / (1000 * 60 * 60);
  if (hoursSinceLastSync >= 24) {
    console.log(`📊 마지막 동기화 후 ${hoursSinceLastSync.toFixed(1)}시간 경과 → 동기화 필요`);
    return true;
  }

  console.log(`✅ 동기화 불필요 (마지막 동기화: ${new Date(lastSync.timestamp).toLocaleString()})`);
  return false;
}
