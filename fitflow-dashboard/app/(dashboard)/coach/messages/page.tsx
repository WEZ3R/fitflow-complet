"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { messagesAPI, clientsAPI, appointmentsAPI } from "@/lib/api";
import { connecter, ecouter, estConnecte } from "@/lib/socket";
import { useAuth } from "@/contexts/auth-context";
import { Send, User, Users, Calendar, RefreshCcw } from "lucide-react";

import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import type { Message } from "@/types";
import { getMediaUrl } from '@/lib/media';
import { ReportDialog } from "@/components/moderation/report-dialog";

interface ClientUser {
  // Le signalement vise un User, pas un profil client : son identifiant est donc
  // nécessaire ici. L'API des clients le renvoie déjà.
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Client {
  id: string;
  profilePicture?: string;
  user: ClientUser;
}

const MEETING_LABELS: Record<string, string> = {
  PHONE: "Téléphone", GYM: "Salle de sport", CAFE: "Café", VISIO: "Visioconférence",
  PHYSICAL: "Présentiel", REMOTE: "À distance",
};

const DURATION_OPTIONS = [30, 45, 60, 90, 120];
const RRULE_OPTIONS = [
  { value: "", label: "Aucune" },
  { value: "RRULE:FREQ=WEEKLY", label: "Chaque semaine" },
  { value: "RRULE:FREQ=WEEKLY;INTERVAL=2", label: "Toutes les 2 semaines" },
  { value: "RRULE:FREQ=MONTHLY", label: "Mensuel" },
];

function AppointmentProposalCard({ message, onAccept, onDecline }: {
  message: Message;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
}) {
  const appt = message.appointment;
  if (!appt) return null;
  const isRecurrent = !!(appt.rrule || appt.parentId);
  // Le coach peut accepter/refuser uniquement les propositions envoyées par le CLIENT
  const isActionable = appt.status === "PROPOSED" && !message.isSentByCoach && !!onAccept && !!onDecline;
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
            onClick={() => onAccept!(appt.id)}
            className="flex-1 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium"
          >
            Accepter
          </button>
          <button
            onClick={() => onDecline!(appt.id)}
            className="flex-1 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 font-medium"
          >
            Pas dispo
          </button>
        </div>
      ) : (
        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
          appt.status === "CONFIRMED" ? "bg-green-100 text-green-700" :
          appt.status === "CANCELLED" ? "bg-gray-100 text-gray-500" :
          "bg-yellow-100 text-yellow-700"
        }`}>
          {appt.status === "CONFIRMED" ? "Confirmé" : appt.status === "CANCELLED" ? "Annulé" : "En attente..."}
        </span>
      )}
    </div>
  );
}

function ProposalModal({ clientId, coachId, onClose, onSuccess }: {
  clientId: string; coachId: string; onClose: () => void; onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    title: "", startAt: "", time: "09:00", durationMinutes: 60,
    locationType: "PHYSICAL", locationDetail: "", rrule: "",
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
        clientId,
        startAt,
        durationMinutes: form.durationMinutes,
        locationType: form.locationType,
        locationDetail: form.locationDetail || undefined,
        rrule: form.rrule || undefined,
      });
      onSuccess();
    } catch {
      alert("Erreur lors de la proposition du RDV");
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
                <option value="PHYSICAL">Présentiel</option>
                <option value="REMOTE">À distance</option>
              </select>
            </div>
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
              {submitting ? "Envoi..." : "Proposer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CoachMessagesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchUnreadCounts = useCallback(async (): Promise<Record<string, number>> => {
    try {
      const response = await messagesAPI.getUnreadCountsByConversation();
      const counts: Record<string, number> = response.data.data ?? {};
      setUnreadCounts(counts);
      return counts;
    } catch {
      return {};
    }
  }, []);

  /**
   * Marque une conversation comme lue de façon optimiste.
   *
   * L'ordre compte : on éteint la pastille AVANT l'appel réseau, sinon elle reste
   * allumée le temps d'un aller-retour. Le `count` permet à la sidebar de
   * décrémenter sans interroger le serveur — un refetch immédiat renverrait encore
   * l'ancien total, le marquage n'étant pas encore enregistré.
   */
  const markConversationRead = useCallback(async (clientId: string, count: number) => {
    if (!count || !user?.coachProfile?.id) return;
    setUnreadCounts((prev) => ({ ...prev, [clientId]: 0 }));
    window.dispatchEvent(new CustomEvent("fitflow:messages-read", { detail: { count } }));
    try {
      await messagesAPI.markConversationAsRead(user.coachProfile.id, clientId);
      // Sans détail : la sidebar recharge et se réaligne sur le serveur.
      window.dispatchEvent(new Event("fitflow:messages-read"));
    } catch {
      // Lecture non enregistrée : le sondage de la sidebar rallumera la pastille.
    }
  }, [user?.coachProfile?.id]);

  useEffect(() => {
    // Séquentiel : le premier client est sélectionné automatiquement, il faut donc
    // connaître son nombre de non-lus pour le marquer comme lu. En parallèle, la
    // course faisait que la conversation ouverte à l'arrivée restait comptée.
    const init = async () => {
      const counts = await fetchUnreadCounts();
      const first = await fetchClients();
      if (first) markConversationRead(first.id, counts[first.id] ?? 0);
    };
    init();
  }, []);

  /**
   * Rafraîchissement de la conversation.
   *
   * Le WebSocket pousse les nouveaux messages, mais il ne garantit rien : l'API tourne
   * sur plusieurs machines sans bus partagé, un message écrit ailleurs n'arrive pas par
   * la socket. Le sondage reste donc le filet — espacé à 15 s quand la socket est
   * ouverte, 3 s sinon — et suspendu quand l'onglet du navigateur est en arrière-plan.
   */
  useEffect(() => {
    if (!selectedClient) return;

    fetchMessages();
    connecter();

    const arreterEcoute = ecouter((evenement) => {
      if (evenement?.type === "message") fetchMessages();
    });

    let periode: number | null = null;
    const armer = () => {
      if (document.hidden) {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        periode = null;
        return;
      }
      const voulue = estConnecte() ? 15000 : 3000;
      if (voulue === periode) return;
      periode = voulue;
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = setInterval(fetchMessages, voulue);
    };
    armer();
    // La socket peut s'ouvrir ou tomber, l'onglet passer au second plan : on réévalue.
    const surveillance = setInterval(armer, 5000);
    document.addEventListener("visibilitychange", armer);

    return () => {
      arreterEcoute();
      clearInterval(surveillance);
      document.removeEventListener("visibilitychange", armer);
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [selectedClient]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  /** Renvoie le client sélectionné d'office, pour que l'appelant le marque comme lu. */
  const fetchClients = async (): Promise<Client | null> => {
    try {
      const response = await clientsAPI.getCoachClients();
      const clientsData: Client[] = response.data.data;
      setClients(clientsData);
      if (clientsData.length > 0) {
        setSelectedClient(clientsData[0]);
        return clientsData[0];
      }
      return null;
    } catch (error) {
      console.error("Error fetching clients:", error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    if (!selectedClient) return;
    if (!user?.coachProfile?.id) return;
    try {
      const response = await messagesAPI.getConversation(
        user.coachProfile.id,
        selectedClient.id
      );
      setMessages(response.data.data || []);
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    markConversationRead(client.id, unreadCounts[client.id] ?? 0);
  };

  const handleAcceptAppointment = async (appointmentId: string) => {
    try {
      await appointmentsAPI.confirm(appointmentId);
      fetchMessages();
    } catch {
      alert("Erreur lors de la confirmation du RDV");
    }
  };

  const handleDeclineAppointment = async (appointmentId: string) => {
    try {
      await appointmentsAPI.cancel(appointmentId);
      fetchMessages();
    } catch {
      alert("Erreur lors du refus du RDV");
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedClient) return;

    setSending(true);
    try {
      if (!user?.coachProfile?.id) return;
      await messagesAPI.send({
        coachId: user.coachProfile.id,
        clientId: selectedClient.id,
        content: newMessage,
        type: "CHAT",
        isSentByCoach: true,
      });
      setNewMessage("");
      fetchMessages();
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Erreur lors de l'envoi du message");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Chargement...</p>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Aucun client</h2>
        <p className="text-gray-600">
          Vous n&apos;avez pas encore de clients assignés.
        </p>
      </div>
    );
  }

  return (
    <>
    {showProposalModal && selectedClient && user?.coachProfile && (
      <ProposalModal
        clientId={selectedClient.id}
        coachId={user.coachProfile.id}
        onClose={() => setShowProposalModal(false)}
        onSuccess={() => { setShowProposalModal(false); fetchMessages(); }}
      />
    )}
    <div className="flex gap-6 h-[calc(100vh-12rem)]">
      {/* Liste des clients */}
      <Card className="w-80 flex-shrink-0 overflow-hidden flex flex-col">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Mes clients
        </h2>
        <div className="flex-1 overflow-y-auto space-y-2">
          {clients.map((client) => {
            const count = unreadCounts[client.id] ?? 0;
            return (
              <button
                key={client.id}
                onClick={() => handleSelectClient(client)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedClient?.id === client.id
                    ? "bg-primary-100 border-2 border-primary-500"
                    : "bg-gray-50 hover:bg-gray-100 border-2 border-transparent"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="relative flex-shrink-0 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); router.push(`/coach/clients/${client.id}`); }}
                  >
                    {getMediaUrl(client.profilePicture) ? (
                      <img src={getMediaUrl(client.profilePicture)!} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 bg-primary-200 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-primary-700" />
                      </div>
                    )}
                    {count > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {client.user.firstName} {client.user.lastName}
                    </p>
                    <p className="text-xs text-gray-600 truncate">
                      {client.user.email}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Conversation */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        {selectedClient ? (
          <>
            <div className="border-b pb-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => router.push(`/coach/clients/${selectedClient.id}`)}
                    className="flex-shrink-0 rounded-full hover:opacity-80 transition-opacity"
                  >
                    {getMediaUrl(selectedClient.profilePicture) ? (
                      <img src={getMediaUrl(selectedClient.profilePicture)!} alt="" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                        <User className="h-6 w-6 text-primary-600" />
                      </div>
                    )}
                  </button>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {selectedClient.user.firstName} {selectedClient.user.lastName}
                    </h2>
                    <p className="text-sm text-gray-600">{selectedClient.user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowProposalModal(true)}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Proposer un RDV
                  </Button>
                  <ReportDialog
                    reportedUserId={selectedClient.user.id}
                    reportedName={`${selectedClient.user.firstName} ${selectedClient.user.lastName}`}
                    context="CONVERSATION"
                    compact
                  />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 mb-2">Aucun message</p>
                  <p className="text-sm text-gray-400">
                    Commencez la conversation avec votre client !
                  </p>
                </div>
              ) : (
                messages.map((message) => {
                  const isFromCoach = message.isSentByCoach;
                  const date = parseISO(message.createdAt);
                  if (message.type === "APPOINTMENT_PROPOSAL") {
                    return (
                      <div key={message.id} className={`flex ${isFromCoach ? "justify-end" : "justify-start"}`}>
                        <div>
                          <AppointmentProposalCard
                            message={message}
                            onAccept={handleAcceptAppointment}
                            onDecline={handleDeclineAppointment}
                          />
                          <p className={`text-xs text-gray-500 mt-1 ${isFromCoach ? "text-right" : "text-left"}`}>
                            {format(date, "PPp", { locale: fr })}
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isFromCoach ? "justify-end" : "justify-start"}`}
                    >
                      <div className="max-w-[70%]">
                        <div
                          className={`rounded-lg px-4 py-3 ${
                            isFromCoach
                              ? "bg-primary-600 text-white"
                              : "bg-gray-100 text-gray-900"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        </div>
                        <p
                          className={`text-xs text-gray-500 mt-1 ${
                            isFromCoach ? "text-right" : "text-left"
                          }`}
                        >
                          {format(date, "PPp", { locale: fr })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

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
                {sending ? "Envoi..." : "Envoyer"}
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-500">Sélectionnez un client pour commencer</p>
          </div>
        )}
      </Card>
    </div>
    </>
  );
}
