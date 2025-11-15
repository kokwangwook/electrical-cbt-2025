import katex from 'katex';
import 'katex/dist/katex.min.css';

interface LatexRendererProps {
  text: string;
  className?: string;
}

/**
 * LaTeX 렌더링 컴포넌트
 * $ ... $ 사이의 LaTeX 수식을 렌더링합니다.
 * 
 * 사용 예시:
 * <LatexRenderer text="전압 $V = I \times R$ 입니다." />
 */
export default function LatexRenderer({ text, className = '' }: LatexRendererProps) {
  const renderLatex = (inputText: string | null | undefined | number): string => {
    // 타입 체크 및 기본값 처리
    if (inputText === null || inputText === undefined) {
      return '';
    }
    
    // number나 다른 타입을 string으로 변환
    const textString = String(inputText);
    
    // $ ... $ 사이의 LaTeX 렌더링 (인라인 수식)
    let result = textString.replace(/\$(.+?)\$/g, (match, formula) => {
      try {
        return katex.renderToString(formula, {
          throwOnError: false,
          displayMode: false,
        });
      } catch (e) {
        console.error('LaTeX 렌더링 오류:', e);
        return match; // 오류 시 원본 텍스트 반환
      }
    });

    // $$ ... $$ 사이의 LaTeX 렌더링 (블록 수식)
    result = result.replace(/\$\$(.+?)\$\$/g, (match, formula) => {
      try {
        return katex.renderToString(formula, {
          throwOnError: false,
          displayMode: true,
        });
      } catch (e) {
        console.error('LaTeX 렌더링 오류:', e);
        return match;
      }
    });

    return result;
  };

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: renderLatex(text) }}
    />
  );
}
