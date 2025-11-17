// Supabase Service - 서버에서 직접 문제 가져오기
import { supabase } from './supabaseClient';
import type { Question, LoginHistory, Feedback } from '../types';

/**
 * 카테고리별 랜덤 문제 가져오기 (서버에서 직접 선택)
 */
export const fetchRandomQuestions = async (
  category: string,
  count: number
): Promise<Question[]> => {
  try {
    // PostgreSQL의 random() 함수를 사용하여 서버에서 랜덤 선택
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('category', category)
      .order('id') // random() 대신 일단 id로 정렬 후 클라이언트에서 섞기
      .limit(count * 3); // 여유있게 가져와서 클라이언트에서 랜덤 선택

    if (error) {
      console.error(`${category} 문제 조회 실패:`, error);
      return [];
    }

    if (!data || data.length === 0) {
      console.warn(`${category} 문제가 없습니다.`);
      return [];
    }

    // 클라이언트에서 랜덤 섞기
    const shuffled = data.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);

    // Supabase 형식을 로컬 형식으로 변환
    return selected.map(q => ({
      id: q.id,
      category: q.category,
      standard: q.standard || undefined,
      detailItem: q.detailItem || undefined,
      question: q.question,
      option1: q.option1,
      option2: q.option2,
      option3: q.option3,
      option4: q.option4,
      answer: q.answer,
      explanation: q.explanation,
      imageUrl: q.imageUrl || undefined,
      hasImage: q.hasImage || false,
      mustInclude: q.mustInclude || false,
      mustExclude: q.mustExclude || false,
      weight: q.weight || 5,
      source: q.source || undefined
    }));
  } catch (err) {
    console.error(`${category} 문제 조회 오류:`, err);
    return [];
  }
};

/**
 * 랜덤 60문제 가져오기 (카테고리별 20문제씩)
 */
export const fetchRandom60Questions = async (): Promise<Question[]> => {
  try {
    const [theoryQuestions, machineQuestions, facilityQuestions] = await Promise.all([
      fetchRandomQuestions('전기이론', 20),
      fetchRandomQuestions('전기기기', 20),
      fetchRandomQuestions('전기설비', 20)
    ]);

    // 전체 문제를 합치고 랜덤하게 섞기
    const allQuestions = [...theoryQuestions, ...machineQuestions, ...facilityQuestions];
    return allQuestions.sort(() => Math.random() - 0.5);
  } catch (err) {
    console.error('랜덤 60문제 조회 오류:', err);
    return [];
  }
};

/**
 * 모든 문제 가져오기 (가중치 기반 출제용)
 * 페이징을 사용하여 1000개 이상의 문제도 모두 가져옴
 */
export const fetchAllQuestions = async (): Promise<Question[]> => {
  try {
    const allData: Question[] = [];
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    console.log('📊 모든 문제 가져오기 시작 (페이징 사용)...');

    while (hasMore) {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .order('id')
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error('문제 조회 실패:', error);
        break;
      }

      if (!data || data.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`📦 ${offset + 1}~${offset + data.length}번째 문제 로드됨`);

      // 첫 번째 배치에서 weight 필드 구조 확인 (디버깅)
      if (offset === 0 && data.length > 0) {
        const sampleQ = data[0];
        console.log('🔍 샘플 문제 데이터 (weight 필드 확인):', {
          id: sampleQ.id,
          weight: sampleQ.weight,
          weight_type: typeof sampleQ.weight,
          all_keys: Object.keys(sampleQ)
        });
      }

      // Supabase 형식을 로컬 형식으로 변환
      const converted = data.map(q => ({
        id: q.id,
        category: q.category,
        standard: q.standard || undefined,
        detailItem: q.detailItem || undefined,
        question: q.question,
        option1: q.option1,
        option2: q.option2,
        option3: q.option3,
        option4: q.option4,
        answer: q.answer,
        explanation: q.explanation,
        imageUrl: q.imageUrl || undefined,
        hasImage: q.hasImage || false,
        mustInclude: q.mustInclude || false,
        mustExclude: q.mustExclude || false,
        weight: q.weight !== undefined && q.weight !== null ? Number(q.weight) : 5,
        source: q.source || undefined
      }));

      allData.push(...converted);

      if (data.length < batchSize) {
        hasMore = false;
      } else {
        offset += batchSize;
      }
    }

    console.log(`✅ 총 ${allData.length}개 문제 로드 완료`);

    // 가중치 분포 로그
    const weightDist: { [key: number]: number } = {};
    allData.forEach(q => {
      const w = q.weight || 5;
      weightDist[w] = (weightDist[w] || 0) + 1;
    });
    console.log('📊 가중치 분포:', weightDist);

    return allData;
  } catch (err) {
    console.error('모든 문제 조회 오류:', err);
    return [];
  }
};

