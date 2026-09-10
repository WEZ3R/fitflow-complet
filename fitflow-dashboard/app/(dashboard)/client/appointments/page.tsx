'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { appointmentsAPI } from '@/lib/api';
import type { Appointment } from '@/types';
import {
  CalendarClock, MapPin, Video, Clock, CheckCircle2, XCircle, RefreshCcw, User,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

const STATUS_CONFIG = {
  PROPOSED: { label: 'En attente de confirmation', className: 'bg-yellow-100 text-yellow-700' },
  CONFIRMED: { label: 'Confirmé', className: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Annulé', className: 'bg-gray-100 text-gray-500' },
};

export default function ClientAppointmentsPage() {
  const searchParams = useSearchParams();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    fetchAppointments();
  }, []);

  // Scroll vers le RDV ciblé via ?appointmentId=... (clic notification cloche)
  useEffect(() => {
    const apptId = searchParams.get('appointmentId');
    if (!apptId || loading) return;
    setHighlightId(apptId);
    requestAnimationFrame(() => {
      const el = document.getElementById(`appt-${apptId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    const timer = setTimeout(() => setHighlightId(null), 3000);
    return () => clearTimeout(timer);
  }, [searchParams, loading, appointments]);

  const fetchAppointments = async () => {
    try {
      const res = await appointmentsAPI.getAll();
      const sorted = (res.data.data || []).sort(
        (a: Appointment, b: Appointment) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
      );
      setAppointments(sorted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (id: string) => {
    setActionLoading(id);
    try {
      await appointmentsAPI.confirm(id);
      await fetchAppointments();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || 'Erreur lors de la confirmation.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Annuler ce rendez-vous ? Votre coach sera notifié.')) return;
    setActionLoading(id);
    try {
      await appointmentsAPI.cancel(id, 'single');
      await fetchAppointments();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || "Erreur lors de l'annulation.");
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = appointments.filter((a) => !filterStatus || a.status === filterStatus);

  const upcoming = filtered.filter((a) => a.status !== 'CANCELLED' && new Date(a.startAt) >= new Date());
  const past = filtered.filter((a) => a.status !== 'CANCELLED' && new Date(a.startAt) < new Date());
  const cancelled = filtered.filter((a) => a.status === 'CANCELLED');

  const AppointmentCard = ({ appt }: { appt: Appointment }) => {
    const { label, className } = STATUS_CONFIG[appt.status];
    const isPast = new Date(appt.startAt) < new Date();
    const isHighlighted = highlightId === appt.id;

    return (
      <div id={`appt-${appt.id}`} className={isHighlighted ? 'ring-2 ring-indigo-400 ring-offset-2 rounded-lg transition-shadow' : ''}>
      <Card className={`${isPast && appt.status !== 'CANCELLED' ? 'opacity-70' : ''} hover:shadow-md transition-shadow`}>
        <div className="flex gap-4">
          {/* Date bloc */}
          <div className="flex-shrink-0 text-center bg-indigo-50 rounded-lg px-3 py-2 min-w-[56px]">
            <p className="text-xs text-indigo-400 uppercase font-medium">
              {format(parseISO(appt.startAt), 'MMM', { locale: fr })}
            </p>
            <p className="text-2xl font-bold text-indigo-700 leading-none">
              {format(parseISO(appt.startAt), 'd')}
            </p>
            <p className="text-xs text-indigo-400">
              {format(parseISO(appt.startAt), 'HH:mm')}
            </p>
          </div>

          {/* Contenu */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-gray-900 truncate">{appt.title}</h3>
              <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
                {label}
              </span>
            </div>

            <div className="flex flex-wrap gap-3 mt-1.5 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {appt.durationMinutes} min
              </span>
              <span className="flex items-center gap-1">
                {appt.locationType === 'PHYSICAL'
                  ? <><MapPin className="h-3.5 w-3.5" /> Présentiel</>
                  : <><Video className="h-3.5 w-3.5" /> Distanciel</>
                }
              </span>
              {appt.coach && (
                <span className="flex items-center gap-1 text-indigo-600">
                  <User className="h-3.5 w-3.5" />
                  {appt.coach.user.firstName} {appt.coach.user.lastName}
                </span>
              )}
              {appt.rrule && (
                <span className="flex items-center gap-1 text-purple-600">
                  <RefreshCcw className="h-3.5 w-3.5" /> Récurrent
                </span>
              )}
            </div>

            {appt.locationDetail && (
              <p className="text-xs text-gray-400 mt-1 truncate">{appt.locationDetail}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        {!isPast && appt.status !== 'CANCELLED' && (
          <div className="flex gap-2 mt-3 pt-3 border-t">
            {appt.status === 'PROPOSED' && (
              <button
                onClick={() => handleConfirm(appt.id)}
                disabled={actionLoading === appt.id}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-green-700 hover:bg-green-50 rounded-lg border border-green-300 transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {actionLoading === appt.id ? 'Confirmation...' : 'Confirmer'}
              </button>
            )}
            <button
              onClick={() => handleCancel(appt.id)}
              disabled={actionLoading === appt.id}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors disabled:opacity-50"
            >
              <XCircle className="h-3.5 w-3.5" />
              {actionLoading === appt.id ? 'Annulation...' : 'Annuler'}
            </button>
          </div>
        )}
      </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 rounded-lg">
          <CalendarClock className="h-7 w-7 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mes rendez-vous</h1>
          <p className="text-sm text-gray-500">Confirmez ou annulez vos RDV avec votre coach</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        {(['', 'PROPOSED', 'CONFIRMED', 'CANCELLED'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
              ${filterStatus === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}
          >
            {s === '' ? 'Tous' : STATUS_CONFIG[s].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Chargement...</div>
      ) : appointments.length === 0 ? (
        <div className="text-center py-16">
          <CalendarClock className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg font-medium">Aucun rendez-vous</p>
          <p className="text-gray-400 text-sm mt-2">
            Votre coach peut vous proposer des RDV via la messagerie.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* RDV à venir */}
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                À venir ({upcoming.length})
              </h2>
              <div className="space-y-3">
                {upcoming.map((a) => <AppointmentCard key={a.id} appt={a} />)}
              </div>
            </section>
          )}

          {/* RDV passés */}
          {past.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Passés ({past.length})
              </h2>
              <div className="space-y-3">
                {past.map((a) => <AppointmentCard key={a.id} appt={a} />)}
              </div>
            </section>
          )}

          {/* RDV annulés */}
          {cancelled.length > 0 && !filterStatus && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Annulés ({cancelled.length})
              </h2>
              <div className="space-y-3">
                {cancelled.map((a) => <AppointmentCard key={a.id} appt={a} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
