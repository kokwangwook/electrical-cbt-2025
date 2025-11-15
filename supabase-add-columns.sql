-- ============================================
-- Supabase questions 테이블에 컬럼 추가
-- ============================================
-- 이 SQL을 Supabase SQL Editor에서 한 번에 실행하세요.
-- ============================================

-- detailItem 컬럼 추가 (세부항목)
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS "detailItem" TEXT;

-- source 컬럼 추가 (문제 출처 - 선택사항)
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS "source" TEXT;

-- ============================================
-- 실행 완료 후 확인:
-- ============================================
-- 다음 쿼리로 테이블 구조를 확인할 수 있습니다:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'questions'
-- ORDER BY ordinal_position;

