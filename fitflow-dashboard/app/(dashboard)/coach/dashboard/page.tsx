'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { programsAPI, clientsAPI, appointmentsAPI } from '@/lib/api';
import type { Appointment } from '@/types';
import { Users, Calendar, MessageSquare, TrendingUp, UserPlus, Dumbbell, Flame, Heart, Wind, Clock, CheckCircle2, MapPin, Video, CalendarClock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ClientUser {
  firstName: string;
  lastName: string;
  email: string;
}

interface Client {
  id: string;
  user: ClientUser;
  requestStatus: string;
  goals?: string;
  weight?: number;
  height?: number;
}

interface SessionExercise {
  id: string;
  name: string;
  category: string;
  sets?: number;
  reps?: string;
  duration?: string;
}

interface Session {
  id: string;
  date: string;
  status: string;
  isRestDay: boolean;
  completedByClient: boolean;
  notes?: string;
  exercises?: SessionExercise[];
}

interface Program {
  id: string;
  title: string;
  isActive: boolean;
  clientId: string;
  sessions?: Session[];
}

interface Stats {
  totalClients: number;
  activePrograms: number;
  messagesUnread: number;
  /** Taux de complétion en pourcentage, ou null s'il n'y a aucune séance à mesurer.
   *  0 signifierait « aucune séance validée », ce qui n'est pas la même chose. */
  completionRate: number | null;
}

interface TodaySessionInfo {
  session: Session;
  programTitle: string;
  clientName: string;
  clientId: string;
  programId: string;
}

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Pas de cas particulier pour target === 0 : appeler setValue directement dans le
    // corps de l'effet déclenche un rendu en cascade. La boucle ci-dessous converge de
    // toute façon vers 0 dès la première frame.
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      // Easing ease-out : décélère en fin
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return value;
}

