'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { setStatus, setStatusColors, durationStatus } from '@/lib/setComparison';
import { programsAPI, sessionsAPI, statsAPI, clientsAPI, mealsAPI } from '@/lib/api';
import { useSessionInol, inolZone } from '@/components/analytics/use-session-inol';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Droplets,
  Sun,
  Moon,
  Flame,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  parseISO,
  isFuture,
  startOfDay,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import type { ClientProfile, Program, Session, DailyStat, Meal } from '@/types';

type DayStatus = 'completed' | 'missed' | 'future' | 'no-program' | 'pending';

interface DayData {
  session: Session | null;
  stats: DailyStat | null;
  meals: Meal[];
}

const DAY_COLORS: Record<DayStatus, string> = {
  completed: 'bg-green-500 text-white hover:bg-green-600',
  missed: 'bg-red-500 text-white hover:bg-red-600',
  future: 'bg-white text-gray-900 hover:bg-gray-50',
  'no-program': 'bg-gray-300 text-gray-600 hover:bg-gray-400',
  pending: 'bg-blue-500 text-white hover:bg-blue-600',
};

/**
 * Vue Progression d'un client : calendrier mensuel et détail du jour sélectionné.
 *
 * Extraite de la page /progress pour être montable ailleurs — un onglet de la fiche
 * client, en l'occurrence. La page d'origine n'en est plus qu'une enveloppe, afin de
 * ne pas casser les liens existants.
 */
