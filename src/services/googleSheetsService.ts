/**
 * Google Sheets API 서비스
 * Google Apps Script 웹 앱과 통신
 */

const API_URL = import.meta.env.VITE_GOOGLE_SHEETS_API_URL;

export interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
  count?: number;
  // 한글 키 지원
  성공?: boolean;
  데이터?: T;
  오류?: string;
  메시지?: string;
  개수?: number;
}

/**
 * GET 요청
 */
async function apiGet(params: Record<string, string>): Promise<ApiResponse> {
  const url = new URL(API_URL);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const response = await fetch(url.toString());
  return await response.json();
}

/**
 * POST 요청
 */
async function apiPost(params: Record<string, string>, data: any): Promise<ApiResponse> {
  const url = new URL(API_URL);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  return await response.json();
}

// ==================== Questions ====================

/**
 * 카테고리를 시트 이름으로 변환
 * (현재 미사용 - 필요시 주석 해제)
 */
// function getCategorySheetName(category: string): string {
//   const sheetMap: Record<string, string> = {
//     '전기이론': '전기이론',
//     '전기기기': '전기기기',
//     '전기설비': '전기설비',
//     '주관식': '기타',
//     '기타': '기타',
//   };
//   return sheetMap[category] || '기타';
// }

/**
 * 서버의 문제 총 개수만 빠르게 확인 (효율적인 API 호출)
 * @returns 총 문제 개수
 */
export async function getQuestionsCountFromServer(): Promise<number> {
  try {
    const sheetNames = ['questions', '전기이론', '전기기기', '전기설비', '기타'];
    let totalCount = 0;

    console.log('📊 서버 문제 개수 확인 중...');

    for (const sheetName of sheetNames) {
      try {
        // getCount 액션이 서버에 구현되어 있다면 사용, 없으면 전체 데이터 가져와서 개수 세기
        const response = await apiGet({
          action: 'getCount',
          sheet: sheetName,
        });

        const success = response.success || response.성공;
        const count = response.count || response.개수;
        const data = response.data || response.데이터;

        if (success && count !== undefined) {
          // getCount 액션이 구현되어 있는 경우
          totalCount += count;
          console.log(`  📖 '${sheetName}': ${count}개`);
        } else if (data && Array.isArray(data)) {
          // getCount가 없으면 전체 데이터에서 개수만 세기
          const validCount = data.filter((row: any) => {
            const question = String(row.question || '').trim();
            return question && question.length > 0;
          }).length;
          totalCount += validCount;
          console.log(`  📖 '${sheetName}': ${validCount}개`);
        }
      } catch (error) {
        console.warn(`⚠️ '${sheetName}' 개수 확인 실패:`, error);
      }
    }

    console.log(`✅ 서버 총 문제 개수: ${totalCount}개`);
    return totalCount;
  } catch (error) {
    console.error('❌ 서버 문제 개수 확인 실패:', error);
    return 0;
  }
}

/**
 * 선택한 시트에서 문제 가져오기
 * Google Sheets 구조: questions, 전기이론, 전기기기, 전기설비, 기타 시트
 * @param selectedSheets 가져올 시트 목록 (기본값: 모든 시트)
 */
