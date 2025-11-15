/**
 * 시간을 MM:SS 형식으로 포맷
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 점수 계산
 */
export function calculateScore(correct: number, total: number): number {
  return Math.round((correct / total) * 100);
}

/**
 * 합격 여부 판단 (60점 이상)
 */
export function isPassed(score: number): boolean {
  return score >= 60;
}

/**
 * 시간을 시:분:초 형식으로 변환
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}시간 ${minutes}분 ${secs}초`;
  } else if (minutes > 0) {
    return `${minutes}분 ${secs}초`;
  } else {
    return `${secs}초`;
  }
}

/**
 * 날짜를 한국어 형식으로 포맷
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
