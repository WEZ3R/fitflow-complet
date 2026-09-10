"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StepProgress } from "@/components/onboarding/StepProgress";
import { GymPicker } from "@/components/onboarding/GymPicker";
import { onboardingAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import {
  Dumbbell,
  BicepsFlexed,
  Scale,
  HeartPulse,
  Bike,
  Flame,
  PersonStanding,
  StretchHorizontal,
  Trophy,
  Medal,
} from "lucide-react";

const TOTAL = 2;

const SPECIALTIES = [
  { value: "STRENGTH", label: "Force", icon: Dumbbell },
  { value: "HYPERTROPHY", label: "Hypertrophie", icon: BicepsFlexed },
  { value: "WEIGHT_LOSS", label: "Perte de poids", icon: Scale },
  { value: "REHAB", label: "Rééducation", icon: HeartPulse },
  { value: "ENDURANCE", label: "Endurance", icon: Bike },
  { value: "CROSSFIT", label: "CrossFit", icon: Flame },
  { value: "YOGA", label: "Yoga", icon: PersonStanding },
  { value: "MOBILITY", label: "Mobilité", icon: StretchHorizontal },
  { value: "POWERLIFTING", label: "Powerlifting", icon: Trophy },
  { value: "BODYBUILDING", label: "Bodybuilding", icon: Medal },
] as const;

export default function CoachOnboardingPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Étape 1
  const [bio, setBio] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [isRemote, setIsRemote] = useState(false);

  // Étape 2
  const [city, setCity] = useState("");
  const [gyms, setGyms] = useState<Array<{ id: string; name: string; address?: string | null }>>([]);
  const [gymIds, setGymIds] = useState<string[]>([]);
  const [gymsLoading, setGymsLoading] = useState(false);

  const toggleSpecialty = (v: string) =>
    setSpecialties((s) => s.includes(v) ? s.filter((x) => x !== v) : [...s, v]);

  const searchGyms = async () => {
    if (!city.trim()) return;
    setGymsLoading(true);
    try {
      const res = await onboardingAPI.searchGyms(city.trim());
      setGyms(res.data?.data || []);
    } catch {
      //
    } finally {
      setGymsLoading(false);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onboardingAPI.submitCoach({ bio: bio || undefined, specialties, city: city || undefined, gymIds, isRemote });
      await refreshUser();
      router.push("/coach/dashboard");
    } catch {
      router.push("/coach/dashboard");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-lg bg-white shadow-sm p-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-900">Complétez votre profil coach</h1>
          <button type="button" onClick={() => router.push("/coach/dashboard")} className="text-sm text-gray-400 hover:text-gray-600">Passer</button>
        </div>
        <StepProgress total={TOTAL} current={step} />

        {/* Étape 1 — Spécialités */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio <span className="text-gray-400 font-normal">(facultatif)</span></label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Présentez votre méthode, expérience, valeurs..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Spécialités</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SPECIALTIES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleSpecialty(value)}
                    className={`flex items-center gap-2 p-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      specialties.includes(value)
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isRemote}
                onChange={(e) => setIsRemote(e.target.checked)}
                className="accent-indigo-600 w-4 h-4"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Coaching à distance</span>
                <p className="text-xs text-gray-500">Visio, programmes en ligne</p>
              </div>
            </label>

            <Button className="w-full" onClick={() => setStep(2)}>Continuer</Button>
          </div>
        )}

        {/* Étape 2 — Localisation */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-gray-600 text-sm mb-4">Indiquez où vous entraînez vos clients.</p>
            <GymPicker
              city={city}
              onCityChange={setCity}
              gyms={gyms}
              selectedIds={gymIds}
              onToggle={(id) => setGymIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])}
              onSearch={searchGyms}
              loading={gymsLoading}
            />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Retour</Button>
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