export default function CoachDashboardPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [todaySessions, setTodaySessions] = useState<TodaySessionInfo[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalClients: 0,
    activePrograms: 0,
    messagesUnread: 0,
    completionRate: null,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [programsResponse, clientsResponse, upcomingResponse] = await Promise.all([
        programsAPI.getCoachPrograms(),
        clientsAPI.getCoachClients(),
        appointmentsAPI.getUpcoming(),
      ]);

      setUpcomingAppointments(upcomingResponse.data.data || []);

      const programsData = programsResponse.data.data;
      const allClients = clientsResponse.data.data;

      // Filtrer uniquement les clients acceptes (pas les demandes en attente)
      const acceptedClients = allClients.filter((client: Client) => client.requestStatus === 'accepted');

      setPrograms(programsData);
      setClients(acceptedClients);

      // Calculer les stats
      const activePrograms = programsData.filter((p: Program) => p.isActive).length;

      // Taux de complétion sur 30 jours glissants.
      // Trois choix à noter :
      //  - programmes actifs seulement, pour rester cohérent avec la carte voisine ;
      //  - jours de repos exclus, ils n'ont rien à valider ;
      //  - séances futures exclues, une séance de demain n'est pas « manquée ».
      const windowStart = new Date();
      windowStart.setDate(windowStart.getDate() - 30);
      windowStart.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      let done = 0;
      let due = 0;
      for (const program of programsData.filter((p: Program) => p.isActive)) {
        for (const session of program.sessions ?? []) {
          if (session.isRestDay) continue;
          const date = new Date(session.date);
          if (date < windowStart || date > today) continue;
          due++;
          if (session.completedByClient) done++;
        }
      }

      setStats({
        totalClients: acceptedClients.length,
        activePrograms,
        messagesUnread: 0,
        completionRate: due > 0 ? Math.round((done / due) * 100) : null,
      });

      // Extraire les séances du jour depuis les programmes
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const todayItems: TodaySessionInfo[] = [];
      for (const program of programsData) {
        if (!program.isActive || !program.sessions) continue;
        const client = acceptedClients.find((c: Client) => c.id === program.clientId);
        for (const session of program.sessions) {
          // Comparer en heure locale pour gérer les fuseaux horaires
          const sessionDateStr = session.date ? format(parseISO(session.date), 'yyyy-MM-dd') : null;
          if (sessionDateStr === todayStr) {
            todayItems.push({
              session,
              programTitle: program.title,
              programId: program.id,
              clientName: client ? `${client.user.firstName} ${client.user.lastName}` : 'Client',
              clientId: client?.id || '',
            });
          }
        }
      }
      setTodaySessions(todayItems);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const countClients  = useCountUp(stats.totalClients);
  const countPrograms = useCountUp(stats.activePrograms);
  const countMessages = useCountUp(stats.messagesUnread);
  const countCompletion = useCountUp(stats.completionRate ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Tableau de bord Coach</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="flex items-center space-x-4">
          <div className="p-3 bg-primary-100 rounded-lg">
            <Users className="h-8 w-8 text-primary-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Clients</p>
            <p className="text-2xl font-bold">{countClients}</p>
          </div>
        </Card>

        <Card className="flex items-center space-x-4">
          <div className="p-3 bg-green-100 rounded-lg">
            <Calendar className="h-8 w-8 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Programmes actifs</p>
            <p className="text-2xl font-bold">{countPrograms}</p>
          </div>
        </Card>

        <Card className="flex items-center space-x-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <MessageSquare className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Messages non lus</p>
            <p className="text-2xl font-bold">{countMessages}</p>
          </div>
        </Card>

        <Card className="flex items-center space-x-4">
          <div className="p-3 bg-purple-100 rounded-lg">
            <TrendingUp className="h-8 w-8 text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Taux de complétion</p>
            <p className="text-2xl font-bold">
              {stats.completionRate === null ? '--' : `${countCompletion} %`}
            </p>
            <p className="text-xs text-gray-400">30 derniers jours</p>
          </div>
        </Card>
      </div>

      {/* Prochains RDV */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <CalendarClock className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Prochains rendez-vous</h2>
              <p className="text-sm text-gray-500">Les 3 prochains RDV confirmés</p>
            </div>
          </div>
          <Link href="/coach/appointments">
            <Button variant="secondary" size="sm">Voir tout</Button>
          </Link>
        </div>

        {upcomingAppointments.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Aucun rendez-vous à venir</p>
            <Link href="/coach/appointments" className="mt-3 inline-block">
              <Button size="sm">Créer un RDV</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingAppointments.map((appt) => (
              <div key={appt.id} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex-shrink-0 text-center min-w-[48px]">
                  <p className="text-xs text-gray-500 uppercase">
                    {format(new Date(appt.startAt), 'MMM', { locale: fr })}
                  </p>
                  <p className="text-2xl font-bold text-indigo-600 leading-none">
                    {format(new Date(appt.startAt), 'd')}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{appt.title}</p>
                  <p className="text-sm text-gray-500">
                    {format(new Date(appt.startAt), 'EEEE HH:mm', { locale: fr })} · {appt.durationMinutes} min
                  </p>
                  {appt.client && (
                    <p className="text-sm text-indigo-600 mt-0.5">
                      {appt.client.user.firstName} {appt.client.user.lastName}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 flex items-center gap-1.5 text-gray-400">
                  {appt.locationType === 'PHYSICAL'
                    ? <MapPin className="h-4 w-4" />
                    : <Video className="h-4 w-4" />
                  }
                  <span className="text-xs">{appt.locationType === 'PHYSICAL' ? 'Présentiel' : 'Distanciel'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Séances du jour */}
      {todaySessions.length > 0 && (
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <Dumbbell className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Séances du jour</h2>
              <p className="text-sm text-gray-500">{format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}</p>
            </div>
          </div>
          <div className="space-y-3">
            {todaySessions.map(({ session, programTitle, clientName, clientId, programId }) => (
              <Link
                key={session.id}
                href={`/coach/programs/${programId}/sessions/${session.id}/edit`}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${session.completedByClient ? 'bg-green-100' : 'bg-gray-100'}`}>
                    {session.completedByClient
                      ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                      : <Clock className="h-5 w-5 text-gray-500" />
                    }
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{clientName}</p>
                    <p className="text-sm text-gray-500">{programTitle}</p>
                    {session.exercises && session.exercises.length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {session.exercises.slice(0, 3).map(e => e.name).join(' · ')}
                        {session.exercises.length > 3 && ` +${session.exercises.length - 3}`}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    session.completedByClient
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {session.completedByClient ? 'Terminée' : 'En attente'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Mes Clients */}
      <Card>
        {/* pr-4 reprend le padding des lignes clients ci-dessous, pour que « Voir clients »
            tombe sur la même verticale que les boutons « Voir le profil » */}
        <div className="flex items-center justify-between mb-4 pr-4">
          <h3 className="text-xl font-bold">Mes Clients</h3>
          <Link href="/coach/clients">
            <Button variant="outline" size="sm">
              Voir clients
            </Button>
          </Link>
        </div>
        {loading ? (
          <p className="text-gray-600">Chargement...</p>
        ) : clients.length === 0 ? (
          <div className="text-center py-8">
            <UserPlus className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">Aucun client pour le moment</p>
            <p className="text-sm text-gray-500">
              Les clients apparaitront ici une fois qu&apos;ils seront assignes a votre profil.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {clients.map((client) => (
              <div key={client.id} data-surface="raised" className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                    <Users className="h-6 w-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {client.user.firstName} {client.user.lastName}
                    </h3>
                    <p className="text-sm text-gray-600">{client.user.email}</p>
                    {client.goals && (
                      <p className="text-sm text-gray-500 mt-1 italic">Objectif: {client.goals}</p>
                    )}
                    {client.weight && client.height && (
                      <p className="text-xs text-gray-500 mt-1">
                        {client.weight} kg &bull; {client.height} cm
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {!programs.some((p) => p.clientId === client.id && p.isActive) && (
                    <Link href={`/coach/clients/${client.id}/program/new`}>
                      <Button size="sm">
                        Creer un programme
                      </Button>
                    </Link>
                  )}
                  <Link href={`/coach/clients/${client.id}`}>
                    <Button variant="secondary" size="sm">
                      Voir le profil
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
