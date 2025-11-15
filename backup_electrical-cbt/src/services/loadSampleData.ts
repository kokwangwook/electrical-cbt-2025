import { getQuestions, addQuestion } from './storage';
import sampleQuestions from '../../sample_questions.json';

/**
 * 샘플 문제 데이터 로드
 * 문제가 없을 때 자동으로 샘플 20문제를 추가합니다.
 */
export function loadSampleQuestions(): void {
  const existingQuestions = getQuestions();

  if (existingQuestions.length === 0) {
    console.log('📚 샘플 문제 로드 중...');
    
    sampleQuestions.forEach(q => {
      addQuestion({
        category: q.category,
        question: q.question,
        option1: q.option1,
        option2: q.option2,
        option3: q.option3,
        option4: q.option4,
        answer: q.answer,
        explanation: q.explanation,
        imageUrl: q.imageUrl || '',
      });
    });

    console.log(`✅ 샘플 문제 ${sampleQuestions.length}개 로드 완료`);
  }
}



