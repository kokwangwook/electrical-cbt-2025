import { useEffect, useRef } from 'react';
import katex from 'katex';

interface MathRendererProps {
  content: string;
  className?: string;
}

/**
 * LaTeX 수식을 렌더링하는 컴포넌트
 *
 * 지원 형식:
 * - 인라인 수식: $x^2 + y^2 = z^2$
 * - 블록 수식: $$\int_0^1 x^2 dx$$
 *
 * @example
 * <MathRenderer content="전류는 $I = \frac{V}{R}$로 계산됩니다." />
 * <MathRenderer content="$$\sum_{i=1}^{n} i = \frac{n(n+1)}{2}$$" />
 */
export default function MathRenderer({ content, className = '' }: MathRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let processedContent = content;

    // 블록 수식 처리: $$...$$
    processedContent = processedContent.replace(
      /\$\$([\s\S]+?)\$\$/g,
      (_, math) => {
        try {
          return `<div class="math-block">${katex.renderToString(math, {
            displayMode: true,
            throwOnError: false,
          })}</div>`;
        } catch (error) {
          console.error('LaTeX 블록 렌더링 실패:', error);
          return `<div class="math-error">$$${math}$$</div>`;
        }
      }
    );

    // 인라인 수식 처리: $...$
    processedContent = processedContent.replace(
      /\$([^\$]+?)\$/g,
      (_, math) => {
        try {
          return `<span class="math-inline">${katex.renderToString(math, {
            displayMode: false,
            throwOnError: false,
          })}</span>`;
        } catch (error) {
          console.error('LaTeX 인라인 렌더링 실패:', error);
          return `<span class="math-error">$${math}$</span>`;
        }
      }
    );

    containerRef.current.innerHTML = processedContent;
  }, [content]);

  return (
    <div
      ref={containerRef}
      className={`math-renderer ${className}`}
      style={{
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    />
  );
}
