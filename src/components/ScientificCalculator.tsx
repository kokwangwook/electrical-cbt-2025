import { useState } from 'react';

interface ScientificCalculatorProps {
  onClose: () => void;
}

export default function ScientificCalculator({ onClose }: ScientificCalculatorProps) {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);
  const [memory, setMemory] = useState(0);
  const [powerMode, setPowerMode] = useState(false); // 제곱 모드

  const handleNumber = (num: string) => {
    if (waitingForNewValue) {
      setDisplay(num);
      setWaitingForNewValue(false);
    } else {
      setDisplay(display === '0' ? num : display + num);
    }
  };

  const handleDecimal = () => {
    if (waitingForNewValue) {
      setDisplay('0.');
      setWaitingForNewValue(false);
    } else if (display.indexOf('.') === -1) {
      setDisplay(display + '.');
    }
  };

  const handleOperation = (op: string) => {
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operation) {
      const currentValue = previousValue || 0;
      const newValue = calculate(currentValue, inputValue, operation);

      setDisplay(String(newValue));
      setPreviousValue(newValue);
    }

    setWaitingForNewValue(true);
    setOperation(op);
  };

  const calculate = (firstValue: number, secondValue: number, op: string): number => {
    switch (op) {
      case '+':
        return firstValue + secondValue;
      case '-':
        return firstValue - secondValue;
      case '*':
        return firstValue * secondValue;
      case '/':
        return secondValue !== 0 ? firstValue / secondValue : 0;
      case '^':
        return Math.pow(firstValue, secondValue);
      case '=':
        return secondValue;
      default:
        return secondValue;
    }
  };

  const handleEquals = () => {
    if (powerMode && previousValue !== null) {
      const inputValue = parseFloat(display);
      const newValue = Math.pow(previousValue, inputValue);
      setDisplay(String(newValue));
      setPreviousValue(null);
      setPowerMode(false);
      setWaitingForNewValue(true);
    } else if (previousValue !== null && operation) {
      const inputValue = parseFloat(display);
      const newValue = calculate(previousValue, inputValue, operation);

      setDisplay(String(newValue));
      setPreviousValue(null);
      setOperation(null);
      setWaitingForNewValue(true);
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setWaitingForNewValue(false);
  };

  const handleClearEntry = () => {
    setDisplay('0');
  };

  const handleFunction = (func: string) => {
    const value = parseFloat(display);
    let result: number;

    switch (func) {
      case 'sin':
        result = Math.sin(value * (Math.PI / 180)); // 도 단위
        break;
      case 'cos':
        result = Math.cos(value * (Math.PI / 180));
        break;
      case 'tan':
        result = Math.tan(value * (Math.PI / 180));
        break;
      case 'asin':
        result = Math.asin(value) * (180 / Math.PI);
        break;
      case 'acos':
        result = Math.acos(value) * (180 / Math.PI);
        break;
      case 'atan':
        result = Math.atan(value) * (180 / Math.PI);
        break;
      case 'log':
        result = Math.log10(value);
        break;
      case 'ln':
        result = Math.log(value);
        break;
      case 'sqrt':
        result = Math.sqrt(value);
        break;
      case 'square':
        result = value * value;
        break;
      case 'pow':
        // x^y 모드 활성화
        setPowerMode(true);
        setPreviousValue(value);
        setWaitingForNewValue(true);
        result = value;
        break;
      case 'pi':
        result = Math.PI;
        break;
      case 'e':
        result = Math.E;
        break;
      case '1/x':
        result = value !== 0 ? 1 / value : 0;
        break;
      default:
        result = value;
    }

    setDisplay(String(result));
    setWaitingForNewValue(true);
  };

  const handleMemory = (memOp: string) => {
    const value = parseFloat(display);
    switch (memOp) {
      case 'MC':
        setMemory(0);
        break;
      case 'MR':
        setDisplay(String(memory));
        setWaitingForNewValue(true);
        break;
      case 'M+':
        setMemory(memory + value);
        break;
      case 'M-':
        setMemory(memory - value);
        break;
    }
  };

  const handleBackspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
        <div className="border-b p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">🔢 공학용 계산기</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          {/* 디스플레이 */}
          <div className="bg-gray-900 text-white p-4 rounded-lg mb-4 text-right">
            <div className="text-sm text-gray-400 mb-1">
              {memory !== 0 && 'M'}
            </div>
            <div className="text-3xl font-mono overflow-x-auto">
              {display}
            </div>
          </div>

          {/* 버튼 그리드 */}
          <div className="grid grid-cols-5 gap-2">
            {/* 메모리 버튼 */}
            <button
              onClick={() => handleMemory('MC')}
              className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm font-semibold"
            >
              MC
            </button>
            <button
              onClick={() => handleMemory('MR')}
              className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm font-semibold"
            >
              MR
            </button>
            <button
              onClick={() => handleMemory('M+')}
              className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm font-semibold"
            >
              M+
            </button>
            <button
              onClick={() => handleMemory('M-')}
              className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm font-semibold"
            >
              M-
            </button>
            <button
              onClick={handleBackspace}
              className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded text-sm font-semibold"
            >
              ⌫
            </button>

            {/* 함수 버튼 */}
            <button
              onClick={() => handleFunction('sin')}
              className="px-3 py-2 bg-blue-100 hover:bg-blue-200 rounded text-sm font-semibold"
            >
              sin
            </button>
            <button
              onClick={() => handleFunction('cos')}
              className="px-3 py-2 bg-blue-100 hover:bg-blue-200 rounded text-sm font-semibold"
            >
              cos
            </button>
            <button
              onClick={() => handleFunction('tan')}
              className="px-3 py-2 bg-blue-100 hover:bg-blue-200 rounded text-sm font-semibold"
            >
              tan
            </button>
            <button
              onClick={() => handleFunction('log')}
              className="px-3 py-2 bg-blue-100 hover:bg-blue-200 rounded text-sm font-semibold"
            >
              log
            </button>
            <button
              onClick={() => handleFunction('ln')}
              className="px-3 py-2 bg-blue-100 hover:bg-blue-200 rounded text-sm font-semibold"
            >
              ln
            </button>

            <button
              onClick={() => handleFunction('asin')}
              className="px-3 py-2 bg-blue-100 hover:bg-blue-200 rounded text-sm font-semibold"
            >
              sin⁻¹
            </button>
            <button
              onClick={() => handleFunction('acos')}
              className="px-3 py-2 bg-blue-100 hover:bg-blue-200 rounded text-sm font-semibold"
            >
              cos⁻¹
            </button>
            <button
              onClick={() => handleFunction('atan')}
              className="px-3 py-2 bg-blue-100 hover:bg-blue-200 rounded text-sm font-semibold"
            >
              tan⁻¹
            </button>
            <button
              onClick={() => handleFunction('sqrt')}
              className="px-3 py-2 bg-blue-100 hover:bg-blue-200 rounded text-sm font-semibold"
            >
              √
            </button>
            <button
              onClick={() => handleFunction('square')}
              className="px-3 py-2 bg-blue-100 hover:bg-blue-200 rounded text-sm font-semibold"
            >
              x²
            </button>

            {/* 숫자 및 기본 연산 */}
            <button
              onClick={handleClear}
              className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded text-sm font-semibold"
            >
              C
            </button>
            <button
              onClick={handleClearEntry}
              className="px-3 py-2 bg-red-400 hover:bg-red-500 text-white rounded text-sm font-semibold"
            >
              CE
            </button>
            <button
              onClick={() => handleFunction('1/x')}
              className="px-3 py-2 bg-blue-100 hover:bg-blue-200 rounded text-sm font-semibold"
            >
              1/x
            </button>
            <button
              onClick={() => handleOperation('/')}
              className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm font-semibold"
            >
              ÷
            </button>
            <button
              onClick={() => handleOperation('*')}
              className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm font-semibold"
            >
              ×
            </button>

            <button
              onClick={() => handleNumber('7')}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-semibold"
            >
              7
            </button>
            <button
              onClick={() => handleNumber('8')}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-semibold"
            >
              8
            </button>
            <button
              onClick={() => handleNumber('9')}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-semibold"
            >
              9
            </button>
            <button
              onClick={() => handleOperation('-')}
              className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm font-semibold"
            >
              −
            </button>
            <button
              onClick={() => handleFunction('pi')}
              className="px-3 py-2 bg-blue-100 hover:bg-blue-200 rounded text-sm font-semibold"
            >
              π
            </button>

            <button
              onClick={() => handleNumber('4')}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-semibold"
            >
              4
            </button>
            <button
              onClick={() => handleNumber('5')}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-semibold"
            >
              5
            </button>
            <button
              onClick={() => handleNumber('6')}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-semibold"
            >
              6
            </button>
            <button
              onClick={() => handleOperation('+')}
              className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm font-semibold"
            >
              +
            </button>
            <button
              onClick={() => handleFunction('e')}
              className="px-3 py-2 bg-blue-100 hover:bg-blue-200 rounded text-sm font-semibold"
            >
              e
            </button>

            <button
              onClick={() => handleNumber('1')}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-semibold"
            >
              1
            </button>
            <button
              onClick={() => handleNumber('2')}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-semibold"
            >
              2
            </button>
            <button
              onClick={() => handleNumber('3')}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-semibold"
            >
              3
            </button>
            <button
              onClick={handleEquals}
              className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded text-sm font-semibold row-span-2"
              style={{ gridRow: 'span 2' }}
            >
              =
            </button>
            <button
              onClick={() => handleFunction('pow')}
              className="px-3 py-2 bg-blue-100 hover:bg-blue-200 rounded text-sm font-semibold"
            >
              x^y
            </button>

            <button
              onClick={() => handleNumber('0')}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-semibold col-span-2"
              style={{ gridColumn: 'span 2' }}
            >
              0
            </button>
            <button
              onClick={handleDecimal}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-semibold"
            >
              .
            </button>
            <button
              onClick={() => {
                const value = parseFloat(display);
                setDisplay(String(-value));
              }}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-semibold"
            >
              ±
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

