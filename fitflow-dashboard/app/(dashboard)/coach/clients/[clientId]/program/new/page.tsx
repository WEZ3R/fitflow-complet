"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { clientsAPI, programsAPI, templatesAPI } from "@/lib/api";
import { CalorieCalculator } from "@/components/nutrition/CalorieCalculator";
import {
  Scale,
  Calendar,
  Utensils,
  Droplet,
  Moon,
  Activity,
  ChevronRight,
  Target,
  Plus,
  Trash2,
  CheckCircle,
  Copy,
  Save,
} from "lucide-react";

interface CustomGoal {
  title: string;
  description: string;
}

interface ProgramData {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  cycleDays: string;
}

interface Template {
  id: string;
  name: string;
  description?: string;
  cycleDays?: string;
  dietEnabled: boolean;
  dietType?: string;
  targetCalories?: string;
  waterTrackingEnabled: boolean;
  waterGoal?: string;
  sleepTrackingEnabled: boolean;
  weightTrackingEnabled: boolean;
  customGoalsData?: CustomGoal[];
}

interface Client {
  user: {
    firstName: string;
    lastName: string;
  };
}

export default function Page({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = React.use(params);
  const router = useRouter();

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");

  // Informations de base du programme
  const [programData, setProgramData] = useState<ProgramData>({
    title: "",
    description: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    cycleDays: "",
  });

  // Options Diet
  const [dietEnabled, setDietEnabled] = useState(false);
  const [dietType, setDietType] = useState("calories");
  const [targetCalories, setTargetCalories] = useState("");

  // Options Stats
  const [waterTrackingEnabled, setWaterTrackingEnabled] = useState(false);
  const [waterGoal, setWaterGoal] = useState("");
  const [sleepTrackingEnabled, setSleepTrackingEnabled] = useState(false);
  const [weightTrackingEnabled, setWeightTrackingEnabled] = useState(false);

  // Objectifs personnalises
  const [customGoals, setCustomGoals] = useState<CustomGoal[]>([]);

  useEffect(() => {
    fetchClient();
    fetchTemplates();
  }, [clientId]);

  const fetchClient = async () => {
    try {
      const response = await clientsAPI.getById(clientId);
      setClient(response.data.data);
    } catch (error) {
      console.error("Error fetching client:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await templatesAPI.getAll();
      setTemplates(response.data.data);
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  };

  const applyTemplate = async (templateId: string) => {
    try {
      const response = await templatesAPI.getById(templateId);
      const template = response.data.data;

      setProgramData({
        ...programData,
        title: template.name,
        description: template.description || "",
        cycleDays: template.cycleDays || "",
      });

      setDietEnabled(template.dietEnabled);
      setDietType(template.dietType || "calories");
      setTargetCalories(template.targetCalories || "");
      setWaterTrackingEnabled(template.waterTrackingEnabled);
      setWaterGoal(template.waterGoal || "");
      setSleepTrackingEnabled(template.sleepTrackingEnabled);
      setWeightTrackingEnabled(template.weightTrackingEnabled);

      if (template.customGoalsData && Array.isArray(template.customGoalsData)) {
        setCustomGoals(template.customGoalsData);
      }

      setSelectedTemplate(templateId);
    } catch (error) {
      console.error("Error applying template:", error);
      alert("Erreur lors de l'application du template");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (selectedTemplate) {
        const response = await templatesAPI.apply(selectedTemplate, {
          clientId,
          title: programData.title,
          description: programData.description,
          startDate: programData.startDate,
          endDate: programData.endDate || null,
        });
        const newProgramId = response.data.data.id;
        router.push(`/coach/programs/${newProgramId}/calendar`);
        return;
      }

      const programPayload = {
        ...programData,
        clientId: clientId,
        dietEnabled,
        dietType: dietEnabled ? dietType : null,
        targetCalories:
          dietEnabled && dietType === "calories"
            ? parseInt(targetCalories)
            : null,
        waterTrackingEnabled,
        waterGoal:
          waterTrackingEnabled && waterGoal ? parseFloat(waterGoal) : null,
        sleepTrackingEnabled,
        weightTrackingEnabled,
        customGoals: customGoals.filter((g) => g.title.trim() !== ""),
      };

      const response = await programsAPI.create(programPayload);
      const newProgramId = response.data.data.id;

      if (saveAsTemplate && templateName.trim()) {
        try {
          await templatesAPI.create({
            name: templateName,
            description: programData.description,
            cycleDays: programData.cycleDays
              ? parseInt(programData.cycleDays)
              : null,
            dietEnabled,
            dietType: dietEnabled ? dietType : null,
            targetCalories:
              dietEnabled && dietType === "calories"
                ? parseInt(targetCalories)
                : null,
            waterTrackingEnabled,
            waterGoal:
              waterTrackingEnabled && waterGoal ? parseFloat(waterGoal) : null,
            sleepTrackingEnabled,
            weightTrackingEnabled,
            customGoalsData: customGoals.filter((g) => g.title.trim() !== ""),
            sessionsData: [],
          });
        } catch (templateError) {
          console.error("Error saving template:", templateError);
        }
      }

      router.push(`/coach/programs/${newProgramId}/calendar`);
    } catch (error) {
      console.error("Error creating program:", error);
      alert("Erreur lors de la creation du programme");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Chargement...</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Client non trouve</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Creer un programme
        </h1>
        <p className="text-gray-600 mt-2">
          Pour {client.user.firstName} {client.user.lastName}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Template Selection */}
        {templates.length > 0 && (
          <Card>
            <div className="flex items-start gap-3">
              <Copy className="h-5 w-5 text-primary-600 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-2">
                  Utiliser un programme type
                </h3>
                <select
                  value={selectedTemplate || ""}
                  onChange={(e) => {
                    const templateId = e.target.value;
                    if (templateId) {
                      applyTemplate(templateId);
                    } else {
                      setSelectedTemplate(null);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Creer un nouveau programme</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                {selectedTemplate && (
                  <p className="text-sm text-green-600 mt-2">
                    Template applique. Les seances et objectifs seront crees
                    automatiquement.
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Save as Template */}
        {!selectedTemplate && (
          <Card>
            <div className="flex items-start gap-3">
              <Save className="h-5 w-5 text-orange-600 mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <input
                    type="checkbox"
                    id="saveAsTemplate"
                    checked={saveAsTemplate}
                    onChange={(e) => setSaveAsTemplate(e.target.checked)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label
                    htmlFor="saveAsTemplate"
                    className="font-semibold text-gray-900 cursor-pointer"
                  >
                    Sauvegarder comme programme type
                  </label>
                </div>
                {saveAsTemplate && (
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Nom du template (ex: Programme debutant)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                )}
                <p className="text-xs text-gray-500 mt-2">
                  Le programme sera sauvegarde comme template reutilisable pour
                  d&apos;autres clients
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Informations de base */}
        <Card title="Informations du programme">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Titre du programme *
              </label>
              <input
                type="text"
                required
                value={programData.title}
                onChange={(e) =>
                  setProgramData({ ...programData, title: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Ex: Programme de remise en forme"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={programData.description}
                onChange={(e) =>
                  setProgramData({
                    ...programData,
                    description: e.target.value,
                  })
                }
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Decrivez les objectifs et le contenu du programme..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de debut *
                </label>
                <input
                  type="date"
                  required
                  value={programData.startDate}
                  onChange={(e) =>
                    setProgramData({
                      ...programData,
                      startDate: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de fin
                </label>
                <input
                  type="date"
                  value={programData.endDate}
                  onChange={(e) =>
                    setProgramData({ ...programData, endDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cycle (jours)
                </label>
                <input
                  type="number"
                  min="1"
                  value={programData.cycleDays}
                  onChange={(e) =>
                    setProgramData({
                      ...programData,
                      cycleDays: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Ex: 7"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Options Nutrition */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Utensils className="h-5 w-5 text-primary-600" />
              <div>
                <h3 className="font-semibold text-gray-900">
                  Suivi Nutrition
                </h3>
                <p className="text-sm text-gray-600">
                  Activer le suivi alimentaire
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={dietEnabled}
                onChange={(e) => setDietEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          {dietEnabled && (
            <div className="space-y-4 pl-8 border-l-2 border-primary-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type de suivi
                </label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="dietType"
                      value="calories"
                      checked={dietType === "calories"}
                      onChange={(e) => setDietType(e.target.value)}
                      className="w-4 h-4 text-primary-600"
                    />
                    <div>
                      <p className="font-medium text-gray-900">
                        Objectif calorique
                      </p>
                      <p className="text-sm text-gray-600">
                        Le client suit un objectif de calories quotidiennes
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="dietType"
                      value="menu"
                      checked={dietType === "menu"}
                      onChange={(e) => setDietType(e.target.value)}
                      className="w-4 h-4 text-primary-600"
                    />
                    <div>
                      <p className="font-medium text-gray-900">
                        Menu personnalise
                      </p>
                      <p className="text-sm text-gray-600">
                        Le client coche les plats qu&apos;il a suivis
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {dietType === "calories" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Objectif calorique quotidien (kcal)
                  </label>
                  <div className="relative">
                    <Target className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="number"
                      min="0"
                      value={targetCalories}
                      onChange={(e) => setTargetCalories(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Ex: 2000"
                    />
                  </div>
                  <CalorieCalculator
                    clientId={clientId}
                    onApply={(calories) => setTargetCalories(calories.toString())}
                  />
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Options Statistiques */}
        <Card title="Suivi des statistiques">
          <div className="space-y-4">
            {/* Water Tracking */}
            <div className="border rounded-lg">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center space-x-3">
                  <Droplet className="h-5 w-5 text-blue-600" />
                  <div>
                    <h4 className="font-medium text-gray-900">
                      Consommation d&apos;eau
                    </h4>
                    <p className="text-sm text-gray-600">
                      Le client pourra enregistrer sa consommation d&apos;eau
                      quotidienne
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={waterTrackingEnabled}
                    onChange={(e) => setWaterTrackingEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              {waterTrackingEnabled && (
                <div className="px-4 pb-4 border-t border-gray-200 pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Objectif quotidien d&apos;eau (litres)
                  </label>
                  <div className="relative max-w-xs">
                    <Droplet className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-400" />
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={waterGoal}
                      onChange={(e) => setWaterGoal(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: 2.5"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Le client verra cet objectif lors du remplissage de ses
                    donnees quotidiennes
                  </p>
                </div>
              )}
            </div>

            {/* Sleep Tracking */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <Moon className="h-5 w-5 text-purple-600" />
                <div>
                  <h4 className="font-medium text-gray-900">
                    Horaires de sommeil
                  </h4>
                  <p className="text-sm text-gray-600">
                    Le client pourra enregistrer ses heures de coucher et de
                    reveil
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={sleepTrackingEnabled}
                  onChange={(e) => setSleepTrackingEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            {/* Scale Tracking */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <Scale className="h-5 w-5 text-orange-600" />
                <div>
                  <h4 className="font-medium text-gray-900">Suivi du poids</h4>
                  <p className="text-sm text-gray-600">
                    Le client pourra enregistrer son poids quotidiennement
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={weightTrackingEnabled}
                  onChange={(e) => setWeightTrackingEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
              </label>
            </div>
          </div>
        </Card>

        {/* Objectifs Personnalises */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <h3 className="font-semibold text-gray-900">
                  Objectifs quotidiens personnalises
                </h3>
                <p className="text-sm text-gray-600">
                  Ajoutez des objectifs que le client pourra cocher chaque jour
                </p>
              </div>
            </div>
            <Button
              type="button"
              onClick={() =>
                setCustomGoals([
                  ...customGoals,
                  { title: "", description: "" },
                ])
              }
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          </div>

          {customGoals.length > 0 ? (
            <div className="space-y-3">
              {customGoals.map((goal, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 border rounded-lg bg-gray-50"
                >
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={goal.title}
                      onChange={(e) => {
                        const updated = [...customGoals];
                        updated[index].title = e.target.value;
                        setCustomGoals(updated);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Ex: Faire 10 minutes de meditation"
                    />
                    <input
                      type="text"
                      value={goal.description}
                      onChange={(e) => {
                        const updated = [...customGoals];
                        updated[index].description = e.target.value;
                        setCustomGoals(updated);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Description optionnelle..."
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomGoals(
                        customGoals.filter((_, i) => i !== index)
                      );
                    }}
                    className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-lg transition-colors"
                    title="Supprimer l'objectif"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <CheckCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 mb-2">
                Aucun objectif personnalise
              </p>
              <p className="text-sm text-gray-500">
                Cliquez sur &quot;Ajouter&quot; pour creer des objectifs
                quotidiens
              </p>
            </div>
          )}

          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Exemples d&apos;objectifs :</strong> &quot;Boire un verre
              d&apos;eau au reveil&quot;, &quot;Faire 20 minutes de
              marche&quot;, &quot;Prendre mes vitamines&quot;, &quot;Mediter 10
              minutes&quot;
            </p>
          </div>
        </Card>

        {/* Info Seances */}
        <Card>
          <div className="flex items-center space-x-3 mb-4">
            <Activity className="h-5 w-5 text-green-600" />
            <div>
              <h3 className="font-semibold text-gray-900">
                Seances d&apos;entrainement
              </h3>
              <p className="text-sm text-gray-600">
                Vous pourrez definir les seances jour par jour apres la creation
                du programme
              </p>
            </div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800 flex items-center">
              <Calendar className="h-4 w-4 mr-2" />
              Un calendrier vous permettra de planifier les exercices
              quotidiennement
            </p>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push("/coach/dashboard")}
          >
            Annuler
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Creation..." : "Creer le programme"}
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </form>
    </div>
  );
}
