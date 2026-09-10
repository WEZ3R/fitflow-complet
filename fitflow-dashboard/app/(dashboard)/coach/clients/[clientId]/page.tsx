'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { MonthScrollCalendar } from '@/components/ui/month-scroll-calendar';
import { Button } from '@/components/ui/button';
import { clientsAPI, programsAPI, analyticsAPI, requestsAPI, availabilityAPI, blockAPI, appointmentsAPI } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import {
  ArrowLeft,
  User,
  Mail,
  Weight,
  Ruler,
  Target,
  Calendar,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  Check,
  X,
  Cake,
  TrendingUp,
  Download,
  ShieldOff,
  Shield,
  Zap,
  BarChart3,
  ExternalLink,
  CalendarDays,
  Table2,
} from 'lucide-react';
import { format, parseISO, differenceInYears, isSameDay, getDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import InolBreakdown from '@/components/analytics/InolBreakdown';
import ClientProgressPanel from '@/components/clients/client-progress-panel';
import MuscleProgressTable from '@/components/analytics/MuscleProgressTable';
import WorkoutAnalyticsPanel from '@/app/(dashboard)/coach/analytics/_components/WorkoutAnalyticsPanel';
import Link from 'next/link';
import type { ClientAvailability, BlockStatus, Appointment } from '@/types';
import { getMediaUrl } from '@/lib/media';

const DAYS_FR_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const CONTACT_LABELS: Record<string, string> = { PHONE: 'Téléphone', GYM: 'Salle', CAFE: 'Café', VISIO: 'Visio' };
const DURATION_OPTIONS = [30, 45, 60, 90, 120];
const RRULE_OPTIONS = [
  { value: '', label: 'Aucune' },
  { value: 'RRULE:FREQ=WEEKLY', label: 'Chaque semaine' },
  { value: 'RRULE:FREQ=WEEKLY;INTERVAL=2', label: 'Toutes les 2 semaines' },
  { value: 'RRULE:FREQ=MONTHLY', label: 'Mensuel' },
];

function ClientCalendarSection({ clientId, coachId }: { clientId: string; coachId: string }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availabilities, setAvailabilities] = useState<ClientAvailability[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blockStatus, setBlockStatus] = useState<BlockStatus | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [loadingBlock, setLoadingBlock] = useState(false);

  const fetchData = async (month: Date) => {
    const monthStr = format(month, 'yyyy-MM');
    try {
      const [availRes, blockRes] = await Promise.all([
        availabilityAPI.getClientAvailability(clientId, monthStr),
        blockAPI.getStatus(clientId),
      ]);
      setAvailabilities(availRes.data.data?.availabilities || []);
      setAppointments(availRes.data.data?.appointments || []);
      setBlockStatus(blockRes.data.data);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
    }
  };

  useEffect(() => { fetchData(currentMonth); }, [clientId, currentMonth]);

  // Un client qui n'a pas renseigné de créneaux est considéré disponible en permanence :
  // sans cette règle, aucun jour ne serait cliquable et le coach ne pourrait proposer aucun RDV.
  const isAlwaysAvailable = availabilities.length === 0;

  const getDayState = (day: Date): 'confirmed' | 'proposed' | 'available' | 'unavailable' => {
    const dow = getDay(day);
    if (appointments.some(a => a.status === 'CONFIRMED' && isSameDay(parseISO(a.startAt), day))) return 'confirmed';
    if (appointments.some(a => a.status === 'PROPOSED' && isSameDay(parseISO(a.startAt), day))) return 'proposed';
    if (isAlwaysAvailable) return 'available';
    if (availabilities.some(a => a.dayOfWeek === dow)) return 'available';
    return 'unavailable';
  };

  const handleDayClick = (day: Date) => {
    const state = getDayState(day);
    if (state === 'available' || state === 'proposed') {
      setSelectedDay(day);
      setShowProposalForm(true);
    }
  };

  const handleBlock = async (data: { blockedUntil?: string; reason?: string }) => {
    setLoadingBlock(true);
    try {
      await blockAPI.block(clientId, data);
      await fetchData(currentMonth);
      setShowBlockModal(false);
    } catch { alert('Erreur lors du blocage'); }
    finally { setLoadingBlock(false); }
  };

  const handleUnblock = async () => {
    setLoadingBlock(true);
    try {
      await blockAPI.unblock(clientId);
      await fetchData(currentMonth);
    } catch { alert('Erreur lors du déblocage'); }
    finally { setLoadingBlock(false); }
  };

  const isBlocked = blockStatus?.isBlocked ?? false;
  const blockedUntil = blockStatus?.block?.blockedUntil;

  const uniqueContacts = Array.from(new Set(availabilities.flatMap(a => a.contactTypes)));

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Disponibilités &amp; RDV
          </h2>
          <div className="flex items-center gap-2">
            {isBlocked ? (
              <>
                <span className="px-3 py-1 bg-red-100 text-red-700 text-sm font-medium rounded-full">
                  Bloqué{blockedUntil ? ` jusqu'au ${format(parseISO(blockedUntil), 'dd/MM/yyyy')}` : ' (permanent)'}
                </span>
                <Button variant="outline" size="sm" onClick={handleUnblock} disabled={loadingBlock}>
                  <ShieldOff className="h-4 w-4 mr-1" />
                  Débloquer
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowBlockModal(true)} className="text-red-600 border-red-200 hover:bg-red-50">
                <Shield className="h-4 w-4 mr-1" />
                Bloquer les demandes
              </Button>
            )}
          </div>
        </div>

        {/* Disponibilités du client */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-600 uppercase mb-2">Créneaux du client</h3>
          {isAlwaysAvailable ? (
            <p className="text-sm text-gray-500">
              Ce client n&apos;a pas renseigné ses disponibilités : il est considéré comme
              disponible en permanence, tous les créneaux sont donc proposables.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availabilities.map((slot) => (
                <span key={slot.id} className="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full border border-blue-200">
                  {DAYS_FR_SHORT[slot.dayOfWeek]} {slot.startTime}–{slot.endTime}
                  {slot.contactTypes.length > 0 && (
                    <span className="ml-1 text-blue-500">({slot.contactTypes.map(c => CONTACT_LABELS[c] || c).join(', ')})</span>
                  )}
                </span>
              ))}
            </div>
          )}
          {uniqueContacts.length > 0 && (
            <div className="flex gap-2 mt-2">
              <span className="text-xs text-gray-500">Préférences :</span>
              {uniqueContacts.map(ct => (
                <span key={ct} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                  {CONTACT_LABELS[ct] || ct}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Calendrier mensuel */}
        <div>
          <MonthScrollCalendar
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            renderDay={(day, { inMonth }) => {
              const state = getDayState(day);
              const dayAppts = appointments.filter(a => isSameDay(parseISO(a.startAt), day));
              const clickable = state === 'available' || state === 'proposed';
              return (
                <div
                  onClick={() => clickable && handleDayClick(day)}
                  className={`h-full w-full flex flex-col items-center justify-center rounded-lg text-sm relative
                    ${state === 'confirmed' ? 'bg-blue-500 text-white' : ''}
                    ${state === 'proposed' ? 'bg-blue-100 text-blue-800 cursor-pointer hover:bg-blue-200' : ''}
                    ${state === 'available' ? 'border-2 border-green-400 text-gray-700 cursor-pointer hover:bg-green-50' : ''}
                    ${state === 'unavailable' ? 'bg-gray-100 text-gray-400' : ''}
                    ${!inMonth ? 'opacity-30' : ''}
                  `}
                >
                  <span className="font-medium">{format(day, 'd')}</span>
                  {dayAppts.length > 0 && (
                    <span className="text-xs opacity-75">{dayAppts.length} RDV</span>
                  )}
                </div>
              );
            }}
          />

          {/* Légende */}
          <div className="flex gap-4 mt-3 text-xs text-gray-600">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-blue-500" /> Confirmé</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-blue-100 border border-blue-300" /> Proposé</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded border-2 border-green-400" /> Disponible</div>
            {!isAlwaysAvailable && (
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-gray-100" /> Indisponible</div>
            )}
          </div>
        </div>
      </Card>

      {/* Modal proposition RDV */}
      {showProposalForm && selectedDay && (
        <ProposalFormModal
          clientId={clientId}
          coachId={coachId}
          preselectedDate={selectedDay}
          onClose={() => setShowProposalForm(false)}
          onSuccess={() => { setShowProposalForm(false); fetchData(currentMonth); }}
        />
      )}

      {/* Modal blocage */}
      {showBlockModal && (
        <BlockModal
          onClose={() => setShowBlockModal(false)}
          onConfirm={handleBlock}
          loading={loadingBlock}
        />
      )}
    </>
  );
}

function ProposalFormModal({ clientId, coachId, preselectedDate, onClose, onSuccess }: {
  clientId: string; coachId: string; preselectedDate: Date;
  onClose: () => void; onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    title: '',
    startAt: format(preselectedDate, 'yyyy-MM-dd'),
    time: '09:00',
    durationMinutes: 60,
    locationType: 'PHONE',
    locationDetail: '',
    rrule: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) return;
    setSubmitting(true);
    try {
      const startAt = new Date(`${form.startAt}T${form.time}`).toISOString();
      await appointmentsAPI.create({
        title: form.title,
        clientId,
        startAt,
        durationMinutes: form.durationMinutes,
        locationType: form.locationType,
        locationDetail: form.locationDetail || undefined,
        meetingType: form.locationType,
        rrule: form.rrule || undefined,
      });
      onSuccess();
    } catch {
      alert('Erreur lors de la création du RDV');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-xl font-bold mb-4">Proposer un RDV</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
            <input type="text" required value={form.title}
              onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input type="date" required value={form.startAt}
                onChange={(e) => setForm(p => ({ ...p, startAt: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Heure *</label>
              <input type="time" required value={form.time}
                onChange={(e) => setForm(p => ({ ...p, time: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Durée *</label>
              <select value={form.durationMinutes}
                onChange={(e) => setForm(p => ({ ...p, durationMinutes: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type contact *</label>
              <select value={form.locationType}
                onChange={(e) => setForm(p => ({ ...p, locationType: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="PHONE">Téléphone</option>
                <option value="GYM">Salle de sport</option>
                <option value="CAFE">Café</option>
                <option value="VISIO">Visio</option>
                <option value="PHYSICAL">Présentiel</option>
                <option value="REMOTE">À distance</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Détail (adresse, lien…)</label>
            <input type="text" value={form.locationDetail}
              onChange={(e) => setForm(p => ({ ...p, locationDetail: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Optionnel" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Récurrence</label>
            <select value={form.rrule}
              onChange={(e) => setForm(p => ({ ...p, rrule: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              {RRULE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? 'Envoi...' : 'Proposer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BlockModal({ onClose, onConfirm, loading }: {
  onClose: () => void;
  onConfirm: (data: { blockedUntil?: string; reason?: string }) => void;
  loading: boolean;
}) {
  const [type, setType] = useState<'temp' | 'permanent'>('temp');
  const [blockedUntil, setBlockedUntil] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      blockedUntil: type === 'temp' && blockedUntil ? blockedUntil : undefined,
      reason: reason || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-sm w-full p-6">
        <h3 className="text-xl font-bold mb-4">Bloquer ce client</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" value="temp" checked={type === 'temp'} onChange={() => setType('temp')} />
              <span className="text-sm">Temporairement</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" value="permanent" checked={type === 'permanent'} onChange={() => setType('permanent')} />
              <span className="text-sm">Définitivement</span>
            </label>
          </div>
          {type === 'temp' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bloqué jusqu&apos;au</label>
              <input type="date" value={blockedUntil}
                onChange={(e) => setBlockedUntil(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Raison (optionnel)</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
            <Button type="submit" className="flex-1 bg-red-600 hover:bg-red-700" disabled={loading}>
              {loading ? 'Blocage...' : 'Bloquer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ClientUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Client {
  id: string;
  user: ClientUser;
  requestStatus: string;
  requestId?: string;
  requestMessage?: string;
  requestDate?: string;
  profilePicture?: string;
  weight?: number;
  height?: number;
  dateOfBirth?: string;
  // Renvoyé par l'API mais absent de ce type : le panneau Musculation s'en sert
  // pour appliquer le bon barème de force.
  gender?: string | null;
  goals?: string;
  createdAt: string;
}

interface Session {
  id: string;
}

interface Program {
  id: string;
  title: string;
  description?: string;
  isActive: boolean;
  startDate: string;
  endDate?: string;
  clientId: string;
  sessions?: Session[];
  dietEnabled?: boolean;
  waterTrackingEnabled?: boolean;
  sleepTrackingEnabled?: boolean;
}

interface StatEntry {
  date: string;
  weight?: number;
  waterIntake?: number;
  sleepHours?: number;
  totalCalories?: number;
}

interface ChartDataPoint {
  date: string;
  weight?: number;
  waterIntake?: number;
  sleepHours?: number;
  totalCalories?: number;
}

interface Metric {
  key: string;
  label: string;
  color: string;
}

interface Period {
  value: number;
  label: string;
}

export default function ClientProfilePage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const coachId = user?.coachProfile?.id || '';
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');

  // Etats pour les graphiques
  const [period, setPeriod] = useState(30);
  /** Onglet de la section « Statistiques et Progression ». */
  const [statsTab, setStatsTab] = useState<'stats' | 'progress' | 'workout' | 'table'>('stats');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['weight']);
  const [rawStatsData, setRawStatsData] = useState<StatEntry[]>([]);

  useEffect(() => {
    fetchClientData();
  }, [clientId]);

  useEffect(() => {
    if (client && client.requestStatus !== 'pending') {
      fetchAnalyticsData();
    }
  }, [client?.id, period, selectedMetrics]);

  const fetchClientData = async () => {
    try {
      const [clientResponse, programsResponse] = await Promise.all([
        clientsAPI.getById(clientId),
        programsAPI.getCoachPrograms(),
      ]);

      const clientData = clientResponse.data.data;
      setClient(clientData);

      const clientPrograms = programsResponse.data.data.filter(
        (p: Program) => p.clientId === clientData.id
      );
      setPrograms(clientPrograms);
    } catch (error) {
      console.error('Error fetching client data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProgram = async (programId: string) => {
    if (window.confirm('Voulez-vous vraiment supprimer ce programme ?')) {
      try {
        await programsAPI.delete(programId);
        fetchClientData();
      } catch (error) {
        console.error('Error deleting program:', error);
        alert('Erreur lors de la suppression du programme');
      }
    }
  };

  const handleToggleActive = async (program: Program) => {
    try {
      await programsAPI.update(program.id, {
        ...program,
        isActive: !program.isActive,
      });
      fetchClientData();
    } catch (error) {
      console.error('Error updating program:', error);
      alert('Erreur lors de la mise a jour du programme');
    }
  };

  const startEditing = (program: Program) => {
    setEditingProgramId(program.id);
    setEditedTitle(program.title);
    setEditedDescription(program.description || '');
  };

  const cancelEditing = () => {
    setEditingProgramId(null);
    setEditedTitle('');
    setEditedDescription('');
  };

  const saveEditing = async (program: Program) => {
    try {
      await programsAPI.update(program.id, {
        ...program,
        title: editedTitle,
        description: editedDescription,
      });
      setEditingProgramId(null);
      fetchClientData();
    } catch (error) {
      console.error('Error updating program:', error);
      alert('Erreur lors de la mise a jour du programme');
    }
  };

  const fetchAnalyticsData = async () => {
    if (!client) return;

    setLoadingChart(true);
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - period);

      const response = await analyticsAPI.getClientStats({
        clientIds: [client.id],
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      if (!response.data.data || response.data.data.length === 0 || !response.data.data[0]?.stats?.length) {
        setChartData([]);
        setRawStatsData([]);
        return;
      }

      const stats: StatEntry[] = response.data.data[0].stats;

      setRawStatsData(stats);

      const formattedData: ChartDataPoint[] = stats.map((stat) => ({
        date: new Date(stat.date).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
        }),
        weight: stat.weight,
        waterIntake: stat.waterIntake,
        sleepHours: stat.sleepHours,
        totalCalories: stat.totalCalories,
      }));

      setChartData(formattedData);
    } catch (error) {
      console.error('Erreur lors de la recuperation des donnees analytics:', error);
      setChartData([]);
    } finally {
      setLoadingChart(false);
    }
  };

  const metrics: Metric[] = [
    { key: 'weight', label: 'Poids (kg)', color: '#3b82f6' },
    { key: 'waterIntake', label: 'Eau (L)', color: '#06b6d4' },
    { key: 'sleepHours', label: 'Sommeil (h)', color: '#8b5cf6' },
    { key: 'totalCalories', label: 'Calories', color: '#f59e0b' },
  ];

  const periods: Period[] = [
    { value: 7, label: '7 jours' },
    { value: 30, label: '30 jours' },
    { value: 60, label: '60 jours' },
    { value: 90, label: '90 jours' },
  ];

  const handleMetricToggle = (metricKey: string) => {
    setSelectedMetrics(prev => {
      if (prev.includes(metricKey)) {
        return prev.filter(key => key !== metricKey);
      } else {
        return [...prev, metricKey];
      }
    });
  };

  const exportToExcel = () => {
    if (rawStatsData.length === 0) {
      alert('Aucune donnee a exporter');
      return;
    }

    const excelData = rawStatsData.map(stat => ({
      'Date': new Date(stat.date).toLocaleDateString('fr-FR'),
      'Poids (kg)': stat.weight || '-',
      'Eau (L)': stat.waterIntake || '-',
      'Sommeil (h)': stat.sleepHours || '-',
      'Calories': stat.totalCalories || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Statistiques');

    const fileName = `${client?.user?.firstName}_${client?.user?.lastName}_stats_${new Date().toLocaleDateString('fr-FR')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handleAcceptRequest = async () => {
    if (!client?.requestId) return;

    try {
      await requestsAPI.accept(client.requestId);
      router.push('/coach/clients');
    } catch (error) {
      console.error('Error accepting request:', error);
      alert("Erreur lors de l'acceptation de la demande");
    }
  };

  const handleRejectRequest = async () => {
    if (!client?.requestId) return;

    if (window.confirm('Voulez-vous vraiment refuser cette demande ?')) {
      try {
        await requestsAPI.reject(client.requestId);
        router.push('/coach/clients');
      } catch (error) {
        console.error('Error rejecting request:', error);
        alert('Erreur lors du refus de la demande');
      }
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
      <div className="text-center py-12">
        <p className="text-gray-600">Client non trouve</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push('/coach/dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Profil de {client.user.firstName} {client.user.lastName}
            </h1>
            <p className="text-gray-600 mt-1">Gestion du client et de ses programmes</p>
          </div>
        </div>
        <Button onClick={() => router.push(`/coach/clients/${clientId}/progress`)}>
          <Calendar className="h-4 w-4 mr-2" />
          Consulter progression
        </Button>
      </div>

      {/* Banniere pour demande en attente */}
      {client.requestStatus === 'pending' && (
        <Card className="border-2 border-yellow-300 bg-yellow-50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <h3 className="text-lg font-bold text-yellow-900">
                  Demande d&apos;entrainement en attente
                </h3>
              </div>
              {client.requestMessage && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-yellow-900 mb-1">Message du client:</p>
                  <p className="text-sm text-yellow-800 bg-white rounded-lg p-3 border border-yellow-200">
                    {client.requestMessage}
                  </p>
                </div>
              )}
              {client.requestDate && (
                <p className="text-xs text-yellow-700">
                  Demande recue le {format(parseISO(client.requestDate), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleAcceptRequest}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="h-4 w-4 mr-2" />
                Accepter
              </Button>
              <Button
                variant="danger"
                onClick={handleRejectRequest}
              >
                <X className="h-4 w-4 mr-2" />
                Refuser
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Informations client */}
        <div className="lg:col-span-1">
          <Card>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center overflow-hidden">
                {client.profilePicture ? (
                  <img
                    src={getMediaUrl(client.profilePicture) || undefined}
                    alt=""
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-8 w-8 text-primary-600" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {client.user.firstName} {client.user.lastName}
                </h2>
                <p className="text-sm text-gray-600">Client</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-gray-700">
                <Mail className="h-5 w-5 text-gray-400" />
                <span className="text-sm">{client.user.email}</span>
              </div>

              {client.weight && (
                <div className="flex items-center gap-3 text-gray-700">
                  <Weight className="h-5 w-5 text-gray-400" />
                  <span className="text-sm">{client.weight} kg</span>
                </div>
              )}

              {client.height && (
                <div className="flex items-center gap-3 text-gray-700">
                  <Ruler className="h-5 w-5 text-gray-400" />
                  <span className="text-sm">{client.height} cm</span>
                </div>
              )}

              {client.dateOfBirth && (
                <div className="flex items-center gap-3 text-gray-700">
                  <Cake className="h-5 w-5 text-gray-400" />
                  <span className="text-sm">
                    {differenceInYears(new Date(), new Date(client.dateOfBirth))} ans
                  </span>
                </div>
              )}

              {client.goals && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Target className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-blue-900 mb-1">Objectifs</p>
                      <p className="text-sm text-blue-800">{client.goals}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t">
                <p className="text-xs text-gray-500">
                  Client depuis le{' '}
                  {format(parseISO(client.createdAt), 'dd MMMM yyyy', { locale: fr })}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Programmes */}
        <div className="lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Programmes ({programs.length})
              </h2>
              {programs.length === 0 && (
                <Button onClick={() => router.push(`/coach/clients/${clientId}/program/new`)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau programme
                </Button>
              )}
            </div>

            {programs.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 mb-4">Aucun programme pour ce client</p>
                <Button onClick={() => router.push(`/coach/clients/${clientId}/program/new`)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Creer le premier programme
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {programs.map((program) => (
                  <div
                    key={program.id}
                    className={`border-2 rounded-lg p-5 transition-all ${
                      program.isActive
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        {editingProgramId === program.id ? (
                          /* Mode edition */
                          <div className="space-y-3 mb-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Titre du programme *
                              </label>
                              <input
                                type="text"
                                value={editedTitle}
                                onChange={(e) => setEditedTitle(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                placeholder="Nom du programme"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description
                              </label>
                              <textarea
                                rows={2}
                                value={editedDescription}
                                onChange={(e) => setEditedDescription(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                placeholder="Description du programme"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => saveEditing(program)}
                                disabled={!editedTitle.trim()}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Enregistrer
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={cancelEditing}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Annuler
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* Mode affichage */
                          <>
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-bold text-gray-900">
                                {program.title}
                              </h3>
                              <button
                                onClick={() => startEditing(program)}
                                className="text-gray-400 hover:text-primary-600 transition-colors"
                                title="Modifier le nom"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              {program.isActive ? (
                                <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded-full">
                                  Actif
                                </span>
                              ) : (
                                <span className="px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-600 rounded-full">
                                  Inactif
                                </span>
                              )}
                            </div>

                            {program.description && (
                              <p className="text-sm text-gray-600 mb-3">{program.description}</p>
                            )}
                          </>
                        )}

                        <div className="flex flex-wrap gap-4 text-sm text-gray-700">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>
                              Du {format(parseISO(program.startDate), 'dd/MM/yyyy')}
                              {program.endDate &&
                                ` au ${format(parseISO(program.endDate), 'dd/MM/yyyy')}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>{program.sessions?.length || 0} seances</span>
                          </div>
                        </div>

                        {/* Options du programme */}
                        <div className="flex flex-wrap gap-2 mt-3">
                          {program.dietEnabled && (
                            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                              Nutrition activee
                            </span>
                          )}
                          {program.waterTrackingEnabled && (
                            <span className="px-2 py-1 text-xs bg-cyan-100 text-cyan-700 rounded-full">
                              Suivi eau
                            </span>
                          )}
                          {program.sleepTrackingEnabled && (
                            <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
                              Suivi sommeil
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => router.push(`/coach/programs/${program.id}/calendar`)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Modifier
                        </Button>
                        <Button
                          size="sm"
                          variant={program.isActive ? 'secondary' : 'primary'}
                          onClick={() => handleToggleActive(program)}
                        >
                          {program.isActive ? (
                            <>
                              <Clock className="h-4 w-4 mr-1" />
                              Desactiver
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Activer
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDeleteProgram(program.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Section Disponibilités & RDV — uniquement pour clients actifs */}
      {coachId && client?.requestStatus !== 'pending' && (
        <div className="mt-8">
          <ClientCalendarSection clientId={clientId} coachId={coachId} />
        </div>
      )}

      {/* Section Graphiques — uniquement pour clients actifs */}
      {client?.requestStatus !== 'pending' && <div className="mt-8">
        <Card>
          <div className="mb-6">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  <TrendingUp className="inline-block h-6 w-6 mr-2 text-primary-500" />
                  Statistiques et Progression
                </h2>
                <p className="text-gray-600 text-sm">
                  Visualisez l&apos;evolution des donnees de votre client
                </p>
              </div>

              {/* Raccourci vers l'analyse comparative, client déjà sélectionné :
                  sans le paramètre, il faudrait le retrouver dans une liste de trente. */}
              <Link
                href={`/coach/analytics?tab=workout&clientId=${clientId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary-500/40 px-3 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-500/10 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Ouvrir dans l&apos;analyse comparative
              </Link>
            </div>

            {/* Onglets */}
            <div className="mt-4 flex gap-1 border-b border-gray-500/20">
              {([
                { key: 'stats', label: 'Statistiques', icon: TrendingUp },
                { key: 'progress', label: 'Progression', icon: CalendarDays },
                { key: 'workout', label: 'Musculation', icon: BarChart3 },
                { key: 'table', label: 'Tableau exportable', icon: Table2 },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setStatsTab(t.key)}
                  aria-selected={statsTab === t.key}
                  role="tab"
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    statsTab === t.key
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <t.icon className="h-4 w-4" aria-hidden="true" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Onglet Statistiques : graphiques, tableau et intensité cumulée */}
          {statsTab === 'stats' && (
            <>
            {/* Filtres */}
            <div className="mb-6 space-y-4">
              {/* Selection de la periode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Periode
                </label>
                <div className="flex gap-2 flex-wrap">
                  {periods.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setPeriod(p.value)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        period === p.value
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selection des metriques */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Metriques
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {metrics.map(metric => (
                    <label
                      key={metric.key}
                      className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMetrics.includes(metric.key)}
                        onChange={() => handleMetricToggle(metric.key)}
                        className="h-4 w-4 text-orange-600 rounded focus:ring-orange-500"
                      />
                      <div className="ml-3 flex items-center">
                        <div
                          className="w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: metric.color }}
                        />
                        <span className="text-sm font-medium text-gray-900">
                          {metric.label}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Graphique */}
            <div>
              {loadingChart ? (
                <div className="flex items-center justify-center h-96">
                  <div className="text-gray-500">Chargement des donnees...</div>
                </div>
              ) : chartData.length === 0 ? (
                <div className="flex items-center justify-center h-96">
                  <div className="text-gray-500">Aucune donnee disponible pour cette periode</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                    />
                    <Tooltip
                      labelStyle={{ color: '#ffffff', fontWeight: 600 }}
                      contentStyle={{
                        backgroundColor: 'var(--surface-card, #323232)',
                        border: '1px solid rgba(255,255,255,0.14)',
                        borderRadius: '8px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                      }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: '20px' }}
                      iconType="line"
                    />
                    {selectedMetrics.map(metricKey => {
                      const metric = metrics.find(m => m.key === metricKey);
                      if (!metric) return null;
                      return (
                        <Line
                          key={metricKey}
                          type="monotone"
                          dataKey={metricKey}
                          stroke={metric.color}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          name={metric.label}
                          connectNulls
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Tableau des donnees */}
            {!loadingChart && rawStatsData.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Tableau des donnees</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Periode: {period} jours ({rawStatsData.length} entrees)
                    </p>
                  </div>
                  <Button onClick={exportToExcel} variant="secondary" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Exporter en Excel
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Poids (kg)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Eau (L)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Sommeil (h)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Calories
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {rawStatsData.map((stat, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(stat.date).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {stat.weight ? stat.weight.toFixed(1) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {stat.waterIntake ? stat.waterIntake.toFixed(1) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {stat.sleepHours ? stat.sleepHours.toFixed(1) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {stat.totalCalories ? Math.round(stat.totalCalories) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Intensité (INOL) — même période que les graphiques ci-dessus */}
            <div className="mt-8 pt-6 border-t border-gray-500/20">
              <div className="mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary-500" />
                  Intensité de l&apos;entraînement (INOL)
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Charge nerveuse subie, par exercice et par groupe musculaire.
                  Période : {period} jours.
                </p>
              </div>
              {/* key : changer de période remonte le composant, ce qui remet son état
                  à « chargement » sans setState synchrone dans un effet. */}
              <InolBreakdown key={period} clientId={clientId} days={period} />
            </div>
            </>
          )}

          {/* Onglet Progression : le calendrier et le détail du jour, mêmes
              composants que la page dédiée /progress. */}
          {statsTab === 'progress' && <ClientProgressPanel clientId={clientId} />}

          {/* Onglet Musculation : le panneau de la page d'analyse, à l'identique.
              Il porte sa propre période interne, alignée sur celle de la section. */}
          {statsTab === 'workout' && (
            <WorkoutAnalyticsPanel
              clientId={clientId}
              clientName={client ? `${client.user.firstName} ${client.user.lastName}` : ''}
              clientGender={client?.gender ?? null}
              period={period}
              // Le graphique « Intensité par séance » compare des totaux de séance à
              // des seuils valables par exercice : il affiche « Intense » en
              // permanence. L'INOL est présenté correctement dans les onglets
              // Progression et Tableau.
              showInol={false}
            />
          )}

          {/* Onglet Tableau : le grain le plus fin — un exercice par séance — avec
              export Excel. C'est le seul export qui permette de recalculer les
              agrégats en aval. */}
          {statsTab === 'table' && (
            <MuscleProgressTable
              clientId={clientId}
              clientName={client ? `${client.user.firstName} ${client.user.lastName}` : ''}
              days={period}
            />
          )}
        </Card>
      </div>}
    </div>
  );
}
