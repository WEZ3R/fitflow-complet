"use client";

import { useState, useEffect, type ChangeEvent, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FoodSearch } from "@/components/client/food-search";
import { statsAPI, mealsAPI } from "@/lib/api";
import { Camera, Trash2 } from "lucide-react";
import type { Program } from "@/types";

interface StatsData {
  bedTime: string;
  wakeTime: string;
  waterIntake: string;
  weight: string;
  workoutTime: string;
  workoutDurationHours: string;
  workoutDurationMinutes: string;
}

interface MealEntry {
  id: number;
  mealType: string;
  description: string;
  calories: string;
  protein: string;
  carbs: string;
  fats: string;
  photo: File | null;
}

interface DailyDataFormProps {
  clientId: string;
  date: string;
  program?: Partial<Program>;
  onSuccess?: () => void;
}

export const DailyDataForm = ({ clientId, date, program, onSuccess }: DailyDataFormProps) => {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [statsData, setStatsData] = useState<StatsData>({
    bedTime: "",
    wakeTime: "",
    waterIntake: "",
    weight: "",
    workoutTime: "",
    workoutDurationHours: "",
    workoutDurationMinutes: "",
  });

  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [currentMealType, setCurrentMealType] = useState("breakfast");
  const [currentPhoto, setCurrentPhoto] = useState<File | null>(null);

  useEffect(() => {
    const loadExistingData = async () => {
      if (!clientId || !date) return;

      setLoadingData(true);
      try {
        const statsResponse = await statsAPI.getClientStats(clientId, {
          startDate: date,
          endDate: date,
        });

        const stats = statsResponse.data.data?.[0];

        if (stats) {
          const bedTime = stats.bedTime ? new Date(stats.bedTime).toTimeString().slice(0, 5) : "";
          const wakeTime = stats.wakeTime ? new Date(stats.wakeTime).toTimeString().slice(0, 5) : "";
          const workoutTime = stats.workoutTime ? new Date(stats.workoutTime).toTimeString().slice(0, 5) : "";

          const durationHours = stats.workoutDuration ? Math.floor(stats.workoutDuration / 60) : "";
          const durationMinutes = stats.workoutDuration ? stats.workoutDuration % 60 : "";

          setStatsData({
            bedTime,
            wakeTime,
            waterIntake: stats.waterIntake?.toString() || "",
            weight: stats.weight?.toString() || "",
            workoutTime,
            workoutDurationHours: durationHours.toString(),
            workoutDurationMinutes: durationMinutes.toString(),
          });
        } else {
          setStatsData({
            bedTime: "",
            wakeTime: "",
            waterIntake: "",
            weight: "",
            workoutTime: "",
            workoutDurationHours: "",
            workoutDurationMinutes: "",
          });
        }

        setMeals([]);
      } catch (error) {
        console.error("Error loading existing data:", error);
      } finally {
        setLoadingData(false);
      }
    };

    loadExistingData();
  }, [clientId, date]);

  const handleStatsChange = (e: ChangeEvent<HTMLInputElement>) => {
    setStatsData({ ...statsData, [e.target.name]: e.target.value });
  };

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCurrentPhoto(e.target.files?.[0] || null);
  };

  const handleFoodSelect = (food: {
    description: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  }) => {
    setMeals([
      ...meals,
      {
        id: Date.now(),
        mealType: currentMealType,
        description: food.description,
        calories: String(food.calories),
        protein: String(food.protein),
        carbs: String(food.carbs),
        fats: String(food.fats),
        photo: currentPhoto,
      },
    ]);
    setCurrentPhoto(null);
    // Reset file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  };

  const removeMeal = (id: number) => {
    setMeals(meals.filter((meal) => meal.id !== id));
  };

  const calculateSleepHours = () => {
    if (statsData.bedTime && statsData.wakeTime) {
      const bed = new Date(`2000-01-01T${statsData.bedTime}`);
      const wake = new Date(`2000-01-02T${statsData.wakeTime}`);
      const diffInMinutes = (wake.getTime() - bed.getTime()) / (1000 * 60);
      const totalMinutes = diffInMinutes > 0 ? diffInMinutes : 1440 + diffInMinutes;
      const hours = Math.floor(totalMinutes / 60);
      const minutes = Math.floor(totalMinutes % 60);
      return { hours, minutes, decimal: totalMinutes / 60 };
    }
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const sleepData = calculateSleepHours();
      const sleepHours = sleepData ? sleepData.decimal : null;

      const workoutDuration =
        statsData.workoutDurationHours || statsData.workoutDurationMinutes
          ? parseInt(statsData.workoutDurationHours || "0") * 60 +
            parseInt(statsData.workoutDurationMinutes || "0")
          : null;

      const dataToSend = {
        clientId,
        date,
        sleepHours,
        bedTime: statsData.bedTime ? new Date(`${date}T${statsData.bedTime}`).toISOString() : null,
        wakeTime: statsData.wakeTime ? new Date(`${date}T${statsData.wakeTime}`).toISOString() : null,
        waterIntake: statsData.waterIntake ? parseFloat(statsData.waterIntake) : null,
        weight: statsData.weight ? parseFloat(statsData.weight) : null,
        workoutTime: statsData.workoutTime ? new Date(`${date}T${statsData.workoutTime}`).toISOString() : null,
        workoutDuration,
      };

      await statsAPI.upsert(dataToSend);

      for (const meal of meals) {
        await mealsAPI.create({
          clientId,
          date,
          mealType: meal.mealType,
          description: meal.description,
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          fats: meal.fats,
          photo: meal.photo,
        });
      }

      if (onSuccess) onSuccess();
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
      console.error("Error submitting daily data:", error);
      alert(
        `Erreur lors de l'enregistrement des données: ${axiosError.response?.data?.message || axiosError.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  const totalCalories = meals.reduce((sum, meal) => sum + parseInt(meal.calories || "0"), 0);
  const totalProtein = meals.reduce((sum, meal) => sum + parseFloat(meal.protein || "0"), 0);
  const totalCarbs = meals.reduce((sum, meal) => sum + parseFloat(meal.carbs || "0"), 0);
  const totalFats = meals.reduce((sum, meal) => sum + parseFloat(meal.fats || "0"), 0);

  if (loadingData) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Chargement des données...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card title="Sommeil">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                label="Heure de réveil de ce matin"
                type="time"
                name="wakeTime"
                value={statsData.wakeTime}
                onChange={handleStatsChange}
              />
              <p className="text-xs text-gray-500 mt-1">À renseigner le matin au réveil</p>
            </div>
            <div>
              <Input
                label="Heure de coucher de ce soir"
                type="time"
                name="bedTime"
                value={statsData.bedTime}
                onChange={handleStatsChange}
              />
              <p className="text-xs text-gray-500 mt-1">À renseigner le soir avant de dormir</p>
            </div>
          </div>
          {statsData.bedTime && statsData.wakeTime && calculateSleepHours() && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>Durée de sommeil estimée :</strong> {calculateSleepHours()!.hours}h
                {calculateSleepHours()!.minutes.toString().padStart(2, "0")}
                <span className="text-xs block mt-1">
                  (entre le coucher de ce soir et le réveil de demain matin)
                </span>
              </p>
            </div>
          )}
        </div>
      </Card>

      <Card title={program?.weightTrackingEnabled ? "Hydratation & Poids" : "Hydratation"}>
        <div className={program?.weightTrackingEnabled ? "grid grid-cols-2 gap-4" : ""}>
          <Input
            label="Eau bue (litres)"
            type="number"
            step="0.1"
            name="waterIntake"
            value={statsData.waterIntake}
            onChange={handleStatsChange}
            placeholder="2.5"
          />
          {program?.weightTrackingEnabled && (
            <Input
              label="Poids (kg)"
              type="number"
              step="0.1"
              name="weight"
              value={statsData.weight}
              onChange={handleStatsChange}
              placeholder="75.5"
            />
          )}
        </div>
      </Card>

      <Card title="Entraînement">
        <div className="space-y-4">
          <Input
            label="Heure de la séance"
            type="time"
            name="workoutTime"
            value={statsData.workoutTime}
            onChange={handleStatsChange}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Durée de la séance</label>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Heures"
                type="number"
                name="workoutDurationHours"
                value={statsData.workoutDurationHours}
                onChange={handleStatsChange}
                placeholder="1"
                min="0"
              />
              <Input
                label="Minutes"
                type="number"
                name="workoutDurationMinutes"
                value={statsData.workoutDurationMinutes}
                onChange={handleStatsChange}
                placeholder="30"
                min="0"
                max="59"
              />
            </div>
          </div>
        </div>
      </Card>

      <Card title="Repas">
        <div className="space-y-4">
          {/* Repas groupés par type */}
          {(["breakfast", "lunch", "dinner", "snack"] as const).map((type) => {
            const label = { breakfast: "Petit-déjeuner", lunch: "Déjeuner", dinner: "Dîner", snack: "Collation" }[type];
            const items = meals.filter((m) => m.mealType === type);
            const isActive = currentMealType === type;

            return (
              <div key={type} className="space-y-2">
                <button
                  type="button"
                  onClick={() => setCurrentMealType(type)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                    isActive ? "bg-primary-50 border-2 border-primary-300" : "bg-gray-50 border-2 border-transparent hover:bg-gray-100"
                  }`}
                >
                  <span className={`text-sm font-semibold ${isActive ? "text-primary-700" : "text-gray-700"}`}>
                    {label}
                  </span>
                  {items.length > 0 && (
                    <span className="text-xs text-gray-500">
                      {items.reduce((s, m) => s + parseInt(m.calories || "0"), 0)} kcal
                    </span>
                  )}
                </button>

                {/* Liste des aliments de ce repas */}
                {items.length > 0 && (
                  <div className="ml-3 space-y-1">
                    {items.map((meal) => (
                      <div key={meal.id} className="flex items-center gap-2 p-2 bg-white rounded border">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">{meal.description}</p>
                          <p className="text-xs text-gray-500">
                            {meal.calories} kcal · P: {meal.protein}g · G: {meal.carbs}g · L: {meal.fats}g
                          </p>
                        </div>
                        {meal.photo && <Camera className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />}
                        <button
                          type="button"
                          onClick={() => removeMeal(meal.id)}
                          className="text-red-400 hover:text-red-600 flex-shrink-0 p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Formulaire d'ajout pour le type actif */}
                {isActive && (
                  <div className="ml-3 space-y-3 p-3 border-2 border-dashed border-gray-300 rounded-lg">
                    <FoodSearch onSelect={handleFoodSelect} />
                    <div>
                      <label className="label">Photo du plat (optionnel)</label>
                      <input type="file" accept="image/*" onChange={handlePhotoChange} className="input" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Totaux journaliers */}
          {meals.length > 0 && (
            <div className="pt-3 border-t">
              <p className="text-lg font-bold">
                Total : <span className="text-primary-600">{totalCalories} kcal</span>
              </p>
              <p className="text-sm text-gray-600">
                Protéines: <span className="font-semibold">{Math.round(totalProtein * 10) / 10}g</span>
                {" · "}Glucides: <span className="font-semibold">{Math.round(totalCarbs * 10) / 10}g</span>
                {" · "}Lipides: <span className="font-semibold">{Math.round(totalFats * 10) / 10}g</span>
              </p>
            </div>
          )}
        </div>
      </Card>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Enregistrement..." : "Enregistrer mes données"}
      </Button>
    </form>
  );
};
