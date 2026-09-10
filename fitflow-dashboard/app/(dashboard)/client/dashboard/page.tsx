'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DailyDataForm } from '@/components/client/daily-data-form';
import { programsAPI, sessionsAPI } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import {
  Calendar,
  Dumbbell,
  CheckCircle2,
  Clock,
  MessageSquare,
  Flame,
  Heart,
  Wind,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { format, isToday, isFuture, parseISO, addDays, subDays, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Session {
  id: string;
  date: string;
  status: string;
  isRestDay: boolean;
  completedByClient: boolean;
  notes?: string;
  exercises?: Exercise[];
}

interface Exercise {
  id: string;
  name: string;
  category: string;
  sets?: number;
  reps?: string;
  weight?: string;
  duration?: string;
}

interface Program {
  id: string;
  title: string;
  isActive: boolean;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  WARMUP: Flame,
  MAIN: Dumbbell,
  CARDIO: Heart,
  STRETCHING: Wind,
};

export default function ClientDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeProgram, setActiveProgram] = useState<Program | null>(null);
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
  const [todaySession, setTodaySession] = useState<Session | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [allSessions, setAllSessions] = useState<Session[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (allSessions.length > 0) {
      const session = allSessions.find((s) =>
        isSameDay(parseISO(s.date), selectedDate)
      );
      setSelectedSession(session || null);
    }
  }, [selectedDate, allSessions]);

  const fetchDashboardData = async () => {
    try {
      const programsResponse = await programsAPI.getClientPrograms();
      const programs = programsResponse.data.data;
      const active = programs.find((p: Program) => p.isActive);

      if (active) {
        setActiveProgram(active);

        const today = new Date();
        const startDate = format(subDays(today, 30), 'yyyy-MM-dd');
        const endDate = format(addDays(today, 30), 'yyyy-MM-dd');

        const sessionsResponse = await sessionsAPI.getByProgram(active.id, {
          startDate,
          endDate,
        });

        const sessions = sessionsResponse.data.data;
        setAllSessions(sessions);

        const todayStr = format(today, 'yyyy-MM-dd');
        const todaySessionData = sessions.find(
          (s: Session) => format(parseISO(s.date), 'yyyy-MM-dd') === todayStr
        );
        const upcoming = sessions.filter(
          (s: Session) => format(parseISO(s.date), 'yyyy-MM-dd') !== todayStr && isFuture(parseISO(s.date))
        ).slice(0, 7);

        setTodaySession(todaySessionData);
        setSelectedSession(todaySessionData);
        setUpcomingSessions(upcoming);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousDay = () => {
    setSelectedDate((prev) => subDays(prev, 1));
  };

  const handleNextDay = () => {
    setSelectedDate((prev) => addDays(prev, 1));
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const getDaysArray = () => {
    const days: Date[] = [];
    for (let i = -2; i <= 2; i++) {
      days.push(addDays(selectedDate, i));
    }
    return days;
  };

  const getSessionStatusBadge = (session: Session) => {
    if (session.isRestDay) {
      return (
        <span className="px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-600 rounded-full">
          Jour de repos
        </span>
      );
    }

    if (session.completedByClient) {
      return (
        <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded-full flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Terminée
        </span>
      );
    }

    return (
      <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full flex items-center gap-1">
        <Clock className="h-3 w-3" />
        À faire
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Chargement...</p>
      </div>
    );
  }

  if (!activeProgram) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Aucun programme actif</h2>
        <p className="text-gray-600 mb-6">
          Votre coach n&apos;a pas encore créé de programme d&apos;entraînement pour vous.
        </p>
        <Button onClick={() => router.push('/client/messages')}>
          <MessageSquare className="h-4 w-4 mr-2" />
          Contacter mon coach
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mon programme</h1>
          <p className="text-gray-600 mt-1">{activeProgram.title}</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => router.push('/client/messages')}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Messages
          </Button>
        </div>
      </div>

      {/* Menu de navigation journalière */}
      <Card>
        <div className="space-y-4">
          {/* Sélecteur de date pour jours lointains */}
          <div className="flex items-center justify-center gap-4">
            <label htmlFor="date-picker" className="text-sm font-medium text-gray-700">
              Aller à une date :
            </label>
            <input
              id="date-picker"
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Navigation horizontale des jours */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={handlePreviousDay}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Jour précédent"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>

            <div className="flex gap-2">
              {getDaysArray().map((date, index) => {
                const isSelected = index === 2;
                const isTodayDate = isToday(date);
                const session = allSessions.find((s) =>
                  isSameDay(parseISO(s.date), date)
                );

                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => handleDateSelect(date)}
                    className={`
                      flex flex-col items-center justify-center p-3 rounded-lg transition-all min-w-[80px]
                      ${
                        isSelected
                          ? 'bg-primary-600 text-white shadow-lg scale-110'
                          : 'bg-white border border-gray-200 hover:border-primary-300 hover:shadow-md'
                      }
                    `}
                  >
                    <div className={`text-xs uppercase font-medium ${isSelected ? 'text-primary-100' : 'text-gray-500'}`}>
                      {format(date, 'EEE', { locale: fr })}
                    </div>
                    <div className={`text-2xl font-bold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                      {format(date, 'd')}
                    </div>
                    <div className={`text-xs ${isSelected ? 'text-primary-100' : 'text-gray-500'}`}>
                      {format(date, 'MMM', { locale: fr })}
                    </div>
                    {isTodayDate && !isSelected && (
                      <div className="mt-1 w-2 h-2 bg-primary-500 rounded-full"></div>
                    )}
                    {session && (
                      <div className="mt-1">
                        {session.status === 'DONE' ? (
                          <CheckCircle2 className={`h-4 w-4 ${isSelected ? 'text-green-300' : 'text-green-500'}`} />
                        ) : session.isRestDay ? (
                          <div className={`text-xs ${isSelected ? 'text-primary-100' : 'text-gray-400'}`}>Repos</div>
                        ) : (
                          <Clock className={`h-4 w-4 ${isSelected ? 'text-blue-300' : 'text-blue-500'}`} />
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleNextDay}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Jour suivant"
            >
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>
      </Card>

      {/* Séance du jour sélectionné */}
      {selectedSession && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary-100 rounded-lg">
                <Calendar className="h-6 w-6 text-primary-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {isToday(selectedDate) ? "Séance d'aujourd'hui" : 'Séance du jour sélectionné'}
                </h2>
                <p className="text-sm text-gray-600">
                  {format(parseISO(selectedSession.date), "EEEE d MMMM yyyy", { locale: fr })}
                </p>
              </div>
            </div>
            {getSessionStatusBadge(selectedSession)}
          </div>

          {selectedSession.isRestDay ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-600">Jour de repos - Profitez-en pour récupérer.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {selectedSession.notes && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <strong>Note du coach :</strong> {selectedSession.notes}
                  </p>
                </div>
              )}

              {/* Liste d'exercices */}
              {selectedSession.exercises && selectedSession.exercises.length > 0 && (
                <div className="space-y-1.5">
                  {selectedSession.exercises.slice(0, 6).map((ex) => {
                    const Icon = CATEGORY_ICONS[ex.category];
                    return (
                      <div key={ex.id} className="flex items-center gap-3 py-1.5 px-3 bg-gray-50 rounded-lg">
                        {Icon && <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                        <span className="text-sm text-gray-800 flex-1 truncate">{ex.name}</span>
                        {ex.sets && (
                          <span className="text-xs text-gray-500 flex-shrink-0">
                            {ex.sets}x{ex.reps || ''}
                          </span>
                        )}
                        {ex.duration && !ex.sets && (
                          <span className="text-xs text-gray-500 flex-shrink-0">{ex.duration}</span>
                        )}
                      </div>
                    );
                  })}
                  {selectedSession.exercises.length > 6 && (
                    <p className="text-xs text-primary-600 text-center font-medium pt-1">
                      +{selectedSession.exercises.length - 6} autres exercices
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between mt-3">
                <div>
                  <p className="text-sm text-gray-600">
                    {selectedSession.exercises?.length || 0} exercice(s) au programme
                  </p>
                  {selectedSession.exercises && selectedSession.exercises.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      {Object.keys(
                        selectedSession.exercises.reduce((acc: Record<string, boolean>, ex) => {
                          acc[ex.category] = true;
                          return acc;
                        }, {})
                      ).map((category) => {
                        const Icon = CATEGORY_ICONS[category];
                        return (
                          <span
                            key={category}
                            className="text-xs px-2 py-1 bg-gray-100 rounded-full flex items-center gap-1"
                          >
                            {Icon && <Icon className="h-3 w-3" />}
                            {category}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                <Button onClick={() => router.push(`/client/sessions/${selectedSession.id}`)}>
                  {selectedSession.status === 'DONE' ? 'Voir la séance' : 'Démarrer la séance'}
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Message si pas de séance pour le jour sélectionné */}
      {!selectedSession && (
        <Card>
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">Aucune séance programmée pour ce jour</p>
          </div>
        </Card>
      )}

      {/* Formulaire de statistiques quotidiennes */}
      <div>
        <DailyDataForm
          clientId={user?.clientProfile?.id || ""}
          date={format(selectedDate, 'yyyy-MM-dd')}
          program={activeProgram}
          onSuccess={() => {}}
        />
      </div>

      {/* Prochaines séances */}
      <Card>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Prochaines séances</h2>
        {upcomingSessions.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Aucune séance programmée pour les 7 prochains jours</p>
        ) : (
          <div className="space-y-3">
            {upcomingSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => router.push(`/client/sessions/${session.id}`)}
              >
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {format(parseISO(session.date), 'd')}
                    </div>
                    <div className="text-xs text-gray-600 uppercase">
                      {format(parseISO(session.date), 'MMM', { locale: fr })}
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {format(parseISO(session.date), 'EEEE', { locale: fr })}
                    </p>
                    {session.isRestDay ? (
                      <p className="text-sm text-gray-600">Jour de repos</p>
                    ) : (
                      <p className="text-sm text-gray-600">
                        {session.exercises?.length || 0} exercice(s)
                      </p>
                    )}
                  </div>
                </div>
                {getSessionStatusBadge(session)}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
