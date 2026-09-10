'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { sessionsAPI, setCompletionsAPI } from '@/lib/api';
import {
  ArrowLeft,
  CheckCircle2,
  Flame,
  Dumbbell,
  Heart,
  Wind,
  Video,
  Image as ImageIcon,
  Timer,
  Weight,
  Repeat,
  Clock,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Exercise {
  id: string;
  name: string;
  category: string;
  description?: string;
  sets?: number;
  reps?: string;
  weight?: string;
  duration?: string;
  restTime?: string;
  videoUrl?: string;
  gifUrl?: string;
  setCompletions?: SetCompletion[];
}

interface SetCompletion {
  setNumber: number;
  repsAchieved: string;
  durationAchieved: string;
  weightUsed: string;
  completed: boolean;
}

interface Session {
  id: string;
  date: string;
  status: string;
  isRestDay: boolean;
  completedByClient: boolean;
  notes?: string;
  exercises?: Exercise[];
}

interface SetData {
  repsAchieved: string;
  durationAchieved: string;
  weightUsed: string;
  completed: boolean;
}

interface SetCompletionsState {
  [exerciseId: string]: {
    [setNumber: number]: SetData;
  };
}

interface CategoryConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  borderColor: string;
}

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  WARMUP: { label: 'Échauffement', icon: Flame, color: 'bg-orange-100 text-orange-700', borderColor: 'border-orange-300' },
  MAIN: { label: 'Musculation', icon: Dumbbell, color: 'bg-blue-100 text-blue-700', borderColor: 'border-blue-300' },
  RENFORCEMENT: { label: 'Renforcement', icon: Timer, color: 'bg-primary-100 text-primary-700', borderColor: 'border-primary-300' },
  CARDIO: { label: 'Cardio', icon: Heart, color: 'bg-red-100 text-red-700', borderColor: 'border-red-300' },
  STRETCHING: { label: 'Étirements', icon: Wind, color: 'bg-purple-100 text-purple-700', borderColor: 'border-purple-300' },
};

