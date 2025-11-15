// 카테고리 격리 테스트
// "옴의 법칙"이 "전기설비" 카테고리에 있으면 전기이론 출제기준을 적용하지 않는지 테스트

const STANDARD_KEYWORDS = {
  "1.4": ["직류", "옴의 법칙", "저항", "전압강하", "전류", "전압", "전력"],
  "3.1": ["배선재료", "전선", "케이블", "나전선", "절연전선", "개폐기"],
  "3.2": ["전선접속", "접속", "단선접속", "슬리브"],
};

const STANDARDS_BY_CATEGORY = {
  "전기이론": ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6"],
  "전기설비": ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8"],
};

function getStandardsByCategory(category) {
  return STANDARDS_BY_CATEGORY[category] || [];
}

function matchStandardByKeywords(question) {
  const fullText = [
    question.question || '',
    question.option1 || '',
    question.option2 || '',
    question.option3 || '',
    question.option4 || '',
    question.explanation || '',
  ].join(' ').toLowerCase();

  console.log(`\n카테고리: ${question.category}`);
  console.log(`문제 텍스트: ${fullText.substring(0, 100)}...`);

  // ⚠️ 중요: 해당 카테고리의 출제기준만 검사
  const standards = getStandardsByCategory(question.category);
  console.log(`검사할 출제기준: ${standards.join(', ')}`);
  
  if (standards.length === 0) {
    return undefined;
  }

  const scores = {};
  
  standards.forEach(standard => {
    const keywords = STANDARD_KEYWORDS[standard] || [];
    let score = 0;
    
    keywords.forEach(keyword => {
      const keywordLower = keyword.toLowerCase();
      const keywordNoSpace = keywordLower.replace(/\s+/g, '');
      const textNoSpace = fullText.replace(/\s+/g, '');
      
      if (fullText.includes(keywordLower) || textNoSpace.includes(keywordNoSpace)) {
        score += 1;
        console.log(`  ✓ "${keyword}" 매칭 (${standard})`);
      }
    });
    
    if (score > 0) {
      scores[standard] = score;
    }
  });

  const sortedStandards = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  
  if (sortedStandards.length > 0 && sortedStandards[0][1] > 0) {
    return sortedStandards[0][0];
  }

  return undefined;
}

console.log('='.repeat(80));
console.log('🔍 카테고리 격리 테스트');
console.log('='.repeat(80));

// 테스트 케이스 1: "옴의 법칙"이 "전기설비" 카테고리에 있는 경우
console.log('\n📋 테스트 케이스 1: "옴의 법칙"이 "전기설비" 카테고리');
const testQuestion1 = {
  question: "옴의 법칙에 따라 전선의 저항을 계산하는 문제",
  category: "전기설비"
};

const result1 = matchStandardByKeywords(testQuestion1);
console.log(`\n✅ 결과: ${result1 || '미지정'}`);
console.log(`\n⚠️  확인: "옴의 법칙"은 1.4 직류회로의 키워드이지만,`);
console.log(`   카테고리가 "전기설비"이므로 전기설비 출제기준(3.1~3.8)만 검사합니다.`);
console.log(`   전기이론 출제기준(1.4)은 절대로 적용되지 않습니다.`);

// 테스트 케이스 2: "옴의 법칙"이 "전기이론" 카테고리에 있는 경우
console.log('\n' + '='.repeat(80));
console.log('\n📋 테스트 케이스 2: "옴의 법칙"이 "전기이론" 카테고리');
const testQuestion2 = {
  question: "옴의 법칙에 따라 전압과 전류의 관계를 설명하시오",
  category: "전기이론"
};

const result2 = matchStandardByKeywords(testQuestion2);
console.log(`\n✅ 결과: ${result2 || '미지정'}`);
console.log(`\n✅ 확인: 카테고리가 "전기이론"이므로 전기이론 출제기준(1.1~1.6)만 검사합니다.`);

console.log('\n' + '='.repeat(80));
console.log('✅ 테스트 완료');
console.log('='.repeat(80));


