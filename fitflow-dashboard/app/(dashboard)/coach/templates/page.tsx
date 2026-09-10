"use client";

import { useState, useEffect, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { templatesAPI, sessionTemplatesAPI } from "@/lib/api";
import {
  Trash2, Activity, Calendar, Utensils, Droplet, Moon, Target,
  Plus, X, Scale, Dumbbell, Pencil, ChevronDown, ChevronUp, BedDouble,
  Copy, Clipboard, ClipboardCheck, GripVertical,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ExerciseSearch from "@/app/(dashboard)/coach/programs/[programId]/sessions/_components/exercise-search";
import BodyMap from "@/app/(dashboard)/coach/analytics/_components/BodyMap";
import type { ExerciseReference } from "@/types";

// ─── Sortable wrapper (render-prop) ──────────────────────────────────────────

interface SortableHandleProps {
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
  isDragging: boolean;
}

function SortableItem({ id, children }: { id: string; children: (props: SortableHandleProps) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : "auto",
    position: "relative",
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners, isDragging })}
    </div>
  );
}

// Génère un ID stable pour les exercices côté UI (pas persisté)
let _exerciseIdCounter = 0;
const nextExerciseId = () => `ex-${Date.now()}-${++_exerciseIdCounter}`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrackingFeature {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

interface CustomGoal { title: string; description: string; }

interface ExerciseItem {
  id?: string; // ID UI uniquement (drag-and-drop), pas persisté
  name: string;
  category: "WARMUP" | "MAIN" | "RENFORCEMENT" | "CARDIO" | "STRETCHING";
  sets?: number;
  reps?: string;
  weight?: string;
  restTime?: string;
  description?: string;
  gifUrl?: string;
  exerciseRefId?: string;
  targetMuscles?: string[];
  secondaryMuscles?: string[];
  bodyParts?: string[];
  order: number;
}

interface TemplateSessionItem {
  dayNumber: number;
  isRestDay: boolean;
  name?: string;
  notes?: string;
  exercises: ExerciseItem[];
}

interface ProgramTemplate {
  id: string;
  name: string;
  description?: string;
  cycleDays?: number;
  dietEnabled?: boolean;
  dietType?: string;
  targetCalories?: number;
  waterTrackingEnabled?: boolean;
  waterGoal?: number;
  sleepTrackingEnabled?: boolean;
  weightTrackingEnabled?: boolean;
  sessionsData?: TemplateSessionItem[];
  customGoalsData?: CustomGoal[];
  nutritionObjective?: string;
  nutritionActivityFactor?: number;
  nutritionSurplus?: number;
  nutritionDeficit?: number;
  createdAt: string;
}

interface SessionTemplate {
  id: string;
  name: string;
  description?: string;
  exercisesData: ExerciseItem[];
  createdAt: string;
  updatedAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<ExerciseItem["category"], string> = {
  WARMUP: "Échauffement", MAIN: "Principal", RENFORCEMENT: "Renforcement",
  CARDIO: "Cardio", STRETCHING: "Étirements",
};

const CATEGORY_COLORS: Record<ExerciseItem["category"], string> = {
  WARMUP: "bg-orange-100 text-orange-700",
  MAIN: "bg-indigo-100 text-indigo-700",
  RENFORCEMENT: "bg-primary-100 text-primary-700",
  CARDIO: "bg-red-100 text-red-700",
  STRETCHING: "bg-green-100 text-green-700",
};

const emptyExercise = (): ExerciseItem => ({
  id: nextExerciseId(),
  name: "", category: "MAIN", sets: undefined, reps: "", weight: "", restTime: "", description: "", order: 0,
});

// Garantit qu'un exercice (potentiellement chargé depuis l'API) a un id UI
const withId = (ex: ExerciseItem): ExerciseItem => (ex.id ? ex : { ...ex, id: nextExerciseId() });

const ACTIVITY_PRESETS = [
  { value: 1.2,  label: "Sédentaire",   detail: "Peu ou pas d'exercice" },
  { value: 1.37, label: "Léger",        detail: "1–3 séances/semaine" },
  { value: 1.55, label: "Modéré",       detail: "3–5 séances/semaine" },
  { value: 1.72, label: "Intense",      detail: "6–7 séances/semaine" },
  { value: 1.9,  label: "Très intense", detail: "2× par jour" },
];

type NutritionObjective = "maintien" | "prise_de_masse" | "seche";

const NUTRITION_OBJECTIVES: { value: NutritionObjective; label: string; activeColor: string }[] = [
  { value: "maintien",       label: "Maintien",       activeColor: "border-blue-400 bg-blue-50 text-blue-700" },
  { value: "prise_de_masse", label: "Prise de masse", activeColor: "border-green-400 bg-green-50 text-green-700" },
  { value: "seche",          label: "Sèche",          activeColor: "border-orange-400 bg-orange-50 text-orange-700" },
];

const defaultProgramForm = {
  name: "", description: "", cycleDays: "",
  dietEnabled: false, dietType: "calories", targetCalories: "",
  waterTrackingEnabled: false, waterGoal: "",
  sleepTrackingEnabled: false, weightTrackingEnabled: false,
  nutritionObjective: "" as NutritionObjective | "",
  nutritionActivityFactor: 1.55,
  nutritionSurplus: "",
  nutritionDeficit: "",
  useNutritionCalc: false,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const [tab, setTab] = useState<"program" | "session">("session");

  // Programme templates
  const [programTemplates, setProgramTemplates] = useState<ProgramTemplate[]>([]);
  const [programLoading, setProgramLoading] = useState(true);
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [savingProgram, setSavingProgram] = useState(false);
  const [editingProgramTemplate, setEditingProgramTemplate] = useState<ProgramTemplate | null>(null);
  const [programForm, setProgramForm] = useState(defaultProgramForm);
  const [customGoals, setCustomGoals] = useState<CustomGoal[]>([]);
  const [templateSessions, setTemplateSessions] = useState<TemplateSessionItem[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [expandedTExercise, setExpandedTExercise] = useState<number | null>(null);
  const [copiedSession, setCopiedSession] = useState<TemplateSessionItem | null>(null);

  // Session templates
  const [sessionTemplates, setSessionTemplates] = useState<SessionTemplate[]>([]);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [editingSession, setEditingSession] = useState<SessionTemplate | null>(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionForm, setSessionForm] = useState({ name: "", description: "" });
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [savingSession, setSavingSession] = useState(false);
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null);

  useEffect(() => { fetchProgramTemplates(); fetchSessionTemplates(); }, []);

  // Verrouille le scroll de l'arrière-plan quand un modal est ouvert
  useEffect(() => {
    if (showProgramModal || showSessionModal) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [showProgramModal, showSessionModal]);

  // ── Program templates ──────────────────────────────────────────────────────

  const fetchProgramTemplates = async () => {
    try {
      const r = await templatesAPI.getAll();
      setProgramTemplates(r.data.data);
    } catch (e) { console.error(e); }
    finally { setProgramLoading(false); }
  };

  const openNewProgram = () => {
    setEditingProgramTemplate(null);
    setProgramForm(defaultProgramForm);
    setCustomGoals([]);
    setTemplateSessions([]);
    setSelectedDay(null);
    setExpandedTExercise(null);
    setCopiedSession(null);
    setShowProgramModal(true);
  };

  const openEditProgram = (tpl: ProgramTemplate) => {
    setEditingProgramTemplate(tpl);
    setProgramForm({
      name: tpl.name,
      description: tpl.description || "",
      cycleDays: tpl.cycleDays?.toString() || "",
      dietEnabled: tpl.dietEnabled || false,
      dietType: tpl.dietType || "calories",
      targetCalories: tpl.targetCalories?.toString() || "",
      waterTrackingEnabled: tpl.waterTrackingEnabled || false,
      waterGoal: tpl.waterGoal?.toString() || "",
      sleepTrackingEnabled: tpl.sleepTrackingEnabled || false,
      weightTrackingEnabled: tpl.weightTrackingEnabled || false,
      nutritionObjective: (tpl.nutritionObjective as NutritionObjective | "") || "",
      nutritionActivityFactor: tpl.nutritionActivityFactor ?? 1.55,
      nutritionSurplus: tpl.nutritionSurplus?.toString() || "",
      nutritionDeficit: tpl.nutritionDeficit?.toString() || "",
      useNutritionCalc: !!(tpl.nutritionObjective && tpl.nutritionActivityFactor),
    });
    setCustomGoals(Array.isArray(tpl.customGoalsData) ? (tpl.customGoalsData as CustomGoal[]) : []);
    setTemplateSessions(Array.isArray(tpl.sessionsData)
      ? (tpl.sessionsData as TemplateSessionItem[]).map((s) => ({ ...s, exercises: s.exercises.map(withId) }))
      : []);
    setSelectedDay(null);
    setExpandedTExercise(null);
    setCopiedSession(null);
    setShowProgramModal(true);
  };

  const handleDeleteProgram = async (id: string) => {
    if (!confirm("Supprimer ce template ?")) return;
    try {
      await templatesAPI.delete(id);
      setProgramTemplates((p) => p.filter((t) => t.id !== id));
    } catch (e) { console.error(e); }
  };

  const handleSubmitProgram = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!programForm.name.trim()) return;
    setSavingProgram(true);
    try {
      const payload: Record<string, unknown> = {
        name: programForm.name.trim(),
        description: programForm.description.trim() || undefined,
        cycleDays: programForm.cycleDays ? parseInt(programForm.cycleDays) : undefined,
        dietEnabled: programForm.dietEnabled,
        dietType: programForm.dietEnabled ? programForm.dietType : undefined,
        targetCalories: programForm.dietEnabled && programForm.targetCalories ? parseInt(programForm.targetCalories) : undefined,
        waterTrackingEnabled: programForm.waterTrackingEnabled,
        waterGoal: programForm.waterTrackingEnabled && programForm.waterGoal ? parseFloat(programForm.waterGoal) : undefined,
        sleepTrackingEnabled: programForm.sleepTrackingEnabled,
        weightTrackingEnabled: programForm.weightTrackingEnabled,
        nutritionObjective: programForm.useNutritionCalc && programForm.nutritionObjective ? programForm.nutritionObjective : null,
        nutritionActivityFactor: programForm.useNutritionCalc && programForm.nutritionObjective ? programForm.nutritionActivityFactor : null,
        nutritionSurplus: programForm.useNutritionCalc && programForm.nutritionObjective === "prise_de_masse" && programForm.nutritionSurplus ? parseInt(programForm.nutritionSurplus as string) : null,
        nutritionDeficit: programForm.useNutritionCalc && programForm.nutritionObjective === "seche" && programForm.nutritionDeficit ? parseInt(programForm.nutritionDeficit as string) : null,
        customGoalsData: customGoals.filter((g) => g.title.trim()),
        sessionsData: templateSessions
          .filter((s) => !s.isRestDay ? s.exercises.some((e) => e.name.trim()) : true)
          .sort((a, b) => a.dayNumber - b.dayNumber)
          .map((s) => ({
            ...s,
            exercises: s.exercises
              .filter((e) => e.name.trim())
              .map((e, i) => ({ ...e, order: i })),
          })),
      };

      if (editingProgramTemplate) {
        const r = await templatesAPI.update(editingProgramTemplate.id, payload);
        setProgramTemplates((prev) => prev.map((t) => t.id === editingProgramTemplate.id ? r.data.data : t));
      } else {
        const r = await templatesAPI.create(payload);
        setProgramTemplates((prev) => [r.data.data, ...prev]);
      }
      setShowProgramModal(false);
    } catch (e) { console.error(e); }
    finally { setSavingProgram(false); }
  };

  // ── Template sessions helpers ──────────────────────────────────────────────

  const addSessionForDay = (day: number) => {
    setTemplateSessions((prev) => {
      const filtered = prev.filter((s) => s.dayNumber !== day);
      return [...filtered, { dayNumber: day, isRestDay: false, name: "", notes: "", exercises: [emptyExercise()] }];
    });
    setSelectedDay(day);
    setExpandedTExercise(null);
  };

  const removeSessionForDay = (day: number) => {
    setTemplateSessions((prev) => prev.filter((s) => s.dayNumber !== day));
    if (selectedDay === day) setSelectedDay(null);
    setExpandedTExercise(null);
  };

  const updateDaySession = (day: number, field: keyof TemplateSessionItem, value: unknown) => {
    setTemplateSessions((prev) => prev.map((s) => s.dayNumber === day ? { ...s, [field]: value } : s));
  };

  const applySessionTemplate = (day: number, tpl: SessionTemplate) => {
    setTemplateSessions((prev) => prev.map((s) =>
      s.dayNumber === day
        ? { ...s, exercises: tpl.exercisesData.map((ex, i) => withId({ ...ex, order: i })) }
        : s
    ));
    setExpandedTExercise(null);
  };

  const addTExercise = (sIdx: number) => {
    setTemplateSessions((prev) => prev.map((s, i) => {
      if (i !== sIdx) return s;
      const eIdx = s.exercises.length;
      const updated = [...s.exercises, { ...emptyExercise(), order: eIdx }];
      return { ...s, exercises: updated };
    }));
    setExpandedTExercise(templateSessions[sIdx]?.exercises.length ?? 0);
  };

  const updateTExercise = (sIdx: number, eIdx: number, field: keyof ExerciseItem, value: unknown) => {
    setTemplateSessions((prev) => prev.map((s, i) => {
      if (i !== sIdx) return s;
      return { ...s, exercises: s.exercises.map((ex, j) => j === eIdx ? { ...ex, [field]: value } : ex) };
    }));
  };

  const removeTExercise = (sIdx: number, eIdx: number) => {
    setTemplateSessions((prev) => prev.map((s, i) => {
      if (i !== sIdx) return s;
      return { ...s, exercises: s.exercises.filter((_, j) => j !== eIdx).map((ex, j) => ({ ...ex, order: j })) };
    }));
    setExpandedTExercise(null);
  };

  const handleTExerciseRefSelect = (sIdx: number, eIdx: number, ref: ExerciseReference) => {
    const categoryMap: Record<string, ExerciseItem["category"]> = {
      STRENGTH: "MAIN", CARDIO: "CARDIO", STRETCHING: "STRETCHING",
    };
    updateTExercise(sIdx, eIdx, "name", ref.name);
    setTemplateSessions((prev) => prev.map((s, i) => {
      if (i !== sIdx) return s;
      return {
        ...s, exercises: s.exercises.map((ex, j) => j === eIdx ? {
          ...ex,
          name: ref.name,
          exerciseRefId: ref.id,
          gifUrl: ref.gifUrl || "",
          category: categoryMap[ref.exerciseType] || ex.category,
          targetMuscles: ref.targetMuscles,
          secondaryMuscles: ref.secondaryMuscles,
          bodyParts: ref.bodyParts,
        } : ex),
      };
    }));
  };

  // ── DnD (drag-and-drop) ───────────────────────────────────────────────────
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Réordonnancement des exercices d'une séance dans un template de programme
  const handleProgramSessionDragEnd = (sIdx: number) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setTemplateSessions((prev) => prev.map((s, i) => {
      if (i !== sIdx) return s;
      const oldIndex = s.exercises.findIndex((ex) => ex.id === active.id);
      const newIndex = s.exercises.findIndex((ex) => ex.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return s;
      return { ...s, exercises: arrayMove(s.exercises, oldIndex, newIndex).map((ex, j) => ({ ...ex, order: j })) };
    }));
  };

  // ── Session templates ──────────────────────────────────────────────────────

  const fetchSessionTemplates = async () => {
    try {
      const r = await sessionTemplatesAPI.getAll();
      setSessionTemplates(r.data.data);
    } catch (e) { console.error(e); }
    finally { setSessionLoading(false); }
  };

  const openNewSession = () => {
    setEditingSession(null);
    setSessionForm({ name: "", description: "" });
    setExercises([emptyExercise()]);
    setExpandedExercise(0);
    setShowSessionModal(true);
  };

  const openEditSession = (tpl: SessionTemplate) => {
    setEditingSession(tpl);
    setSessionForm({ name: tpl.name, description: tpl.description || "" });
    setExercises(tpl.exercisesData.length > 0 ? tpl.exercisesData.map((ex, i) => withId({ ...ex, order: i })) : [emptyExercise()]);
    setExpandedExercise(null);
    setShowSessionModal(true);
  };

  const handleSubmitSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionForm.name.trim()) return;
    setSavingSession(true);
    try {
      const payload = {
        name: sessionForm.name.trim(),
        description: sessionForm.description.trim() || undefined,
        exercisesData: exercises.filter((ex) => ex.name.trim()).map((ex, i) => ({ ...ex, order: i })),
      };
      if (editingSession) {
        const r = await sessionTemplatesAPI.update(editingSession.id, payload);
        setSessionTemplates((prev) => prev.map((t) => t.id === editingSession.id ? r.data.data : t));
      } else {
        const r = await sessionTemplatesAPI.create(payload);
        setSessionTemplates((prev) => [r.data.data, ...prev]);
      }
      setShowSessionModal(false);
    } catch (e) { console.error(e); }
    finally { setSavingSession(false); }
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm("Supprimer ce template de séance ?")) return;
    try {
      await sessionTemplatesAPI.delete(id);
      setSessionTemplates((p) => p.filter((t) => t.id !== id));
    } catch (e) { console.error(e); }
  };

  const addExercise = () => {
    const idx = exercises.length;
    setExercises((prev) => [...prev, { ...emptyExercise(), order: idx }]);
    setExpandedExercise(idx);
  };

  const updateExercise = (idx: number, field: keyof ExerciseItem, value: unknown) => {
    setExercises((prev) => prev.map((ex, i) => i === idx ? { ...ex, [field]: value } : ex));
  };

  const removeExercise = (idx: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== idx).map((ex, i) => ({ ...ex, order: i })));
    setExpandedExercise(null);
  };

  const handleExerciseRefSelect = (idx: number, ref: ExerciseReference) => {
    const categoryMap: Record<string, ExerciseItem["category"]> = {
      STRENGTH: "MAIN", CARDIO: "CARDIO", STRETCHING: "STRETCHING",
    };
    setExercises((prev) => prev.map((ex, i) => i === idx ? {
      ...ex, name: ref.name, exerciseRefId: ref.id, gifUrl: ref.gifUrl || "",
      category: categoryMap[ref.exerciseType] || ex.category,
      targetMuscles: ref.targetMuscles, secondaryMuscles: ref.secondaryMuscles,
      bodyParts: ref.bodyParts,
    } : ex));
  };

  // Réordonnancement des exercices d'un template de séance autonome
  const handleSessionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setExercises((prev) => {
      const oldIndex = prev.findIndex((ex) => ex.id === active.id);
      const newIndex = prev.findIndex((ex) => ex.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex).map((ex, i) => ({ ...ex, order: i }));
    });
  };

  const getTrackingFeatures = (t: ProgramTemplate): TrackingFeature[] => {
    const f: TrackingFeature[] = [];
    if (t.dietEnabled) f.push({ icon: Utensils, label: "Nutrition" });
    if (t.waterTrackingEnabled) f.push({ icon: Droplet, label: "Eau" });
    if (t.sleepTrackingEnabled) f.push({ icon: Moon, label: "Sommeil" });
    if (t.weightTrackingEnabled) f.push({ icon: Scale, label: "Poids" });
    return f;
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Templates</h1>
          <p className="text-gray-600 mt-1">Réutilisez vos structures d&apos;entraînement</p>
        </div>
        <Button onClick={tab === "session" ? openNewSession : openNewProgram}>
          <Plus className="h-4 w-4 mr-2" />
          {tab === "session" ? "Nouvelle séance type" : "Nouveau programme type"}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        {(["session", "program"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? "bg-primary-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "session"
              ? <span className="flex items-center gap-2"><Dumbbell className="h-4 w-4" />Séances</span>
              : <span className="flex items-center gap-2"><Calendar className="h-4 w-4" />Programmes</span>}
          </button>
        ))}
      </div>

      {/* ── Session templates tab ── */}
      {tab === "session" && (
        <>
          {sessionLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
            </div>
          ) : sessionTemplates.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <Dumbbell className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune séance type</h3>
                <p className="text-gray-600 mb-6">Créez votre première séance type pour la réutiliser avec vos clients</p>
                <Button onClick={openNewSession}><Plus className="h-4 w-4 mr-2" />Créer une séance type</Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {sessionTemplates.map((tpl) => {
                const exCount = Array.isArray(tpl.exercisesData) ? tpl.exercisesData.length : 0;
                const byCategory = (tpl.exercisesData || []).reduce((acc, ex) => {
                  acc[ex.category] = (acc[ex.category] || 0) + 1; return acc;
                }, {} as Record<string, number>);
                const cardVolumes: Record<string, number> = {};
                for (const ex of tpl.exercisesData || []) {
                  for (const bp of (ex as ExerciseItem).bodyParts ?? []) {
                    cardVolumes[bp] = (cardVolumes[bp] ?? 0) + 1;
                  }
                }
                const cardMaxVolume = Math.max(0, ...Object.values(cardVolumes));
                return (
                  <Card key={tpl.id} className="hover:shadow-lg transition-shadow">
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{tpl.name}</h3>
                          {tpl.description && <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{tpl.description}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-3">
                        <Activity className="h-4 w-4 text-indigo-500 shrink-0" />
                        <span>{exCount} exercice{exCount !== 1 ? "s" : ""}</span>
                      </div>
                      {Object.entries(byCategory).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {Object.entries(byCategory).map(([cat, count]) => (
                            <span key={cat} className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[cat as ExerciseItem["category"]] ?? "bg-gray-100 text-gray-600"}`}>
                              {CATEGORY_LABELS[cat as ExerciseItem["category"]] ?? cat} ×{count}
                            </span>
                          ))}
                        </div>
                      )}
                      {cardMaxVolume > 0 && (
                        <div className="mb-4 flex justify-center">
                          <BodyMap gender={null} muscleVolumes={cardVolumes} maxVolume={cardMaxVolume} />
                        </div>
                      )}
                      <div className="flex gap-2 pt-3 border-t border-gray-100">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditSession(tpl)}>
                          <Pencil className="h-3.5 w-3.5 mr-1.5" /> Modifier
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDeleteSession(tpl.id)} className="text-red-500 border-red-200 hover:bg-red-50">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">Modifié le {new Date(tpl.updatedAt).toLocaleDateString("fr-FR")}</p>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Program templates tab ── */}
      {tab === "program" && (
        <>
          {programLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
            </div>
          ) : programTemplates.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <Activity className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun programme type</h3>
                <p className="text-gray-600 mb-6">Créez votre premier programme type pour le réutiliser avec vos clients</p>
                <Button onClick={openNewProgram}><Plus className="h-4 w-4 mr-2" />Créer un programme type</Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {programTemplates.map((t) => {
                const features = getTrackingFeatures(t);
                const sessionsCount = Array.isArray(t.sessionsData) ? t.sessionsData.length : 0;
                const goalsCount = Array.isArray(t.customGoalsData) ? t.customGoalsData.length : 0;
                return (
                  <Card key={t.id} className="hover:shadow-lg transition-shadow">
                    <div className="p-5">
                      <h3 className="font-semibold text-gray-900 mb-1">{t.name}</h3>
                      {t.description && <p className="text-sm text-gray-500 line-clamp-2 mb-3">{t.description}</p>}
                      <div className="space-y-1.5 mb-3">
                        {t.cycleDays && <div className="flex items-center text-sm text-gray-600"><Calendar className="h-4 w-4 mr-2 text-primary-500" />{t.cycleDays} jours de cycle</div>}
                        {sessionsCount > 0 && <div className="flex items-center text-sm text-gray-600"><Activity className="h-4 w-4 mr-2 text-green-500" />{sessionsCount} séance{sessionsCount > 1 ? "s" : ""}</div>}
                        {goalsCount > 0 && <div className="flex items-center text-sm text-gray-600"><Target className="h-4 w-4 mr-2 text-orange-500" />{goalsCount} objectif{goalsCount > 1 ? "s" : ""}</div>}
                      </div>
                      {features.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {features.map((f, i) => (
                            <div key={i} className="flex items-center bg-gray-100 rounded-full px-2.5 py-0.5 text-xs text-gray-700">
                              <f.icon className="h-3 w-3 mr-1" />{f.label}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2 pt-3 border-t border-gray-100">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditProgram(t)}>
                          <Pencil className="h-3.5 w-3.5 mr-1.5" />Modifier
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDeleteProgram(t.id)} className="text-red-500 border-red-200 hover:bg-red-50">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">Créé le {new Date(t.createdAt).toLocaleDateString("fr-FR")}</p>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═══════ Modal séance type ═══════ */}
      {showSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowSessionModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b shrink-0">
              <h2 className="text-lg font-bold text-gray-900">
                {editingSession ? "Modifier la séance type" : "Nouvelle séance type"}
              </h2>
              <button onClick={() => setShowSessionModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitSession} className="flex flex-col flex-1 overflow-hidden">
              <div className="overflow-y-auto overscroll-contain flex-1 p-5 space-y-5">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom <span className="text-red-500">*</span></label>
                    <input type="text" required value={sessionForm.name} onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })} placeholder="Ex: Full body débutant, PPL Push..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea value={sessionForm.description} onChange={(e) => setSessionForm({ ...sessionForm, description: e.target.value })} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
                  </div>
                </div>
                {(() => {
                  // Volume par body part = nombre d'exercices qui le sollicitent
                  const muscleVolumes: Record<string, number> = {};
                  for (const ex of exercises) {
                    for (const bp of ex.bodyParts ?? []) {
                      muscleVolumes[bp] = (muscleVolumes[bp] ?? 0) + 1;
                    }
                  }
                  const maxVolume = Math.max(0, ...Object.values(muscleVolumes));
                  if (maxVolume === 0) return null;
                  return (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs font-medium text-gray-500 mb-2">Muscles ciblés</p>
                      <div className="flex justify-center">
                        <BodyMap gender={null} muscleVolumes={muscleVolumes} maxVolume={maxVolume} />
                      </div>
                    </div>
                  );
                })()}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">
                    Exercices <span className="text-gray-400 font-normal">({exercises.filter(e => e.name.trim()).length})</span>
                  </h3>
                  <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleSessionDragEnd}>
                    <SortableContext items={exercises.map((e) => e.id ?? "")} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {exercises.map((ex, idx) => {
                          const isOpen = expandedExercise === idx;
                          return (
                            <SortableItem key={ex.id ?? idx} id={ex.id ?? `tmp-${idx}`}>
                              {({ attributes, listeners }) => (
                                <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50">
                                    <button
                                      type="button"
                                      {...attributes}
                                      {...listeners}
                                      className="text-gray-300 hover:text-gray-600 cursor-grab active:cursor-grabbing shrink-0"
                                      aria-label="Glisser pour réorganiser"
                                    >
                                      <GripVertical className="h-4 w-4" />
                                    </button>
                                    <span className="text-xs text-gray-400 w-4 shrink-0">{idx + 1}</span>
                                    {ex.gifUrl && <img src={ex.gifUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0 bg-gray-100" loading="lazy" />}
                                    <div className="flex-1 min-w-0">
                                      <ExerciseSearch value={ex.name} onChange={(v) => updateExercise(idx, "name", v)} onSelect={(ref) => handleExerciseRefSelect(idx, ref)} placeholder="Rechercher ou saisir un exercice..." />
                                    </div>
                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${CATEGORY_COLORS[ex.category]}`}>{CATEGORY_LABELS[ex.category]}</span>
                                    <button type="button" onClick={() => setExpandedExercise(isOpen ? null : idx)} className="text-gray-400 hover:text-gray-600 shrink-0">
                                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </button>
                                    <button type="button" onClick={() => removeExercise(idx)} className="text-gray-300 hover:text-red-500 shrink-0"><X className="h-4 w-4" /></button>
                                  </div>
                                  {isOpen && (
                                    <div className="p-3 border-t border-gray-100 space-y-3">
                                      <div>
                                        <label className="block text-xs text-gray-500 mb-1">Catégorie</label>
                                        <div className="flex flex-wrap gap-1.5">
                                          {(["WARMUP", "MAIN", "RENFORCEMENT", "CARDIO", "STRETCHING"] as const).map((cat) => (
                                            <button key={cat} type="button" onClick={() => updateExercise(idx, "category", cat)} className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${ex.category === cat ? CATEGORY_COLORS[cat] : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                                              {CATEGORY_LABELS[cat]}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                        <div><label className="block text-xs text-gray-500 mb-1">Séries</label><input type="number" min={1} value={ex.sets ?? ""} onChange={(e) => updateExercise(idx, "sets", e.target.value ? parseInt(e.target.value) : undefined)} placeholder="3" className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-400" /></div>
                                        <div><label className="block text-xs text-gray-500 mb-1">Reps</label><input type="text" value={ex.reps ?? ""} onChange={(e) => updateExercise(idx, "reps", e.target.value)} placeholder="12 ou 8-12" className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-400" /></div>
                                        <div><label className="block text-xs text-gray-500 mb-1">Charge</label><input type="text" value={ex.weight ?? ""} onChange={(e) => updateExercise(idx, "weight", e.target.value)} placeholder="20kg" className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-400" /></div>
                                        <div><label className="block text-xs text-gray-500 mb-1">Repos</label><input type="text" value={ex.restTime ?? ""} onChange={(e) => updateExercise(idx, "restTime", e.target.value)} placeholder="90s" className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-400" /></div>
                                      </div>
                                      <div><label className="block text-xs text-gray-500 mb-1">Notes</label><input type="text" value={ex.description ?? ""} onChange={(e) => updateExercise(idx, "description", e.target.value)} placeholder="Consignes, variantes..." className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-400" /></div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </SortableItem>
                          );
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                  <button
                    type="button"
                    onClick={addExercise}
                    className={`w-full border-2 border-dashed rounded-lg text-sm transition-colors ${
                      exercises.length === 0
                        ? 'border-gray-200 py-4 text-gray-400 hover:border-primary-300 hover:text-primary-500'
                        : 'border-gray-200 py-2.5 mt-2 text-gray-500 hover:border-primary-300 hover:text-primary-600'
                    }`}
                  >
                    <Plus className="h-4 w-4 inline mr-1" /> Ajouter un exercice
                  </button>
                </div>
              </div>
              <div className="flex gap-3 p-5 border-t shrink-0">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowSessionModal(false)} disabled={savingSession}>Annuler</Button>
                <Button type="submit" className="flex-1" disabled={savingSession || !sessionForm.name.trim()}>
                  {savingSession ? "Enregistrement..." : editingSession ? "Enregistrer" : "Créer la séance type"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════ Modal programme type ═══════ */}
      {showProgramModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowProgramModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b shrink-0">
              <h2 className="text-lg font-bold text-gray-900">
                {editingProgramTemplate ? "Modifier le programme type" : "Nouveau programme type"}
              </h2>
              <button onClick={() => setShowProgramModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitProgram} className="flex flex-col flex-1 overflow-hidden">
              <div className="overflow-y-auto overscroll-contain flex-1 p-5 space-y-6">

                {/* ── Section 1 : Informations générales ── */}
                <section>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Informations générales</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nom <span className="text-red-500">*</span></label>
                      <input type="text" required value={programForm.name} onChange={(e) => setProgramForm({ ...programForm, name: e.target.value })} placeholder="Ex: Full Body Débutant 4 semaines" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea value={programForm.description} onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })} rows={2} placeholder="Décrivez ce programme type..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Durée du cycle (jours)</label>
                      <input type="number" min={1} value={programForm.cycleDays} onChange={(e) => setProgramForm({ ...programForm, cycleDays: e.target.value })} placeholder="Ex: 28" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                  </div>
                </section>

                <hr className="border-gray-100" />

                {/* ── Section 2 : Constantes à suivre ── */}
                <section>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Constantes à suivre</h3>
                  <div className="space-y-3">

                    {/* Nutrition */}
                    <div className="rounded-lg border border-gray-200 p-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <div className={`p-1.5 rounded-lg ${programForm.dietEnabled ? "bg-orange-100" : "bg-gray-100"}`}>
                          <Utensils className={`h-4 w-4 ${programForm.dietEnabled ? "text-orange-600" : "text-gray-400"}`} />
                        </div>
                        <span className="flex-1 text-sm font-medium text-gray-800">Nutrition</span>
                        <input type="checkbox" checked={programForm.dietEnabled} onChange={(e) => setProgramForm({ ...programForm, dietEnabled: e.target.checked })} className="accent-primary-600 h-4 w-4" />
                      </label>
                      {programForm.dietEnabled && (
                        <div className="mt-3 ml-10 space-y-2">
                          <div className="flex gap-2">
                            {(["calories", "menu"] as const).map((t) => (
                              <button key={t} type="button" onClick={() => setProgramForm({ ...programForm, dietType: t })}
                                className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors border ${programForm.dietType === t ? "bg-orange-50 border-orange-300 text-orange-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                                {t === "calories" ? "Objectif calories" : "Menu planifié"}
                              </button>
                            ))}
                          </div>
                          {programForm.dietType === "calories" && (
                            <div className="space-y-3">
                              {/* Option A : valeur fixe */}
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Calories fixes (optionnel)</label>
                                <div className="flex items-center gap-2">
                                  <input type="number" min={500} max={6000} value={programForm.targetCalories} onChange={(e) => setProgramForm({ ...programForm, targetCalories: e.target.value })} placeholder="2000" className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-400" />
                                  <span className="text-xs text-gray-500 shrink-0">kcal/jour</span>
                                </div>
                              </div>

                              {/* Option B : calcul automatique via stats du client */}
                              <div className="rounded-lg border border-indigo-200 overflow-hidden">
                                <button type="button"
                                  onClick={() => setProgramForm((f) => ({ ...f, useNutritionCalc: !f.useNutritionCalc }))}
                                  className="w-full flex items-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 transition-colors text-left">
                                  <span className="flex-1 text-xs font-medium text-indigo-700">Calcul auto selon les stats du client</span>
                                  {programForm.useNutritionCalc
                                    ? <ChevronUp className="h-3.5 w-3.5 text-indigo-400" />
                                    : <ChevronDown className="h-3.5 w-3.5 text-indigo-400" />}
                                </button>

                                {programForm.useNutritionCalc && (
                                  <div className="p-3 space-y-3 bg-white">
                                    <p className="text-[11px] text-indigo-600 bg-indigo-50 rounded px-2 py-1.5">
                                      Les calories seront calculées automatiquement à partir des stats du client (poids, taille, âge, genre) lors de l&apos;application du template.
                                    </p>

                                    {/* Objectif */}
                                    <div>
                                      <p className="text-xs font-medium text-gray-500 mb-1.5">Objectif</p>
                                      <div className="flex gap-1.5">
                                        {NUTRITION_OBJECTIVES.map((obj) => (
                                          <button key={obj.value} type="button"
                                            onClick={() => setProgramForm((f) => ({ ...f, nutritionObjective: obj.value }))}
                                            className={`flex-1 py-1.5 px-2 rounded-lg border text-xs font-medium transition-colors ${programForm.nutritionObjective === obj.value ? obj.activeColor : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                                            {obj.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Surplus / Déficit */}
                                    {programForm.nutritionObjective === "prise_de_masse" && (
                                      <div className="flex items-center gap-2 bg-green-50 rounded px-2 py-1.5">
                                        <span className="text-xs text-green-700 flex-1">Surplus</span>
                                        <input type="number" min={50} max={1000} value={programForm.nutritionSurplus}
                                          onChange={(e) => setProgramForm((f) => ({ ...f, nutritionSurplus: e.target.value }))}
                                          placeholder="300" className="w-16 border border-green-300 rounded px-2 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-green-400" />
                                        <span className="text-xs text-green-600">kcal</span>
                                      </div>
                                    )}
                                    {programForm.nutritionObjective === "seche" && (
                                      <div className="flex items-center gap-2 bg-orange-50 rounded px-2 py-1.5">
                                        <span className="text-xs text-orange-700 flex-1">Déficit</span>
                                        <input type="number" min={50} max={1000} value={programForm.nutritionDeficit}
                                          onChange={(e) => setProgramForm((f) => ({ ...f, nutritionDeficit: e.target.value }))}
                                          placeholder="400" className="w-16 border border-orange-300 rounded px-2 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-orange-400" />
                                        <span className="text-xs text-orange-600">kcal</span>
                                      </div>
                                    )}

                                    {/* Niveau d'activité */}
                                    <div>
                                      <p className="text-xs font-medium text-gray-500 mb-1.5">Niveau d&apos;activité</p>
                                      <div className="grid grid-cols-5 gap-1">
                                        {ACTIVITY_PRESETS.map((preset) => (
                                          <button key={preset.value} type="button"
                                            onClick={() => setProgramForm((f) => ({ ...f, nutritionActivityFactor: preset.value }))}
                                            title={`${preset.label} — ${preset.detail}`}
                                            className={`py-1.5 px-1 rounded-lg border text-xs font-medium transition-colors text-center leading-tight ${programForm.nutritionActivityFactor === preset.value ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                                            <span className="block font-bold">{preset.value}</span>
                                            <span className="block text-[9px] opacity-75">{preset.label}</span>
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Eau */}
                    <div className="rounded-lg border border-gray-200 p-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <div className={`p-1.5 rounded-lg ${programForm.waterTrackingEnabled ? "bg-blue-100" : "bg-gray-100"}`}>
                          <Droplet className={`h-4 w-4 ${programForm.waterTrackingEnabled ? "text-blue-600" : "text-gray-400"}`} />
                        </div>
                        <span className="flex-1 text-sm font-medium text-gray-800">Hydratation</span>
                        <input type="checkbox" checked={programForm.waterTrackingEnabled} onChange={(e) => setProgramForm({ ...programForm, waterTrackingEnabled: e.target.checked })} className="accent-primary-600 h-4 w-4" />
                      </label>
                      {programForm.waterTrackingEnabled && (
                        <div className="mt-3 ml-10 flex items-center gap-2">
                          <input type="number" min={0.5} max={10} step={0.1} value={programForm.waterGoal} onChange={(e) => setProgramForm({ ...programForm, waterGoal: e.target.value })} placeholder="2.5" className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-400" />
                          <span className="text-xs text-gray-500 shrink-0">L/jour</span>
                        </div>
                      )}
                    </div>

                    {/* Sommeil */}
                    <div className="rounded-lg border border-gray-200 p-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <div className={`p-1.5 rounded-lg ${programForm.sleepTrackingEnabled ? "bg-purple-100" : "bg-gray-100"}`}>
                          <BedDouble className={`h-4 w-4 ${programForm.sleepTrackingEnabled ? "text-purple-600" : "text-gray-400"}`} />
                        </div>
                        <span className="flex-1 text-sm font-medium text-gray-800">Sommeil</span>
                        <input type="checkbox" checked={programForm.sleepTrackingEnabled} onChange={(e) => setProgramForm({ ...programForm, sleepTrackingEnabled: e.target.checked })} className="accent-primary-600 h-4 w-4" />
                      </label>
                    </div>

                    {/* Poids */}
                    <div className="rounded-lg border border-gray-200 p-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <div className={`p-1.5 rounded-lg ${programForm.weightTrackingEnabled ? "bg-green-100" : "bg-gray-100"}`}>
                          <Scale className={`h-4 w-4 ${programForm.weightTrackingEnabled ? "text-green-600" : "text-gray-400"}`} />
                        </div>
                        <span className="flex-1 text-sm font-medium text-gray-800">Poids corporel</span>
                        <input type="checkbox" checked={programForm.weightTrackingEnabled} onChange={(e) => setProgramForm({ ...programForm, weightTrackingEnabled: e.target.checked })} className="accent-primary-600 h-4 w-4" />
                      </label>
                    </div>

                  </div>
                </section>

                <hr className="border-gray-100" />

                {/* ── Section 3 : Objectifs quotidiens ── */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Objectifs quotidiens</h3>
                    <button type="button" onClick={() => setCustomGoals((g) => [...g, { title: "", description: "" }])} className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium">
                      <Plus className="h-3.5 w-3.5" /> Ajouter
                    </button>
                  </div>
                  {customGoals.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">Aucun objectif. Ex: &quot;10 min de méditation&quot;, &quot;Marcher 8000 pas&quot;</p>
                  ) : (
                    <div className="space-y-2">
                      {customGoals.map((g, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <div className="flex-1 space-y-1.5">
                            <input type="text" value={g.title} onChange={(e) => setCustomGoals((prev) => prev.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} placeholder="Titre de l'objectif *" className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-400" />
                            <input type="text" value={g.description} onChange={(e) => setCustomGoals((prev) => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder="Description (optionnelle)" className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-400" />
                          </div>
                          <button type="button" onClick={() => setCustomGoals((prev) => prev.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500 mt-1 shrink-0">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <hr className="border-gray-100" />

                {/* ── Section 4 : Séances ── */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                      Séances{" "}
                      <span className="text-gray-400 font-normal normal-case">
                        ({templateSessions.filter((s) => !s.isRestDay).length} entraînement
                        {templateSessions.filter((s) => !s.isRestDay).length > 1 ? "s" : ""},
                        {" "}{templateSessions.filter((s) => s.isRestDay).length} repos)
                      </span>
                    </h3>
                  </div>

                  {!programForm.cycleDays ? (
                    <p className="text-sm text-gray-400 italic bg-gray-50 rounded-lg px-3 py-2.5">
                      Définissez d&apos;abord la durée du cycle pour planifier les séances.
                    </p>
                  ) : (() => {
                    const totalDays = parseInt(programForm.cycleDays) || 0;
                    if (totalDays < 1) return null;

                    // ── Calendar grid ──
                    const weeks = Math.ceil(totalDays / 7);
                    const cells = Array.from({ length: totalDays }, (_, i) => i);

                    return (
                      <div className="space-y-3">
                        {/* Day-of-week header */}
                        <div className="grid grid-cols-7 gap-1">
                          {["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"].map((d) => (
                            <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-0.5">{d}</div>
                          ))}
                        </div>

                        {/* Day cells */}
                        <div className="grid grid-cols-7 gap-1">
                          {cells.map((day) => {
                            const session = templateSessions.find((s) => s.dayNumber === day);
                            const exCount = session && !session.isRestDay
                              ? session.exercises.filter((e) => e.name.trim()).length
                              : 0;
                            const isSelected = selectedDay === day;

                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => {
                                  if (!session) {
                                    addSessionForDay(day);
                                  } else {
                                    setSelectedDay(isSelected ? null : day);
                                    setExpandedTExercise(null);
                                  }
                                }}
                                className={`relative rounded-lg border p-1.5 text-center transition-all min-h-[52px] flex flex-col items-center justify-center gap-0.5 ${
                                  isSelected
                                    ? "border-primary-500 ring-2 ring-primary-500 ring-offset-1"
                                    : session
                                      ? session.isRestDay
                                        ? "border-blue-200 bg-blue-50 hover:border-blue-300"
                                        : "border-green-200 bg-green-50 hover:border-green-300"
                                      : "border-gray-200 bg-gray-50 hover:border-primary-300 hover:bg-primary-50"
                                }`}
                              >
                                <span className="text-[10px] font-bold text-gray-500">J{day + 1}</span>
                                {session ? (
                                  session.isRestDay ? (
                                    <span className="text-[9px] font-medium text-blue-600 leading-tight">Repos</span>
                                  ) : (
                                    <span className="text-[9px] font-medium text-green-600 leading-tight">
                                      {exCount > 0 ? `${exCount}ex` : "vide"}
                                    </span>
                                  )
                                ) : (
                                  <Plus className="h-3 w-3 text-gray-300" />
                                )}
                              </button>
                            );
                          })}
                          {/* Padding cells to complete last row */}
                          {Array.from({ length: weeks * 7 - totalDays }, (_, i) => (
                            <div key={`pad-${i}`} className="min-h-[52px]" />
                          ))}
                        </div>

                        {/* ── Day editor ── */}
                        {selectedDay !== null && (() => {
                          const session = templateSessions.find((s) => s.dayNumber === selectedDay);
                          if (!session) return null;
                          const sIdx = templateSessions.findIndex((s) => s.dayNumber === selectedDay);
                          const exCount = session.exercises.filter((e) => e.name.trim()).length;

                          return (
                            <div className="border border-gray-200 rounded-xl overflow-hidden">
                              {/* Day editor header */}
                              <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                                <span className="text-sm font-bold text-gray-800">Jour {selectedDay + 1}</span>
                                <div className="flex-1" />

                                {/* Copy / Paste */}
                                <button
                                  type="button"
                                  title="Copier cette séance"
                                  onClick={() => setCopiedSession({ ...session })}
                                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors ${
                                    copiedSession?.dayNumber === session.dayNumber
                                      ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                                      : "border-gray-200 text-gray-500 hover:bg-gray-100"
                                  }`}
                                >
                                  <Copy className="h-3 w-3" /> Copier
                                </button>
                                {copiedSession && copiedSession.dayNumber !== selectedDay && (
                                  <button
                                    type="button"
                                    title="Coller la séance copiée"
                                    onClick={() => {
                                      setTemplateSessions((prev) => prev.map((s) =>
                                        s.dayNumber === selectedDay
                                          ? { ...copiedSession, dayNumber: selectedDay }
                                          : s
                                      ));
                                      setExpandedTExercise(null);
                                    }}
                                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                                  >
                                    <ClipboardCheck className="h-3 w-3" /> Coller
                                  </button>
                                )}

                                {/* Rest toggle */}
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={session.isRestDay}
                                    onChange={(e) => {
                                      updateDaySession(selectedDay, "isRestDay", e.target.checked);
                                      setExpandedTExercise(null);
                                    }}
                                    className="accent-primary-600"
                                  />
                                  <span className="text-xs text-gray-600">Repos</span>
                                </label>

                                {/* Delete day */}
                                <button
                                  type="button"
                                  onClick={() => removeSessionForDay(selectedDay)}
                                  className="text-gray-300 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>

                              <div className="p-3 space-y-3">
                                {/* Notes */}
                                <input
                                  type="text"
                                  value={session.notes || ""}
                                  onChange={(e) => updateDaySession(selectedDay, "notes", e.target.value)}
                                  placeholder="Notes de séance..."
                                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-400"
                                />

                                {!session.isRestDay && (
                                  <div>
                                    {/* Session template picker — select natif */}
                                    <div className="mb-3 flex items-center gap-2">
                                      <Clipboard className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                                      <select
                                        value=""
                                        onChange={(e) => {
                                          const tpl = sessionTemplates.find((t) => t.id === e.target.value);
                                          if (tpl) applySessionTemplate(selectedDay, tpl);
                                        }}
                                        className="flex-1 border border-indigo-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                      >
                                        <option value="" disabled>Importer une séance type...</option>
                                        {sessionTemplates.map((tpl) => (
                                          <option key={tpl.id} value={tpl.id}>
                                            {tpl.name} ({tpl.exercisesData.length} ex.)
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* Exercise list */}
                                    <span className="text-xs font-semibold text-gray-700 block mb-2">
                                      Exercices <span className="text-gray-400 font-normal">({exCount})</span>
                                    </span>

                                    <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleProgramSessionDragEnd(sIdx)}>
                                      <SortableContext items={session.exercises.map((e) => e.id ?? "")} strategy={verticalListSortingStrategy}>
                                        <div className="space-y-1.5">
                                          {session.exercises.map((ex, eIdx) => {
                                            const isExOpen = expandedTExercise === eIdx;
                                            return (
                                              <SortableItem key={ex.id ?? eIdx} id={ex.id ?? `tmp-${sIdx}-${eIdx}`}>
                                                {({ attributes, listeners }) => (
                                                  <div className="border border-gray-100 rounded-lg overflow-hidden bg-white">
                                                    <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50/50">
                                                      <button
                                                        type="button"
                                                        {...attributes}
                                                        {...listeners}
                                                        className="text-gray-300 hover:text-gray-600 cursor-grab active:cursor-grabbing shrink-0"
                                                        aria-label="Glisser pour réorganiser"
                                                      >
                                                        <GripVertical className="h-3.5 w-3.5" />
                                                      </button>
                                                      <span className="text-xs text-gray-400 w-3 shrink-0">{eIdx + 1}</span>
                                                      {ex.gifUrl && <img src={ex.gifUrl} alt="" className="w-7 h-7 rounded object-cover shrink-0 bg-gray-100" loading="lazy" />}
                                                      <div className="flex-1 min-w-0">
                                                        <ExerciseSearch
                                                          value={ex.name}
                                                          onChange={(v) => updateTExercise(sIdx, eIdx, "name", v)}
                                                          onSelect={(ref) => handleTExerciseRefSelect(sIdx, eIdx, ref)}
                                                          placeholder="Exercice..."
                                                        />
                                                      </div>
                                                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${CATEGORY_COLORS[ex.category]}`}>
                                                        {CATEGORY_LABELS[ex.category]}
                                                      </span>
                                                      <button type="button" onClick={() => setExpandedTExercise(isExOpen ? null : eIdx)} className="text-gray-400 hover:text-gray-600 shrink-0">
                                                        {isExOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                                      </button>
                                                      <button type="button" onClick={() => removeTExercise(sIdx, eIdx)} className="text-gray-300 hover:text-red-500 shrink-0">
                                                        <X className="h-3.5 w-3.5" />
                                                      </button>
                                                    </div>
                                                    {isExOpen && (
                                                      <div className="p-2.5 border-t border-gray-100 space-y-2">
                                                        <div className="flex flex-wrap gap-1">
                                                          {(["WARMUP", "MAIN", "RENFORCEMENT", "CARDIO", "STRETCHING"] as const).map((cat) => (
                                                            <button key={cat} type="button" onClick={() => updateTExercise(sIdx, eIdx, "category", cat)}
                                                              className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${ex.category === cat ? CATEGORY_COLORS[cat] : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                                                              {CATEGORY_LABELS[cat]}
                                                            </button>
                                                          ))}
                                                        </div>
                                                        <div className="grid grid-cols-4 gap-1.5">
                                                          <div><label className="block text-[10px] text-gray-400 mb-0.5">Séries</label><input type="number" min={1} value={ex.sets ?? ""} onChange={(e) => updateTExercise(sIdx, eIdx, "sets", e.target.value ? parseInt(e.target.value) : undefined)} placeholder="3" className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-400" /></div>
                                                          <div><label className="block text-[10px] text-gray-400 mb-0.5">Reps</label><input type="text" value={ex.reps ?? ""} onChange={(e) => updateTExercise(sIdx, eIdx, "reps", e.target.value)} placeholder="12" className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-400" /></div>
                                                          <div><label className="block text-[10px] text-gray-400 mb-0.5">Charge</label><input type="text" value={ex.weight ?? ""} onChange={(e) => updateTExercise(sIdx, eIdx, "weight", e.target.value)} placeholder="20kg" className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-400" /></div>
                                                          <div><label className="block text-[10px] text-gray-400 mb-0.5">Repos</label><input type="text" value={ex.restTime ?? ""} onChange={(e) => updateTExercise(sIdx, eIdx, "restTime", e.target.value)} placeholder="90s" className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-400" /></div>
                                                        </div>
                                                        <div><label className="block text-[10px] text-gray-400 mb-0.5">Notes</label><input type="text" value={ex.description ?? ""} onChange={(e) => updateTExercise(sIdx, eIdx, "description", e.target.value)} placeholder="Consignes..." className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-400" /></div>
                                                      </div>
                                                    )}
                                                  </div>
                                                )}
                                              </SortableItem>
                                            );
                                          })}
                                        </div>
                                      </SortableContext>
                                    </DndContext>

                                    <button
                                      type="button"
                                      onClick={() => addTExercise(sIdx)}
                                      className={`w-full border border-dashed rounded-lg text-xs transition-colors mt-1.5 ${
                                        session.exercises.length === 0
                                          ? 'border-gray-200 py-2.5 text-gray-400 hover:border-primary-300 hover:text-primary-500'
                                          : 'border-gray-200 py-2 text-gray-500 hover:border-primary-300 hover:text-primary-600'
                                      }`}
                                    >
                                      <Plus className="h-3 w-3 inline mr-1" /> Ajouter un exercice
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}
                </section>

              </div>

              {/* Footer */}
              <div className="flex gap-3 p-5 border-t shrink-0">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowProgramModal(false)} disabled={savingProgram}>
                  Annuler
                </Button>
                <Button type="submit" className="flex-1" disabled={savingProgram || !programForm.name.trim()}>
                  {savingProgram ? "Enregistrement..." : editingProgramTemplate ? "Enregistrer" : "Créer le template"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