export default function SessionDetailPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = React.use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [setCompletions, setSetCompletions] = useState<SetCompletionsState>({});
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    fetchSession();
  }, [sessionId]);

  const fetchSession = async () => {
    try {
      const response = await sessionsAPI.getById(sessionId);
      const sessionData = response.data.data;
      setSession(sessionData);

      const completions: SetCompletionsState = {};
      sessionData.exercises?.forEach((exercise: Exercise) => {
        completions[exercise.id] = {};
        exercise.setCompletions?.forEach((completion: SetCompletion) => {
          completions[exercise.id][completion.setNumber] = {
            repsAchieved: completion.repsAchieved || exercise.reps || '',
            // Valeur par défaut = la durée prescrite : le client n'a qu'à corriger
            // s'il a tenu plus ou moins longtemps.
            durationAchieved: completion.durationAchieved || exercise.duration || '',
            weightUsed: completion.weightUsed || exercise.weight || '',
            completed: completion.completed,
          };
        });
      });
      setSetCompletions(completions);
    } catch (error) {
      console.error('Error fetching session:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSet = async (exerciseId: string, setNumber: number, exercise: Exercise) => {
    const currentState = setCompletions[exerciseId]?.[setNumber];
    const isCompleted = currentState?.completed || false;

    try {
      if (isCompleted) {
        await setCompletionsAPI.delete(exerciseId, setNumber);

        setSetCompletions((prev) => {
          const newState = { ...prev };
          if (newState[exerciseId]) {
            delete newState[exerciseId][setNumber];
          }
          return newState;
        });
      } else {
        const repsAchieved = currentState?.repsAchieved || exercise.reps || '';
        const durationAchieved = currentState?.durationAchieved || exercise.duration || '';
        const weightUsed = currentState?.weightUsed || exercise.weight || '';

        await setCompletionsAPI.update({
          exerciseId,
          setNumber,
          repsAchieved,
          durationAchieved,
          weightUsed,
        });

        setSetCompletions((prev) => ({
          ...prev,
          [exerciseId]: {
            ...prev[exerciseId],
            [setNumber]: {
              repsAchieved,
              durationAchieved,
              weightUsed,
              completed: true,
            },
          },
        }));
      }
    } catch (error) {
      console.error('Error toggling set:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  const updateSetData = async (exerciseId: string, setNumber: number, field: string, value: string) => {
    setSetCompletions((prev) => ({
      ...prev,
      [exerciseId]: {
        ...prev[exerciseId],
        [setNumber]: {
          ...prev[exerciseId]?.[setNumber],
          [field]: value,
        },
      },
    }));

    if (setCompletions[exerciseId]?.[setNumber]?.completed) {
      try {
        const updatedData = {
          ...setCompletions[exerciseId][setNumber],
          [field]: value,
        };

        await setCompletionsAPI.update({
          exerciseId,
          setNumber,
          repsAchieved: updatedData.repsAchieved,
          durationAchieved: updatedData.durationAchieved,
          weightUsed: updatedData.weightUsed,
        });
      } catch (error) {
        console.error('Error updating set data:', error);
      }
    }
  };

  const isExerciseCompleted = (exercise: Exercise) => {
    if (!exercise.sets) return false;
    for (let i = 1; i <= exercise.sets; i++) {
      if (!setCompletions[exercise.id]?.[i]?.completed) {
        return false;
      }
    }
    return true;
  };

  const getTotalCompletedSets = () => {
    let total = 0;
    let completed = 0;
    session?.exercises?.forEach((exercise) => {
      if (exercise.sets) {
        total += exercise.sets;
        for (let i = 1; i <= exercise.sets; i++) {
          if (setCompletions[exercise.id]?.[i]?.completed) {
            completed++;
          }
        }
      }
    });
    return { total, completed };
  };

  const handleCompleteSession = async () => {
    if (window.confirm('Voulez-vous marquer cette séance comme terminée ?')) {
      setIsCompleting(true);
      try {
        await sessionsAPI.validate(session!.id);
        router.push('/client/dashboard');
      } catch (error) {
        console.error('Error completing session:', error);
        alert('Erreur lors de la validation de la séance');
      } finally {
        setIsCompleting(false);
      }
    }
  };

  const renderExerciseDetails = (exercise: Exercise) => {
    const category = exercise.category;

    // Renforcement : des séries à tenir un certain temps.
    if (category === 'RENFORCEMENT') {
      return (
        <div className="flex flex-wrap gap-4 text-sm">
          {exercise.sets && (
            <div className="flex items-center gap-1 text-gray-700">
              <Dumbbell className="h-4 w-4" />
              <span><strong>{exercise.sets}</strong> séries</span>
            </div>
          )}
          {exercise.duration && (
            <div className="flex items-center gap-1 text-gray-700">
              <Timer className="h-4 w-4" />
              <span>à tenir <strong>{exercise.duration}</strong></span>
            </div>
          )}
        </div>
      );
    }

    if (category === 'CARDIO' || category === 'WARMUP' || category === 'STRETCHING') {
      return (
        <div className="flex flex-wrap gap-4 text-sm">
          {exercise.duration && (
            <div className="flex items-center gap-1 text-gray-700">
              <Timer className="h-4 w-4" />
              <span>Durée: <strong>{exercise.duration}</strong></span>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Chargement...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Séance non trouvée</p>
      </div>
    );
  }

  const { total, completed } = getTotalCompletedSets();
  const allCompleted = total > 0 && completed === total;
  const isSessionDone = session.completedByClient === true;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push('/client/dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {session.isRestDay ? 'Jour de repos' : 'Séance du jour'}
            </h1>
            <p className="text-gray-600 mt-1">
              {format(parseISO(session.date), "EEEE d MMMM yyyy", { locale: fr })}
            </p>
          </div>
        </div>
        {isSessionDone && (
          <span className="px-4 py-2 bg-green-100 text-green-700 rounded-full font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Séance terminée
          </span>
        )}
      </div>

      {/* Note du coach */}
      {session.notes && (
        <Card>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Dumbbell className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">Note de votre coach</h3>
              <p className="text-gray-700">{session.notes}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Jour de repos */}
      {session.isRestDay ? (
        <Card>
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-gray-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Jour de repos</h2>
            <p className="text-gray-600">Profitez-en pour récupérer et recharger les batteries !</p>
          </div>
        </Card>
      ) : (
        <>
          {/* Liste des exercices */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Exercices ({session.exercises?.length || 0})
              </h2>
              {!isSessionDone && (
                <span className="text-sm text-gray-600">
                  {completed} / {total} séries complétées
                </span>
              )}
            </div>

            {!session.exercises || session.exercises.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                Aucun exercice programmé pour cette séance
              </p>
            ) : (
              <div className="space-y-6">
                {session.exercises.map((exercise, index) => {
                  const config = CATEGORY_CONFIG[exercise.category] || CATEGORY_CONFIG.MAIN;
                  const Icon = config.icon;
                  const exerciseCompleted = isExerciseCompleted(exercise);

                  return (
                    <div
                      key={exercise.id}
                      className={`border-2 rounded-lg p-5 ${
                        exerciseCompleted ? 'bg-green-50 border-green-300' : `${config.borderColor} bg-white`
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-3 flex-1">
                          <span className="text-lg font-bold text-gray-400">
                            #{index + 1}
                          </span>
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-4">
                              <h3 className={`text-lg font-bold ${exerciseCompleted ? 'text-green-700' : 'text-gray-900'}`}>
                                {exercise.name}
                              </h3>
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${config.color} flex items-center gap-1 flex-shrink-0`}>
                                <Icon className="h-3 w-3" />
                                {config.label}
                              </span>
                            </div>
                            {exercise.description && (
                              <p className="text-sm text-gray-700 mt-2 bg-gray-50 p-3 rounded-lg">
                                {exercise.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Sets or duration */}
                      {exercise.sets && exercise.sets > 0 ? (
                        <div className="space-y-2">
                          {[...Array(exercise.sets)].map((_, idx) => {
                            const setNumber = idx + 1;
                            const setData = setCompletions[exercise.id]?.[setNumber] || {
                              repsAchieved: exercise.reps || '',
                              durationAchieved: exercise.duration || '',
                              weightUsed: exercise.weight || '',
                              completed: false,
                            };
                            const isTimed = exercise.category === 'RENFORCEMENT';

                            return (
                              <div
                                key={setNumber}
                                className={`flex items-center gap-3 p-3 rounded-lg ${
                                  setData.completed ? 'bg-green-50' : 'bg-gray-50'
                                }`}
                              >
                                <button
                                  onClick={() => !isSessionDone && toggleSet(exercise.id, setNumber, exercise)}
                                  disabled={isSessionDone}
                                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                    setData.completed
                                      ? 'bg-green-500 border-green-500'
                                      : 'border-gray-300 hover:border-green-500'
                                  } ${isSessionDone ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                  {setData.completed && <CheckCircle2 className="h-4 w-4 text-white" />}
                                </button>

                                <span className="font-semibold text-gray-700 w-20">
                                  Série {setNumber}
                                </span>

                                <div className="flex items-center gap-2 flex-1">
                                  {/* Renforcement : on saisit le TEMPS TENU, pas des
                                      répétitions. Champ distinct en base, sinon un
                                      « 45 » de gainage serait compté comme
                                      45 répétitions dans le volume et le 1RM. */}
                                  {isTimed ? (
                                    <div className="flex items-center gap-1">
                                      <Timer className="h-4 w-4 text-gray-500" />
                                      <input
                                        type="text"
                                        placeholder="45s"
                                        value={setData.durationAchieved}
                                        onChange={(e) => !isSessionDone && updateSetData(exercise.id, setNumber, 'durationAchieved', e.target.value)}
                                        disabled={isSessionDone}
                                        className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                                      />
                                      <span className="text-xs text-gray-500">tenu</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1">
                                      <Repeat className="h-4 w-4 text-gray-500" />
                                      <input
                                        type="text"
                                        placeholder="Reps"
                                        value={setData.repsAchieved}
                                        onChange={(e) => !isSessionDone && updateSetData(exercise.id, setNumber, 'repsAchieved', e.target.value)}
                                        disabled={isSessionDone}
                                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                                      />
                                    </div>
                                  )}

                                  {/* Le poids reste proposé : un gainage lesté existe. */}
                                  <div className="flex items-center gap-1">
                                    <Weight className="h-4 w-4 text-gray-500" />
                                    <input
                                      type="text"
                                      placeholder="Poids"
                                      value={setData.weightUsed}
                                      onChange={(e) => !isSessionDone && updateSetData(exercise.id, setNumber, 'weightUsed', e.target.value)}
                                      disabled={isSessionDone}
                                      className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {exercise.restTime && (
                            <div className="flex items-center gap-1 text-sm text-gray-600 mt-2">
                              <Clock className="h-4 w-4" />
                              <span>Repos: <strong>{exercise.restTime}</strong></span>
                            </div>
                          )}
                        </div>
                      ) : (
                        renderExerciseDetails(exercise)
                      )}

                      {/* Médias */}
                      <div className="flex gap-3 mt-4">
                        {exercise.videoUrl && (
                          <a
                            href={exercise.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                          >
                            <Video className="h-4 w-4" />
                            Voir la vidéo
                          </a>
                        )}
                        {exercise.gifUrl && (
                          <a
                            href={exercise.gifUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                          >
                            <ImageIcon className="h-4 w-4" />
                            Voir l&apos;animation
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Bouton de complétion */}
          {!isSessionDone && session.exercises && session.exercises.length > 0 && (
            <div className="flex justify-center pb-8">
              <Button
                size="lg"
                onClick={handleCompleteSession}
                disabled={!allCompleted || isCompleting}
                className="px-8"
              >
                <CheckCircle2 className="h-5 w-5 mr-2" />
                {isCompleting ? 'Validation...' : allCompleted ? 'Terminer la séance' : 'Complétez toutes les séries'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