/**
 * 카테고리별 문제 수 가져오기 (서버에서 COUNT)
 */
export const getCategoryCounts = async (): Promise<{
  total: number;
  전기이론: number;
  전기기기: number;
  전기설비: number;
}> => {
  try {
    const [totalResult, theoryResult, machineResult, facilityResult] = await Promise.all([
      supabase.from('questions').select('*', { count: 'exact', head: true }),
      supabase.from('questions').select('*', { count: 'exact', head: true }).eq('category', '전기이론'),
      supabase.from('questions').select('*', { count: 'exact', head: true }).eq('category', '전기기기'),
      supabase.from('questions').select('*', { count: 'exact', head: true }).eq('category', '전기설비')
    ]);

    return {
      total: totalResult.count || 0,
      전기이론: theoryResult.count || 0,
      전기기기: machineResult.count || 0,
      전기설비: facilityResult.count || 0
    };
  } catch (err) {
    console.error('카테고리 수 조회 오류:', err);
    return { total: 0, 전기이론: 0, 전기기기: 0, 전기설비: 0 };
  }
};

/**
 * IP 주소 가져오기 (외부 API 사용)
 */
const getClientIP = async (): Promise<string> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip || 'Unknown';
  } catch {
    return 'Unknown';
  }
};

/**
 * 로그인 기록 저장 (Supabase)
 */
export const saveLoginHistory = async (
  userId: number,
  userName: string,
  userAgent?: string
): Promise<boolean> => {
  try {
    // IP 주소 가져오기
    const ipAddress = await getClientIP();

    const { error } = await supabase.from('login_history').insert({
      user_id: userId,
      user_name: userName,
      timestamp: Date.now(),
      user_agent: userAgent || navigator.userAgent,
      ip_address: ipAddress
    });

    if (error) {
      console.error('로그인 기록 저장 실패:', error);
      return false;
    }

    console.log('✅ 로그인 기록 저장 완료:', userName, '(IP:', ipAddress, ')');
    return true;
  } catch (err) {
    console.error('로그인 기록 저장 오류:', err);
    return false;
  }
};

/**
 * 로그인 기록 조회 (최근 100개)
 */
export const getLoginHistory = async (): Promise<LoginHistory[]> => {
  try {
    const { data, error } = await supabase
      .from('login_history')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error) {
      console.error('로그인 기록 조회 실패:', error);
      return [];
    }

    return (data || []).map(record => ({
      id: record.id,
      userId: record.user_id,
      userName: record.user_name,
      timestamp: record.timestamp,
      userAgent: record.user_agent,
      ipAddress: record.ip_address || undefined
    }));
  } catch (err) {
    console.error('로그인 기록 조회 오류:', err);
    return [];
  }
};

/**
 * 회원 정보 저장 (Supabase)
 */
export const saveMemberToSupabase = async (member: {
  id: number;
  name: string;
  phone: string;
  email?: string;
  address: string;
  registeredAt: number;
}): Promise<boolean> => {
  try {
    const { error } = await supabase.from('members').insert({
      id: member.id,
      name: member.name,
      phone: member.phone,
      email: member.email,
      address: member.address,
      registered_at: member.registeredAt,
      created_at: new Date().toISOString()
    });

    if (error) {
      console.error('회원 저장 실패:', error);
      return false;
    }

    console.log('✅ 회원 저장 완료:', member.name);
    return true;
  } catch (err) {
    console.error('회원 저장 오류:', err);
    return false;
  }
};

/**
 * 이메일 중복 확인
 */
