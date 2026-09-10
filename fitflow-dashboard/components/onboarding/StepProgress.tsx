interface StepProgressProps {
  total: number;
  current: number; // base 1
}

export function StepProgress({ total, current }: StepProgressProps) {
  return (
    <div className="flex gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors ${
            i < current ? "bg-indigo-600" : "bg-gray-200"
          }`}
        />
      ))}
    </div>
  );
}
