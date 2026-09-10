"use client";

import { useState } from "react";
import { nutritionAPI } from "@/lib/api";
import { Calculator, ChevronDown, ChevronUp, Zap } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Objective = "maintien" | "prise_de_masse" | "seche";

interface MacroResult {
  proteines: number;
  lipides: number;
  glucides: number;
}

interface CalcResult {
  client: { nom: string; poids: number; taille: number; age: number };
  bmr: number;
  tdee: number;
  calories_cible: number;
  objectif: Objective;
  delta: number;
  macronutriments: MacroResult;
}

interface CalorieCalculatorProps {
  clientId: string;
  onApply: (calories: number, macros: MacroResult) => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const ACTIVITY_PRESETS = [
  { value: 1.2,  label: "Sédentaire",   detail: "Peu ou pas d'exercice" },
  { value: 1.37, label: "Léger",        detail: "1–3 séances/semaine" },
  { value: 1.55, label: "Modéré",       detail: "3–5 séances/semaine" },
  { value: 1.72, label: "Intense",      detail: "6–7 séances/semaine" },
  { value: 1.9,  label: "Très intense", detail: "2× par jour" },
];

const OBJECTIVES: { value: Objective; label: string; activeColor: string }[] = [
  { value: "maintien",       label: "Maintien",       activeColor: "border-blue-400 bg-blue-50 text-blue-700" },
  { value: "prise_de_masse", label: "Prise de masse", activeColor: "border-green-400 bg-green-50 text-green-700" },
  { value: "seche",          label: "Sèche",          activeColor: "border-orange-400 bg-orange-50 text-orange-700" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function CalorieCalculator({ clientId, onApply }: CalorieCalculatorProps) {
  const [open, setOpen] = useState(false);
  const [objective, setObjective] = useState<Objective>("maintien");
  const [activityPreset, setActivityPreset] = useState<number>(1.55);
  const [useCustomActivity, setUseCustomActivity] = useState(false);
  const [customActivity, setCustomActivity] = useState("");
  const [customSurplus, setCustomSurplus] = useState("");
  const [customDeficit, setCustomDeficit] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activityFactor = useCustomActivity ? parseFloat(customActivity) || 0 : activityPreset;

  const resetResult = () => setResult(null);

  const handleCalculate = async () => {
    if (activityFactor < 1) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const payload: Parameters<typeof nutritionAPI.calculate>[0] = {
        clientId,
        activityFactor,
        objective,
        ...(objective === "prise_de_masse" && customSurplus ? { surplus: parseInt(customSurplus) } : {}),
        ...(objective === "seche" && customDeficit ? { deficit: parseInt(customDeficit) } : {}),
      };
      const res = await nutritionAPI.calculate(payload);
      setResult(res.data.data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Erreur lors du calcul";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!result) return;
    onApply(result.calories_cible, result.macronutriments);
    setOpen(false);
  };

  const macroBar = result ? (() => {
    const total = result.calories_cible;
    if (!total) return null;
    const pPct = Math.round((result.macronutriments.proteines * 4 / total) * 100);
    const lPct = Math.round((result.macronutriments.lipides * 9 / total) * 100);
    return { pPct, lPct, gPct: 100 - pPct - lPct };
  })() : null;

  return (
    <div className="mt-3 rounded-lg border border-indigo-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 transition-colors text-left"
      >
        <Calculator className="h-4 w-4 text-indigo-600 shrink-0" />
        <span className="flex-1 text-sm font-medium text-indigo-700">Calculer automatiquement</span>
        {open ? <ChevronUp className="h-4 w-4 text-indigo-400" /> : <ChevronDown className="h-4 w-4 text-indigo-400" />}
      </button>

      {open && (
        <div className="p-4 space-y-5 bg-white">
          {/* Objectif */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Objectif</p>
            <div className="flex gap-2">
              {OBJECTIVES.map((obj) => (
                <button key={obj.value} type="button"
                  onClick={() => { setObjective(obj.value); resetResult(); }}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${objective === obj.value ? obj.activeColor : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                  {obj.label}
                </button>
              ))}
            </div>
          </div>

          {/* Delta */}
          {objective === "prise_de_masse" && (
            <div className="flex items-center gap-3 bg-green-50 rounded-lg px-3 py-2">
              <span className="text-sm text-green-700 flex-1">Surplus calorique</span>
              <input type="number" min={50} max={1000} value={customSurplus} placeholder="300"
                onChange={(e) => { setCustomSurplus(e.target.value); resetResult(); }}
                className="w-20 border border-green-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-green-400" />
              <span className="text-xs text-green-600">kcal</span>
            </div>
          )}
          {objective === "seche" && (
            <div className="flex items-center gap-3 bg-orange-50 rounded-lg px-3 py-2">
              <span className="text-sm text-orange-700 flex-1">Déficit calorique</span>
              <input type="number" min={50} max={1000} value={customDeficit} placeholder="400"
                onChange={(e) => { setCustomDeficit(e.target.value); resetResult(); }}
                className="w-20 border border-orange-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-orange-400" />
              <span className="text-xs text-orange-600">kcal</span>
            </div>
          )}

          {/* Niveau d'activité */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Niveau d&apos;activité</p>
            <div className="grid grid-cols-5 gap-1.5 mb-2">
              {ACTIVITY_PRESETS.map((preset) => (
                <button key={preset.value} type="button"
                  onClick={() => { setActivityPreset(preset.value); setUseCustomActivity(false); resetResult(); }}
                  title={`${preset.label} — ${preset.detail}`}
                  className={`py-1.5 px-1 rounded-lg border text-xs font-medium transition-colors text-center leading-tight ${!useCustomActivity && activityPreset === preset.value ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                  <span className="block font-bold">{preset.value}</span>
                  <span className="block text-[10px] opacity-75">{preset.label}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button type="button"
                onClick={() => { setUseCustomActivity((v) => !v); resetResult(); }}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${useCustomActivity ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                Personnalisé
              </button>
              {useCustomActivity && (
                <input type="number" min={1} max={2.5} step={0.01} value={customActivity}
                  onChange={(e) => { setCustomActivity(e.target.value); resetResult(); }}
                  placeholder="ex: 1.65"
                  className="w-24 border border-indigo-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  autoFocus />
              )}
            </div>
          </div>

          {/* Calculer */}
          <button type="button" onClick={handleCalculate} disabled={loading || activityFactor < 1}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
            <Zap className="h-4 w-4" />
            {loading ? "Calcul en cours..." : "Calculer"}
          </button>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          {/* Résultats */}
          {result && (
            <div className="space-y-4 pt-1">
              <div className="h-px bg-gray-100" />
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 mb-0.5">BMR</p>
                  <p className="text-xl font-bold text-gray-900">{result.bmr.toLocaleString("fr-FR")}</p>
                  <p className="text-xs text-gray-400">kcal au repos</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 mb-0.5">TDEE (maintien)</p>
                  <p className="text-xl font-bold text-gray-900">{result.tdee.toLocaleString("fr-FR")}</p>
                  <p className="text-xs text-gray-400">kcal avec activité</p>
                </div>
              </div>
              <div className={`rounded-lg p-4 text-center ${result.objectif === "prise_de_masse" ? "bg-green-50 border border-green-200" : result.objectif === "seche" ? "bg-orange-50 border border-orange-200" : "bg-blue-50 border border-blue-200"}`}>
                <p className="text-xs font-medium text-gray-500 mb-1">Objectif calorique quotidien</p>
                <p className={`text-3xl font-bold ${result.objectif === "prise_de_masse" ? "text-green-700" : result.objectif === "seche" ? "text-orange-700" : "text-blue-700"}`}>
                  {result.calories_cible.toLocaleString("fr-FR")} <span className="text-lg font-normal">kcal</span>
                </p>
                {result.delta !== 0 && <p className="text-sm mt-1 text-gray-600">{result.delta > 0 ? "+" : ""}{result.delta} kcal / maintien</p>}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Macronutriments</p>
                {macroBar && (
                  <div className="flex rounded-full overflow-hidden h-3 mb-3">
                    <div className="bg-blue-400" style={{ width: `${macroBar.pPct}%` }} />
                    <div className="bg-yellow-400" style={{ width: `${macroBar.lPct}%` }} />
                    <div className="bg-green-400" style={{ width: `${macroBar.gPct}%` }} />
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Protéines", val: result.macronutriments.proteines, kcal: result.macronutriments.proteines * 4, bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-400" },
                    { label: "Lipides",   val: result.macronutriments.lipides,   kcal: result.macronutriments.lipides * 9,   bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-400" },
                    { label: "Glucides",  val: result.macronutriments.glucides,  kcal: result.macronutriments.glucides * 4,  bg: "bg-green-50", text: "text-green-700", dot: "bg-green-400" },
                  ].map((m) => (
                    <div key={m.label} className={`${m.bg} rounded-lg p-3 text-center`}>
                      <div className={`w-2 h-2 rounded-full ${m.dot} mx-auto mb-1.5`} />
                      <p className={`text-lg font-bold ${m.text}`}>{m.val}g</p>
                      <p className="text-xs text-gray-500">{m.label}</p>
                      <p className="text-[10px] text-gray-400">{m.kcal} kcal</p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-gray-400 text-center">
                Calculé pour {result.client.nom} · {result.client.poids} kg · {result.client.taille} cm · {result.client.age} ans
              </p>
              <button type="button" onClick={handleApply}
                className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors">
                Appliquer {result.calories_cible.toLocaleString("fr-FR")} kcal/jour
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
