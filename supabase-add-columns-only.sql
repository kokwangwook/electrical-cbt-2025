-- ============================================
-- 컬럼 추가만 실행 (RLS 정책은 이미 있음)
-- ============================================
-- 이 SQL은 컬럼만 추가합니다. RLS 정책은 이미 생성되어 있으므로 제외했습니다.
-- ============================================

-- detailItem 컬럼 추가 (세부항목)
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS "detailItem" TEXT;

-- source 컬럼 추가 (문제 출처 - 선택사항)
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS "source" TEXT;