export async function getAllQuestionsFromSheets(selectedSheets?: string[]): Promise<any[]> {
  try {
    // 선택된 시트 목록 (없으면 모든 시트)
    const sheetNames = selectedSheets && selectedSheets.length > 0 
      ? selectedSheets 
      : ['questions', '전기이론', '전기기기', '전기설비', '기타'];
    
    const allQuestions: any[] = [];
    const seenIds = new Set<number>(); // 중복 ID 체크

    console.log(`📊 Google Sheets에서 ${sheetNames.length}개 시트 데이터 가져오기 시작...`);
    console.log(`   선택된 시트: ${sheetNames.join(', ')}`);

    // 각 시트에서 데이터 가져오기 (순차 처리 + 지연 시간)
    for (let i = 0; i < sheetNames.length; i++) {
      const sheetName = sheetNames[i];
      
      try {
        console.log(`  📖 '${sheetName}' 시트 읽기 중...`);
        
        const response = await apiGet({
          action: 'getAll',
          sheet: sheetName,
        });

        console.log(`  🔍 '${sheetName}' 응답:`, {
          success: response.success || response.성공,
          dataLength: (response.data || response.데이터)?.length || 0,
          error: response.error || response.오류
        });

        // 한글 키와 영문 키 모두 지원
        const success = response.success || response.성공;
        const data = response.data || response.데이터;
        const error = response.error || response.오류;

        if (!success) {
          console.warn(`  ⚠️ '${sheetName}' 시트: API 오류 -`, error);
          continue;
        }

        if (!data || !Array.isArray(data) || data.length === 0) {
          console.log(`  ℹ️ '${sheetName}' 시트: 데이터 없음 (length: ${data?.length || 0})`);
          continue;
        }

        console.log(`  📊 '${sheetName}' 원본 데이터: ${data.length}행`);

        // 데이터 정규화 및 ID 처리
        let duplicateCount = 0;
        let missingIdCount = 0;

        const questions = data.map((row: any, _idx: number) => {
          let id = typeof row.id === 'number' ? row.id : parseInt(row.id) || 0;
          
          // category가 없으면 시트 이름을 카테고리로 사용
          let category = String(row.category || '').trim();
          if (!category && sheetName !== 'questions') {
            category = sheetName;
          }
          
          // ID가 없거나 0이면 로컬에서 새로 부여할 수 있도록 0으로 유지
          // (로컬에서 받은 후 새로 부여)
          if (!id || id === 0) {
            id = 0; // ID가 없음을 표시
            missingIdCount++;
            console.log(`    ⚠️ ID 없음: 로컬에서 새로 부여 예정 (${sheetName})`);
          } else if (seenIds.has(id)) {
            // 중복 ID는 로컬에서 새로 부여할 수 있도록 0으로 설정
            const originalId = id;
            id = 0;
            duplicateCount++;
            console.log(`    🔄 중복 ID: ${originalId} → 로컬에서 새로 부여 예정 (${sheetName})`);
          } else {
            // 유효한 ID는 그대로 사용
            seenIds.add(id);
          }
          
          return {
            id: id, // ID가 없으면 0으로 설정 (로컬에서 새로 부여)
            category: category,
            question: String(row.question || '').trim(),
            option1: String(row.option1 || '').trim(),
            option2: String(row.option2 || '').trim(),
            option3: String(row.option3 || '').trim(),
            option4: String(row.option4 || '').trim(),
            answer: typeof row.answer === 'number' ? row.answer : parseInt(row.answer) || 1,
            explanation: String(row.explanation || '').trim(),
            imageUrl: String(row.imageUrl || '').trim(),
            standard: row.standard ? String(row.standard).trim() : undefined,
            detailItem: row.detailItem ? String(row.detailItem).trim() : undefined,
            weight: row.weights || row.weight ? parseInt(String(row.weights || row.weight)) : undefined,
            source: row.Source || row.source ? String(row.Source || row.source).trim() : undefined,
          };
        }).filter((q: any) => {
          // 유효한 문제만 필터링 (question이 있어야 함)
          return q.question && q.question.length > 0;
        });
        
        // ID가 없는 문제들에 대해 로컬에서 새로 부여
        // 로컬 Storage에서 기존 문제 가져오기
        const localStorageData = localStorage.getItem('questions');
        const localQuestions: any[] = localStorageData ? JSON.parse(localStorageData) : [];
        const usedIds = new Set(localQuestions.map((q: any) => q.id));
        usedIds.forEach((id: number) => seenIds.add(id)); // 로컬 ID도 중복 체크에 포함
        
        questions.forEach((q: any) => {
          if (!q.id || q.id === 0) {
            // 1000-1999 범위에서 사용 가능한 ID 찾기
            let newId: number | null = null;
            for (let i = 1000; i <= 1999; i++) {
              if (!seenIds.has(i)) {
                newId = i;
                break;
              }
            }
            
            // 1000-1999 범위가 모두 사용 중이면 2000번대 사용
            if (newId === null) {
              const maxId = Array.from(seenIds).length > 0 ? Math.max(...Array.from(seenIds) as number[]) : 999;
              newId = maxId + 1;
            }
            
            q.id = newId;
            seenIds.add(newId);
            console.log(`    ✅ 로컬에서 ID 부여: → ${newId} (${sheetName})`);
          }
        });

        allQuestions.push(...questions);
        console.log(`  ✅ '${sheetName}' 시트: ${questions.length}개 문제 추가됨 (필터링: ${data.length} → ${questions.length})`);
        if (missingIdCount > 0) {
          console.log(`    📝 ID 없음: ${missingIdCount}개 (로컬에서 새로 부여됨)`);
        }
        if (duplicateCount > 0) {
          console.log(`    🔄 중복 ID: ${duplicateCount}개 (로컬에서 새로 부여됨)`);
        }
        
        // API 제한 방지를 위한 지연 (마지막 시트는 제외)
        if (i < sheetNames.length - 1) {
          console.log(`  ⏳ 다음 시트 요청 전 0.5초 대기...`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (sheetError) {
        console.error(`  ❌ '${sheetName}' 시트 읽기 실패:`, sheetError);
        console.error(`     에러 상세:`, {
          message: sheetError instanceof Error ? sheetError.message : String(sheetError),
          stack: sheetError instanceof Error ? sheetError.stack : undefined
        });
      }
    }

    // 카테고리별 통계
    const categoryStats: Record<string, number> = {};
    allQuestions.forEach(q => {
      const cat = q.category || '미분류';
      categoryStats[cat] = (categoryStats[cat] || 0) + 1;
    });

    console.log(`\n✅ 총 ${allQuestions.length}개 문제를 Google Sheets에서 가져왔습니다`);
    console.log(`\n📊 카테고리별 문제 수:`);
    Object.entries(categoryStats).forEach(([category, count]) => {
      console.log(`   - ${category}: ${count}개`);
    });
    
    return allQuestions;
  } catch (error) {
    console.error('❌ Google Sheets에서 문제 가져오기 실패:', error);
    return [];
  }
}

/**
 * Google Sheets에서 카테고리별 문제 수만 가져오기
 * 각 시트별로 데이터를 가져와서 카테고리별로 카운트
 */
export async function getQuestionCountsFromSheets(): Promise<{
  전기이론: number;
  전기기기: number;
  전기설비: number;
  total: number;
}> {
  try {
    const sheetNames = ['전기이론', '전기기기', '전기설비'];
    const counts = {
      전기이론: 0,
      전기기기: 0,
      전기설비: 0,
      total: 0,
    };

    console.log('📊 Google Sheets에서 문제 수 조회 중...');

    // 각 시트별로 카운트 가져오기
    for (const sheetName of sheetNames) {
      try {
        const response = await apiGet({
          action: 'getAll',
          sheet: sheetName,
        });

        const success = response.success || response.성공;
        const data = response.data || response.데이터;

        if (success && data && Array.isArray(data)) {
          // 유효한 문제만 카운트 (question 필드가 있는 것만)
          const validCount = data.filter((row: any) => {
            const question = String(row.question || '').trim();
            return question && question.length > 0;
          }).length;

          if (sheetName === '전기이론') {
            counts.전기이론 = validCount;
          } else if (sheetName === '전기기기') {
            counts.전기기기 = validCount;
          } else if (sheetName === '전기설비') {
            counts.전기설비 = validCount;
          }

          console.log(`  ✅ ${sheetName}: ${validCount}개`);
        }
      } catch (error) {
        console.error(`  ❌ ${sheetName} 시트 카운트 실패:`, error);
      }
    }

    counts.total = counts.전기이론 + counts.전기기기 + counts.전기설비;
    console.log(`📊 총 문제 수: ${counts.total}개 (전기이론 ${counts.전기이론}개, 전기기기 ${counts.전기기기}개, 전기설비 ${counts.전기설비}개)`);

    return counts;
  } catch (error) {
    console.error('❌ Google Sheets에서 문제 수 조회 실패:', error);
    return {
      전기이론: 0,
      전기기기: 0,
      전기설비: 0,
      total: 0,
    };
  }
}

export async function addQuestionToSheets(question: any): Promise<any | null> {
  try {
    // 단일 'questions' 시트에 추가
    const response = await apiGet({
      action: 'add',
      sheet: 'questions',
      data: JSON.stringify(question)
    });

    // 한글 키와 영문 키 모두 지원
    const success = response.success || response.성공;
    const data = response.data || response.데이터;
    const error = response.error || response.오류;

    if (success) {
      console.log(`✅ 문제가 'questions' 시트에 추가되었습니다 (ID: ${data?.id || question.id})`);
      return data;
    } else {
      console.error('❌ 문제 추가 실패:', error);
      return null;
    }
  } catch (error) {
    console.error('❌ 문제 추가 중 오류:', error);
    return null;
  }
}

export async function updateQuestionInSheets(question: any): Promise<any | null> {
  try {
    // 단일 'questions' 시트에서 업데이트
    const response = await apiGet({
      action: 'update',
      sheet: 'questions',
      data: JSON.stringify(question)
    });

    // 한글 키와 영문 키 모두 지원
    const success = response.success || response.성공;
    const data = response.data || response.데이터;
    const error = response.error || response.오류;

    if (success) {
      console.log(`✅ 문제가 'questions' 시트에서 업데이트되었습니다 (ID: ${question.id})`);
      return data;
    } else {
      console.error('❌ 문제 업데이트 실패:', error);
      return null;
    }
  } catch (error) {
    console.error('❌ 문제 업데이트 중 오류:', error);
    return null;
  }
}

export async function deleteQuestionFromSheets(id: number): Promise<boolean> {
  try {
    // 단일 'questions' 시트에서 삭제
    const response = await apiGet({
      action: 'delete',
      sheet: 'questions',
      id: id.toString()
    });

    // 한글 키와 영문 키 모두 지원
    const success = response.success || response.성공;

    if (success) {
      console.log(`✅ 문제가 'questions' 시트에서 삭제되었습니다 (ID: ${id})`);
      return true;
    } else {
      console.warn(`⚠️ ID ${id}인 문제를 찾을 수 없습니다`);
      return false;
    }
  } catch (error) {
    console.error('❌ 문제 삭제 중 오류:', error);
    return false;
  }
}

export async function bulkAddQuestionsToSheets(questions: any[], selectedSheets?: string[]): Promise<boolean> {
  try {
    if (questions.length === 0) {
      console.warn('⚠️ 추가할 문제가 없습니다');
      return false;
    }

    // 선택된 시트 목록 (없으면 모든 시트)
    const targetSheets = selectedSheets && selectedSheets.length > 0 
      ? selectedSheets 
      : ['questions', '전기이론', '전기기기', '전기설비', '기타'];

    // 선택된 카테고리만 포함하도록 필터링
    const questionsByCategory: Record<string, any[]> = {};
    targetSheets.forEach(sheet => {
      if (sheet === 'questions' || ['전기이론', '전기기기', '전기설비', '기타'].includes(sheet)) {
        questionsByCategory[sheet] = [];
      }
    });

    // 데이터 정규화 및 카테고리별 분류
    const normalizedQuestions = questions.map((q: any) => {
      // 먼저 선택지를 문자열로 변환
      const options = [
        String(q.option1 || '').trim(),
        String(q.option2 || '').trim(),
        String(q.option3 || '').trim(),
        String(q.option4 || '').trim(),
      ];
      
      // answer를 숫자로 변환
      let answer = q.answer;
      
      // answer가 문자열인 경우 처리
      if (typeof answer === 'string') {
        const answerStr = answer.trim();
        
        // 숫자 문자열인 경우 ("1", "2", "3", "4")
        const numAnswer = parseInt(answerStr);
        if (!isNaN(numAnswer) && numAnswer >= 1 && numAnswer <= 4) {
          answer = numAnswer;
        } else {
          // 선택지 텍스트와 일치하는 경우 찾기 (더 유연한 매칭)
          let matchIndex = -1;
          
          // 1. 정확한 일치
          matchIndex = options.findIndex((opt) => opt === answerStr);
          
          // 2. 공백 제거 후 일치
          if (matchIndex === -1) {
            const normalizedAnswer = answerStr.replace(/\s+/g, '');
            matchIndex = options.findIndex((opt) => {
              const normalizedOpt = String(opt).replace(/\s+/g, '');
              return normalizedOpt === normalizedAnswer;
            });
          }
          
          // 3. 부분 일치 (포함 관계)
          if (matchIndex === -1) {
            const normalizedAnswer = answerStr.replace(/\s+/g, '');
            matchIndex = options.findIndex((opt) => {
              const optStr = String(opt);
              const normalizedOpt = optStr.replace(/\s+/g, '');
              return optStr && (
                optStr.includes(answerStr) || 
                answerStr.includes(optStr) ||
                normalizedOpt.includes(normalizedAnswer) ||
                normalizedAnswer.includes(normalizedOpt)
              );
            });
          }
          
          if (matchIndex >= 0) {
            answer = matchIndex + 1;
          } else {
            // 기본값: 1번 (경고 메시지 제거 - 너무 많이 출력됨)
            answer = 1;
          }
        }
      }
      
      // answer가 숫자가 아니면 1로 설정
      if (typeof answer !== 'number' || answer < 1 || answer > 4) {
        answer = 1;
      }
      
      // ID 처리: 로컬의 실제 ID를 그대로 Google Sheets에 전송
      const id = q.id || 0;
      
      return {
        id: id, // 숫자 그대로 전송
        category: String(q.category || '').trim(),
        question: String(q.question || '').trim(),
        option1: options[0],
        option2: options[1],
        option3: options[2],
        option4: options[3],
        answer: answer,
        explanation: String(q.explanation || '').trim(),
        imageUrl: String(q.imageUrl || '').trim(),
        standard: q.standard ? String(q.standard).trim() : undefined,
        detailItem: q.detailItem ? String(q.detailItem).trim() : undefined,
        weight: q.weight ? parseInt(String(q.weight)) : undefined,
        source: q.source ? String(q.source).trim() : undefined,
      };
    }).filter((q: any) => {
      // 유효한 문제만 필터링 (question이 있어야 함)
      return q.question && q.question.length > 0;
    });

    // 카테고리별로 문제 분류
    normalizedQuestions.forEach((q: any) => {
      const category = q.category || '기타';
      
      // 'questions' 시트가 선택되어 있으면 모든 문제를 'questions' 시트에 추가
      if (questionsByCategory['questions']) {
        questionsByCategory['questions'].push(q);
      }
      
      // 카테고리별 시트가 선택되어 있으면 해당 카테고리 시트에 추가
      if (questionsByCategory[category]) {
        questionsByCategory[category].push(q);
      } else if (questionsByCategory['기타'] && category !== '기타') {
        // 기타 시트가 선택되어 있고, 카테고리가 매칭되지 않으면 기타로 분류
        questionsByCategory['기타'].push(q);
      }
    });

    console.log(`\n📊 ${targetSheets.length}개 시트로 문제 업로드 시작...`);
    console.log(`   선택된 시트: ${targetSheets.join(', ')}`);
    Object.entries(questionsByCategory).forEach(([category, questions]) => {
      if (questions.length > 0) {
        console.log(`   - ${category}: ${questions.length}개`);
      }
    });

    const BATCH_SIZE = 2;
    let totalAdded = 0;

    // 각 카테고리별 시트에 업로드
    for (const [category, categoryQuestions] of Object.entries(questionsByCategory)) {
      if (categoryQuestions.length === 0) {
        console.log(`\n  ℹ️ '${category}' 시트: 업로드할 문제 없음`);
        continue;
      }

      console.log(`\n  📤 '${category}' 시트에 ${categoryQuestions.length}개 문제 업로드 중...`);

      for (let i = 0; i < categoryQuestions.length; i += BATCH_SIZE) {
        const batch = categoryQuestions.slice(i, i + BATCH_SIZE);

        // GET 요청 사용 (CORS 문제 회피)
        const response = await apiGet({
          action: 'bulkAdd',
          sheet: category,
          data: JSON.stringify(batch),
        });

        // 한글 키와 영문 키 모두 지원
        const success = response.success || response.성공;
        const count = response.count || response.개수;
        const error = response.error || response.오류;

        if (success) {
          totalAdded += count || batch.length;
          console.log(`    ✅ ${Math.min(i + BATCH_SIZE, categoryQuestions.length)}/${categoryQuestions.length} 문제 추가됨`);
        } else {
          console.error(`    ❌ 배치 ${i}-${Math.min(i + BATCH_SIZE, categoryQuestions.length)} 추가 실패:`, error);
          return false;
        }
        
        // 배치 간 지연 (API 제한 방지 및 안정성 향상)
        if (i + BATCH_SIZE < categoryQuestions.length) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
        }
      }

      console.log(`  ✅ '${category}' 시트: ${categoryQuestions.length}개 문제 업로드 완료`);
    }

    console.log(`\n✅ 총 ${totalAdded}개 문제가 카테고리별 시트에 추가되었습니다`);
    return true;
  } catch (error) {
    console.error('❌ 일괄 문제 추가 중 오류:', error);
    return false;
  }
}

// ==================== Users ====================

export async function getAllUsersFromSheets(): Promise<any[]> {
  try {
    const response = await apiGet({
      action: 'getAll',
      sheet: 'users',
    });

    // 한글 키와 영문 키 모두 지원
    const success = response.success || response.성공;
    const data = response.data || response.데이터;
    const error = response.error || response.오류;

    if (success) {
      return data || [];
    } else {
      console.error('Failed to get users:', error);
      return [];
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

export async function addUserToSheets(user: any): Promise<any | null> {
  try {
    // CORS 문제 우회를 위해 GET 요청 사용 (데이터를 JSON 문자열로 전달)
    const response = await apiGet({
      action: 'add',
      sheet: 'users',
      data: JSON.stringify(user)
    });

    // 한글 키와 영문 키 모두 지원
    const success = response.success || response.성공;
    const data = response.data || response.데이터;
    const error = response.error || response.오류;

    if (success) {
      return data;
    } else {
      console.error('Failed to add user:', error);
      return null;
    }
  } catch (error) {
    console.error('Error adding user:', error);
    return null;
  }
}

export async function updateUserInSheets(user: any): Promise<any | null> {
  try {
    // CORS 문제 우회를 위해 GET 요청 사용
    const response = await apiGet({
      action: 'update',
      sheet: 'users',
      data: JSON.stringify(user)
    });

    // 한글 키와 영문 키 모두 지원
    const success = response.success || response.성공;
    const data = response.data || response.데이터;
    const error = response.error || response.오류;

    if (success) {
      return data;
    } else {
      console.error('Failed to update user:', error);
      return null;
    }
  } catch (error) {
    console.error('Error updating user:', error);
    return null;
  }
}

export async function deleteUserFromSheets(id: string): Promise<boolean> {
  try {
    // CORS 문제 우회를 위해 GET 요청 사용
    const response = await apiGet({
      action: 'delete',
      sheet: 'users',
      id: id.toString()
    });

    // 한글 키와 영문 키 모두 지원
    const success = response.success || response.성공;
    return success || false;
  } catch (error) {
    console.error('Error deleting user:', error);
    return false;
  }
}

// ==================== Results ====================

export async function getAllResultsFromSheets(): Promise<any[]> {
  try {
    const response = await apiGet({
      action: 'getAll',
      sheet: 'results',
    });

    // 한글 키와 영문 키 모두 지원
    const success = response.success || response.성공;
    const data = response.data || response.데이터;
    const error = response.error || response.오류;

    if (success) {
      return data || [];
    } else {
      console.error('Failed to get results:', error);
      return [];
    }
  } catch (error) {
    console.error('Error fetching results:', error);
    return [];
  }
}

export async function addResultToSheets(result: any): Promise<any | null> {
  try {
    const response = await apiPost(
      {
        action: 'add',
        sheet: 'results',
      },
      result
    );

    // 한글 키와 영문 키 모두 지원
    const success = response.success || response.성공;
    const data = response.data || response.데이터;
    const error = response.error || response.오류;

    if (success) {
      return data;
    } else {
      console.error('Failed to add result:', error);
      return null;
    }
  } catch (error) {
    console.error('Error adding result:', error);
    return null;
  }
}
