-- ========================================
-- 플래시카드 테이블 생성 (Flashcards Table)
-- ========================================
-- 단답형/키워드 암기 문제를 위한 테이블
-- 기존 questions 테이블과는 별도로 관리

CREATE TABLE IF NOT EXISTS flashcards (
  id BIGSERIAL PRIMARY KEY,
  no INTEGER NOT NULL,                   -- 문제 번호 (1~1300, 구글시트 원본 번호)
  category TEXT NOT NULL,                -- 카테고리 (전기이론, 전기기기, 전기설비)
  question TEXT NOT NULL,                -- 문제 전문
  answer_keyword TEXT NOT NULL,          -- 정답 키워드 (짧은 답변)
  explanation TEXT,                      -- 해설 및 암기 팁
  created_at TIMESTAMPTZ DEFAULT NOW(),  -- 생성일시
  updated_at TIMESTAMPTZ DEFAULT NOW()   -- 수정일시
);

-- ========================================
-- 인덱스 생성 (Index Creation)
-- ========================================
CREATE INDEX IF NOT EXISTS idx_flashcards_category ON flashcards(category);
CREATE INDEX IF NOT EXISTS idx_flashcards_no ON flashcards(no);

-- ========================================
-- RLS (Row Level Security) 정책
-- ========================================
-- TESTING MODE: 모든 사용자 읽기 허용

-- RLS 활성화
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;

-- 공개 읽기 허용 (모든 사용자)
CREATE POLICY "Allow public read access"
ON flashcards FOR SELECT
USING (true);

-- ========================================
-- 테이블 생성 확인
-- ========================================
-- 이 쿼리를 실행하여 테이블이 올바르게 생성되었는지 확인
-- SELECT * FROM flashcards LIMIT 5;
-- SELECT COUNT(*) FROM flashcards;