export default function ClientProgressPanel({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<DailyStat[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDayData, setSelectedDayData] = useState<DayData | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);

      const clientRes = await clientsAPI.getById(clientId);
      const clientData: ClientProfile = clientRes.data.data;
      setClient(clientData);

      // Paralléliser programmes + stats
      const [programsRes, statsRes] = await Promise.all([
        programsAPI.getCoachPrograms(),
        statsAPI.getClientStats(clientData.id, {
          startDate: format(start, 'yyyy-MM-dd'),
          endDate: format(end, 'yyyy-MM-dd'),
        }),
      ]);

      const clientPrograms: Program[] = (programsRes.data.data as Program[]).filter(
        (p) => p.clientId === clientData.id
      );

      // Sessions pour tous les programmes du client
      const allSessions: Session[] = [];
      await Promise.all(
        clientPrograms.map(async (program) => {
          const res = await sessionsAPI.getByProgram(program.id, {
            startDate: format(start, 'yyyy-MM-dd'),
            endDate: format(end, 'yyyy-MM-dd'),
          });
          allSessions.push(...(res.data.data as Session[]));
        })
      );

      setSessions(allSessions);
      setStats(statsRes.data.data ?? []);
    } catch {
      console.error('Error fetching progress data');
    } finally {
      setLoading(false);
    }
  }, [clientId, currentMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getDayStatus = (date: Date): DayStatus => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const daySession = sessions.find(
      (s) => format(parseISO(s.date), 'yyyy-MM-dd') === dateStr
    );
    const today = startOfDay(new Date());
    const current = startOfDay(date);

    if (isFuture(current)) return 'future';
    if (!daySession) return 'no-program';
    if (daySession.status === 'DONE') return 'completed';
    if (current < today) return 'missed';
    return 'pending';
  };

  const handleDateClick = async (date: Date) => {
    setSelectedDate(date);
    const dateStr = format(date, 'yyyy-MM-dd');
    const session = sessions.find((s) => format(parseISO(s.date), 'yyyy-MM-dd') === dateStr) ?? null;
    const stat = stats.find((s) => format(parseISO(s.date), 'yyyy-MM-dd') === dateStr) ?? null;

    // Charger les repas du jour
    let dayMeals: Meal[] = [];
    if (client) {
      try {
        const mealsRes = await mealsAPI.getClientMeals(client.user.id, {
          startDate: dateStr,
          endDate: dateStr,
        });
        dayMeals = mealsRes.data.data ?? [];
      } catch {
        console.error('Error fetching meals for day');
      }
    }

    setSelectedDayData({ session, stats: stat, meals: dayMeals });
  };

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const firstDayOfWeek = monthStart.getDay();
    const padding = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    return (
      <div className="grid grid-cols-7 gap-2">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
          <div key={d} className="text-center font-semibold text-gray-600 py-2 text-sm">{d}</div>
        ))}
        {Array.from({ length: padding }).map((_, i) => <div key={`pad-${i}`} />)}
        {days.map((date) => {
          const status = getDayStatus(date);
          const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
          return (
            <button
              key={date.toString()}
              onClick={() => handleDateClick(date)}
              className={`aspect-square rounded-lg flex items-center justify-center font-semibold text-sm transition-all border-2 ${DAY_COLORS[status]} ${isSelected ? 'ring-4 ring-primary-300 border-primary-500' : 'border-transparent'}`}
            >
              {format(date, 'd')}
            </button>
          );
        })}
      </div>
    );
  };

  /**
   * Intensité de la séance sélectionnée, appelée inconditionnellement : un hook ne
   * peut pas être invoqué depuis renderDayDetails, qui n'est pas un composant. Une
   * date vide neutralise la requête.
   */
  const sessionInol = useSessionInol(
    clientId,
    selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '',
    selectedDayData?.session?.id,
  );

  /**
   * Horodatage ISO → heure locale « 05h43 ».
   *
   * `bedTime` et `wakeTime` sont des DateTime en base : la valeur brute sortait
   * telle quelle à l'écran (« 2026-08-07T05:43:00.000Z »). L'affichage se fait en
   * heure locale, pas en UTC — c'est l'heure à laquelle le client s'est levé chez
   * lui qui compte, pas son équivalent à Greenwich.
   */
  const formatTime = (value?: string | null) => {
    if (!value) return '--:--';
    const d = new Date(value);
    return Number.isNaN(d.getTime())
      ? '--:--'
      : format(d, 'HH:mm', { locale: fr }).replace(':', 'h');
  };

  const renderDayDetails = () => {
    if (!selectedDate || !selectedDayData) {
      return (
        <div className="text-center py-12 text-gray-500">
          <Calendar className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <p>Sélectionnez un jour pour voir les détails</p>
        </div>
      );
    }

    const { session, stats: dayStats, meals: dayMeals } = selectedDayData;

    // Calculer les macros totales depuis les repas
    const totalProtein = dayMeals.reduce((sum, m) => sum + (m.protein ?? 0), 0);
    const totalCarbs = dayMeals.reduce((sum, m) => sum + (m.carbs ?? 0), 0);
    const totalFats = dayMeals.reduce((sum, m) => sum + (m.fats ?? 0), 0);
    const hasMacros = totalProtein > 0 || totalCarbs > 0 || totalFats > 0;

    return (
      <div className="space-y-6">
        <div className="border-b pb-4">
          <h3 className="text-xl font-bold text-gray-900">
            {format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}
          </h3>
        </div>

        {/* Daily stats */}
        {dayStats ? (
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-3">Objectifs quotidiens</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-1">
                  <Droplets className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">Eau</span>
                </div>
                <p className="text-xl font-bold text-blue-600">{dayStats.waterIntake ?? 0}L</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center gap-2 mb-1">
                  <Sun className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium text-gray-700">Lever</span>
                </div>
                <p className="text-xl font-bold text-orange-600">{formatTime(dayStats.wakeTime)}</p>
              </div>
              <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                <div className="flex items-center gap-2 mb-1">
                  <Moon className="h-4 w-4 text-indigo-600" />
                  <span className="text-sm font-medium text-gray-700">Coucher</span>
                </div>
                <p className="text-xl font-bold text-indigo-600">{formatTime(dayStats.bedTime)}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center gap-2 mb-1">
                  <Flame className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-gray-700">Calories</span>
                </div>
                <p className="text-xl font-bold text-red-600">{dayStats.totalCalories ?? 0} kcal</p>
              </div>
            </div>

            {/* Macros nutritionnelles */}
            {hasMacros && (
              <div className="mt-3">
                <h5 className="text-sm font-semibold text-gray-700 mb-2">Macronutriments</h5>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 bg-blue-50 rounded-lg border border-blue-200 text-center">
                    <p className="text-lg font-bold text-blue-600">{Math.round(totalProtein * 10) / 10}g</p>
                    <p className="text-xs text-gray-500">Protéines</p>
                  </div>
                  <div className="p-2 bg-yellow-50 rounded-lg border border-yellow-200 text-center">
                    <p className="text-lg font-bold text-yellow-600">{Math.round(totalCarbs * 10) / 10}g</p>
                    <p className="text-xs text-gray-500">Glucides</p>
                  </div>
                  <div className="p-2 bg-orange-50 rounded-lg border border-orange-200 text-center">
                    <p className="text-lg font-bold text-orange-600">{Math.round(totalFats * 10) / 10}g</p>
                    <p className="text-xs text-gray-500">Lipides</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 bg-gray-50 rounded-lg text-gray-500 text-sm">
            Aucune donnée d&apos;objectifs pour ce jour
          </div>
        )}

        {/* Session */}
        {session ? (
          <div>
            <div className="flex items-baseline justify-between gap-2 mb-3">
              <h4 className="text-lg font-semibold text-gray-900">Séance d&apos;entraînement</h4>
              {sessionInol.total != null && (
                <span className="text-xs text-gray-500">
                  intensité cumulée <span className="font-bold">{sessionInol.total.toFixed(2)}</span>
                </span>
              )}
            </div>
            <div className="mb-4">
              {session.status === 'DONE' ? (
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-semibold">Séance terminée</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-700">
                  <XCircle className="h-5 w-5" />
                  <span className="font-semibold">Séance non effectuée</span>
                </div>
              )}
            </div>

            {session.isRestDay ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg text-gray-600 text-sm">Jour de repos</div>
            ) : (
              <div className="space-y-3">
                {session.exercises
                  ?.filter((ex) => ex.name)
                  .map((exercise, idx) => {
                    // Sans série à détailler : la consigne se résume à une durée.
                    const isCardio = ['CARDIO', 'WARMUP', 'STRETCHING'].includes(exercise.category);
                    // Avec des séries, mais chronométrées au lieu d'être comptées.
                    const isTimed = exercise.category === 'RENFORCEMENT';
                    return (
                      <div key={exercise.id ?? idx} className="border rounded-lg p-3 bg-white">
                        <div className="flex items-baseline justify-between gap-2 mb-2">
                          <h5 className="font-semibold text-gray-900 text-sm">
                            {idx + 1}. {exercise.name}
                          </h5>
                          {/* Intensité du mouvement, appariée par exerciseRefId. Absente
                              pour un échauffement ou un exercice au poids du corps : on
                              n'affiche alors rien plutôt qu'un zéro trompeur. */}
                          {(() => {
                            const ref = exercise.exerciseRefId
                              ? sessionInol.byRef.get(exercise.exerciseRefId)
                              : undefined;
                            if (!ref) return null;
                            const zone = inolZone(ref.inol);
                            return (
                              <span
                                className="text-xs font-bold shrink-0"
                                style={{ color: zone.color }}
                                title={`INOL ${ref.inol} (${zone.label}) — ${ref.sets} séries, ${ref.totalReps} reps, pic à ${ref.topPct1RM} % de ${ref.ref1RM} kg`}
                              >
                                INOL {ref.inol.toFixed(2)}
                                <span className="font-normal opacity-70"> · {zone.label}</span>
                              </span>
                            );
                          })()}
                        </div>
                        {!isCardio && (exercise.setCompletions?.length ?? 0) > 0 ? (
                          <div className="space-y-1">
                            {exercise.setCompletions!.map((completion) => {
                              const status = isTimed
                                ? durationStatus(exercise.duration, completion.durationAchieved)
                                : setStatus(exercise.reps, exercise.weight, completion.repsAchieved, completion.weightUsed);
                              const { bg: bgColor, text: textColor } = setStatusColors[status];
                              return (
                                <div key={completion.setNumber} className={`flex items-center gap-3 text-xs rounded px-2 py-1.5 border ${bgColor}`}>
                                  <span className={`font-semibold w-14 ${textColor}`}>Série {completion.setNumber}</span>
                                  {isTimed ? (
                                    <span className="text-gray-600">Tenu&nbsp;: <span className={`font-bold ${textColor}`}>{completion.durationAchieved || '—'}</span> <span className="text-gray-400">(prévu: {exercise.duration})</span></span>
                                  ) : (
                                    <span className="text-gray-600">Reps: <span className={`font-bold ${textColor}`}>{completion.repsAchieved}</span> <span className="text-gray-400">(prévu: {exercise.reps})</span></span>
                                  )}
                                  <span className="text-gray-600">Poids: <span className={`font-bold ${textColor}`}>{completion.weightUsed}</span> <span className="text-gray-400">(prévu: {exercise.weight})</span></span>
                                </div>
                              );
                            })}
                          </div>
                        ) : isCardio ? (
                          <p className="text-sm text-gray-600">{exercise.duration ? `Durée: ${exercise.duration}` : 'Pas de durée renseignée'}</p>
                        ) : (
                          <p className="text-sm text-orange-600 italic">Aucune donnée enregistrée par le client</p>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            {session.notes && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-900"><strong>Notes:</strong> {session.notes}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 bg-gray-50 rounded-lg text-gray-500 text-sm">
            Aucune séance programmée pour ce jour
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendar */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-xl font-bold text-gray-900">
              {format(currentMonth, 'MMMM yyyy', { locale: fr })}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {renderCalendar()}

          <div className="mt-6 grid grid-cols-2 gap-2 text-sm">
            {[
              { color: 'bg-green-500', label: 'Séance validée' },
              { color: 'bg-red-500', label: 'Séance manquée' },
              { color: 'bg-blue-500', label: 'Séance du jour' },
              { color: 'bg-gray-300', label: 'Pas de programme' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded ${color}`} />
                <span className="text-gray-600">{label}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Day details */}
        <Card>{renderDayDetails()}</Card>
      </div>
    </div>
  );
}
