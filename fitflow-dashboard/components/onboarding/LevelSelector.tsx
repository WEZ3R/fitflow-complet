import { Sprout, Zap, Flame } from "lucide-react";

const LEVELS = [
  { value: "BEGINNER", label: "Débutant", icon: Sprout, desc: "Moins de 1 an" },
  { value: "INTERMEDIATE", label: "Intermédiaire", icon: Zap, desc: "1 à 3 ans" },
  { value: "ADVANCED", label: "Avancé", icon: Flame, desc: "Plus de 3 ans" },
] as const;

interface LevelSelectorProps {
  value: string | null;
  onChange: (v: string) => void;
}

export function LevelSelector({ value, onChange }: LevelSelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {LEVELS.map(({ value: v, label, icon: Icon, desc }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
            value === v
              ? "border-indigo-600 bg-indigo-50 text-indigo-700"
              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
          }`}
        >
          <Icon className="w-6 h-6" strokeWidth={1.75} aria-hidden="true" />
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-gray-400">{desc}</span>
        </button>
      ))}
    </div>
  );
}
