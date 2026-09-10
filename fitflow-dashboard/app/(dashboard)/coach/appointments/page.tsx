'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { MonthScrollCalendar } from '@/components/ui/month-scroll-calendar';
import { Button } from '@/components/ui/button';
import { appointmentsAPI, clientsAPI } from '@/lib/api';
import type { Appointment } from '@/types';
import {
  CalendarClock, Plus, MapPin, Video, X,
  Clock, Trash2, RefreshCcw, User, Pencil,
} from 'lucide-react';
import { format, isSameDay, parseISO, isToday as dateFnsIsToday } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ClientOption {
  id: string;
  user: { firstName: string; lastName: string };
}

const STATUS_CONFIG = {
  PROPOSED: { label: 'Proposé', className: 'bg-yellow-100 text-yellow-700' },
  CONFIRMED: { label: 'Confirmé', className: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Annulé', className: 'bg-gray-100 text-gray-500' },
};

const RRULE_OPTIONS = [
  { value: '', label: 'Aucune répétition' },
  { value: 'RRULE:FREQ=WEEKLY', label: 'Chaque semaine' },
  { value: 'RRULE:FREQ=WEEKLY;COUNT=4', label: 'Chaque semaine (4 fois)' },
  { value: 'RRULE:FREQ=BIWEEKLY', label: 'Toutes les 2 semaines' },
  { value: 'RRULE:FREQ=MONTHLY', label: 'Chaque mois' },
];

const DURATION_OPTIONS = [30, 45, 60, 90, 120];

// Grille horaire — journée complète, de 00:00 à 00:00
const GRID_START = 0;   // 00:00
const GRID_END = 24;    // 00:00 du lendemain (borne de fin, sans bande horaire)
const HOUR_HEIGHT = 44; // px par heure
/**
 * Heure amenée en haut du cadre à l'ouverture.
 *
 * La grille commence à 00:00 pour qu'un rendez-vous nocturne reste plaçable, mais
 * personne ne travaille à cette heure : la vue s'ouvrait donc sur sept bandes vides.
 * On fait défiler jusqu'à 7:00 sans amputer la grille — les heures précédentes
 * restent accessibles en remontant.
 */
const OPENING_HOUR = 7;
const GRID_HOURS = Array.from({ length: GRID_END - GRID_START + 1 }, (_, i) => GRID_START + i);
const TOTAL_HEIGHT = (GRID_END - GRID_START) * HOUR_HEIGHT;

const APPT_COLORS: Record<string, string> = {
  PROPOSED:  'bg-yellow-50  border-yellow-300  text-yellow-900',
  CONFIRMED: 'bg-indigo-50  border-indigo-300  text-indigo-900',
  CANCELLED: 'bg-gray-50    border-gray-200    text-gray-400 opacity-50',
};

export default function CoachAppointmentsPage() {
  const searchParams = useSearchParams();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [conflictData, setConflictData] = useState<{
    id: string; title: string; startAt: string; endAt: string; durationMinutes: number;
  } | null>(null);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ appt: Appointment; x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  /** Le cadrage initial ne doit se faire qu'une fois, pas à chaque rendu. */
  const framedRef = useRef(false);

  // Édition d'un RDV
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    startAt: '',
    durationMinutes: 60,
    locationType: 'PHYSICAL' as 'PHYSICAL' | 'REMOTE',
    locationDetail: '',
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  // Formulaire création
  const [form, setForm] = useState({
    title: '',
    clientId: '',
    startAt: '',
    durationMinutes: 60,
    locationType: 'PHYSICAL' as 'PHYSICAL' | 'REMOTE',
    locationDetail: '',
    rrule: '',
  });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  // Préselection date depuis ?date=YYYY-MM-DD (clic notification cloche)
  useEffect(() => {
    const dateParam = searchParams.get('date');
    if (!dateParam) return;
    const target = parseISO(dateParam);
    if (Number.isNaN(target.getTime())) return;
    setCalendarDate(target);
    setSelectedDay(target);
  }, [searchParams]);

  const fetchData = async () => {
    try {
      const [apptRes, clientsRes] = await Promise.all([
        appointmentsAPI.getAll(),
        clientsAPI.getCoachClients(),
      ]);
      setAppointments(apptRes.data.data || []);
      const allClients = clientsRes.data.data || [];
      setClients(allClients.filter((c: ClientOption & { requestStatus: string }) => c.requestStatus === 'accepted'));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openForm = () => {
    const baseDate = selectedDay ?? new Date();
    const dateStr = format(baseDate, "yyyy-MM-dd'T'09:00");
    setForm((f) => ({ ...f, startAt: dateStr }));
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setFormError('');
  };

  const buildPayload = (resolution?: string, conflictId?: string) => ({
    title: form.title,
    ...(form.clientId ? { clientId: form.clientId } : {}),
    startAt: new Date(form.startAt).toISOString(),
    durationMinutes: form.durationMinutes,
    locationType: form.locationType,
    ...(form.locationDetail ? { locationDetail: form.locationDetail } : {}),
    ...(form.rrule ? { rrule: form.rrule } : {}),
    ...(resolution ? { resolution, conflictId } : {}),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.title || !form.startAt) {
      setFormError('Le titre et la date sont requis.');
      return;
    }
    setSubmitting(true);
    try {
      await appointmentsAPI.create(buildPayload());
      closeForm();
      setForm({ title: '', clientId: '', startAt: '', durationMinutes: 60, locationType: 'PHYSICAL', locationDetail: '', rrule: '' });
      await fetchData();
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { message?: string; conflict?: typeof conflictData } } })?.response?.data;
      if (errData?.conflict) {
        setConflictData(errData.conflict);
      } else {
        setFormError(errData?.message || 'Erreur lors de la création du RDV.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveConflict = async (resolution: 'replace' | 'shorten' | 'cancel') => {
    if (resolution === 'cancel') {
      setConflictData(null);
      return;
    }
    setConflictData(null);
    setSubmitting(true);
    try {
      await appointmentsAPI.create(buildPayload(resolution, conflictData?.id));
      closeForm();
      setForm({ title: '', clientId: '', startAt: '', durationMinutes: 60, locationType: 'PHYSICAL', locationDetail: '', rrule: '' });
      await fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg || 'Erreur lors de la résolution du conflit.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string, hasSeries: boolean) => {
    const scope = hasSeries && confirm('Annuler toute la série ?') ? 'series' : 'single';
    try {
      await appointmentsAPI.cancel(id, scope as 'single' | 'series');
      await fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string, hasSeries: boolean) => {
    if (!confirm('Supprimer ce rendez-vous ?')) return;
    const scope = hasSeries && confirm('Supprimer toute la série ?') ? 'series' : 'single';
    try {
      await appointmentsAPI.delete(id, scope as 'single' | 'series');
      await fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // Context menu
  const openContextMenu = (appt: Appointment, e: React.MouseEvent) => {
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 180);
    setContextMenu({ appt, x, y });
  };

  const closeContextMenu = () => setContextMenu(null);

  useEffect(() => {
    if (!contextMenu) return;
    const handle = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [contextMenu]);

  // Édition
  const openEditModal = (appt: Appointment) => {
    setEditingAppt(appt);
    setEditForm({
      title: appt.title,
      startAt: format(parseISO(appt.startAt), "yyyy-MM-dd'T'HH:mm"),
      durationMinutes: appt.durationMinutes,
      locationType: (appt.locationType === 'REMOTE' ? 'REMOTE' : 'PHYSICAL') as 'PHYSICAL' | 'REMOTE',
      locationDetail: appt.locationDetail || '',
    });
    setEditError('');
    closeContextMenu();
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAppt) return;
    setEditSubmitting(true);
    setEditError('');
    try {
      await appointmentsAPI.update(editingAppt.id, {
        title: editForm.title,
        startAt: new Date(editForm.startAt).toISOString(),
        durationMinutes: editForm.durationMinutes,
        locationType: editForm.locationType,
        ...(editForm.locationDetail ? { locationDetail: editForm.locationDetail } : { locationDetail: '' }),
      });
      setEditingAppt(null);
      await fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setEditError(msg || 'Erreur lors de la modification.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Calendrier

  const appointmentsOnDay = (day: Date) =>
    appointments.filter((a) => isSameDay(parseISO(a.startAt), day) && a.status !== 'CANCELLED');

  // Jour affiché dans la grille (jour sélectionné ou aujourd'hui)
  const viewDay = selectedDay ?? new Date();
  const viewIsToday = dateFnsIsToday(viewDay);

  const dayAppointments = appointments.filter((a) => {
    if (filterStatus && a.status !== filterStatus) return false;
    return isSameDay(parseISO(a.startAt), viewDay);
  }).sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  // Indicateur heure courante
  const now = new Date();
  const currentTimeTop = viewIsToday
    ? (now.getHours() + now.getMinutes() / 60 - GRID_START) * HOUR_HEIGHT
    : -1;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <CalendarClock className="h-7 w-7 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
            <p className="text-sm text-gray-500">Gérez vos rendez-vous</p>
          </div>
        </div>
        <Button onClick={openForm}>
          <Plus className="h-4 w-4 mr-2" /> Créer un RDV
        </Button>
      </div>

      {/* Modal formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Nouveau rendez-vous</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Avec client → proposition envoyée au client. Sans client → créneau bloqué.
                </p>
              </div>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{formError}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: Séance bilan, Coaching individuel..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client <span className="text-gray-400">(optionnel)</span>
                </label>
                <select
                  value={form.clientId}
                  onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">— Sans client (créneau bloqué) —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.user.firstName} {c.user.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date et heure *</label>
                <input
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Durée</label>
                <select
                  value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: parseInt(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {DURATION_OPTIONS.map((d) => (
                    <option key={d} value={d}>{d} min</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type de lieu</label>
                <div className="flex gap-3">
                  {(['PHYSICAL', 'REMOTE'] as const).map((type) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value={type}
                        checked={form.locationType === type}
                        onChange={() => setForm({ ...form, locationType: type })}
                        className="text-indigo-600"
                      />
                      <span className="text-sm text-gray-700 flex items-center gap-1">
                        {type === 'PHYSICAL' ? <><MapPin className="h-4 w-4" /> Présentiel</> : <><Video className="h-4 w-4" /> Distanciel</>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {form.locationType === 'PHYSICAL' ? 'Adresse' : 'Lien visio'}
                </label>
                <input
                  type="text"
                  value={form.locationDetail}
                  onChange={(e) => setForm({ ...form, locationDetail: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={form.locationType === 'PHYSICAL' ? 'Ex: 12 rue du sport, Paris' : 'https://meet.google.com/...'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Répétition</label>
                <select
                  value={form.rrule}
                  onChange={(e) => setForm({ ...form, rrule: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {RRULE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? 'Création...' : form.clientId ? 'Envoyer la proposition' : 'Créer le RDV'}
                </Button>
                <Button type="button" variant="secondary" onClick={closeForm}>
                  Annuler
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal conflit */}
      {conflictData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-100 rounded-lg">
                <CalendarClock className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Conflit de planning</h2>
                <p className="text-sm text-gray-500">Un RDV existe déjà sur ce créneau</p>
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-5">
              <p className="font-semibold text-gray-900 mb-1">{conflictData.title}</p>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {format(parseISO(conflictData.startAt), "EEEE d MMMM 'à' HH:mm", { locale: fr })}
                  {' — '}
                  {format(parseISO(conflictData.endAt), 'HH:mm')}
                  {' '}({conflictData.durationMinutes} min)
                </span>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-4">Que souhaitez-vous faire ?</p>

            <div className="space-y-2">
              <button
                onClick={() => handleResolveConflict('replace')}
                disabled={submitting}
                className="w-full text-left px-4 py-3 rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
              >
                <p className="font-medium text-red-700">Remplacer le RDV existant</p>
                <p className="text-xs text-gray-500 mt-0.5">Supprime l&apos;ancien RDV et crée le nouveau à sa place</p>
              </button>
              <button
                onClick={() => handleResolveConflict('shorten')}
                disabled={submitting}
                className="w-full text-left px-4 py-3 rounded-lg border border-indigo-200 hover:bg-indigo-50 transition-colors"
              >
                <p className="font-medium text-indigo-700">Raccourcir les deux</p>
                <p className="text-xs text-gray-500 mt-0.5">Le RDV qui débute en premier se termine là où l&apos;autre commence</p>
              </button>
              <button
                onClick={() => handleResolveConflict('cancel')}
                disabled={submitting}
                className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <p className="font-medium text-gray-700">Modifier l&apos;heure du nouveau RDV</p>
                <p className="text-xs text-gray-500 mt-0.5">Revenir au formulaire pour choisir un autre créneau</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[200] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden min-w-[200px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div className="px-4 py-2.5 border-b border-gray-100">
            <p className="font-semibold text-gray-900 text-sm truncate max-w-[220px]">{contextMenu.appt.title}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {format(parseISO(contextMenu.appt.startAt), "EEEE d MMM 'à' HH:mm", { locale: fr })}
            </p>
          </div>
          {contextMenu.appt.status !== 'CANCELLED' && (
            <button
              onClick={() => openEditModal(contextMenu.appt)}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Pencil className="h-4 w-4 text-indigo-500" /> Modifier le RDV
            </button>
          )}
          <button
            onClick={() => { handleDelete(contextMenu.appt.id, !!contextMenu.appt.rrule); closeContextMenu(); }}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-gray-100"
          >
            <Trash2 className="h-4 w-4" /> Supprimer
          </button>
        </div>
      )}

      {/* Modal édition */}
      {editingAppt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Modifier le rendez-vous</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {editingAppt.status === 'CONFIRMED' && editingAppt.client
                    ? 'Le client sera notifié des changements.'
                    : 'Modification du créneau.'}
                </p>
              </div>
              <button onClick={() => setEditingAppt(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {editError && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{editError}</p>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
                <input
                  type="text"
                  required
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date et heure</label>
                  <input
                    type="datetime-local"
                    required
                    value={editForm.startAt}
                    onChange={(e) => setEditForm({ ...editForm, startAt: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Durée</label>
                  <select
                    value={editForm.durationMinutes}
                    onChange={(e) => setEditForm({ ...editForm, durationMinutes: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {DURATION_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d} min</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type de lieu</label>
                <div className="flex gap-3">
                  {(['PHYSICAL', 'REMOTE'] as const).map((type) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value={type}
                        checked={editForm.locationType === type}
                        onChange={() => setEditForm({ ...editForm, locationType: type })}
                        className="text-indigo-600"
                      />
                      <span className="text-sm text-gray-700 flex items-center gap-1">
                        {type === 'PHYSICAL' ? <><MapPin className="h-4 w-4" /> Présentiel</> : <><Video className="h-4 w-4" /> Distanciel</>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {editForm.locationType === 'PHYSICAL' ? 'Adresse' : 'Lien visio'}
                </label>
                <input
                  type="text"
                  value={editForm.locationDetail}
                  onChange={(e) => setEditForm({ ...editForm, locationDetail: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={editForm.locationType === 'PHYSICAL' ? 'Ex: 12 rue du sport, Paris' : 'https://meet.google.com/...'}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={editSubmitting} className="flex-1">
                  {editSubmitting ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setEditingAppt(null)}>
                  Annuler
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendrier */}
        <Card className="lg:col-span-1">
          <MonthScrollCalendar
            month={calendarDate}
            onMonthChange={setCalendarDate}
            renderDay={(day, { inMonth }) => {
              const dayAppts = appointmentsOnDay(day);
              const isSelected = selectedDay && isSameDay(day, selectedDay);
              const isToday = isSameDay(day, new Date());
              return (
                <button
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`relative flex flex-col items-center justify-center h-full w-full rounded-lg text-sm transition-colors
                    ${isSelected ? 'bg-indigo-600 text-white' : isToday ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'hover:bg-gray-50 text-gray-700'}
                    ${!inMonth ? 'opacity-30' : ''}
                  `}
                >
                  {format(day, 'd')}
                  {dayAppts.length > 0 && (
                    <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-indigo-500'}`} />
                  )}
                </button>
              );
            }}
          />
          {selectedDay && (
            <button
              onClick={() => setSelectedDay(null)}
              className="mt-3 w-full text-xs text-indigo-600 hover:text-indigo-700 underline text-center"
            >
              Voir tous les RDV
            </button>
          )}
        </Card>

        {/* Vue jour — emploi du temps */}
        <div className="lg:col-span-2 flex flex-col gap-3">

          {/* En-tête : jour + filtres */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-semibold text-gray-800 capitalize">
              {format(viewDay, 'EEEE d MMMM yyyy', { locale: fr })}
            </h3>
            <div className="flex gap-2 flex-wrap">
              {['', 'PROPOSED', 'CONFIRMED'].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors
                    ${filterStatus === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}
                >
                  {s === '' ? 'Tous' : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grille */}
          <Card className="p-0 overflow-hidden flex-1">
            {loading ? (
              <div className="flex items-center justify-center h-64 text-gray-400">Chargement...</div>
            ) : (
              // paddingBottom réduit à 8 px : c'est le débord de l'étiquette « 00:00 »
              // sous sa ligne (-mt-2). Les 16 px précédents laissaient du vide sous la
              // dernière heure, si bien que le défilement ne s'arrêtait pas sur elle.
              <div
                ref={(el) => {
                  scrollerRef.current = el;
                  // Cadrage sur l'heure d'ouverture dès que le conteneur existe.
                  // Fait dans le callback de ref plutôt que dans un effet : le
                  // conteneur n'apparaît qu'après le chargement, un effet au montage
                  // le trouverait encore nul.
                  if (el && !framedRef.current) {
                    framedRef.current = true;
                    el.scrollTop = (OPENING_HOUR - GRID_START) * HOUR_HEIGHT;
                  }
                }}
                className="overflow-y-auto"
                style={{ maxHeight: 'calc(100vh - 240px)', paddingTop: '16px', paddingBottom: '0px' }}
              >
              <div className="relative select-none" style={{ height: `${TOTAL_HEIGHT}px` }}>

                  {/* Lignes horaires */}
                  {GRID_HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 flex items-start"
                      style={{
                        top: `${(hour - GRID_START) * HOUR_HEIGHT}px`,
                        // La dernière heure ne borne que la fin de journée : lui donner une
                        // hauteur d'heure la ferait dépasser le conteneur et rendrait
                        // scrollable une bande vide sous 22:00.
                        height: hour === GRID_END ? 0 : `${HOUR_HEIGHT}px`,
                      }}
                    >
                      <span
                        className={`w-14 flex-shrink-0 pr-3 text-right text-xs text-gray-400 ${
                          hour === GRID_END ? '-mt-4' : '-mt-2'
                        }`}
                      >
                        {String(hour % 24).padStart(2, '0')}:00
                      </span>
                      <div className="relative flex-1 border-t border-gray-100 h-full">
                        {/* Demi-heure. Le décalage est relatif à la rangée, pas à la grille :
                            la rangée étant déjà en position absolue, additionner sa position
                            revenait à cumuler deux fois le décalage — le trait de 23 h se
                            retrouvait à 2046 px, soit 990 px sous la fin de journée, ce qui
                            rendait la zone défilable bien au-delà de 00:00. */}
                        {hour !== GRID_END && (
                          <div
                            className="border-t border-gray-50 absolute left-0 right-0"
                            style={{ top: `${HOUR_HEIGHT / 2}px` }}
                          />
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Indicateur heure courante */}
                  {currentTimeTop >= 0 && currentTimeTop <= TOTAL_HEIGHT && (
                    <div
                      className="absolute left-14 right-0 z-0 flex items-center pointer-events-none"
                      style={{ top: `${currentTimeTop}px` }}
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 flex-shrink-0" />
                      <div className="flex-1 border-t-2 border-red-400" />
                    </div>
                  )}

                  {/* Blocs RDV */}
                  {dayAppointments.map((appt) => {
                    const start = parseISO(appt.startAt);
                    const topPx = Math.max(0, (start.getHours() + start.getMinutes() / 60 - GRID_START) * HOUR_HEIGHT);
                    // Écrêté à la fin de grille : un RDV franchissant minuit rajouterait
                    // du contenu sous la dernière ligne, et le défilement ne s'arrêterait
                    // plus sur 00:00. Le plancher de 20 px garde le bloc cliquable.
                    const rawHeight = (appt.durationMinutes / 60) * HOUR_HEIGHT;
                    const available = TOTAL_HEIGHT - topPx;
                    const heightPx = Math.max(Math.min(20, available), Math.min(rawHeight, available));
                    const colorCls = APPT_COLORS[appt.status] ?? APPT_COLORS.PROPOSED;
                    const { label } = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.PROPOSED;
                    const compact = heightPx < 56;

                    return (
                      <div
                        key={appt.id}
                        className={`absolute left-16 right-2 rounded-lg border px-2 py-1 overflow-hidden z-10 cursor-pointer hover:brightness-95 transition-all ${colorCls}`}
                        style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                        onClick={(e) => openContextMenu(appt, e)}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <p className="font-semibold text-xs leading-tight truncate">{appt.title}</p>
                          <span className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_CONFIG[appt.status]?.className}`}>
                            {label}
                          </span>
                        </div>
                        {!compact && (
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] opacity-75">
                            <span>{format(start, 'HH:mm')} — {format(new Date(start.getTime() + appt.durationMinutes * 60000), 'HH:mm')}</span>
                            {appt.client && (
                              <span className="flex items-center gap-0.5">
                                <User className="h-3 w-3" />
                                {appt.client.user.firstName} {appt.client.user.lastName}
                              </span>
                            )}
                            <span className="flex items-center gap-0.5">
                              {appt.locationType === 'PHYSICAL'
                                ? <><MapPin className="h-3 w-3" />Présentiel</>
                                : <><Video className="h-3 w-3" />Distanciel</>}
                            </span>
                            {appt.rrule && <span className="flex items-center gap-0.5"><RefreshCcw className="h-3 w-3" />Récurrent</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Overlay si aucun RDV */}
                  {dayAppointments.length === 0 && (
                    <div className="absolute inset-0 left-14 flex items-center justify-center pointer-events-none">
                      <div className="bg-white/90 backdrop-blur-sm rounded-xl px-8 py-5 text-center shadow border border-gray-200 pointer-events-auto">
                        <CalendarClock className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500 font-medium text-sm mb-3">Pas de RDV ce jour</p>
                        <Button size="sm" onClick={openForm}>
                          <Plus className="h-3.5 w-3.5 mr-1.5" /> Créer un RDV
                        </Button>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
