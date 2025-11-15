import { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// PDF.js worker 설정 (로컬 파일 사용)
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';

interface ParsedResult {
  rawText: string;
  convertedText: string;
  questionCount: number;
  latexCount: number;
}

export default function PdfParser() {
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ParsedResult | null>(null);
  const [error, setError] = useState<string>('');

  // LaTeX 변환 함수
  const convertToLatex = (text: string): string => {
    let converted = text;

    // 단위 변환
    converted = converted.replace(/\[V\]/g, '$[V]$');
    converted = converted.replace(/\[A\]/g, '$[A]$');
    converted = converted.replace(/\[W\]/g, '$[W]$');
    converted = converted.replace(/\[Ω\]/g, '$[\\Omega]$');
    converted = converted.replace(/Ω/g, '$\\Omega$');
    converted = converted.replace(/\[Hz\]/g, '$[Hz]$');
    converted = converted.replace(/\[J\]/g, '$[J]$');
    converted = converted.replace(/\[C\]/g, '$[C]$');
    converted = converted.replace(/\[F\]/g, '$[F]$');
    converted = converted.replace(/\[H\]/g, '$[H]$');
    converted = converted.replace(/\[T\]/g, '$[T]$');
    converted = converted.replace(/\[Wb\]/g, '$[Wb]$');
    converted = converted.replace(/\[N\]/g, '$[N]$');
    converted = converted.replace(/\[m\]/g, '$[m]$');
    converted = converted.replace(/\[s\]/g, '$[s]$');
    converted = converted.replace(/\[kg\]/g, '$[kg]$');

    // 수학 기호 변환 (단일 백슬래시)
    converted = converted.replace(/×/g, '$\\times$');
    converted = converted.replace(/÷/g, '$\\div$');
    converted = converted.replace(/≒/g, '$\\approx$');
    converted = converted.replace(/≈/g, '$\\approx$');
    converted = converted.replace(/≠/g, '$\\neq$');
    converted = converted.replace(/≤/g, '$\\leq$');
    converted = converted.replace(/≥/g, '$\\geq$');
    converted = converted.replace(/∞/g, '$\\infty$');
    converted = converted.replace(/√/g, '$\\sqrt{}$');

    // 거듭제곱 변환
    converted = converted.replace(/²/g, '$^2$');
    converted = converted.replace(/³/g, '$^3$');

    // 10의 거듭제곱 (예: 10^-19, 10^12)
    converted = converted.replace(/10\^(-?\d+)/g, '$10^{$1}$');

    // 일반 거듭제곱 (예: x^2, a^n)
    converted = converted.replace(/([a-zA-Z])\^(\d+)/g, '$1^{$2}$');

    // 분수 패턴 (간단한 경우만)
    converted = converted.replace(/(\d+)\/(\d+)(?!\d)/g, '$\\frac{$1}{$2}$');

    return converted;
  };

  // PDF 파싱
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('PDF 파일만 업로드 가능합니다.');
      return;
    }

    setParsing(true);
    setError('');
    setResult(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let fullText = '';

      // 모든 페이지에서 텍스트 추출
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');

        fullText += pageText + '\n';
      }

      // LaTeX 변환 적용
      const convertedText = convertToLatex(fullText);

      // 통계 계산
      const questionCount = (fullText.match(/\d+\./g) || []).length;
      const latexCount = (convertedText.match(/\$/g) || []).length / 2; // $ 쌍 개수

      setResult({
        rawText: fullText,
        convertedText: convertedText,
        questionCount: questionCount,
        latexCount: Math.floor(latexCount),
      });

    } catch (err) {
      console.error('PDF 파싱 오류:', err);
      setError('PDF 파일을 파싱하는 중 오류가 발생했습니다.');
    } finally {
      setParsing(false);
    }
  };

  // 클립보드에 복사
  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert(`${type}이(가) 클립보드에 복사되었습니다.`);
    }).catch(err => {
      console.error('복사 실패:', err);
      alert('복사에 실패했습니다.');
    });
  };

  // 텍스트 파일로 다운로드
  const downloadText = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 파일 업로드 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">📄 PDF 파일 업로드</h3>

        <div className="mb-4">
          <label className="block mb-2 text-sm font-medium text-gray-700">
            PDF 파일 선택
          </label>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            disabled={parsing}
            className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
          />
          <p className="mt-2 text-sm text-gray-500">
            전기기능사 기출문제 PDF 파일을 업로드하면 텍스트를 추출하고 LaTeX 수식으로 변환합니다.
          </p>
        </div>

        {parsing && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600">PDF 파싱 중...</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">❌ {error}</p>
          </div>
        )}
      </div>

      {/* 결과 표시 */}
      {result && (
        <>
          {/* 통계 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">📊 파싱 통계</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">전체 텍스트 길이</p>
                <p className="text-2xl font-bold text-blue-600">
                  {result.rawText.length.toLocaleString()}
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">감지된 문제 수</p>
                <p className="text-2xl font-bold text-green-600">
                  {result.questionCount}
                </p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">LaTeX 변환 수</p>
                <p className="text-2xl font-bold text-purple-600">
                  {result.latexCount}
                </p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">변환율</p>
                <p className="text-2xl font-bold text-orange-600">
                  {result.latexCount > 0 ? '✓' : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* 원본 텍스트 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">📝 원본 텍스트</h3>
              <div className="space-x-2">
                <button
                  onClick={() => copyToClipboard(result.rawText, '원본 텍스트')}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  📋 복사
                </button>
                <button
                  onClick={() => downloadText(result.rawText, 'raw_text.txt')}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  💾 다운로드
                </button>
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto border border-gray-200">
              <pre className="text-sm whitespace-pre-wrap break-words font-mono">
                {result.rawText.substring(0, 5000)}
                {result.rawText.length > 5000 && '\n\n... (더 많은 내용은 다운로드하여 확인하세요)'}
              </pre>
            </div>
          </div>

          {/* LaTeX 변환 텍스트 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">✨ LaTeX 변환 텍스트</h3>
              <div className="space-x-2">
                <button
                  onClick={() => copyToClipboard(result.convertedText, 'LaTeX 변환 텍스트')}
                  className="px-3 py-1 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded-lg transition-colors"
                >
                  📋 복사
                </button>
                <button
                  onClick={() => downloadText(result.convertedText, 'latex_converted.txt')}
                  className="px-3 py-1 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded-lg transition-colors"
                >
                  💾 다운로드
                </button>
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg max-h-96 overflow-y-auto border border-blue-200">
              <pre className="text-sm whitespace-pre-wrap break-words font-mono">
                {result.convertedText.substring(0, 5000)}
                {result.convertedText.length > 5000 && '\n\n... (더 많은 내용은 다운로드하여 확인하세요)'}
              </pre>
            </div>
          </div>

          {/* 변환 예시 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">💡 변환 예시</h3>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded">
                  <p className="font-semibold text-gray-600 mb-2">원본</p>
                  <code className="text-gray-800">저항 9[Ω]</code>
                </div>
                <div className="bg-blue-50 p-3 rounded">
                  <p className="font-semibold text-blue-600 mb-2">변환 후</p>
                  <code className="text-blue-800">저항 9$[\\Omega]$</code>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded">
                  <code className="text-gray-800">4 × 5 = 20</code>
                </div>
                <div className="bg-blue-50 p-3 rounded">
                  <code className="text-blue-800">4 $\times$ 5 = 20</code>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded">
                  <code className="text-gray-800">a² + b² = c²</code>
                </div>
                <div className="bg-blue-50 p-3 rounded">
                  <code className="text-blue-800">a$^2$ + b$^2$ = c$^2$</code>
                </div>
              </div>
            </div>
          </div>

          {/* 사용 안내 */}
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
            <h4 className="font-semibold text-yellow-800 mb-2">⚠️ 사용 안내</h4>
            <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
              <li>변환된 텍스트를 복사하여 문제 수정 시 사용하세요.</li>
              <li>LaTeX 수식이 자동으로 감지되어 $...$로 감싸집니다.</li>
              <li>PDF 구조에 따라 텍스트 순서가 뒤섞일 수 있습니다.</li>
              <li>변환 결과를 확인하고 필요시 수동으로 수정하세요.</li>
              <li>복잡한 수식은 수동으로 LaTeX 문법을 추가해야 할 수 있습니다.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
