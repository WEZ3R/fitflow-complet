"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StepProgress } from "@/components/onboarding/StepProgress";
import { GoalSelector } from "@/components/onboarding/GoalSelector";
import { LevelSelector } from "@/components/onboarding/LevelSelector";
import { GymPicker } from "@/components/onboarding/GymPicker";
import { onboardingAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";

const TOTAL = 3;

const SPOT_TYPES = ["PARK", "TRACK", "HOME", "OUTDOOR", "POOL", "OTHER"] as const;

export default function ClientOnboardingPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Étape 1
  const [gender, setGender] = useState<string | null>(null);
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");

  // Étape 2
  const [city, setCity] = useState("");
  const [gyms, setGyms] = useState<Array<{ id: string; name: string; address?: string | null }>>([]);
  const [gymIds, setGymIds] = useState<string[]>([]);
  const [gymsLoading, setGymsLoading] = useState(false);
  const [customSpots, setCustomSpots] = useState<Array<{ type: string; label: string; address?: string }>>([]);
  const [newSpotType, setNewSpotType] = useState("PARK");
  const [newSpotLabel, setNewSpotLabel] = useState("");
  const [newSpotAddress, setNewSpotAddress] = useState("");

  // Étape 3
  const [goalCategory, setGoalCategory] = useState<string | null>(null);
  const [customGoal, setCustomGoal] = useState("");
  const [level, setLevel] = useState<string | null>(null);

  const searchGyms = async () => {
    if (!city.trim()) return;
    setGymsLoading(true);
    try {
      const res = await onboardingAPI.searchGyms(city.trim());
      setGyms(res.data?.data || []);
    } catch {
      // Ville non trouvée
    } finally {
      setGymsLoading(false);
    }
  };

  const toggleGym = (id: string) =>
    setGymIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

  const addSpot = () => {
    if (!newSpotLabel.trim()) return;
    setCustomSpots((s) => [...s, { type: newSpotType, label: newSpotLabel.trim(), address: newSpotAddress.trim() || undefined }]);
    setNewSpotLabel("");
    setNewSpotAddress("");
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onboardingAPI.submitClient({
        step1: { gender, age: age || undefined, height: height || undefined, weight: weight || undefined },
        step2: { city: city || undefined, gymIds, customSpots },
        step3: { goalCategory, customGoal: customGoal || undefined, level },
      });
      await refreshUser();
      router.push("/client/dashboard");
    } catch {
      // Laisser passer si erreur (données partielles OK)
      router.push("/client/dashboard");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-lg bg-white shadow-sm p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-900">Complétez votre profil</h1>
          <button
            type="button"
            onClick={() => router.push("/client/dashboard")}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            Passer
          </button>
        </div>
        <StepProgress total={TOTAL} current={step} />

        {/* Étape 1 — Physique */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-gray-600 text-sm mb-4">Ces informations personnalisent votre expérience.</p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Genre <span className="text-gray-400 font-normal">(facultatif)</span>
              </label>
              <div className="flex gap-2">
                {[{ v: "M", l: "Homme" }, { v: "F", l: "Femme" }, { v: "X", l: "Autre" }].map((g) => (
                  <button
                    key={g.v}
                    type="button"
                    onClick={() => setGender(gender === g.v ? null : g.v)}
                    className={`flex-1 py-2 text-sm rounded-lg border-2 font-medium transition-all ${
                      gender === g.v ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600"
                    }`}
                  >
                    {g.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Input label="Âge" type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="28" />
              <Input label="Taille (cm)" type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="175" />
              <Input label="Poids (kg)" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="70" />
            </div>

            <Button className="w-full mt-2" onClick={() => setStep(2)}>Continuer</Button>
          </div>
        )}

        {/* Étape 2 — Localisation */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-gray-600 text-sm mb-4">Indiquez vos lieux d&apos;entraînement pour trouver les coachs proches.</p>

            <GymPicker
              city={city}
              onCityChange={setCity}
              gyms={gyms}
              selectedIds={gymIds}
              onToggle={toggleGym}
              onSearch={searchGyms}
              loading={gymsLoading}
            />

            {/* Lieux custom */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Lieux personnalisés</p>
              {customSpots.map((s, i) => (
                <div key={i} className="flex items-center justify-between py-1 text-sm text-gray-700">
                  <span>{s.label}</span>
                  <button type="button" onClick={() => setCustomSpots((sp) => sp.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-xs">Retirer</button>
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <select
                  value={newSpotType}
                  onChange={(e) => setNewSpotType(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                >
                  {SPOT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input
                  type="text"
                  value={newSpotLabel}
                  onChange={(e) => setNewSpotLabel(e.target.value)}
                  placeholder="Nom du lieu"
                  className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                />
                <button type="button" onClick={addSpot} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">+</button>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Retour</Button>
              <Button className="flex-1" onClick={() => setStep(3)}>Continuer</Button>
            </div>
          </div>
        )}

        {/* Étape 3 — Objectif */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-gray-600 text-sm mb-4">On trouvera les coachs les plus adaptés à vos besoins.</p>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Objectif principal</p>
              <GoalSelector value={goalCategory} onChange={setGoalCategory} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Précisez <span className="text-gray-400 font-normal">(facultatif)</span>
              </label>
              <textarea
                value={customGoal}
                onChange={(e) => setCustomGoal(e.target.value)}
                placeholder="Ex: Préparer un marathon, perdre 10kg..."
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Votre niveau</p>
              <LevelSelector value={level} onChange={setLevel} />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>Retour</Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={saving}>
                {saving ? "Enregistrement..." : "Terminer"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
