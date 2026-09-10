'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { sessionsAPI } from '@/lib/api';
import {
  Save,
  Trash2,
  Plus,
  Video,
  Image as ImageIcon,
  FileText,
  Flame,
  Dumbbell,
  Wind,
  Heart,
  Timer,
  ChevronUp,
  Copy,
  CheckCircle2,
  Info,
  Link2,
  Unlink2,
  Layers,
  GripVertical,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ─── Sortable wrapper (render-prop) ──────────────────────────────────────────

interface SortableHandleProps {
  attributes: ReturnType<typeof useSortable>['attributes'];
  listeners: ReturnType<typeof useSortable>['listeners'];
  isDragging: boolean;
}

function SortableItem({ id, children }: { id: string; children: (props: SortableHandleProps) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 'auto',
    position: 'relative',
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners, isDragging })}
    </div>
  );
}
import type { Exercise, SetCompletion, ExerciseReference } from '@/types';
import { setStatus, setStatusColors, isValidReps, isValidDuration } from '@/lib/setComparison';
import ExerciseSearch from './exercise-search';
import ExerciseDetailModal from './exercise-detail-modal';

// ─── Types ───────────────────────────────────────────────────────────────────

type ExerciseCategory = 'WARMUP' | 'MAIN' | 'RENFORCEMENT' | 'CARDIO' | 'STRETCHING';

interface DraftExercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  sets: string;
  reps: string;
  weight: string;
  usePerSetWeights: boolean;
  setWeights: string[];
  duration: string;
  restTime: string;
  videoUrl: string;
  gifUrl: string;
  description: string;
  exerciseRefId: string;
  exerciseRef?: ExerciseReference;
  setCompletions?: SetCompletion[];
  supersetGroup?: string | null;
}

interface SessionEditorProps {
  programId: string;
  sessionId?: string | null;
  initialDate?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const EXERCISE_CATEGORIES: Record<ExerciseCategory, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  WARMUP: { label: 'Échauffement', icon: Flame, color: 'text-orange-600' },
  MAIN: { label: 'Musculation', icon: Dumbbell, color: 'text-blue-600' },
  // Travail compté en TEMPS et non en répétitions : gainage, chaise, planche.
  RENFORCEMENT: { label: 'Renforcement (temps)', icon: Timer, color: 'text-primary-600' },
  CARDIO: { label: 'Cardio', icon: Heart, color: 'text-red-600' },
  STRETCHING: { label: 'Étirements', icon: Wind, color: 'text-purple-600' },
};

function createDraftExercise(): DraftExercise {
  return {
    id: `temp-${Date.now()}-${Math.random()}`,
    name: '',
    category: 'MAIN',
    sets: '',
    reps: '',
    weight: '',
    usePerSetWeights: false,
    setWeights: [],
    duration: '',
    restTime: '',
    videoUrl: '',
    gifUrl: '',
    description: '',
    exerciseRefId: '',
    supersetGroup: null,
  };
}

// Retourne un mapping { groupUUID → label "A", "B", ... } pour l'affichage
function buildSupersetLabels(exercises: DraftExercise[]): Record<string, string> {
  const labels: Record<string, string> = {};
  let idx = 0;
  exercises.forEach((ex) => {
    if (ex.supersetGroup && !labels[ex.supersetGroup]) {
      labels[ex.supersetGroup] = String.fromCharCode(65 + idx); // A, B, C...
      idx++;
    }
  });
  return labels;
}

