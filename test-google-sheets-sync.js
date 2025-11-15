/**
 * Google Sheets 동기화 테스트 스크립트
 * 브라우저 콘솔에서 실행하거나 Node.js 환경에서 실행
 */

// 테스트용 함수들 (브라우저 콘솔에서 실행)
async function testGoogleSheetsSync() {
  console.log('🧪 Google Sheets 동기화 테스트 시작...\n');

  // 1. Google Sheets에서 데이터 가져오기 테스트
  console.log('1️⃣ Google Sheets에서 데이터 가져오기 테스트');
  try {
    const { getAllQuestionsFromSheets } = await import('./src/services/googleSheetsService.ts');
    const questions = await getAllQuestionsFromSheets();
    
    console.log(`✅ 성공: ${questions.length}개 문제 가져옴`);
    console.log('샘플 데이터:', questions.slice(0, 2));
    
    // 데이터 구조 검증
    if (questions.length > 0) {
      const sample = questions[0];
      const requiredFields = ['id', 'category', 'question', 'option1', 'option2', 'option3', 'option4', 'answer'];
      const missingFields = requiredFields.filter(field => !(field in sample));
      
      if (missingFields.length > 0) {
        console.error('❌ 필수 필드 누락:', missingFields);
      } else {
        console.log('✅ 데이터 구조 검증 통과');
      }
    }
  } catch (error) {
    console.error('❌ 실패:', error);
  }

  console.log('\n2️⃣ LocalStorage에 저장 테스트');
  try {
    const { getQuestions, saveQuestions } = await import('./src/services/storage.ts');
    const testQuestions = [
      {
        id: 1000,
        category: '전기이론',
        question: '테스트 문제 1',
        option1: '선택지 1',
        option2: '선택지 2',
        option3: '선택지 3',
        option4: '선택지 4',
        answer: 1,
        explanation: '테스트 해설',
        imageUrl: '',
      },
      {
        id: 1001,
        category: '전기기기',
        question: '테스트 문제 2',
        option1: '선택지 1',
        option2: '선택지 2',
        option3: '선택지 3',
        option4: '선택지 4',
        answer: 2,
        explanation: '테스트 해설',
        imageUrl: '',
      },
    ];
    
    saveQuestions(testQuestions);
    const saved = getQuestions();
    console.log(`✅ 성공: ${saved.length}개 문제 저장됨`);
    console.log('저장된 데이터:', saved);
  } catch (error) {
    console.error('❌ 실패:', error);
  }

  console.log('\n3️⃣ ID 중복 방지 테스트');
  try {
    const { addQuestion } = await import('./src/services/storage.ts');
    
    // 첫 번째 문제 추가
    const q1 = addQuestion({
      category: '전기이론',
      question: '중복 테스트 1',
      option1: '1', option2: '2', option3: '3', option4: '4',
      answer: 1,
      explanation: '',
      imageUrl: '',
    });
    console.log(`✅ 문제 1 추가: ID ${q1.id}`);
    
    // 두 번째 문제 추가
    const q2 = addQuestion({
      category: '전기이론',
      question: '중복 테스트 2',
      option1: '1', option2: '2', option3: '3', option4: '4',
      answer: 1,
      explanation: '',
      imageUrl: '',
    });
    console.log(`✅ 문제 2 추가: ID ${q2.id}`);
    
    // ID 중복 확인
    const { getQuestions } = await import('./src/services/storage.ts');
    const allQuestions = getQuestions();
    const ids = allQuestions.map(q => q.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    
    if (duplicates.length > 0) {
      console.error('❌ ID 중복 발견:', duplicates);
    } else {
      console.log('✅ ID 중복 없음');
    }
  } catch (error) {
    console.error('❌ 실패:', error);
  }

  console.log('\n✅ 테스트 완료!');
}

// 브라우저 콘솔에서 실행 방법:
// testGoogleSheetsSync();

// Node.js 환경에서 실행하려면:
// node test-google-sheets-sync.js

export { testGoogleSheetsSync };