export const checkEmailExists = async (email: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('members')
      .select('id')
      .eq('email', email)
      .limit(1);

    if (error) {
      console.error('이메일 확인 실패:', error);
      return false;
    }

    return (data && data.length > 0);
  } catch (err) {
    console.error('이메일 확인 오류:', err);
    return false;
  }
};

/**
 * 모든 회원 가져오기 (Supabase)
 */
export const fetchAllMembersFromSupabase = async (): Promise<Array<{
  id: number;
  name: string;
  phone: string;
  email?: string;
  address: string;
  registeredAt: number;
  memo?: string;
}>> => {
  try {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('회원 목록 조회 실패:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log('ℹ️ Supabase에 회원이 없습니다.');
      return [];
    }

    // Supabase 형식을 로컬 형식으로 변환
    return data.map(m => ({
      id: m.id,
      name: m.name,
      phone: m.phone,
      email: m.email || undefined,
      address: m.address || '',
      registeredAt: m.registered_at || Date.now(),
      memo: m.memo || ''
    }));
  } catch (err) {
    console.error('회원 목록 조회 오류:', err);
    return [];
  }
};

/**
 * 회원 정보 업데이트 (Supabase)
 */
export const updateMemberInSupabase = async (member: {
  id: number;
  name: string;
  phone: string;
  email?: string;
  address: string;
  memo?: string;
}): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('members')
      .update({
        name: member.name,
        phone: member.phone,
        email: member.email,
        address: member.address,
        memo: member.memo
      })
      .eq('id', member.id);

    if (error) {
      console.error('회원 업데이트 실패:', error);
      return false;
    }

    console.log('✅ 회원 업데이트 완료:', member.name);
    return true;
  } catch (err) {
    console.error('회원 업데이트 오류:', err);
    return false;
  }
};

/**
 * 회원 삭제 (Supabase)
 */
export const deleteMemberFromSupabase = async (id: number): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('members')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('회원 삭제 실패:', error);
      return false;
    }

    console.log('✅ 회원 삭제 완료:', id);
    return true;
  } catch (err) {
    console.error('회원 삭제 오류:', err);
    return false;
  }
};

/**
 * 문제 수정 (Supabase)
 */
export const updateQuestionInSupabase = async (question: Question): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('questions')
      .update({
        category: question.category,
        standard: question.standard,
        detailItem: question.detailItem,
        question: question.question,
        option1: question.option1,
        option2: question.option2,
        option3: question.option3,
        option4: question.option4,
        answer: question.answer,
        explanation: question.explanation,
        imageUrl: question.imageUrl,
        hasImage: question.hasImage,
        mustInclude: question.mustInclude,
        mustExclude: question.mustExclude,
        weight: question.weight
      })
      .eq('id', question.id);

    if (error) {
      console.error('문제 수정 실패:', error);
      return false;
    }

    console.log('✅ 문제 수정 완료:', question.id);
    return true;
  } catch (err) {
    console.error('문제 수정 오류:', err);
    return false;
  }
};

/**
 * 문제 삭제 (Supabase)
 */
export const deleteQuestionFromSupabase = async (id: number): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('문제 삭제 실패:', error);
      return false;
    }

    console.log('✅ 문제 삭제 완료:', id);
    return true;
  } catch (err) {
    console.error('문제 삭제 오류:', err);
    return false;
  }
};

/**
 * 문제 일괄 삽입 (Supabase) - 핵심 필드만
 */