const SUPERSET_COLORS = [
  { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-400', connector: 'bg-violet-400' },
  { bg: 'bg-sky-100',    text: 'text-sky-700',    border: 'border-sky-400',    connector: 'bg-sky-400' },
  { bg: 'bg-emerald-100',text: 'text-emerald-700',border: 'border-emerald-400',connector: 'bg-emerald-400' },
  { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-400',  connector: 'bg-amber-400' },
  { bg: 'bg-rose-100',   text: 'text-rose-700',   border: 'border-rose-400',   connector: 'bg-rose-400' },
];

function getSupersetColor(label: string) {
  const idx = label.charCodeAt(0) - 65; // A=0, B=1, ...
  return SUPERSET_COLORS[idx % SUPERSET_COLORS.length];
}

// ─── Rest Time Input ──────────────────────────────────────────────────────────

/**
 * Saisie du temps de repos.
 *
 * Champ unique et libre, au format du reste du produit — « 90s », « 2min ». La version
 * précédente offrait deux champs numériques « mm : ss » et écrivait « 1:30 » : elle
 * introduisait une seconde écriture dans le produit, et surtout elle était destructrice.
 * Sur une valeur existante comme « 90s », `split(':')` rendait ["90s"], qu'un
 * `input type="number"` ne sait pas afficher : le champ paraissait vide, et la moindre
 * modification réécrivait « X:00 » par-dessus la valeur d'origine.
 */
function RestTimeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-28 px-2 py-2 border border-gray-300 rounded-lg text-sm"
      placeholder="90s"
      aria-label="Temps de repos"
    />
  );
}

// ─── Set Completions (read-only) ──────────────────────────────────────────────

