// Supabase Service - 서버에서 직접 문제 가져오기
import { supabase } from './supabaseClient';
import type { Question, LoginHistory } from '../types';

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
 * 로그인 기록 저장 (Supabase)
 */
export const saveLoginHistory = async (
  userId: number,
  userName: string,
  userAgent?: string
): Promise<boolean> => {
  try {
    const { error } = await supabase.from('login_history').insert({
      user_id: userId,
      user_name: userName,
      timestamp: Date.now(),
      user_agent: userAgent || navigator.userAgent
    });

    if (error) {
      console.error('로그인 기록 저장 실패:', error);
      return false;
    }

    console.log('✅ 로그인 기록 저장 완료:', userName);
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
      userAgent: record.user_agent
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
  email: string;
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
