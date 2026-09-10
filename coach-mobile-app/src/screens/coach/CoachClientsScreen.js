import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { clientsAPI, requestsAPI } from '../../services/api';
import { couleurs } from '../../theme';

const STATUS_COLORS = {
  ACTIVE: { bg: couleurs.succesVoile, text: couleurs.succes, label: 'Actif' },
  INACTIVE: { bg: couleurs.eleve, text: couleurs.texteFaible, label: 'Inactif' },
  PENDING: { bg: couleurs.alerteVoile, text: couleurs.alerte, label: 'En attente' },
};

const CoachClientsScreen = ({ navigation }) => {
  const [allClients, setAllClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [actionLoading, setActionLoading] = useState(null); // requestId en cours

  const fetchClients = useCallback(async () => {
    try {
      const response = await clientsAPI.getCoachClients();
      if (response.data.success) {
        const data = response.data.data || [];
        setAllClients(data);
        setFilteredClients(data);
      }
    } catch (error) {
      console.error('Erreur chargement clients:', error);
      Alert.alert('Erreur', 'Impossible de charger la liste des clients');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) { setFilteredClients(allClients); return; }
    setFilteredClients(allClients.filter((client) => {
      const fn = (client.user?.firstName || '').toLowerCase();
      const ln = (client.user?.lastName || '').toLowerCase();
      const em = (client.user?.email || '').toLowerCase();
      return fn.includes(q) || ln.includes(q) || `${fn} ${ln}`.includes(q) || em.includes(q);
    }));
  }, [searchQuery, allClients]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchClients();
  }, [fetchClients]);

  const handleAccept = async (requestId) => {
    setActionLoading(requestId);
    try {
      await requestsAPI.accept(requestId);
      await fetchClients();
      setExpandedId(null);
    } catch {
      Alert.alert('Erreur', 'Impossible d\'accepter la demande.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId) => {
    Alert.alert(
      'Refuser la demande',
      'Êtes-vous sûr de vouloir refuser cette demande ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(requestId);
            try {
              await requestsAPI.reject(requestId);
              await fetchClients();
              setExpandedId(null);
            } catch {
              Alert.alert('Erreur', 'Impossible de refuser la demande.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const renderClient = ({ item }) => {
    const firstName = item.user?.firstName || '';
    const lastName = item.user?.lastName || '';
    const email = item.user?.email || '';
    const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
    const isPending = item.requestStatus === 'pending';
    const statusInfo = isPending
      ? STATUS_COLORS.PENDING
      : STATUS_COLORS[item.status] || STATUS_COLORS.ACTIVE;
    const isExpanded = expandedId === item.id;

    return (
      <View style={styles.clientCard}>
        {/* Ligne principale */}
        <View style={styles.clientRow}>
          {/* Avatar — clique → profil */}
          <TouchableOpacity
            style={styles.avatar}
            onPress={() =>
              navigation.navigate('CoachClientDetail', {
                clientId: item.id,
                clientName: `${firstName} ${lastName}`.trim(),
              })
            }
          >
            <Text style={styles.avatarText}>{initials || '?'}</Text>
          </TouchableOpacity>

          {/* Infos — clique → toggle déroulant si pending, sinon profil */}
          <TouchableOpacity
            style={styles.clientInfo}
            onPress={() => {
              if (isPending) {
                setExpandedId(isExpanded ? null : item.id);
              } else {
                navigation.navigate('CoachClientDetail', {
                  clientId: item.id,
                  clientName: `${firstName} ${lastName}`.trim(),
                });
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.clientName}>{firstName} {lastName}</Text>
            {email ? <Text style={styles.clientEmail} numberOfLines={1}>{email}</Text> : null}
          </TouchableOpacity>

          {/* Badge + chevron */}
          <View style={styles.rightCol}>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
              <Text style={[styles.statusText, { color: statusInfo.text }]}>{statusInfo.label}</Text>
            </View>
            {isPending ? (
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={couleurs.texteFaible}
                style={{ marginTop: 8 }}
              />
            ) : (
              <Ionicons name="chevron-forward" size={20} color={couleurs.texteFaible} style={{ marginTop: 8 }} />
            )}
          </View>
        </View>

        {/* Déroulant — clients en attente seulement */}
        {isPending && isExpanded && (
          <View style={styles.pendingExpand}>
            {/* Message de demande */}
            {item.requestMessage ? (
              <View style={styles.messageBox}>
                <Ionicons name="chatbubble-outline" size={14} color={couleurs.accent} style={{ marginRight: 6, marginTop: 1 }} />
                <Text style={styles.messageText}>{item.requestMessage}</Text>
              </View>
            ) : (
              <Text style={styles.noMessage}>Aucun message joint à la demande.</Text>
            )}

            {/* Boutons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.profileBtn}
                onPress={() =>
                  navigation.navigate('CoachClientDetail', {
                    clientId: item.id,
                    clientName: `${firstName} ${lastName}`.trim(),
                  })
                }
              >
                <Ionicons name="person-outline" size={15} color={couleurs.accent} />
                <Text style={styles.profileBtnTxt}>Voir le profil</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.rejectBtn}
                onPress={() => handleReject(item.requestId)}
                disabled={actionLoading === item.requestId}
              >
                {actionLoading === item.requestId ? (
                  <ActivityIndicator size="small" color={couleurs.danger} />
                ) : (
                  <Text style={styles.rejectTxt}>Refuser</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={() => handleAccept(item.requestId)}
                disabled={actionLoading === item.requestId}
              >
                {actionLoading === item.requestId ? (
                  <ActivityIndicator size="small" color={couleurs.texteInverse} />
                ) : (
                  <Text style={styles.acceptTxt}>Accepter</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={couleurs.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Mes clients</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{allClients.length}</Text>
          </View>
        </View>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={couleurs.texteFaible} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher par nom ou email..."
            placeholderTextColor={couleurs.texteFaible}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      <FlatList
        data={filteredClients}
        keyExtractor={(item) => item.id}
        renderItem={renderClient}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[couleurs.accent]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color={couleurs.texteFaible} />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'Aucun résultat' : 'Aucun client'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery
                ? `Aucun client ne correspond à "${searchQuery}"`
                : "Vous n'avez pas encore de clients assignés"}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: couleurs.fond },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: couleurs.carte,
    paddingTop: 60,
    paddingBottom: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: couleurs.texte },
  countBadge: { marginLeft: 10, backgroundColor: couleurs.accentVoile, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  countText: { fontSize: 14, fontWeight: '700', color: couleurs.accent },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: couleurs.fond, borderRadius: 10, paddingHorizontal: 12, height: 40 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: couleurs.texte },
  listContent: { padding: 16, flexGrow: 1 },

  // Card
  clientCard: {
    backgroundColor: couleurs.carte,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: couleurs.ombre,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  clientRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: couleurs.accentVoile, justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  avatarText: { fontSize: 17, fontWeight: '700', color: couleurs.accent },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 16, fontWeight: '600', color: couleurs.texte, marginBottom: 2 },
  clientEmail: { fontSize: 13, color: couleurs.texteFaible },
  rightCol: { alignItems: 'flex-end', marginLeft: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '600' },

  // Déroulant pending
  pendingExpand: {
    borderTopWidth: 1,
    borderTopColor: couleurs.bord,
    padding: 16,
    paddingTop: 12,
    backgroundColor: couleurs.fond,
  },
  messageBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: couleurs.accentVoile, borderRadius: 8, padding: 10, marginBottom: 14 },
  messageText: { flex: 1, fontSize: 13, color: couleurs.accent, lineHeight: 18 },
  noMessage: { fontSize: 13, color: couleurs.texteFaible, fontStyle: 'italic', marginBottom: 14 },
  actionRow: { flexDirection: 'row', gap: 8 },
  profileBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 9, borderRadius: 8, borderWidth: 1.5, borderColor: couleurs.accent,
  },
  profileBtnTxt: { fontSize: 13, fontWeight: '600', color: couleurs.accent },
  rejectBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 9, borderRadius: 8, borderWidth: 1.5, borderColor: couleurs.danger,
  },
  rejectTxt: { fontSize: 13, fontWeight: '600', color: couleurs.danger },
  acceptBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 9, borderRadius: 8, backgroundColor: couleurs.accent,
  },
  acceptTxt: { fontSize: 13, fontWeight: '600', color: couleurs.texteInverse },

  // Empty
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: couleurs.texteDoux, marginTop: 16, marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: couleurs.texteFaible, textAlign: 'center', paddingHorizontal: 32 },
});

export default CoachClientsScreen;
