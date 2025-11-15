interface ProgressProps {
  current: number;
  total: number;
  answered: number;
}

export default function Progress({ current, total, answered }: ProgressProps) {
  const percentage = Math.round((answered / total) * 100);

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">
          문제 {current + 1} / {total}
        </span>
        <span className="text-sm font-medium text-gray-700">
          답변 완료: {answered} / {total} ({percentage}%)
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}