export const insertQuestions = async (
  questions: Partial<Question>[]
): Promise<{ success: number; failed: number; errors: string[] }> => {
  const result = { success: 0, failed: 0, errors: [] as string[] };

  // 기존 최대 ID 조회
  let maxId = 0;
  try {
    const { data: maxData } = await supabase
      .from('questions')
      .select('id')
      .order('id', { ascending: false })
      .limit(1);

    if (maxData && maxData.length > 0) {
      maxId = maxData[0].id;
      console.log('✅ 현재 최대 ID:', maxId);
    } else {
      console.log('ℹ️ 문제가 없어서 ID 1부터 시작합니다.');
    }
  } catch (err) {
    console.warn('최대 ID 조회 실패:', err);
  }

  // 첫 번째 삽입 시도로 스키마 확인
  if (questions.length > 0) {
    const firstQ = questions[0];
    const newId = maxId + 1;
    console.log('🔢 새 ID 생성:', newId);

    // 먼저 모든 필드로 시도 (ID 포함)
    const fullInsertData: Record<string, unknown> = {
      id: newId,
      category: firstQ.category,
      question: firstQ.question,
      option1: firstQ.option1,
      option2: firstQ.option2,
      option3: firstQ.option3,
      option4: firstQ.option4,
      answer: firstQ.answer,
      explanation: firstQ.explanation || ''
    };

    // 선택적 필드 추가
    if (firstQ.standard) fullInsertData.standard = firstQ.standard;
    if (firstQ.detailItem) fullInsertData.detail_item = firstQ.detailItem;
    if (firstQ.weight !== undefined) fullInsertData.weight = firstQ.weight; // weight는 항상 포함
    if (firstQ.source) fullInsertData.source = firstQ.source;

    const { error: firstError } = await supabase.from('questions').insert(fullInsertData);

    if (firstError) {
      console.warn('선택적 필드 포함 삽입 실패, 핵심 필드만으로 재시도:', firstError.message);

      // 핵심 필드만으로 재시도 (weight 포함)
      const coreInsertData: Record<string, unknown> = {
        id: newId,
        category: firstQ.category,
        question: firstQ.question,
        option1: firstQ.option1,
        option2: firstQ.option2,
        option3: firstQ.option3,
        option4: firstQ.option4,
        answer: firstQ.answer,
        explanation: firstQ.explanation || '',
        weight: firstQ.weight !== undefined ? firstQ.weight : 5
      };

      const { error: coreError } = await supabase.from('questions').insert(coreInsertData);

      if (coreError) {
        result.failed++;
        result.errors.push(`첫 번째 문제 삽입 실패: ${coreError.message}`);
        console.error('핵심 필드만으로도 실패:', coreError);
        return result; // 첫 번째도 실패하면 중단
      } else {
        result.success++;
        maxId = newId; // 성공 시 maxId 업데이트
        console.log('✅ 핵심 필드만으로 삽입 성공, 나머지도 같은 방식으로 진행');

        // 나머지 문제들을 핵심 필드만으로 삽입 (weight 포함)
        for (let i = 1; i < questions.length; i++) {
          const q = questions[i];
          const currentId = maxId + i;
          try {
            const { error } = await supabase.from('questions').insert({
              id: currentId,
              category: q.category,
              question: q.question,
              option1: q.option1,
              option2: q.option2,
              option3: q.option3,
              option4: q.option4,
              answer: q.answer,
              explanation: q.explanation || '',
              weight: q.weight !== undefined ? q.weight : 5
            });

            if (error) {
              result.failed++;
              if (result.errors.length < 10) {
                result.errors.push(`문제 ${i + 1} 삽입 실패: ${error.message}`);
              }
            } else {
              result.success++;
            }
          } catch (err) {
            result.failed++;
            if (result.errors.length < 10) {
              result.errors.push(`문제 ${i + 1} 삽입 오류: ${err}`);
            }
          }
        }
        return result;
      }
    } else {
      result.success++;
      maxId = newId; // 성공 시 maxId 업데이트
      console.log('✅ 선택적 필드 포함하여 삽입 성공');
    }
  }

  // 나머지 문제들 (첫 번째가 성공한 경우)
  for (let i = 1; i < questions.length; i++) {
    const q = questions[i];
    const currentId = maxId + i;
    try {
      const insertData: Record<string, unknown> = {
        id: currentId,
        category: q.category,
        question: q.question,
        option1: q.option1,
        option2: q.option2,
        option3: q.option3,
        option4: q.option4,
        answer: q.answer,
        explanation: q.explanation || ''
      };

      if (q.standard) insertData.standard = q.standard;
      if (q.detailItem) insertData.detail_item = q.detailItem;
      if (q.weight !== undefined) insertData.weight = q.weight; // weight는 항상 포함
      if (q.source) insertData.source = q.source;

      const { error } = await supabase.from('questions').insert(insertData);

      if (error) {
        result.failed++;
        if (result.errors.length < 10) {
          result.errors.push(`문제 ${i + 1} 삽입 실패: ${error.message}`);
        }
      } else {
        result.success++;
      }
    } catch (err) {
      result.failed++;
      if (result.errors.length < 10) {
        result.errors.push(`문제 ${i + 1} 삽입 오류: ${err}`);
      }
    }
  }

  return result;
};

