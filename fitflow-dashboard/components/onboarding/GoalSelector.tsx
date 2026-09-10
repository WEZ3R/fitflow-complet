import { Scale, BicepsFlexed, Footprints, HeartPulse, Trophy, Bike } from "lucide-react";

const GOALS = [
  { value: "WEIGHT_LOSS", label: "Perte de poids", icon: Scale },
  { value: "MUSCLE_GAIN", label: "Prise de masse", icon: BicepsFlexed },
  { value: "FITNESS", label: "Remise en forme", icon: Footprints },
  { value: "REHAB", label: "Rééducation", icon: HeartPulse },
  { value: "PERFORMANCE", label: "Performance", icon: Trophy },
  { value: "ENDURANCE", label: "Endurance", icon: Bike },
] as const;

interface GoalSelectorProps {
  value: string | null;
  onChange: (v: string | null) => void;
}

export function GoalSelector({ value, onChange }: GoalSelectorProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {GOALS.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(value === v ? null : v)}
          className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-sm font-medium ${
            value === v
              ? "border-indigo-600 bg-indigo-50 text-indigo-700"
              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
          }`}
        >
          <Icon className="w-6 h-6" strokeWidth={1.75} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}
