import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// PDF 파일 경로
const pdfPath = join(__dirname, 'source', '2010년_4회.pdf');

async function extractText() {
  try {
    // PDF 파일 읽기
    const data = new Uint8Array(fs.readFileSync(pdfPath));

    // PDF 문서 로드
    const loadingTask = pdfjsLib.getDocument({
      data,
      useSystemFonts: true,
    });

    const pdf = await loadingTask.promise;
    console.log(`📄 총 페이지 수: ${pdf.numPages}\n`);

    let fullText = '';

    // 모든 페이지에서 텍스트 추출
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(' ');
      fullText += pageText + '\n';
      console.log(`페이지 ${pageNum} 추출 완료 (${pageText.length}자)`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('📝 추출된 전체 텍스트:');
    console.log('='.repeat(80));
    console.log(fullText);

    console.log('\n' + '='.repeat(80));
    console.log('🔍 정규화된 텍스트 (공백 압축):');
    console.log('='.repeat(80));
    const normalized = fullText.replace(/\s+/g, ' ');
    console.log(normalized);

    // 파일로 저장
    fs.writeFileSync('extracted-raw.txt', fullText, 'utf-8');
    fs.writeFileSync('extracted-normalized.txt', normalized, 'utf-8');
    console.log('\n✅ extracted-raw.txt, extracted-normalized.txt 파일로 저장됨');

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  }
}

extractText();