/**
 * 구글 시트에서 문제 가져오기
 */
export const fetchQuestionsFromGoogleSheet = async (
  sheetUrl: string
): Promise<Partial<Question>[]> => {
  try {
    // 구글 시트 ID 추출
    const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      throw new Error('잘못된 구글 시트 URL입니다.');
    }
    const sheetId = match[1];

    // CSV 형식으로 가져오기
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    const response = await fetch(csvUrl);

    if (!response.ok) {
      throw new Error('구글 시트를 가져올 수 없습니다. 공개 설정을 확인하세요.');
    }

    const csvText = await response.text();
    return parseCSVToQuestions(csvText);
  } catch (err) {
    console.error('구글 시트 가져오기 오류:', err);
    throw err;
  }
};

/**
 * CSV 텍스트를 Question 배열로 파싱
 */
export const parseCSVToQuestions = (csvText: string): Partial<Question>[] => {
  const lines = csvText.split('\n');
  if (lines.length < 2) {
    throw new Error('CSV 파일이 비어있습니다.');
  }

  // 헤더 파싱
  const headers = parseCSVLine(lines[0]);
  const headerMap: { [key: string]: number } = {};
  headers.forEach((h, i) => {
    headerMap[h.trim().toLowerCase()] = i;
  });

  const questions: Partial<Question>[] = [];

  // 데이터 행 파싱
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);

    const category = values[headerMap['category']] || '';
    const question = values[headerMap['question']] || '';
    const option1 = values[headerMap['option1']] || '';
    const option2 = values[headerMap['option2']] || '';
    const option3 = values[headerMap['option3']] || '';
    const option4 = values[headerMap['option4']] || '';
    const answer = parseInt(values[headerMap['answer']] || '0', 10);
    const explanation = values[headerMap['explanation']] || '';
    const standard = values[headerMap['standard']] || '';
    const detailItem = values[headerMap['detailitem']] || values[headerMap['detailItem']] || '';
    const weight = parseInt(values[headerMap['weights']] || values[headerMap['weight']] || '5', 10);
    const source = values[headerMap['source']] || '';

    // 필수 필드 검증
    if (!category || !question || !option1 || !answer) {
      console.warn(`행 ${i + 1} 건너뜀: 필수 필드 누락`);
      continue;
    }

    questions.push({
      category,
      question,
      option1,
      option2,
      option3,
      option4,
      answer,
      explanation,
      standard: standard || undefined,
      detailItem: detailItem || undefined,
      weight: weight || 5,
      source: source || undefined,
      hasImage: false,
      mustInclude: false,
      mustExclude: false
    });
  }

  return questions;
};

/**
 * CSV 라인 파싱 (쉼표와 따옴표 처리)
 */
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
};

/**
 * 기존 문제 ID 목록 가져오기
 */
export const getExistingQuestionIds = async (): Promise<number[]> => {
  try {
    const { data, error } = await supabase
      .from('questions')
      .select('id');

    if (error) {
      console.error('문제 ID 조회 실패:', error);
      return [];
    }

    return (data || []).map(q => q.id);
  } catch (err) {
    console.error('문제 ID 조회 오류:', err);
    return [];
  }
};

/**
 * 제보 저장 (Supabase)
 */
export const saveFeedbackToSupabase = async (
  feedback: Omit<Feedback, 'id' | 'timestamp'>
): Promise<{ success: boolean; feedback?: Feedback; error?: string }> => {
  try {
    const timestamp = Date.now();

    const { data, error } = await supabase.from('feedbacks').insert({
      author: feedback.author,
      user_id: feedback.userId || null,
      content: feedback.content,
      type: feedback.type || 'suggestion',
      question_id: feedback.questionId || null,
      question: feedback.question ? JSON.stringify(feedback.question) : null,
      timestamp: timestamp
    }).select('id').single();

    if (error) {
      console.error('제보 저장 실패:', error);
      return { success: false, error: error.message };
    }

    const savedFeedback: Feedback = {
      id: data.id,
      author: feedback.author,
      userId: feedback.userId,
      content: feedback.content,
      timestamp: timestamp,
      type: feedback.type,
      questionId: feedback.questionId,
      question: feedback.question
    };

    console.log('✅ 제보 저장 완료 (Supabase):', savedFeedback.id);
    return { success: true, feedback: savedFeedback };
  } catch (err) {
    console.error('제보 저장 오류:', err);
    return { success: false, error: String(err) };
  }
};

