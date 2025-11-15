// 브라우저 콘솔에서 실행하는 자동 Import 스크립트
// 사용법: 관리자 페이지(http://localhost:5173/admin)에서 F12 → Console 탭 → 이 코드 붙여넣기

(async function() {
  console.log('🚀 자동 Import 시작...');

  try {
    // JSON 파일 가져오기
    const response = await fetch('/전기공학기초이론.json');
    const questions = await response.json();

    console.log(`✅ ${questions.length}개 문제 로드 완료`);

    // LocalStorage에 저장
    const existingQuestions = JSON.parse(localStorage.getItem('questions') || '[]');

    // 중복 제거 (ID 기준)
    const existingIds = new Set(existingQuestions.map(q => q.id));
    const newQuestions = questions.filter(q => !existingIds.has(q.id));

    if (newQuestions.length === 0) {
      console.log('⚠️  모든 문제가 이미 존재합니다.');
      const shouldOverwrite = confirm('기존 문제를 삭제하고 새로 Import하시겠습니까?');
      if (shouldOverwrite) {
        localStorage.setItem('questions', JSON.stringify(questions));
        console.log(`✅ ${questions.length}개 문제가 Import되었습니다 (덮어쓰기)`);
        alert(`✅ ${questions.length}개 문제가 Import되었습니다!\n페이지를 새로고침하세요.`);
      } else {
        console.log('❌ Import 취소됨');
      }
    } else {
      const allQuestions = [...existingQuestions, ...newQuestions];
      localStorage.setItem('questions', JSON.stringify(allQuestions));
      console.log(`✅ ${newQuestions.length}개 신규 문제가 추가되었습니다`);
      console.log(`📊 총 문제 수: ${allQuestions.length}개`);
      alert(`✅ ${newQuestions.length}개 신규 문제가 추가되었습니다!\n총 ${allQuestions.length}개 문제\n페이지를 새로고침하세요.`);
    }

    // 정답 없는 문제 확인
    const missingAnswers = questions.filter(q => q.answer === 0);
    if (missingAnswers.length > 0) {
      console.warn(`⚠️  정답이 없는 문제: ${missingAnswers.length}개`);
      console.log('ID:', missingAnswers.map(q => q.id).join(', '));
    }

  } catch (error) {
    console.error('❌ Import 실패:', error);
    alert('Import 실패: ' + error.message);
  }
})();
