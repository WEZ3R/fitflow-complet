'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { messagesAPI, clientsAPI, coachesAPI, appointmentsAPI, blockAPI } from '@/lib/api';
import { connecter, ecouter, estConnecte } from '@/lib/socket';
import { useAuth } from '@/contexts/auth-context';
import { Send, User, Users, MapPin, Calendar, RefreshCcw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Message } from '@/types';
import { getMediaUrl } from '@/lib/media';
import { ReportDialog } from '@/components/moderation/report-dialog';

interface Coach {
  id: string;
  bio?: string;
  city?: string;
  profilePicture?: string;
  user: {
    // Identifiant du compte, distinct de l'identifiant de profil `id` ci-dessus :
    // un signalement vise un User. Absent de certaines réponses, d'où l'optionnel.
    id?: string;
    firstName: string;
    lastName: string;
  };
}

const MEETING_LABELS: Record<string, string> = {
  PHONE: 'Téléphone', GYM: 'Salle de sport', CAFE: 'Café', VISIO: 'Visioconférence',
  PHYSICAL: 'Présentiel', REMOTE: 'À distance',
};
const DURATION_OPTIONS = [30, 45, 60, 90, 120];

function AppointmentProposalCard({ message, onAccept, onDecline }: {
  message: Message;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  const appt = message.appointment;
  if (!appt) return null;
  const isRecurrent = !!(appt.rrule || appt.parentId);
  const isActionable = appt.status === 'PROPOSED';
  return (
    <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50 p-4 max-w-sm w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-indigo-600" />
          <span className="font-semibold text-indigo-900 text-sm">Proposition de RDV</span>
        </div>
        {isRecurrent && (
          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full flex items-center gap-1">
            <RefreshCcw className="h-3 w-3" /> Récurrent
          </span>
        )}
      </div>
      <p className="font-bold text-gray-900 mb-2">{appt.title}</p>
      <div className="space-y-1 text-sm text-indigo-700 mb-3">
        <p>{format(parseISO(appt.startAt), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}</p>
        <p>{appt.durationMinutes} min · {appt.meetingType ? MEETING_LABELS[appt.meetingType] : MEETING_LABELS[appt.locationType] || appt.locationType}</p>
        {appt.locationDetail && <p className="text-xs text-indigo-500">{appt.locationDetail}</p>}
      </div>
      {isActionable ? (
        <div className="flex gap-2">
          <button
            onClick={() => onAccept(appt.id)}
            className="flex-1 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium"
          >
            Accepter
          </button>
          <button
            onClick={() => onDecline(appt.id)}
            className="flex-1 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 font-medium"
          >
            Pas dispo
          </button>
        </div>
      ) : (
        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
          appt.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
          appt.status === 'CANCELLED' ? 'bg-gray-100 text-gray-500' :
          'bg-yellow-100 text-yellow-700'
        }`}>
          {appt.status === 'CONFIRMED' ? 'Confirmé' : appt.status === 'CANCELLED' ? 'Annulé' : 'En attente...'}
        </span>
      )}
    </div>
  );
}

function ClientProposalModal({ coachId, clientId, onClose, onSuccess }: {
  coachId: string; clientId: string; onClose: () => void; onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    title: '', startAt: '', time: '09:00', durationMinutes: 60, locationType: 'PHONE',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.startAt) return;
    setSubmitting(true);
    try {
      const startAt = new Date(`${form.startAt}T${form.time}`).toISOString();
      await appointmentsAPI.create({
        title: form.title,
        coachId,
        startAt,
        durationMinutes: form.durationMinutes,
        locationType: form.locationType,
      });
      onSuccess();
    } catch {
      alert('Erreur lors de la proposition du RDV');
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <select value={form.locationType}
                onChange={(e) => setForm(p => ({ ...p, locationType: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="PHONE">Téléphone</option>
                <option value="GYM">Salle de sport</option>
                <option value="CAFE">Café</option>
                <option value="VISIO">Visio</option>
              </select>
            </div>
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

export default function ClientMessagesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const coachIdFromUrl = searchParams.get('coachId');
  const [coach, setCoach] = useState<Coach['user'] | null>(null);
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [availableCoaches, setAvailableCoaches] = useState<Coach[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // La conversation ouverte, lisible depuis un rappel asynchrone sans passer par
  // les dépendances d'un effet.
  const selectedCoachIdRef = useRef<string | null>(null);

  /**
   * Marque une conversation comme lue de façon optimiste.
   *
   * L'ordre compte : on éteint la pastille AVANT l'appel réseau, sinon elle reste
   * allumée le temps d'un aller-retour — ici deux, le marquage étant auparavant
   * placé derrière la vérification de blocage. Le `count` permet à la sidebar de
   * décrémenter sans interroger le serveur, qui renverrait encore l'ancien total.
   */
  const markConversationRead = useCallback(async (coachId: string, count: number) => {
    if (!count || !user?.clientProfile?.id) return;
    setUnreadCounts((prev) => ({ ...prev, [coachId]: 0 }));
    window.dispatchEvent(new CustomEvent('fitflow:messages-read', { detail: { count } }));
    try {
      await messagesAPI.markConversationAsRead(coachId, user.clientProfile.id);
      // Sans détail : la sidebar recharge et se réaligne sur le serveur.
      window.dispatchEvent(new Event('fitflow:messages-read'));
    } catch {
      // Lecture non enregistrée : le sondage de la sidebar rallumera la pastille.
    }
  }, [user?.clientProfile?.id]);

  const fetchUnreadCounts = useCallback(async () => {
    try {
      const response = await messagesAPI.getUnreadCountsByConversation();
      const counts: Record<string, number> = response.data.data ?? {};
      setUnreadCounts(counts);
      // Le coach assigné est sélectionné d'office, souvent avant que ces compteurs
      // arrivent : sans ce rattrapage la conversation affichée restait comptée.
      const open = selectedCoachIdRef.current;
      if (open && counts[open]) markConversationRead(open, counts[open]);
    } catch {
      // silencieux
    }
  }, [markConversationRead]);

  useEffect(() => {
    fetchAvailableCoaches();
    fetchUnreadCounts();
  }, []);

  useEffect(() => {
    if (availableCoaches.length === 0) return;
    if (coachIdFromUrl) {
      const coachFromUrl = availableCoaches.find(c => c.id === coachIdFromUrl);
      if (coachFromUrl) {
        handleSelectCoach(coachFromUrl);
      }
    } else if (user?.clientProfile?.coachId && !selectedCoach) {
      const assignedCoach = availableCoaches.find(c => c.id === user.clientProfile?.coachId);
      if (assignedCoach) {
        handleSelectCoach(assignedCoach);
      } else {
        setSelectedCoach({ id: user.clientProfile.coachId } as Coach);
        selectedCoachIdRef.current = user.clientProfile.coachId;
        markConversationRead(user.clientProfile.coachId, unreadCounts[user.clientProfile.coachId] ?? 0);
        fetchCoachInfo(user.clientProfile.coachId);
      }
    }
  }, [availableCoaches, coachIdFromUrl, user]);

  useEffect(() => {
    if (!selectedCoach) return;

    fetchMessages();
    pollingIntervalRef.current = setInterval(fetchMessages, 3000);

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [selectedCoach]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchAvailableCoaches = async () => {
    try {
      const response = await coachesAPI.getAll();
      setAvailableCoaches(response.data.data || []);
    } catch (error) {
      console.error('Error fetching coaches:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Renseigne l'en-tête de conversation depuis le profil public du coach.
   *
   * L'appel passait auparavant par `clientsAPI.getById`, route réservée aux COACH :
   * il échouait donc systématiquement côté client, silencieusement, et l'en-tête
   * affichait « Mon coach » au lieu du nom. Le profil public porte l'identifiant du
   * compte, nécessaire pour signaler — un signalement vise un User, pas un profil.
   */
  const fetchCoachInfo = async (coachProfileId?: string) => {
    const cible = coachProfileId || selectedCoachIdRef.current;
    if (!cible) return;
    try {
      const response = await coachesAPI.getById(cible);
      const profil = response.data.data;
      if (profil?.user) setCoach(profil.user);
    } catch (error) {
      console.error('Error fetching coach info:', error);
    }
  };

  const fetchMessages = async () => {
    if (!selectedCoach || !user?.clientProfile) return;
    try {
      const response = await messagesAPI.getConversation(selectedCoach.id, user.clientProfile.id);
      setMessages(response.data.data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCoach = async (c: Coach) => {
    setSelectedCoach(c);
    setCoach(c.user);
    setIsBlocked(false);
    selectedCoachIdRef.current = c.id;

    // La liste de recherche n'expose pas l'identifiant de compte du coach — seul le
    // profil public le porte. On l'affiche donc d'abord avec ce qu'on a, puis on
    // complète : sans cet identifiant, le signalement serait impossible.
    fetchCoachInfo(c.id);

    // Avant la vérification de blocage : la pastille ne doit pas attendre un
    // appel qui ne la concerne pas.
    markConversationRead(c.id, unreadCounts[c.id] ?? 0);

    // Vérifier blocage
    try {
      const blockRes = await blockAPI.getStatus(c.id);
      setIsBlocked(blockRes.data.data?.isBlocked ?? false);
    } catch {
      // silencieux
    }
  };

  const handleAccept = async (appointmentId: string) => {
    try {
      await appointmentsAPI.confirm(appointmentId);
      fetchMessages();
    } catch {
      alert('Erreur lors de la confirmation du RDV');
    }
  };

  const handleDecline = async (appointmentId: string) => {
    try {
      await appointmentsAPI.cancel(appointmentId);
      fetchMessages();
    } catch {
      alert('Erreur lors du refus du RDV');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedCoach) return;

    setSending(true);
    try {
      await messagesAPI.send({
        coachId: selectedCoach.id,
        clientId: user?.clientProfile?.id,
        content: newMessage,
        type: 'CHAT',
        isSentByCoach: false,
      });
      setNewMessage('');
      fetchMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Erreur lors de l\'envoi du message');
    } finally {
      setSending(false);
    }
  };

  if (loading && !selectedCoach) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Chargement...</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!selectedCoach) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Choisir un coach</h2>
          {availableCoaches.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">Aucun coach disponible pour le moment</p>
            </div>
          ) : (
            <div className="space-y-4">
              {availableCoaches.map((availableCoach) => {
                const count = unreadCounts[availableCoach.id] ?? 0;
                return (
                  <button
                    key={availableCoach.id}
                    onClick={() => handleSelectCoach(availableCoach)}
                    className="w-full p-4 border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="relative flex-shrink-0 cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); router.push(`/client/coach/${availableCoach.id}`); }}
                        >
                          {getMediaUrl(availableCoach.profilePicture) ? (
                            <img src={getMediaUrl(availableCoach.profilePicture)!} alt="" className="w-12 h-12 rounded-full object-cover" />
                          ) : (
                            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                              <User className="h-6 w-6 text-primary-600" />
                            </div>
                          )}
                          {count > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                              {count > 99 ? '99+' : count}
                            </span>
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {availableCoach.user.firstName} {availableCoach.user.lastName}
                          </h3>
                          {availableCoach.bio && (
                            <p className="text-sm text-gray-600 line-clamp-1">{availableCoach.bio}</p>
                          )}
                          {availableCoach.city && (
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <MapPin className="h-3 w-3" />
                              {availableCoach.city}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-primary-600">&rarr;</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <>
    {showProposalModal && selectedCoach && user?.clientProfile && (
      <ClientProposalModal
        coachId={selectedCoach.id}
        clientId={user.clientProfile.id}
        onClose={() => setShowProposalModal(false)}
        onSuccess={() => { setShowProposalModal(false); fetchMessages(); }}
      />
    )}
    <div className="max-w-4xl mx-auto h-[calc(100vh-12rem)]">
      <Card className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b pb-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => selectedCoach && router.push(`/client/coach/${selectedCoach.id}`)}
                className="flex-shrink-0 rounded-full hover:opacity-80 transition-opacity"
              >
                {getMediaUrl(selectedCoach?.profilePicture) ? (
                  <img src={getMediaUrl(selectedCoach?.profilePicture)!} alt="" className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                    <User className="h-6 w-6 text-primary-600" />
                  </div>
                )}
              </button>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {coach ? `${coach.firstName} ${coach.lastName}` : 'Mon coach'}
                  <span className="ml-2 text-sm font-normal text-gray-600">(Coach)</span>
                </h2>
                <p className="text-sm text-gray-600">Conversation</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isBlocked && selectedCoach && user?.clientProfile && (
                <Button variant="outline" size="sm" onClick={() => setShowProposalModal(true)}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Proposer un RDV
                </Button>
              )}
              {coach?.id && (
                <ReportDialog
                  reportedUserId={coach.id}
                  reportedName={`${coach.firstName} ${coach.lastName}`}
                  context="CONVERSATION"
                  compact
                />
              )}
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedCoach(null);
                  setCoach(null);
                  setMessages([]);
                  setIsBlocked(false);
                }}
                className="flex items-center gap-2"
              >
                <Users className="h-4 w-4" />
                Autre coach
              </Button>
            </div>
          </div>
          {isBlocked && (
            <p className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              Vous ne pouvez pas proposer de RDV à ce coach pour le moment.
            </p>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {loading ? (
            <p className="text-center text-gray-500">Chargement...</p>
          ) : messages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-2">Aucun message</p>
              <p className="text-sm text-gray-400">Commencez la conversation avec votre coach !</p>
            </div>
          ) : (
            messages.map((message) => {
              const isFromCoach = message.isSentByCoach;
              const date = parseISO(message.createdAt);
              if (message.type === 'APPOINTMENT_PROPOSAL') {
                return (
                  <div key={message.id} className={`flex ${isFromCoach ? 'justify-start' : 'justify-end'}`}>
                    <div>
                      <AppointmentProposalCard
                        message={message}
                        onAccept={handleAccept}
                        onDecline={handleDecline}
                      />
                      <p className={`text-xs text-gray-500 mt-1 ${isFromCoach ? 'text-left' : 'text-right'}`}>
                        {format(date, 'PPp', { locale: fr })}
                      </p>
                    </div>
                  </div>
                );
              }
              return (
                <div
                  key={message.id}
                  className={`flex ${isFromCoach ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[70%] ${isFromCoach ? 'order-1' : 'order-2'}`}>
                    <div
                      className={`rounded-lg px-4 py-3 ${
                        isFromCoach ? 'bg-gray-100 text-gray-900' : 'bg-primary-600 text-white'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                    <p className={`text-xs text-gray-500 mt-1 ${isFromCoach ? 'text-left' : 'text-right'}`}>
                      {format(date, 'PPp', { locale: fr })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="flex gap-2 border-t pt-4">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Tapez votre message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            disabled={sending}
          />
          <Button type="submit" disabled={sending || !newMessage.trim()}>
            <Send className="h-4 w-4 mr-2" />
            {sending ? 'Envoi...' : 'Envoyer'}
          </Button>
        </form>
      </Card>
    </div>
    </>
  );
}
