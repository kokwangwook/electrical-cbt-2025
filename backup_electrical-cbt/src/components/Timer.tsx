import { useEffect, useState } from 'react';
import { formatTime } from '../utils/helpers';

interface TimerProps {
  duration: number; // seconds
  onTimeUp: () => void;
  isPaused?: boolean;
}

export default function Timer({ duration, onTimeUp, isPaused = false }: TimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    if (isPaused || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, onTimeUp, isPaused]);

  const isWarning = timeLeft <= 300; // 5분 이하 경고
  const isCritical = timeLeft <= 60; // 1분 이하 위험

  return (
    <div
      className={`text-2xl font-bold px-6 py-3 rounded-lg ${
        isCritical
          ? 'bg-red-500 text-white animate-pulse'
          : isWarning
          ? 'bg-yellow-500 text-white'
          : 'bg-blue-500 text-white'
      }`}
    >
      ⏱️ 남은 시간: {formatTime(timeLeft)}
    </div>
  );
}
