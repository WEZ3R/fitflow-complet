import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../contexts/AuthContext';
import { clientsAPI, coachesAPI, messagesAPI, appointmentsAPI } from '../services/api';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { API_URL } from '../../config';
import { couleurs } from '../theme';
import { connecter, ecouter, estConnecte } from '../services/socket';

// JJ-MM-AA depuis YYYY-MM-DD
const formatDateDDMMYY = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}-${m}-${y.slice(2)}`;
};

// YYYY-MM-DD depuis Date
const toIsoDate = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// HH:MM depuis Date
const toHHMM = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const MEDIA_BASE = API_URL.replace('/api', '');
const getMediaUrl = (filename) => {
  if (!filename) return null;
  if (filename.startsWith('http')) return filename;
  return `${MEDIA_BASE}${filename.startsWith('/') ? filename : '/uploads/' + filename}`;
};

// ---------------------------------------------------------------------------
// Composant badge non-lu
// ---------------------------------------------------------------------------
const UnreadBadge = ({ count }) => {
  if (!count) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Écran principal
// ---------------------------------------------------------------------------
const MessagesScreen = ({ navigation, onConversationRead, isVisible = false, resetRef }) => {
  const { user } = useAuth();
  const isCoach = user?.role === 'COACH';

  // Ref pour éviter les stale closures dans les intervals
  const isVisibleRef = useRef(isVisible);
  useEffect(() => { isVisibleRef.current = isVisible; }, [isVisible]);

  // Expose la fonction de reset à l'AppNavigator
  useEffect(() => {
    if (resetRef) resetRef.current = () => setSelectedInterlocutor(null);
  }, [resetRef]);

  // Profil propre (coachProfile ou clientProfile)
  const [ownProfile, setOwnProfile] = useState(null);

  // Liste des interlocuteurs (clients pour coach, coaches pour client)
  const [interlocutors, setInterlocutors] = useState([]);
  const [selectedInterlocutor, setSelectedInterlocutor] = useState(null);

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [apptActionLoading, setApptActionLoading] = useState(null);

  // ─── Proposition de RDV ───────────────────────────────────────────────────
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [proposalSubmitting, setProposalSubmitting] = useState(false);
  const initialProposalForm = {
    title: '',
    startDate: '',
    startTime: '',
    durationMinutes: '60',
    locationType: 'PHYSICAL',
    locationDetail: '',
  };
  const [proposalForm, setProposalForm] = useState(initialProposalForm);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Date par défaut pour les pickers natifs
  const dateValue = proposalForm.startDate ? new Date(`${proposalForm.startDate}T00:00:00`) : new Date();
  const timeValue = (() => {
    const d = new Date();
    if (proposalForm.startTime) {
      const [h, m] = proposalForm.startTime.split(':');
      d.setHours(parseInt(h, 10) || 0, parseInt(m, 10) || 0, 0, 0);
    }
    return d;
  })();

  const handleProposeAppointment = async () => {
    if (!selectedInterlocutor) return;
    const { title, startDate, startTime, durationMinutes, locationType, locationDetail } = proposalForm;
    if (!title.trim() || !startDate.trim() || !startTime.trim() || !durationMinutes) {
      Alert.alert('Champs manquants', 'Titre, date, heure et durée sont obligatoires.');
      return;
    }
    const startAt = new Date(`${startDate}T${startTime}`);
    if (Number.isNaN(startAt.getTime())) {
      Alert.alert('Format invalide', 'Sélectionnez une date valide et heure HH:MM.');
      return;
    }
    setProposalSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        startAt: startAt.toISOString(),
        durationMinutes: parseInt(durationMinutes, 10) || 60,
        locationType,
        ...(locationDetail.trim() ? { locationDetail: locationDetail.trim() } : {}),
        ...(isCoach
          ? { clientId: selectedInterlocutor.id }
          : { coachId: selectedInterlocutor.id }),
      };
      await appointmentsAPI.create(payload);
      setShowProposalModal(false);
      setProposalForm(initialProposalForm);
      // Rafraîchir les messages pour voir la bulle de proposition
      if (ownProfile && selectedInterlocutor) {
        const coachId = isCoach ? ownProfile.id : selectedInterlocutor.id;
        const clientId = isCoach ? selectedInterlocutor.id : ownProfile.id;
        const response = await messagesAPI.getConversation(coachId, clientId);
        if (response.data.success) setMessages(response.data.data || []);
      }
    } catch (error) {
      const status = error?.response?.status;
      if (status === 409) {
        Alert.alert('Conflit', 'Ce créneau est déjà occupé. Choisissez un autre horaire.');
      } else {
        Alert.alert('Erreur', error?.response?.data?.message || 'Impossible de proposer ce RDV.');
      }
    } finally {
      setProposalSubmitting(false);
    }
  };

  const flatListRef = useRef(null);
  const pollingIntervalRef = useRef(null);

  // -------------------------------------------------------------------------
  // Chargement initial
  // -------------------------------------------------------------------------
  useEffect(() => {
    fetchOwnProfile();
    fetchUnreadCounts();
  }, []);

  useEffect(() => {
    if (!ownProfile) return;
    fetchInterlocutors();
  }, [ownProfile]);

  /**
   * Rafraîchissement de la conversation.
   *
   * Le WebSocket pousse les nouveaux messages, mais il ne garantit rien : l'API tourne
   * sur plusieurs machines sans bus partagé, un message écrit ailleurs n'arrive pas par
   * la socket. Le sondage reste donc le filet — simplement espacé quand la socket est
   * ouverte (15 s au lieu de 3 s), et suspendu quand l'écran n'est pas affiché.
   */
  useEffect(() => {
    if (!selectedInterlocutor) return;
    if (!isVisible) return;

    fetchMessages();
    connecter();

    const arreterEcoute = ecouter((evenement) => {
      if (evenement?.type === 'message') fetchMessages();
    });

    let periode = null;
    const armer = () => {
      const voulue = estConnecte() ? 15000 : 3000;
      if (voulue === periode) return;
      periode = voulue;
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = setInterval(fetchMessages, voulue);
    };
    armer();
    // La socket peut s'ouvrir ou tomber en cours de route : on réévalue le rythme.
    const surveillance = setInterval(armer, 5000);

    return () => {
      arreterEcoute();
      clearInterval(surveillance);
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [selectedInterlocutor, isVisible]);

  // -------------------------------------------------------------------------
  // Fetch profil propre
  // -------------------------------------------------------------------------
  const fetchOwnProfile = async () => {
    try {
      if (isCoach) {
        const response = await coachesAPI.getMe();
        if (response.data.success) setOwnProfile(response.data.data);
      } else {
        const response = await clientsAPI.getMe();
        if (response.data.success) {
          const profile = response.data.data;
          setOwnProfile(profile);
          // Ne pas présélectionner : toujours afficher la liste d'abord
        }
      }
    } catch (error) {
      console.error('Error fetching own profile:', error);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Fetch liste des interlocuteurs
  // -------------------------------------------------------------------------
  const fetchInterlocutors = async () => {
    try {
      if (isCoach) {
        const response = await clientsAPI.getCoachClients();
        if (response.data.success) {
          setInterlocutors(response.data.data || []);
        }
      } else {
        // Coachs assignés (relation acceptée)
        const assignedCoaches = (ownProfile?.coaches || []).map(cc => cc.coach);

        // Tous les coachs ayant échangé des messages (inclut ceux sans relation acceptée)
        let conversationCoaches = [];
        try {
          const res = await messagesAPI.getConversationPartners();
          if (res.data.success) conversationCoaches = res.data.data || [];
        } catch {
          // silencieux — fallback sur assignedCoaches uniquement
        }

        // Fusionner en déduplicant par id
        const assignedIds = new Set(assignedCoaches.map(c => c.id));
        const extra = conversationCoaches.filter(c => !assignedIds.has(c.id));
        setInterlocutors([...assignedCoaches, ...extra]);
      }
    } catch (error) {
      console.error('Error fetching interlocutors:', error);
    }
  };

  // -------------------------------------------------------------------------
  // Fetch compteurs non lus (par conversation)
  // -------------------------------------------------------------------------
  const fetchUnreadCounts = async () => {
    try {
      const response = await messagesAPI.getUnreadCountsByConversation();
      if (response.data.success) {
        setUnreadCounts(response.data.data ?? {});
      }
    } catch {
      // silencieux
    }
  };

  // -------------------------------------------------------------------------
  // Marquer la conversation comme lue (helper)
  // -------------------------------------------------------------------------
  const markConversationRead = async (interlocutor, profileOverride) => {
    const profile = profileOverride ?? ownProfile;
    if (!profile || !interlocutor) return;
    try {
      const coachId = isCoach ? profile.id : interlocutor.id;
      const clientId = isCoach ? interlocutor.id : profile.id;
      await messagesAPI.markConversationAsRead(coachId, clientId);
      setUnreadCounts((prev) => ({ ...prev, [interlocutor.id]: 0 }));
      if (onConversationRead) onConversationRead();
    } catch {
      // silencieux
    }
  };

  // -------------------------------------------------------------------------
  // Sélection d'un interlocuteur + mark as read
  // -------------------------------------------------------------------------
  const handleSelectInterlocutor = async (interlocutor) => {
    setSelectedInterlocutor(interlocutor);
    if (ownProfile && unreadCounts[interlocutor.id]) {
      await markConversationRead(interlocutor);
    }
  };

  // -------------------------------------------------------------------------
  // Fetch messages (+ mark as read si messages non-lus détectés)
  // -------------------------------------------------------------------------
  const fetchMessages = async () => {
    if (!selectedInterlocutor || !ownProfile) return;
    try {
      const coachId = isCoach ? ownProfile.id : selectedInterlocutor.id;
      const clientId = isCoach ? selectedInterlocutor.id : ownProfile.id;
      const response = await messagesAPI.getConversation(coachId, clientId);
      if (response.data.success) {
        const fetchedMessages = response.data.data || [];
        setMessages(fetchedMessages);
        // Marquer comme lu uniquement si l'onglet Messages est actif
        const hasUnreadFromOther = fetchedMessages.some(
          (m) => !m.isRead && (isCoach ? !m.isSentByCoach : m.isSentByCoach)
        );
        if (hasUnreadFromOther && isVisibleRef.current) {
          markConversationRead(selectedInterlocutor);
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  // -------------------------------------------------------------------------
  // Envoi d'un message
  // -------------------------------------------------------------------------
  const handleSend = async () => {
    if (!newMessage.trim() || !selectedInterlocutor || !ownProfile) return;

    setSending(true);
    try {
      const coachId = isCoach ? ownProfile.id : selectedInterlocutor.id;
      const clientId = isCoach ? selectedInterlocutor.id : ownProfile.id;
      await messagesAPI.send({
        coachId,
        clientId,
        content: newMessage,
        type: 'CHAT',
        isSentByCoach: isCoach,
      });
      setNewMessage('');
      fetchMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      alert("Erreur lors de l'envoi du message");
    } finally {
      setSending(false);
    }
  };

  // -------------------------------------------------------------------------
  // RDV (client uniquement)
  // -------------------------------------------------------------------------
  const handleConfirmAppointment = async (appointmentId) => {
    setApptActionLoading(appointmentId + '_confirm');
    try {
      await appointmentsAPI.confirm(appointmentId);
      fetchMessages();
    } catch (err) {
      alert(err?.response?.data?.message || 'Erreur lors de la confirmation.');
    } finally {
      setApptActionLoading(null);
    }
  };

  const handleDeclineAppointment = async (appointmentId) => {
    setApptActionLoading(appointmentId + '_decline');
    try {
      await appointmentsAPI.cancel(appointmentId, 'single');
      fetchMessages();
    } catch (err) {
      alert(err?.response?.data?.message || 'Erreur lors du refus.');
    } finally {
      setApptActionLoading(null);
    }
  };

  // -------------------------------------------------------------------------
  // Rendu bulle RDV
  // -------------------------------------------------------------------------
  const renderAppointmentBubble = (item) => {
    const appt = item.appointment;
    if (!appt) return null;
    const isProposed = appt.status === 'PROPOSED';
    const isConfirmed = appt.status === 'CONFIRMED';
    const isCancelled = appt.status === 'CANCELLED';
    const startDate = parseISO(appt.startAt);
    const confirmLoading = apptActionLoading === appt.id + '_confirm';
    const declineLoading = apptActionLoading === appt.id + '_decline';

    return (
      <View style={styles.apptBubble}>
        <View style={styles.apptBubbleHeader}>
          <Ionicons name="calendar" size={16} color={couleurs.accent} />
          <Text style={styles.apptBubbleType}>Proposition de RDV</Text>
        </View>
        <Text style={styles.apptBubbleTitle}>{appt.title}</Text>
        <Text style={styles.apptBubbleDate}>
          {format(startDate, "EEEE d MMMM 'à' HH:mm", { locale: fr })}
        </Text>
        <Text style={styles.apptBubbleMeta}>
          {appt.durationMinutes} min · {appt.locationType === 'PHYSICAL' ? 'Présentiel' : 'Distanciel'}
          {appt.locationDetail ? ` · ${appt.locationDetail}` : ''}
        </Text>
        <View style={[styles.apptStatusRow, isCancelled && { opacity: 0.6 }]}>
          <View style={[
            styles.apptStatusBadge,
            isConfirmed && styles.apptStatusConfirmed,
            isCancelled && styles.apptStatusCancelled,
            isProposed && styles.apptStatusProposed,
          ]}>
            <Text style={[
              styles.apptStatusText,
              isConfirmed && styles.apptStatusTextConfirmed,
              isCancelled && styles.apptStatusTextCancelled,
              isProposed && styles.apptStatusTextProposed,
            ]}>
              {isProposed ? 'En attente de confirmation' : isConfirmed ? 'Confirmé' : 'Annulé'}
            </Text>
          </View>
        </View>
        {/* Boutons uniquement côté client pour confirmer/refuser */}
        {isProposed && item.isSentByCoach && !isCoach && (
          <View style={styles.apptActions}>
            <TouchableOpacity
              style={[styles.apptActionBtn, styles.apptConfirmBtn]}
              onPress={() => handleConfirmAppointment(appt.id)}
              disabled={!!apptActionLoading}
            >
              {confirmLoading
                ? <ActivityIndicator size="small" color={couleurs.succes} />
                : <Text style={styles.apptConfirmText}>Confirmer</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.apptActionBtn, styles.apptDeclineBtn]}
              onPress={() => handleDeclineAppointment(appt.id)}
              disabled={!!apptActionLoading}
            >
              {declineLoading
                ? <ActivityIndicator size="small" color={couleurs.danger} />
                : <Text style={styles.apptDeclineText}>Refuser</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // -------------------------------------------------------------------------
  // Rendu d'un message
  // -------------------------------------------------------------------------
  const renderMessage = ({ item }) => {
    const sentByMe = isCoach ? item.isSentByCoach : !item.isSentByCoach;
    const date = parseISO(item.createdAt);

    if (item.type === 'APPOINTMENT_PROPOSAL') {
      return (
        <View style={[styles.messageBubble, sentByMe ? styles.messageBubbleRight : styles.messageBubbleLeft]}>
          {renderAppointmentBubble(item)}
          <Text style={[styles.messageTime, sentByMe ? styles.messageTimeRight : styles.messageTimeLeft]}>
            {format(date, 'PPp', { locale: fr })}
          </Text>
        </View>
      );
    }

    if (item.type === 'TIP') {
      return (
        <View style={styles.tipBubble}>
          <Ionicons name="information-circle" size={16} color={couleurs.accent} />
          <Text style={styles.tipText}>{item.content}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.messageBubble, sentByMe ? styles.messageBubbleRight : styles.messageBubbleLeft]}>
        <View style={[styles.messageContent, sentByMe ? styles.messageContentRight : styles.messageContentLeft]}>
          <Text style={[styles.messageText, sentByMe ? styles.messageTextRight : styles.messageTextLeft]}>
            {item.content}
          </Text>
        </View>
        <Text style={[styles.messageTime, sentByMe ? styles.messageTimeRight : styles.messageTimeLeft]}>
          {format(date, 'PPp', { locale: fr })}
        </Text>
      </View>
    );
  };

  // -------------------------------------------------------------------------
  // Rendu : loading
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={couleurs.accent} />
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // Rendu : sélection de l'interlocuteur
  // -------------------------------------------------------------------------
  if (!selectedInterlocutor) {
    const title = isCoach ? 'Mes clients' : 'Mes coachs';
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        <FlatList
          data={interlocutors || []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const count = unreadCounts[item.id] ?? 0;
            const firstName = item.user?.firstName ?? '';
            const lastName = item.user?.lastName ?? '';
            return (
              <TouchableOpacity
                style={styles.interlocutorCard}
                onPress={() => handleSelectInterlocutor(item)}
              >
                <TouchableOpacity
                  style={styles.avatarWrapper}
                  onPress={() => navigation.navigate('CoachDetail', { coachId: item.id })}
                  activeOpacity={0.8}
                >
                  {getMediaUrl(item.profilePicture) ? (
                    <Image source={{ uri: getMediaUrl(item.profilePicture) }} style={styles.avatarImg} />
                  ) : (
                    <View style={styles.avatar}>
                      <Ionicons name="person" size={22} color={couleurs.accent} />
                    </View>
                  )}
                  <UnreadBadge count={count} />
                </TouchableOpacity>
                <View style={styles.interlocutorInfo}>
                  <Text style={styles.interlocutorName}>{firstName} {lastName}</Text>
                  {item.bio && (
                    <Text style={styles.interlocutorBio} numberOfLines={1}>{item.bio}</Text>
                  )}
                  {item.city && (
                    <Text style={styles.interlocutorCity}>
                      <Ionicons name="location" size={12} color={couleurs.texteDoux} /> {item.city}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={24} color={couleurs.texteFaible} />
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color={couleurs.texteFaible} />
              <Text style={styles.emptyText}>
                {isCoach ? 'Aucun client assigné' : 'Aucun coach assigné'}
              </Text>
            </View>
          }
        />
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // Rendu : conversation
  // -------------------------------------------------------------------------
  const interlocutorName = selectedInterlocutor.user
    ? `${selectedInterlocutor.user.firstName} ${selectedInterlocutor.user.lastName}`
    : isCoach ? 'Mon client' : 'Mon coach';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            setSelectedInterlocutor(null);
            setMessages([]);
            fetchUnreadCounts();
          }}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={28} color={couleurs.texte} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerAvatarWrap}
          onPress={() => navigation.navigate('CoachDetail', { coachId: selectedInterlocutor.id })}
          activeOpacity={0.8}
        >
          {getMediaUrl(selectedInterlocutor.profilePicture) ? (
            <Image source={{ uri: getMediaUrl(selectedInterlocutor.profilePicture) }} style={styles.headerAvatarImg} />
          ) : (
            <View style={styles.headerAvatarPlaceholder}>
              <Ionicons name="person" size={20} color={couleurs.accent} />
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{interlocutorName}</Text>
          <Text style={styles.headerSubtitle}>
            {isCoach ? 'Client' : 'Coach'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={() => setShowProposalModal(true)}
        >
          <Ionicons name="calendar-outline" size={22} color={couleurs.accent} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyMessagesContainer}>
            <Text style={styles.emptyMessagesText}>Aucun message</Text>
            <Text style={styles.emptyMessagesSubtext}>
              {isCoach
                ? 'Commencez la conversation avec votre client !'
                : 'Commencez la conversation avec votre coach !'}
            </Text>
          </View>
        }
      />

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Tapez votre message..."
          placeholderTextColor={couleurs.texteFaible}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!newMessage.trim() || sending}
        >
          {sending
            ? <ActivityIndicator color={couleurs.texteInverse} size="small" />
            : <Ionicons name="send" size={20} color={couleurs.texteInverse} />}
        </TouchableOpacity>
      </View>

      {/* Modal proposition de RDV */}
      <Modal visible={showProposalModal} animationType="slide" transparent onRequestClose={() => setShowProposalModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Proposer un RDV</Text>
                <TouchableOpacity onPress={() => setShowProposalModal(false)}>
                  <Ionicons name="close" size={24} color={couleurs.texte} />
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Titre *</Text>
                <TextInput
                  style={styles.formInput}
                  value={proposalForm.title}
                  onChangeText={(t) => setProposalForm({ ...proposalForm, title: t })}
                  placeholder="Ex: Séance bilan…"
                  placeholderTextColor={couleurs.texteFaible}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Date *</Text>
                <TouchableOpacity
                  style={[styles.formInput, styles.dateField]}
                  onPress={() => setShowDatePicker((v) => !v)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dateFieldText, !proposalForm.startDate && styles.dateFieldPlaceholder]}>
                    {proposalForm.startDate ? formatDateDDMMYY(proposalForm.startDate) : 'JJ-MM-AA'}
                  </Text>
                  <Ionicons
                    name={showDatePicker ? 'chevron-up' : 'calendar-outline'}
                    size={18}
                    color={couleurs.texteDoux}
                  />
                </TouchableOpacity>
                {showDatePicker && (
                  <View style={styles.pickerWrap}>
                    <DateTimePicker
                      value={dateValue}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'default'}
                      minimumDate={new Date()}
                      locale="fr-FR"
                      onChange={(event, selected) => {
                        if (Platform.OS !== 'ios') setShowDatePicker(false);
                        if (event.type === 'dismissed') return;
                        if (selected) {
                          setProposalForm((f) => ({ ...f, startDate: toIsoDate(selected) }));
                        }
                      }}
                    />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity
                        style={styles.pickerCloseBtn}
                        onPress={() => setShowDatePicker(false)}
                      >
                        <Text style={styles.pickerCloseText}>Fermer</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Heure *</Text>
                <TouchableOpacity
                  style={[styles.formInput, styles.dateField]}
                  onPress={() => setShowTimePicker((v) => !v)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dateFieldText, !proposalForm.startTime && styles.dateFieldPlaceholder]}>
                    {proposalForm.startTime || 'HH:MM'}
                  </Text>
                  <Ionicons
                    name={showTimePicker ? 'chevron-up' : 'time-outline'}
                    size={18}
                    color={couleurs.texteDoux}
                  />
                </TouchableOpacity>
                {showTimePicker && (
                  <View style={styles.pickerWrap}>
                    <DateTimePicker
                      value={timeValue}
                      mode="time"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      is24Hour
                      locale="fr-FR"
                      minuteInterval={5}
                      onChange={(event, selected) => {
                        if (Platform.OS !== 'ios') setShowTimePicker(false);
                        if (event.type === 'dismissed') return;
                        if (selected) {
                          setProposalForm((f) => ({ ...f, startTime: toHHMM(selected) }));
                        }
                      }}
                    />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity
                        style={styles.pickerCloseBtn}
                        onPress={() => setShowTimePicker(false)}
                      >
                        <Text style={styles.pickerCloseText}>Fermer</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Durée (minutes) *</Text>
                <TextInput
                  style={styles.formInput}
                  value={proposalForm.durationMinutes}
                  onChangeText={(t) => setProposalForm({ ...proposalForm, durationMinutes: t })}
                  keyboardType="number-pad"
                  placeholder="60"
                  placeholderTextColor={couleurs.texteFaible}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Type de lieu</Text>
                <View style={styles.radioRow}>
                  {[['PHYSICAL', 'Présentiel', 'location-outline'], ['REMOTE', 'Distanciel', 'videocam-outline']].map(([val, lbl, icon]) => (
                    <TouchableOpacity
                      key={val}
                      style={[styles.radioBtn, proposalForm.locationType === val && styles.radioBtnActive]}
                      onPress={() => setProposalForm({ ...proposalForm, locationType: val })}
                    >
                      <Ionicons name={icon} size={16} color={proposalForm.locationType === val ? couleurs.texteInverse : couleurs.texteDoux} />
                      <Text style={[styles.radioBtnText, proposalForm.locationType === val && styles.radioBtnTextActive]}>{lbl}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  {proposalForm.locationType === 'PHYSICAL' ? 'Adresse' : 'Lien visio'} (optionnel)
                </Text>
                <TextInput
                  style={styles.formInput}
                  value={proposalForm.locationDetail}
                  onChangeText={(t) => setProposalForm({ ...proposalForm, locationDetail: t })}
                  placeholder={proposalForm.locationType === 'PHYSICAL' ? 'Ex: 12 rue du sport…' : 'https://meet.google.com/…'}
                  placeholderTextColor={couleurs.texteFaible}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, proposalSubmitting && styles.submitBtnDisabled]}
                onPress={handleProposeAppointment}
                disabled={proposalSubmitting}
              >
                {proposalSubmitting ? (
                  <ActivityIndicator color={couleurs.texteInverse} size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Proposer le RDV</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: couleurs.fond,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: couleurs.carte,
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: couleurs.texte,
  },
  headerSubtitle: {
    fontSize: 12,
    color: couleurs.texteDoux,
    marginTop: 2,
  },
  backButton: {
    marginRight: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Liste interlocuteurs
  listContent: {
    padding: 16,
  },
  interlocutorCard: {
    backgroundColor: couleurs.carte,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: couleurs.ombre,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: couleurs.accentVoile,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  headerAvatarWrap: {
    marginRight: 10,
  },
  headerAvatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: couleurs.accentVoile,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: couleurs.danger,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: couleurs.carte,
  },
  badgeText: {
    color: couleurs.texteInverse,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  interlocutorInfo: {
    flex: 1,
    marginRight: 12,
  },
  interlocutorName: {
    fontSize: 16,
    fontWeight: '600',
    color: couleurs.texte,
    marginBottom: 2,
  },
  interlocutorBio: {
    fontSize: 13,
    color: couleurs.texteDoux,
    marginBottom: 2,
  },
  interlocutorCity: {
    fontSize: 12,
    color: couleurs.texteDoux,
  },
  // Messages
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  messageBubble: {
    marginBottom: 16,
    maxWidth: '80%',
  },
  messageBubbleLeft: {
    alignSelf: 'flex-start',
  },
  messageBubbleRight: {
    alignSelf: 'flex-end',
  },
  messageContent: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  messageContentLeft: {
    backgroundColor: couleurs.eleve,
  },
  messageContentRight: {
    backgroundColor: couleurs.accent,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextLeft: {
    color: couleurs.texte,
  },
  messageTextRight: {
    color: couleurs.texteInverse,
  },
  messageTime: {
    fontSize: 11,
    color: couleurs.texteDoux,
    marginTop: 4,
    marginHorizontal: 4,
  },
  messageTimeLeft: {
    textAlign: 'left',
  },
  messageTimeRight: {
    textAlign: 'right',
  },
  // Input
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: couleurs.carte,
    borderTopWidth: 1,
    borderTopColor: couleurs.bord,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: couleurs.fond,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: couleurs.texte,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: couleurs.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: couleurs.eleve,
  },
  // Vide
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: couleurs.texte,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyMessagesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyMessagesText: {
    fontSize: 16,
    fontWeight: '600',
    color: couleurs.texteDoux,
    marginBottom: 4,
  },
  emptyMessagesSubtext: {
    fontSize: 14,
    color: couleurs.texteFaible,
    textAlign: 'center',
  },
  // Bulle RDV
  apptBubble: {
    backgroundColor: couleurs.carte,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: couleurs.accentVoileFort,
    padding: 14,
    maxWidth: '85%',
    marginBottom: 4,
  },
  apptBubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  apptBubbleType: {
    fontSize: 12,
    fontWeight: '700',
    color: couleurs.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  apptBubbleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: couleurs.texte,
    marginBottom: 4,
  },
  apptBubbleDate: {
    fontSize: 14,
    color: couleurs.texte,
    marginBottom: 2,
    textTransform: 'capitalize',
  },
  apptBubbleMeta: {
    fontSize: 12,
    color: couleurs.texteDoux,
    marginBottom: 10,
  },
  apptStatusRow: {
    marginBottom: 8,
  },
  apptStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 99,
  },
  apptStatusProposed: { backgroundColor: couleurs.alerteVoile },
  apptStatusConfirmed: { backgroundColor: couleurs.succesVoile },
  apptStatusCancelled: { backgroundColor: couleurs.fond },
  apptStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  apptStatusTextProposed: { color: couleurs.alerte },
  apptStatusTextConfirmed: { color: couleurs.succes },
  apptStatusTextCancelled: { color: couleurs.texteFaible },
  apptActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  apptActionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  apptConfirmBtn: {
    borderColor: couleurs.succes,
    backgroundColor: couleurs.succesVoile,
  },
  apptDeclineBtn: {
    borderColor: couleurs.danger,
    backgroundColor: couleurs.dangerVoile,
  },
  apptConfirmText: {
    color: couleurs.succes,
    fontWeight: '600',
    fontSize: 13,
  },
  apptDeclineText: {
    color: couleurs.danger,
    fontWeight: '600',
    fontSize: 13,
  },
  // Bulle TIP
  tipBubble: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: couleurs.accentVoile,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 8,
    maxWidth: '90%',
  },
  tipText: {
    fontSize: 13,
    color: couleurs.accent,
    flex: 1,
    lineHeight: 18,
  },

  // ─── Header action (proposer RDV) ─────────────────────────────────────────
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: couleurs.accentVoile,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  // ─── Modal proposition de RDV ─────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: couleurs.carte,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: couleurs.texte,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: couleurs.texteDoux,
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: couleurs.fond,
    borderWidth: 1,
    borderColor: couleurs.bord,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: couleurs.texte,
  },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateFieldText: {
    fontSize: 14,
    color: couleurs.texte,
  },
  dateFieldPlaceholder: {
    color: couleurs.texteFaible,
  },
  pickerWrap: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: couleurs.bord,
    borderRadius: 10,
    backgroundColor: couleurs.carte,
    overflow: 'hidden',
  },
  pickerCloseBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: couleurs.bord,
    backgroundColor: couleurs.fond,
  },
  pickerCloseText: {
    color: couleurs.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  radioRow: {
    flexDirection: 'row',
    gap: 10,
  },
  radioBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: couleurs.fond,
    borderWidth: 1,
    borderColor: couleurs.bord,
    borderRadius: 10,
    paddingVertical: 12,
  },
  radioBtnActive: {
    backgroundColor: couleurs.accent,
    borderColor: couleurs.accent,
  },
  radioBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: couleurs.texteDoux,
  },
  radioBtnTextActive: {
    color: couleurs.texteInverse,
  },
  submitBtn: {
    backgroundColor: couleurs.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: couleurs.texteInverse,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MessagesScreen;