/**
 * 제보 목록 조회 (Supabase)
 * @returns { success: boolean; data: Feedback[]; error?: string }
 */
export const getFeedbacksFromSupabase = async (): Promise<{ success: boolean; data: Feedback[]; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('feedbacks')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(500);

    if (error) {
      console.error('제보 조회 실패:', error);
      return { success: false, data: [], error: error.message };
    }

    const feedbacks = (data || []).map(record => ({
      id: record.id,
      author: record.author,
      userId: record.user_id || undefined,
      content: record.content,
      timestamp: record.timestamp,
      type: record.type || undefined,
      questionId: record.question_id || undefined,
      question: record.question ? JSON.parse(record.question) : undefined
    }));

    console.log('✅ Supabase에서 제보 조회 성공:', feedbacks.length, '개');
    return { success: true, data: feedbacks };
  } catch (err) {
    console.error('제보 조회 오류:', err);
    return { success: false, data: [], error: String(err) };
  }
};

/**
 * 제보 삭제 (Supabase)
 */
export const deleteFeedbackFromSupabase = async (id: number): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('feedbacks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('제보 삭제 실패:', error);
      return false;
    }

    console.log('✅ 제보 삭제 완료 (Supabase):', id);
    return true;
  } catch (err) {
    console.error('제보 삭제 오류:', err);
    return false;
  }
};

/**
 * 사용자 학습 데이터 저장 (Supabase)
 */
export const saveUserDataToSupabase = async (
  userId: number,
  data: {
    wrongAnswers: unknown[];
    examResults: unknown[];
    statistics: unknown;
  }
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('user_data')
      .upsert({
        user_id: userId,
        wrong_answers: data.wrongAnswers,
        exam_results: data.examResults,
        statistics: data.statistics,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('사용자 데이터 저장 실패:', error);
      return false;
    }

    console.log('✅ 사용자 데이터 저장 완료:', userId);
    return true;
  } catch (err) {
    console.error('사용자 데이터 저장 오류:', err);
    return false;
  }
};

/**
 * 사용자 학습 데이터 불러오기 (Supabase)
 */
export const fetchUserDataFromSupabase = async (
  userId: number
): Promise<{
  wrongAnswers: unknown[];
  examResults: unknown[];
  statistics: unknown;
} | null> => {
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // 데이터가 없는 경우 (정상)
        console.log('ℹ️ 사용자 데이터가 없습니다:', userId);
        return null;
      }
      console.error('사용자 데이터 불러오기 실패:', error);
      return null;
    }

    console.log('✅ 사용자 데이터 불러오기 완료:', userId);
    return {
      wrongAnswers: data.wrong_answers || [],
      examResults: data.exam_results || [],
      statistics: data.statistics || null
    };
  } catch (err) {
    console.error('사용자 데이터 불러오기 오류:', err);
    return null;
  }
};

/**
 * 모든 사용자 학습 데이터 불러오기 (관리자용)
 */
export const fetchAllUserDataFromSupabase = async (): Promise<Array<{
  userId: number;
  wrongAnswers: unknown[];
  examResults: unknown[];
  statistics: unknown;
  updatedAt: string;
}>> => {
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('모든 사용자 데이터 불러오기 실패:', error);
      return [];
    }

    console.log('✅ 모든 사용자 데이터 불러오기 완료:', data?.length || 0, '명');
    return (data || []).map(record => ({
      userId: record.user_id,
      wrongAnswers: record.wrong_answers || [],
      examResults: record.exam_results || [],
      statistics: record.statistics || null,
      updatedAt: record.updated_at || ''
    }));
  } catch (err) {
    console.error('모든 사용자 데이터 불러오기 오류:', err);
    return [];
  }
};