function SetCompletionsList({
  completions,
  exercise,
}: {
  completions: SetCompletion[];
  exercise: DraftExercise;
}) {
  if (completions.length === 0) return null;
  return (
    <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
      <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4" />
        Performances réalisées par le client
      </h4>
      <div className="space-y-2">
        {completions.map((c) => {
          const status = setStatus(exercise.reps, exercise.weight, c.repsAchieved, c.weightUsed);
          const { bg: bgColor, text: textColor } = setStatusColors[status];

          return (
            <div key={c.setNumber} className={`flex items-center gap-3 text-sm rounded px-3 py-2 border ${bgColor}`}>
              <span className={`font-semibold w-16 ${textColor}`}>Série {c.setNumber}</span>
              <div className="flex items-center gap-4 flex-1">
                <span>Reps: <strong className={textColor}>{c.repsAchieved}</strong> <span className="text-xs text-gray-500">(prévu: {exercise.reps})</span></span>
                <span>Poids: <strong className={textColor}>{c.weightUsed}</strong> <span className="text-xs text-gray-500">(prévu: {exercise.weight})</span></span>
              </div>
              {c.completed && <CheckCircle2 className={`h-4 w-4 ${textColor}`} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Exercise Fields ──────────────────────────────────────────────────────────

function ExerciseFields({
  exercise,
  index,
  onUpdate,
  onTogglePerSetWeights,
  onUpdateSetWeight,
}: {
  exercise: DraftExercise;
  index: number;
  onUpdate: (index: number, field: keyof DraftExercise, value: string) => void;
  onTogglePerSetWeights?: (index: number) => void;
  onUpdateSetWeight?: (ei: number, si: number, v: string) => void;
}) {
  const commonMedia = (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          <Video className="inline h-4 w-4 mr-1" />URL Vidéo
        </label>
        <input type="url" value={exercise.videoUrl} onChange={(e) => onUpdate(index, 'videoUrl', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="https://..." />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          <ImageIcon className="inline h-4 w-4 mr-1" />URL GIF
        </label>
        <input type="url" value={exercise.gifUrl} onChange={(e) => onUpdate(index, 'gifUrl', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="https://..." />
      </div>
    </>
  );

  if (exercise.category === 'MAIN') {
    const setCount = parseInt(exercise.sets) || 0;
    return (
      <>
        <div className={`grid gap-3 ${exercise.usePerSetWeights ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Séries</label>
            <input type="number" min="0" value={exercise.sets} onChange={(e) => onUpdate(index, 'sets', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="3" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Répétitions</label>
            <input
              type="text"
              inputMode="numeric"
              value={exercise.reps}
              onChange={(e) => onUpdate(index, 'reps', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                isValidReps(exercise.reps)
                  ? 'border-gray-300 focus:ring-indigo-500'
                  : 'border-red-400 bg-red-50 focus:ring-red-400'
              }`}
              placeholder="12 ou 8-12"
            />
            {!isValidReps(exercise.reps) && (
              <p className="text-xs text-red-600 mt-1">Format invalide. Utilisez un nombre (12) ou une plage (8-12).</p>
            )}
          </div>
          {!exercise.usePerSetWeights && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Poids</label>
              <input type="text" value={exercise.weight} onChange={(e) => onUpdate(index, 'weight', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="20kg" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Repos</label>
            <RestTimeInput value={exercise.restTime} onChange={(v) => onUpdate(index, 'restTime', v)} />
          </div>
        </div>

        <div className="mt-2">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <div onClick={() => onTogglePerSetWeights?.(index)} className={`relative w-9 h-5 rounded-full transition-colors ${exercise.usePerSetWeights ? 'bg-primary-600' : 'bg-gray-300'}`}>
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${exercise.usePerSetWeights ? 'translate-x-4' : ''}`} />
            </div>
            <span className="text-sm text-gray-600">Poids différents par série</span>
          </label>
          {exercise.usePerSetWeights && setCount > 0 && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {Array.from({ length: setCount }).map((_, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500 whitespace-nowrap">S{i + 1}</span>
                  <input type="text" value={exercise.setWeights[i] ?? ''} onChange={(e) => onUpdateSetWeight?.(index, i, e.target.value)} placeholder="20kg" className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
                </div>
              ))}
            </div>
          )}
        </div>

        {exercise.setCompletions && <SetCompletionsList completions={exercise.setCompletions} exercise={exercise} />}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{commonMedia}</div>
      </>
    );
  }

  // RENFORCEMENT : des séries, mais une DURÉE à tenir au lieu d'un nombre de
  // répétitions. Un gainage se prescrit « 3 × 45 s », pas « 3 × 12 ».
  if (exercise.category === 'RENFORCEMENT') {
    return (
      <>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Séries</label>
            <input
              type="number"
              min="0"
              value={exercise.sets}
              onChange={(e) => onUpdate(index, 'sets', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="3"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Timer className="inline h-4 w-4 mr-1" />Durée par série
            </label>
            <input
              type="text"
              value={exercise.duration}
              onChange={(e) => onUpdate(index, 'duration', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                isValidDuration(exercise.duration)
                  ? 'border-gray-300 focus:ring-primary-500'
                  : 'border-red-400 bg-red-50 focus:ring-red-400'
              }`}
              placeholder="45s ou 1min30"
            />
            {!isValidDuration(exercise.duration) && (
              <p className="text-xs text-red-600 mt-1">
                Format invalide. Utilisez 45s, 90s, 1min ou 1min30.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Temps de récup</label>
            <RestTimeInput value={exercise.restTime} onChange={(v) => onUpdate(index, 'restTime', v)} />
          </div>
        </div>
        {exercise.setCompletions && <SetCompletionsList completions={exercise.setCompletions} exercise={exercise} />}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{commonMedia}</div>
      </>
    );
  }

  if (exercise.category === 'CARDIO') {
    return (
      <>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Timer className="inline h-4 w-4 mr-1" />Durée
            </label>
            <input type="text" value={exercise.duration} onChange={(e) => onUpdate(index, 'duration', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="30min" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Temps de récup</label>
            <RestTimeInput value={exercise.restTime} onChange={(v) => onUpdate(index, 'restTime', v)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Séries</label>
            <input type="number" min="0" value={exercise.sets} onChange={(e) => onUpdate(index, 'sets', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="3" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{commonMedia}</div>
      </>
    );
  }

  // WARMUP and STRETCHING
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Timer className="inline h-4 w-4 mr-1" />Durée
          </label>
          <input
            type="text"
            value={exercise.duration}
            onChange={(e) => onUpdate(index, 'duration', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder={exercise.category === 'WARMUP' ? '10min' : '5min'}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{commonMedia}</div>
    </>
  );
}

// ─── Main SessionEditor Component ─────────────────────────────────────────────

export default function SessionEditor({ programId, sessionId, initialDate }: SessionEditorProps) {
  const router = useRouter();

  const [loading, setLoading] = useState(!!sessionId);
  const [saving, setSaving] = useState(false);
  const [sessionDate, setSessionDate] = useState(initialDate);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'DONE'>('DRAFT');
  const [notes, setNotes] = useState('');
  const [isRestDay, setIsRestDay] = useState(false);
  const [exercises, setExercises] = useState<DraftExercise[]>([]);
  const [animatingIndex, setAnimatingIndex] = useState<number | null>(null);
  const [animationDirection, setAnimationDirection] = useState<'up' | 'down' | null>(null);
  const [selectedExerciseForDetail, setSelectedExerciseForDetail] = useState<DraftExercise | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const toggleCollapse = (id: string) =>
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  // ─── DnD sensors ──────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setExercises((prev) => {
      const oldIndex = prev.findIndex((e) => e.id === active.id);
      const newIndex = prev.findIndex((e) => e.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  useEffect(() => {
    if (!sessionId) return;
    const fetchSession = async () => {
      try {
        const res = await sessionsAPI.getById(sessionId);
        const s = res.data.data;
        setSessionDate(new Date(s.date).toISOString().split('T')[0]);
        setName(s.name ?? '');
        setStatus(s.status);
        setNotes(s.notes ?? '');
        setIsRestDay(s.isRestDay);
        setExercises(
          (s.exercises ?? []).map((ex: Exercise) => ({
            id: ex.id,
            name: ex.name,
            category: ex.category as ExerciseCategory,
            sets: ex.sets?.toString() ?? '',
            reps: ex.reps ?? '',
            weight: (ex.weightsPerSet as string[] | null)?.length ? '' : (ex.weight ?? ''),
            usePerSetWeights: !!(ex.weightsPerSet as string[] | null)?.length,
            setWeights: (ex.weightsPerSet as string[] | null) ?? [],
            duration: ex.duration ?? '',
            restTime: ex.restTime ?? '',
            videoUrl: ex.videoUrl ?? '',
            gifUrl: ex.gifUrl ?? '',
            description: ex.description ?? '',
            exerciseRefId: ex.exerciseRefId ?? '',
            exerciseRef: ex.exerciseRef,
            setCompletions: ex.setCompletions,
            supersetGroup: ex.supersetGroup ?? null,
          }))
        );
      } catch {
        console.error('Error fetching session');
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, [sessionId]);

  const updateExercise = (index: number, field: keyof DraftExercise, value: string) => {
    setExercises((prev) => {
      const updated = [...prev];
      const ex = { ...updated[index], [field]: value };
      if (field === 'sets' && ex.usePerSetWeights)
        ex.setWeights = Array.from({ length: parseInt(value) || 0 }, (_, i) => ex.setWeights[i] ?? '');
      updated[index] = ex;
      return updated;
    });
  };

  const handleExerciseRefSelect = (index: number, ref: ExerciseReference) => {
    setExercises((prev) => {
      const updated = [...prev];
      // Mapper exerciseType vers ExerciseCategory
      const categoryMap: Record<string, ExerciseCategory> = {
        STRENGTH: 'MAIN',
        CARDIO: 'CARDIO',
        STRETCHING: 'STRETCHING',
      };
      updated[index] = {
        ...updated[index],
        name: ref.name,
        exerciseRefId: ref.id,
        exerciseRef: ref,
        gifUrl: ref.gifUrl || '',
        category: categoryMap[ref.exerciseType] || updated[index].category,
      };
      return updated;
    });
  };

  const togglePerSetWeights = (i: number) => setExercises((p) => { const u=[...p],ex={...u[i]};ex.usePerSetWeights=!ex.usePerSetWeights;if(ex.usePerSetWeights)ex.setWeights=Array.from({length:parseInt(ex.sets)||0},()=>ex.weight);u[i]=ex;return u; });
  const updateSetWeight = (ei: number, si: number, v: string) => setExercises((p) => { const u=[...p],ex={...u[ei]},w=[...(ex.setWeights??[])];w[si]=v;ex.setWeights=w;u[ei]=ex;return u; });
  const addExercise = () => setExercises((prev) => [...prev, createDraftExercise()]);

  const removeExercise = (index: number) =>
    setExercises((prev) => prev.filter((_, i) => i !== index));

  const duplicateExercise = (index: number) => {
    setExercises((prev) => {
      const copy = { ...prev[index], id: `temp-${Date.now()}-${Math.random()}` };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  };

  // Lie deux exercices consécutifs dans un même super-set
  const linkWithNext = (index: number) => {
    setExercises((prev) => {
      if (index >= prev.length - 1) return prev;
      const updated = [...prev];
      const current = updated[index];
      const next = updated[index + 1];
      const groupId = current.supersetGroup || next.supersetGroup || `ss-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      updated[index] = { ...current, supersetGroup: groupId };
      updated[index + 1] = { ...next, supersetGroup: groupId };
      return updated;
    });
  };

  // Retire un exercice de son super-set (et supprime le groupe si < 2 membres restants)
  const unlinkFromSuperset = (index: number) => {
    setExercises((prev) => {
      const groupId = prev[index].supersetGroup;
      if (!groupId) return prev;
      const updated = prev.map((ex, i) => i === index ? { ...ex, supersetGroup: null } : ex);
      // Si plus d'un seul membre restant dans le groupe, dissoudre le groupe entier
      const remaining = updated.filter((ex) => ex.supersetGroup === groupId);
      if (remaining.length < 2) {
        return updated.map((ex) => ex.supersetGroup === groupId ? { ...ex, supersetGroup: null } : ex);
      }
      return updated;
    });
  };

  const moveExercise = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= exercises.length) return;
    setAnimatingIndex(index);
    setAnimationDirection(direction);
    setTimeout(() => {
      setExercises((prev) => {
        const next = [...prev];
        [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
        return next;
      });
      setTimeout(() => { setAnimatingIndex(null); setAnimationDirection(null); }, 50);
    }, 150);
  };

  const handleSave = async (nextStatus?: 'DRAFT' | 'DONE') => {
    // Validation : refuser les reps non numériques (lettres, caractères spéciaux)
    const invalid = exercises
      .map((ex, i) => ({ ex, position: i + 1 }))
      .filter(({ ex }) => !isValidReps(ex.reps));
    if (invalid.length > 0) {
      const list = invalid.map(({ ex, position }) =>
        `  • Exercice ${position}${ex.name ? ` (${ex.name})` : ''} : « ${ex.reps} »`
      ).join('\n');
      alert(`Impossible d'enregistrer : les répétitions doivent être un nombre (ex. 12) ou une plage (ex. 8-12).\n\n${list}`);
      return;
    }

    const finalStatus = nextStatus ?? status;
    setStatus(finalStatus);
    setSaving(true);
    try {
      const cleanedExercises = exercises.map((ex, i) => {
        const cleaned: Record<string, unknown> = {
          name: ex.name,
          category: ex.category,
          order: i,
        };
        if (ex.sets) cleaned.sets = parseInt(ex.sets) || null;
        if (ex.reps) cleaned.reps = ex.reps;
        if (ex.weight) cleaned.weight = ex.weight;
        if (ex.duration) cleaned.duration = ex.duration;
        if (ex.restTime) cleaned.restTime = ex.restTime;
        if (ex.videoUrl) cleaned.videoUrl = ex.videoUrl;
        if (ex.gifUrl) cleaned.gifUrl = ex.gifUrl;
        if (ex.description) cleaned.description = ex.description;
        if (ex.exerciseRefId) cleaned.exerciseRefId = ex.exerciseRefId;
        if (ex.supersetGroup) cleaned.supersetGroup = ex.supersetGroup;
        if (ex.id && !ex.id.startsWith('temp-')) cleaned.id = ex.id;
        return cleaned;
      });

      await sessionsAPI.upsert({
        ...(sessionId ? { id: sessionId } : {}),
        programId,
        date: sessionDate,
        name: name || null,
        status: finalStatus,
        notes,
        isRestDay,
        exercises: cleanedExercises,
      });
      router.push(`/coach/programs/${programId}/calendar`);
    } catch {
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {sessionId ? 'Éditer la séance' : 'Nouvelle séance'}
        </h1>
        {sessionDate && (
          <p className="text-gray-600 mt-1">
            {new Date(sessionDate).toLocaleDateString('fr-FR', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
        )}
      </div>

      {/* Session options */}
      <Card>
        <div className="space-y-4">
          {/* Date (only for new sessions) */}
          {!sessionId && (
            <div>
              <label className="block font-medium text-gray-900 mb-1">Date de la séance</label>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          )}

          {/* Titre de la séance */}
          <div>
            <label className="block font-medium text-gray-900 mb-1">Titre de la séance</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Full body, Push day, Cardio…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          {/* Rest day toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-gray-900">Jour de repos</label>
              <p className="text-sm text-gray-600">Marquer cette journée comme repos</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={isRestDay} onChange={(e) => setIsRestDay(e.target.checked)} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600" />
            </label>
          </div>

          {!isRestDay && (
            <>
              {/* Notes */}
              <div>
                <label className="block font-medium text-gray-900 mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Notes ou instructions générales pour cette séance..."
                />
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Exercises */}
      {!isRestDay && (
        <Card>
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Exercices ({exercises.length})</h3>
          </div>

          <div className="space-y-0">
            {(() => {
              const supersetLabels = buildSupersetLabels(exercises);
              if (exercises.length === 0) {
                return (
                  <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <Dumbbell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600">Aucun exercice pour le moment</p>
                    <p className="text-sm text-gray-500 mt-1">Cliquez sur &quot;Nouvel exercice&quot; pour commencer</p>
                  </div>
                );
              }
              return (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={exercises.map((e) => e.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {exercises.map((exercise, index) => {
                      const cat = EXERCISE_CATEGORIES[exercise.category] ?? EXERCISE_CATEGORIES.MAIN;
                      const Icon = cat.icon;
                      const isAnimating = animatingIndex === index;
                      const animClass = isAnimating ? (animationDirection === 'up' ? 'animate-slide-up' : 'animate-slide-down') : '';

                      const ssLabel = exercise.supersetGroup ? supersetLabels[exercise.supersetGroup] : null;
                      const ssColor = ssLabel ? getSupersetColor(ssLabel) : null;

                      const prevSameGroup = index > 0 && exercise.supersetGroup && exercises[index - 1].supersetGroup === exercise.supersetGroup;
                      const isCollapsed = collapsedIds.has(exercise.id);

                      // Récap pour la version pliée
                      const summaryParts: string[] = [];
                      if (exercise.sets) summaryParts.push(`${exercise.sets} séries`);
                      if (exercise.reps) summaryParts.push(`${exercise.reps} reps`);
                      if (exercise.weight) summaryParts.push(`${exercise.weight} kg`);
                      if (exercise.duration) summaryParts.push(exercise.duration);
                      const summary = summaryParts.join(' · ');

                      return (
                        <SortableItem key={exercise.id} id={exercise.id}>
                          {({ attributes, listeners }) => (
                            <div>
                              {/* Connecteur entre exercices */}
                              {index > 0 && (
                                <div className="flex items-center justify-center my-1 h-7">
                                  {prevSameGroup ? (
                                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${ssColor!.bg} ${ssColor!.text}`}>
                                      <div className={`w-0.5 h-4 ${ssColor!.connector} rounded`} />
                                      <Layers className="h-3 w-3" />
                                      Super-set {ssLabel}
                                      <div className={`w-0.5 h-4 ${ssColor!.connector} rounded`} />
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => linkWithNext(index - 1)}
                                      className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                                      title="Grouper ces deux exercices en super-set"
                                    >
                                      <Link2 className="h-3 w-3" />
                                      Grouper en super-set
                                    </button>
                                  )}
                                </div>
                              )}

                              <div className={`border-2 rounded-lg ${isCollapsed ? 'p-3' : 'p-5'} bg-white transition-all duration-300 ${animClass} ${ssColor ? `${ssColor.border}` : 'hover:border-gray-300'}`}>
                                {/* Badge super-set */}
                                {ssLabel && ssColor && !isCollapsed && (
                                  <div className="flex items-center gap-2 mb-3">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${ssColor.bg} ${ssColor.text}`}>
                                      <Layers className="h-3 w-3" />
                                      Super-set {ssLabel}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => unlinkFromSuperset(index)}
                                      className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors"
                                      title="Retirer du super-set"
                                    >
                                      <Unlink2 className="h-3 w-3" />
                                      Retirer
                                    </button>
                                  </div>
                                )}

                                {isCollapsed ? (
                                  // ══ Vue compacte ══════════════════════════
                                  <>
                                    {/* Ligne du dessus : dépliant (cliquable plein largeur) */}
                                    <button
                                      type="button"
                                      onClick={() => toggleCollapse(exercise.id)}
                                      className="w-full flex items-center gap-2 text-left hover:bg-gray-50 -m-1 p-1 rounded"
                                    >
                                      <Icon className={`h-4 w-4 ${cat.color} flex-shrink-0`} />
                                      <span className="font-medium text-gray-900 truncate">
                                        {exercise.name || <span className="italic text-gray-400">Exercice sans nom</span>}
                                      </span>
                                      {summary && (
                                        <span className="text-xs text-gray-500 truncate">· {summary}</span>
                                      )}
                                      {ssLabel && ssColor && (
                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${ssColor.bg} ${ssColor.text}`}>
                                          <Layers className="h-2.5 w-2.5" />
                                          {ssLabel}
                                        </span>
                                      )}
                                    </button>

                                    {/* Ligne du dessous : grip + numéro à gauche, poubelle à droite */}
                                    <div className="flex items-center justify-between mt-2">
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          {...attributes}
                                          {...listeners}
                                          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 cursor-grab active:cursor-grabbing touch-none"
                                          title="Glisser pour réorganiser"
                                          aria-label="Réorganiser l'exercice"
                                        >
                                          <GripVertical className="h-4 w-4" />
                                        </button>
                                        <span className="text-xs font-semibold text-gray-500 bg-gray-100 rounded-full w-6 h-6 flex items-center justify-center">
                                          {index + 1}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => removeExercise(index)}
                                        className="text-red-500 hover:bg-red-50 hover:text-red-600 p-1.5 rounded-lg transition-colors"
                                        title="Supprimer l'exercice"
                                        aria-label="Supprimer l'exercice"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                <div className="flex items-start gap-3">
                                  {/* Drag handle + numéro */}
                                  <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-1">
                                    <button
                                      type="button"
                                      {...attributes}
                                      {...listeners}
                                      className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 cursor-grab active:cursor-grabbing touch-none"
                                      title="Glisser pour réorganiser"
                                      aria-label="Réorganiser l'exercice"
                                    >
                                      <GripVertical className="h-5 w-5" />
                                    </button>
                                    <span className="text-xs font-semibold text-gray-500 bg-gray-100 rounded-full w-6 h-6 flex items-center justify-center">
                                      {index + 1}
                                    </span>
                                  </div>

                                  <div className="flex-1 min-w-0">
                                      <div className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l&apos;exercice *</label>
                                            <ExerciseSearch
                                              value={exercise.name}
                                              onChange={(name) => {
                                                updateExercise(index, 'name', name);
                                                if (exercise.exerciseRefId) {
                                                  setExercises((prev) => {
                                                    const updated = [...prev];
                                                    updated[index] = { ...updated[index], exerciseRefId: '', exerciseRef: undefined };
                                                    return updated;
                                                  });
                                                }
                                              }}
                                              onSelect={(ref) => handleExerciseRefSelect(index, ref)}
                                              placeholder="Rechercher ou saisir un exercice..."
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
                                            <div className="relative">
                                              <select
                                                value={exercise.category}
                                                onChange={(e) => updateExercise(index, 'category', e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 appearance-none bg-white pr-10"
                                              >
                                                {Object.entries(EXERCISE_CATEGORIES).map(([key, c]) => (
                                                  <option key={key} value={key}>{c.label}</option>
                                                ))}
                                              </select>
                                              <Icon className={`absolute right-3 top-2.5 h-5 w-5 ${cat.color} pointer-events-none`} />
                                            </div>
                                          </div>
                                        </div>

                                        <ExerciseFields exercise={exercise} index={index} onUpdate={updateExercise} />

                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">
                                            <FileText className="inline h-4 w-4 mr-1" />Instructions
                                          </label>
                                          <textarea
                                            rows={2}
                                            value={exercise.description}
                                            onChange={(e) => updateExercise(index, 'description', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                            placeholder="Instructions détaillées pour le client..."
                                          />
                                        </div>
                                      </div>
                                  </div>

                                  {/* Actions latérales (mode déplié) */}
                                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => toggleCollapse(exercise.id)}
                                      className="text-gray-500 hover:bg-gray-100 p-2 rounded-lg transition-colors"
                                      title="Replier"
                                    >
                                      <ChevronUp className="h-5 w-5" />
                                    </button>
                                    {(exercise.exerciseRefId || exercise.exerciseRef) && (
                                      <button type="button" onClick={() => setSelectedExerciseForDetail(exercise)} className="text-purple-600 hover:bg-purple-50 p-2 rounded-lg transition-colors" title="Voir les détails">
                                        <Info className="h-5 w-5" />
                                      </button>
                                    )}
                                    <button type="button" onClick={() => duplicateExercise(index)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors" title="Dupliquer">
                                      <Copy className="h-5 w-5" />
                                    </button>
                                    <button type="button" onClick={() => removeExercise(index)} className="text-red-500 hover:bg-red-50 hover:text-red-600 p-2 rounded-lg transition-colors" title="Supprimer">
                                      <Trash2 className="h-5 w-5" />
                                    </button>
                                  </div>
                                </div>
                                )}

                              </div>
                            </div>
                          )}
                        </SortableItem>
                      );
                    })}
                  </SortableContext>
                </DndContext>
              );
            })()}
          </div>

          <div className="mt-6">
            <Button onClick={addExercise} variant="outline" className="w-full flex items-center justify-center cursor-pointer hover:bg-gray-50">
              <Plus className="h-4 w-4 mr-1" />
              Nouvel exercice
            </Button>
          </div>
        </Card>
      )}

      {/* Footer actions */}
      <div className="flex justify-end gap-3 pb-8">
        <Button variant="outline" onClick={() => router.push(`/coach/programs/${programId}/calendar`)}>
          Annuler
        </Button>
        {!isRestDay && (
          <Button
            variant="outline"
            onClick={() => handleSave('DRAFT')}
            disabled={saving}
            className="border-yellow-400 text-yellow-700 hover:bg-yellow-50"
          >
            <FileText className="h-4 w-4 mr-2" />
            {saving && status === 'DRAFT' ? 'Enregistrement...' : 'Brouillon'}
          </Button>
        )}
        <Button onClick={() => handleSave(isRestDay ? 'DONE' : 'DONE')} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving && status === 'DONE' ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </div>

      {/* Modale de détail exercice */}
      {selectedExerciseForDetail && (
        <ExerciseDetailModal
          exercise={selectedExerciseForDetail}
          onClose={() => setSelectedExerciseForDetail(null)}
        />
      )}
    </div>
  );
}
