'use client';

import { useEffect, useState } from 'react';
import { X, Dumbbell, Target, Zap } from 'lucide-react';
import { exerciseRefsAPI } from '@/lib/api';
import type { ExerciseReference } from '@/types';
import BodyMap from '@/app/(dashboard)/coach/analytics/_components/BodyMap';

interface ExerciseDetailModalProps {
  exercise: {
    name: string;
    exerciseRefId?: string;
    exerciseRef?: ExerciseReference;
    gifUrl?: string;
  };
  onClose: () => void;
}

export default function ExerciseDetailModal({ exercise, onClose }: ExerciseDetailModalProps) {
  const [ref, setRef] = useState<ExerciseReference | null>(exercise.exerciseRef || null);
  const [loading, setLoading] = useState(!exercise.exerciseRef && !!exercise.exerciseRefId);

  // Charger la référence si pas déjà disponible
  useEffect(() => {
    if (exercise.exerciseRef || !exercise.exerciseRefId) return;

    const fetchRef = async () => {
      try {
        const response = await exerciseRefsAPI.getById(exercise.exerciseRefId!);
        setRef(response.data.data);
      } catch (error) {
        console.error('Erreur chargement exercice:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRef();
  }, [exercise.exerciseRefId, exercise.exerciseRef]);

  // Fermer avec Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Les équipements sont déjà en français dans la BDD FitFlow — retourner tel quel
  const formatEquipment = (eq: string) => eq;

  const gifUrl = ref?.gifUrl || exercise.gifUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">{exercise.name}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* GIF */}
          {gifUrl && (
            <div className="flex justify-center bg-gray-50 rounded-lg p-2">
              <img
                src={gifUrl}
                alt={exercise.name}
                className="max-w-full max-h-64 rounded-lg object-contain"
              />
            </div>
          )}

          {loading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          )}

          {ref && (
            <>
              {/* Diagramme musculaire — même composant que la page Analytics */}
              {ref.bodyParts.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 flex justify-center">
                  <BodyMap
                    gender={null}
                    muscleVolumes={Object.fromEntries(ref.bodyParts.map((bp) => [bp, 1]))}
                    maxVolume={1}
                  />
                </div>
              )}

              {/* Muscles ciblés */}
              {ref.targetMuscles.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4 text-red-500" />
                    Muscles ciblés
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {ref.targetMuscles.map((muscle) => (
                      <span key={muscle} className="text-sm bg-red-50 text-red-700 px-2.5 py-1 rounded-full">
                        {muscle}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Muscles secondaires */}
              {ref.secondaryMuscles.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-orange-500" />
                    Muscles secondaires
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {ref.secondaryMuscles.map((muscle) => (
                      <span key={muscle} className="text-sm bg-orange-50 text-orange-700 px-2.5 py-1 rounded-full">
                        {muscle}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Équipement */}
              {ref.equipments.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-600 font-medium mb-1 flex items-center gap-1">
                    <Dumbbell className="h-3 w-3" />
                    Équipement
                  </p>
                  <p className="text-sm text-gray-900">{ref.equipments.map(formatEquipment).join(', ')}</p>
                </div>
              )}

              {/* Instructions */}
              {ref.instructions.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Instructions</h4>
                  <ol className="space-y-2">
                    {ref.instructions.map((step, i) => (
                      <li key={i} className="flex gap-3 text-sm text-gray-700">
                        <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-semibold">
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
