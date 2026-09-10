import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { clientsAPI, coachesAPI, messagesAPI } from '../../services/api';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { API_URL } from '../../../config';
import { couleurs } from '../../theme';
import { connecter, ecouter, estConnecte } from '../../services/socket';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MEDIA_BASE = API_URL.replace('/api', '');
const getMediaUrl = (filename) => {
  if (!filename) return null;
  if (filename.startsWith('http')) return filename;
  return `${MEDIA_BASE}${filename.startsWith('/') ? filename : '/uploads/' + filename}`;
};

// -----------------------------------------------------------------------
// Badge non lus
// -----------------------------------------------------------------------
const UnreadBadge = ({ count }) => {
  if (!count) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
};

// -----------------------------------------------------------------------
// Écran Messages Coach
// -----------------------------------------------------------------------
const CoachMessagesScreen = ({ navigation, onConversationRead, isVisible = false, resetRef }) => {
  useAuth();

  const isVisibleRef = useRef(isVisible);
  useEffect(() => { isVisibleRef.current = isVisible; }, [isVisible]);

  // Expose la fonction de reset à l'AppNavigator
  useEffect(() => {
    if (resetRef) resetRef.current = handleBack;
  }, [resetRef]);

  const [coachProfile, setCoachProfile] = useState(null);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});

  const flatListRef = useRef(null);
  const pollingIntervalRef = useRef(null);

  // Animation slide : conversation (depuis la droite) + ligne cliquée (vers la gauche)
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const rowSlideAnim = useRef(new Animated.Value(0)).current;
  const [slidingClientId, setSlidingClientId] = useState(null);

  // -----------------------------------------------------------------------
  // Chargement initial
  // -----------------------------------------------------------------------
  useEffect(() => {
    fetchCoachProfile();
    fetchUnreadCounts();
  }, []);

  useEffect(() => {
    if (!coachProfile) return;
    fetchClients();
  }, [coachProfile]);

  /**
   * Même dispositif que côté client : le WebSocket pousse, le sondage reste en filet.
   * Espacé à 15 s quand la socket est ouverte, suspendu quand l'écran n'est pas affiché.
   */
  useEffect(() => {
    if (!selectedClient || !coachProfile) return;
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
    const surveillance = setInterval(armer, 5000);

    return () => {
      arreterEcoute();
      clearInterval(surveillance);
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [selectedClient, coachProfile, isVisible]);


  // -----------------------------------------------------------------------
  // Profil coach
  // -----------------------------------------------------------------------
  const fetchCoachProfile = async () => {
    try {
      const response = await coachesAPI.getMe();
      if (response.data.success) {
        setCoachProfile(response.data.data);
      }
    } catch (error) {
      console.error('Erreur profil coach:', error);
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------------------------------------------------
  // Clients
  // -----------------------------------------------------------------------
  const fetchClients = async () => {
    try {
      const response = await clientsAPI.getCoachClients();
      if (response.data.success) {
        setClients(response.data.data || []);
      }
    } catch (error) {
      console.error('Erreur chargement clients:', error);
    }
  };

  // -----------------------------------------------------------------------
  // Compteurs non lus
  // -----------------------------------------------------------------------
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

  // -----------------------------------------------------------------------
  // Marquer comme lu
  // -----------------------------------------------------------------------
  const markConversationRead = async (client) => {
    if (!coachProfile || !client) return;
    try {
      await messagesAPI.markConversationAsRead(coachProfile.id, client.id);
      setUnreadCounts((prev) => ({ ...prev, [client.id]: 0 }));
      if (onConversationRead) onConversationRead();
    } catch {
      // silencieux
    }
  };

  const handleSelectClient = (client) => {
    // Prépare les deux animations
    slideAnim.setValue(SCREEN_WIDTH);
    rowSlideAnim.setValue(0);
    setSlidingClientId(client.id);

    // Déclenche la sélection immédiatement (démarre le polling de messages)
    setSelectedClient(client);

    // Ligne concernée glisse à gauche + conversation arrive de droite, en parallèle
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.timing(rowSlideAnim, {
        toValue: -SCREEN_WIDTH,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSlidingClientId(null);
      rowSlideAnim.setValue(0);
    });

    if (unreadCounts[client.id]) {
      markConversationRead(client);
    }
  };

  // Retour — inverse exact de l'entrée : ligne revient de la gauche, conversation repart à droite
  const handleBack = useCallback(() => {
    if (!selectedClient) return;

    // Positionne la ligne hors écran à gauche pour qu'elle revienne
    rowSlideAnim.setValue(-SCREEN_WIDTH);
    setSlidingClientId(selectedClient.id);

    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SCREEN_WIDTH,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.timing(rowSlideAnim, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSelectedClient(null);
      setMessages([]);
      setSlidingClientId(null);
      rowSlideAnim.setValue(0);
      slideAnim.setValue(SCREEN_WIDTH);
      fetchUnreadCounts();
    });
  }, [slideAnim, rowSlideAnim, selectedClient]);

  // Mise à jour du resetRef quand handleBack change
  useEffect(() => {
    if (resetRef) resetRef.current = handleBack;
  }, [handleBack, resetRef]);

  // -----------------------------------------------------------------------
  // Messages
  // -----------------------------------------------------------------------
  const fetchMessages = useCallback(async () => {
    if (!selectedClient || !coachProfile) return;
    try {
      const response = await messagesAPI.getConversation(coachProfile.id, selectedClient.id);
      if (response.data.success) {
        const fetched = response.data.data || [];
        setMessages(fetched);
        const hasUnread = fetched.some((m) => !m.isRead && !m.isSentByCoach);
        if (hasUnread && isVisibleRef.current) {
          markConversationRead(selectedClient);
        }
      }
    } catch (error) {
      console.error('Erreur messages:', error);
    }
  }, [selectedClient, coachProfile]);

  // -----------------------------------------------------------------------
  // Envoi
  // -----------------------------------------------------------------------
  const handleSend = async () => {
    if (!newMessage.trim() || !selectedClient || !coachProfile) return;
    setSending(true);
    try {
      await messagesAPI.send({
        coachId: coachProfile.id,
        clientId: selectedClient.id,
        content: newMessage,
        type: 'CHAT',
        isSentByCoach: true,
      });
      setNewMessage('');
      fetchMessages();
    } catch (error) {
      console.error('Erreur envoi message:', error);
      alert("Erreur lors de l'envoi du message");
    } finally {
      setSending(false);
    }
  };

  // -----------------------------------------------------------------------
  // Rendu message
  // -----------------------------------------------------------------------
  const renderMessage = ({ item }) => {
    const sentByMe = item.isSentByCoach;
    let date;
    try {
      date = parseISO(item.createdAt);
    } catch {
      date = new Date();
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

  // -----------------------------------------------------------------------
  // Loading
  // -----------------------------------------------------------------------
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={couleurs.accent} />
      </View>
    );
  }

  // -----------------------------------------------------------------------
  // Rendu principal — liste + conversation superposée
  // -----------------------------------------------------------------------
  const clientName = selectedClient?.user
    ? `${selectedClient.user.firstName} ${selectedClient.user.lastName}`
    : 'Client';

  return (
    <View style={styles.container}>

      {/* ── Liste des clients (toujours rendue) ── */}
      <View style={styles.listScreen}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
        <FlatList
          data={clients}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const count = unreadCounts[item.id] ?? 0;
            const firstName = item.user?.firstName || '';
            const lastName = item.user?.lastName || '';
            const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
            const isSliding = slidingClientId === item.id;
            return (
              <Animated.View
                style={isSliding ? { transform: [{ translateX: rowSlideAnim }] } : undefined}
              >
                <TouchableOpacity
                  style={styles.clientRow}
                  onPress={() => handleSelectClient(item)}
                  activeOpacity={0.7}
                >
                  {/* Avatar avec badge */}
                  <TouchableOpacity
                    style={styles.avatarWrapper}
                    onPress={() => navigation.navigate('CoachClientDetail', { clientId: item.id })}
                    activeOpacity={0.8}
                  >
                    {getMediaUrl(item.profilePicture) ? (
                      <Image source={{ uri: getMediaUrl(item.profilePicture) }} style={styles.avatarImg} />
                    ) : (
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{initials || '?'}</Text>
                      </View>
                    )}
                    <UnreadBadge count={count} />
                  </TouchableOpacity>

                  {/* Nom */}
                  <View style={styles.clientInfo}>
                    <Text style={styles.clientName}>{firstName} {lastName}</Text>
                    {item.goals && (
                      <Text style={styles.clientSub} numberOfLines={1}>{item.goals}</Text>
                    )}
                  </View>

                  {/* Badge non lus à droite si présent */}
                  {count > 0 && (
                    <View style={styles.unreadPill}>
                      <Text style={styles.unreadPillText}>{count > 99 ? '99+' : count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color={couleurs.texteFaible} />
              <Text style={styles.emptyTitle}>Aucun client</Text>
              <Text style={styles.emptySubtext}>
                Vous n'avez pas encore de clients assignés
              </Text>
            </View>
          }
        />
      </View>

      {/* ── Conversation (slide depuis la droite par-dessus la liste) ── */}
      {selectedClient && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.conversationScreen,
            { transform: [{ translateX: slideAnim }] },
          ]}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            {/* Header conversation */}
            <View style={styles.convHeader}>
              <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={28} color={couleurs.texte} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.convAvatarWrap}
                onPress={() => navigation.navigate('CoachClientDetail', { clientId: selectedClient.id })}
                activeOpacity={0.8}
              >
                {getMediaUrl(selectedClient.profilePicture) ? (
                  <Image source={{ uri: getMediaUrl(selectedClient.profilePicture) }} style={styles.convAvatarImg} />
                ) : (
                  <View style={styles.convAvatarPlaceholder}>
                    <Ionicons name="person" size={20} color={couleurs.accent} />
                  </View>
                )}
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.convHeaderTitle}>{clientName}</Text>
                <Text style={styles.convHeaderSub}>Client</Text>
              </View>
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
                    Commencez la conversation avec votre client !
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
          </KeyboardAvoidingView>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: couleurs.fond,
    overflow: 'hidden',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Liste ──────────────────────────────────────────────────────────────
  listScreen: {
    flex: 1,
  },
  header: {
    backgroundColor: couleurs.carte,
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: couleurs.texte,
  },
  // Ligne client pleine largeur (style messagerie native)
  clientRow: {
    backgroundColor: couleurs.carte,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: couleurs.bord,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: couleurs.accentVoile,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarText: {
    fontSize: 17,
    fontWeight: '700',
    color: couleurs.accent,
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
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 15,
    fontWeight: '600',
    color: couleurs.texte,
    marginBottom: 2,
  },
  clientSub: {
    fontSize: 13,
    color: couleurs.texteFaible,
  },
  unreadPill: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: couleurs.accent,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    marginLeft: 8,
  },
  unreadPillText: {
    color: couleurs.texteInverse,
    fontSize: 11,
    fontWeight: '700',
  },

  // ── Conversation (overlay animé) ───────────────────────────────────────
  conversationScreen: {
    backgroundColor: couleurs.fond,
  },
  convHeader: {
    backgroundColor: couleurs.carte,
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    marginRight: 4,
  },
  convAvatarWrap: {
    marginRight: 10,
  },
  convAvatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  convAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: couleurs.accentVoile,
    justifyContent: 'center',
    alignItems: 'center',
  },
  convHeaderTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: couleurs.texte,
  },
  convHeaderSub: {
    fontSize: 12,
    color: couleurs.texteFaible,
    marginTop: 1,
  },

  // ── Messages ───────────────────────────────────────────────────────────
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  messageBubble: {
    marginBottom: 14,
    maxWidth: '80%',
  },
  messageBubbleLeft: { alignSelf: 'flex-start' },
  messageBubbleRight: { alignSelf: 'flex-end' },
  messageContent: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  messageContentLeft: { backgroundColor: couleurs.eleve },
  messageContentRight: { backgroundColor: couleurs.accent },
  messageText: { fontSize: 15, lineHeight: 20 },
  messageTextLeft: { color: couleurs.texte },
  messageTextRight: { color: couleurs.texteInverse },
  messageTime: {
    fontSize: 11,
    color: couleurs.texteFaible,
    marginTop: 4,
    marginHorizontal: 4,
  },
  messageTimeLeft: { textAlign: 'left' },
  messageTimeRight: { textAlign: 'right' },

  // ── Input ──────────────────────────────────────────────────────────────
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

  // ── États vides ────────────────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: couleurs.texteDoux,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: couleurs.texteFaible,
    textAlign: 'center',
    paddingHorizontal: 32,
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
    color: couleurs.texteFaible,
    marginBottom: 4,
  },
  emptyMessagesSubtext: {
    fontSize: 14,
    color: couleurs.texteFaible,
    textAlign: 'center',
  },

  // ── TIP ────────────────────────────────────────────────────────────────
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
});

export default CoachMessagesScreen;
