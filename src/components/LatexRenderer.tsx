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
    let textString = String(inputText);
    
    // 유니코드 수학 기호를 LaTeX 명령어로 변환 (전처리)
    // $ 사이의 내용에 대해서만 변환
    textString = textString.replace(/\$([^$]+?)\$/g, (match, formula) => {
      let processedFormula = formula;
      
      // 대괄호로 감싸진 단위 변환 (예: [mm²] → [\text{mm}^2])
      processedFormula = processedFormula.replace(/\[mm²\]/g, '[\\text{mm}^2]');
      processedFormula = processedFormula.replace(/\[cm²\]/g, '[\\text{cm}^2]');
      processedFormula = processedFormula.replace(/\[m²\]/g, '[\\text{m}^2]');
      
      // 유니코드 제곱 기호를 LaTeX로 변환
      // mm² → \text{mm}^2
      processedFormula = processedFormula.replace(/mm²/g, '\\text{mm}^2');
      processedFormula = processedFormula.replace(/cm²/g, '\\text{cm}^2');
      processedFormula = processedFormula.replace(/m²/g, '\\text{m}^2');
      
      // 일반적인 제곱 기호 변환 (단위 뒤에 오는 경우)
      // 숫자나 문자 뒤의 ²를 ^2로 변환
      processedFormula = processedFormula.replace(/([a-zA-Z0-9]+)²/g, '$1^2');
      
      // 세제곱 기호 변환
      processedFormula = processedFormula.replace(/([a-zA-Z0-9]+)³/g, '$1^3');
      
      // 일반적인 유니코드 수학 기호 변환 (나머지)
      processedFormula = processedFormula.replace(/²/g, '^2');
      processedFormula = processedFormula.replace(/³/g, '^3');
      processedFormula = processedFormula.replace(/¹/g, '^1');
      processedFormula = processedFormula.replace(/⁰/g, '^0');
      
      // 그리스 문자 변환 (일부)
      processedFormula = processedFormula.replace(/μ/g, '\\mu');
      processedFormula = processedFormula.replace(/Ω/g, '\\Omega');
      processedFormula = processedFormula.replace(/α/g, '\\alpha');
      processedFormula = processedFormula.replace(/β/g, '\\beta');
      processedFormula = processedFormula.replace(/π/g, '\\pi');
      
      return `$${processedFormula}$`;
    });
    
    // $ ... $ 사이의 LaTeX 렌더링 (인라인 수식)
    // 정규식을 개선하여 $ 사이의 내용을 더 정확하게 매칭
    let result = textString.replace(/\$([^$]+?)\$/g, (match, formula) => {
      try {
        // 공백 제거 및 트림
        let trimmedFormula = formula.trim();
        
        // KaTeX가 지원하지 않는 특수 문자를 \text{}로 감싸기
        // 원 안의 문자들 (Ⓜ, ⓐ, ⓑ 등) 처리
        trimmedFormula = trimmedFormula.replace(/[ⓐ-ⓩⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏ]/g, (char) => {
          return `\\text{${char}}`;
        });
        
        // KaTeX 렌더링 시도 - strict 모드를 'ignore'로 설정하여 경고 제거
        const rendered = katex.renderToString(trimmedFormula, {
          throwOnError: false,
          displayMode: false,
          strict: 'ignore', // strict 모드를 'ignore'로 설정하여 경고 제거
        });
        
        // 렌더링 결과가 비어있거나 에러가 있는 경우 원본 반환
        if (!rendered || rendered.trim() === '') {
          console.warn('LaTeX 렌더링 결과가 비어있음:', trimmedFormula);
          return match;
        }
        
        // 렌더링된 HTML에 에러 클래스가 포함되어 있는지 확인
        if (rendered.includes('katex-error')) {
          console.warn('LaTeX 렌더링 에러 감지:', trimmedFormula, '렌더링 결과:', rendered);
          // 에러가 있어도 일단 렌더링된 결과를 반환 (에러 메시지 포함)
        }
        
        return rendered;
      } catch (e) {
        console.error('LaTeX 렌더링 오류:', e, '수식:', formula);
        return match; // 오류 시 원본 텍스트 반환
      }
    });

    // $$ ... $$ 사이의 LaTeX 렌더링 (블록 수식)
    result = result.replace(/\$\$(.+?)\$\$/g, (match, formula) => {
      try {
        return katex.renderToString(formula.trim(), {
          throwOnError: false,
          displayMode: true,
          strict: 'ignore', // strict 모드를 'ignore'로 설정하여 경고 제거
        });
      } catch (e) {
        console.error('LaTeX 렌더링 오류:', e);
        return match;
      }
    });

    return result;
  };

  // className에 inline이 포함되어 있으면 span으로, 아니면 div로 렌더링
  const isInline = className.includes('inline');
  const Tag = isInline ? 'span' : 'div';
  
  return (
    <Tag
      className={className}
      dangerouslySetInnerHTML={{ __html: renderLatex(text) }}
    />
  );
}
