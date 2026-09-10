import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { clientsAPI, messagesAPI, appointmentsAPI } from '../../services/api';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import Avatar from '../../components/Avatar';
import { couleurs } from '../../theme';

const CoachDashboardScreen = ({ navigation, onGoToClients, onGoToProfile }) => {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [clientsRes, unreadRes, appointmentsRes] = await Promise.all([
        clientsAPI.getCoachClients(),
        messagesAPI.getUnreadCount(),
        appointmentsAPI.getUpcoming(),
      ]);

      if (clientsRes.data.success) {
        setClients(clientsRes.data.data || []);
      }
      if (unreadRes.data.success) {
        setUnreadCount(unreadRes.data.data?.count ?? 0);
      }
      if (appointmentsRes.data.success) {
        setUpcomingAppointments((appointmentsRes.data.data || []).slice(0, 3));
      }
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
      Alert.alert('Erreur', 'Impossible de charger le tableau de bord');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const formatAppointmentDate = (startAt) => {
    try {
      return format(parseISO(startAt), "EEEE d MMMM 'à' HH:mm", { locale: fr });
    } catch {
      return startAt;
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={couleurs.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[couleurs.accent]} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>Bonjour,</Text>
            <Text style={styles.userName}>{user?.firstName} {user?.lastName}</Text>
            <Text style={styles.role}>Coach</Text>
          </View>
          <Avatar user={user} size={52} onPress={onGoToProfile} />
        </View>
      </View>

      {/* Stats rapides */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="people" size={28} color={couleurs.accent} />
          <Text style={styles.statValue}>{clients.length}</Text>
          <Text style={styles.statLabel}>Clients</Text>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statIconWrapper}>
            <Ionicons name="chatbubbles" size={28} color={unreadCount > 0 ? couleurs.danger : couleurs.accent} />
            {unreadCount > 0 && (
              <View style={styles.statBadge}>
                <Text style={styles.statBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.statValue, unreadCount > 0 && { color: couleurs.danger }]}>{unreadCount}</Text>
          <Text style={styles.statLabel}>Non lus</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="calendar" size={28} color={couleurs.accent} />
          <Text style={styles.statValue}>{upcomingAppointments.length}</Text>
          <Text style={styles.statLabel}>RDV à venir</Text>
        </View>
      </View>

      {/* Mes clients */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Mes clients</Text>
          <TouchableOpacity onPress={onGoToClients}>
            <Text style={styles.seeAll}>Voir tous</Text>
          </TouchableOpacity>
        </View>

        {clients.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="people-outline" size={40} color={couleurs.texteFaible} />
            <Text style={styles.emptyText}>Aucun client pour l'instant</Text>
          </View>
        ) : (
          <View style={styles.clientList}>
            {clients.map((client, index) => {
              const firstName = client.user?.firstName || '';
              const lastName = client.user?.lastName || '';
              const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
              return (
                <TouchableOpacity
                  key={client.id}
                  style={[
                    styles.clientRow,
                    index === clients.length - 1 && styles.clientRowLast,
                  ]}
                  onPress={() =>
                    navigation.navigate('CoachClientDetail', {
                      clientId: client.id,
                      clientName: `${firstName} ${lastName}`.trim(),
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.clientAvatar}>
                    <Text style={styles.clientAvatarText}>{initials || '?'}</Text>
                  </View>
                  <View style={styles.clientInfo}>
                    <Text style={styles.clientName} numberOfLines={1}>
                      {firstName} {lastName}
                    </Text>
                    {client.goals && (
                      <Text style={styles.clientGoal} numberOfLines={1}>
                        {client.goals}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={couleurs.texteFaible} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* Prochains rendez-vous */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Prochains rendez-vous</Text>

        {upcomingAppointments.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={40} color={couleurs.texteFaible} />
            <Text style={styles.emptyText}>Aucun rendez-vous à venir</Text>
          </View>
        ) : (
          upcomingAppointments.map((appt) => (
            <View key={appt.id} style={styles.apptCard}>
              <View style={styles.apptIconCol}>
                <View style={styles.apptIconWrapper}>
                  <Ionicons
                    name={appt.locationType === 'PHYSICAL' ? 'location' : 'videocam'}
                    size={20}
                    color={couleurs.accent}
                  />
                </View>
              </View>
              <View style={styles.apptContent}>
                <Text style={styles.apptTitle} numberOfLines={1}>{appt.title || 'Rendez-vous'}</Text>
                <Text style={styles.apptDate} numberOfLines={1} style={styles.apptDateText}>
                  {formatAppointmentDate(appt.startAt)}
                </Text>
                {appt.client && (
                  <Text style={styles.apptClient} numberOfLines={1}>
                    {appt.client.user?.firstName} {appt.client.user?.lastName}
                  </Text>
                )}
              </View>
              <View style={[
                styles.apptTypeBadge,
                appt.locationType === 'PHYSICAL' ? styles.apptPhysical : styles.apptRemote,
              ]}>
                <Text style={[
                  styles.apptTypeText,
                  appt.locationType === 'PHYSICAL' ? styles.apptPhysicalText : styles.apptRemoteText,
                ]}>
                  {appt.locationType === 'PHYSICAL' ? 'Présentiel' : 'Distanciel'}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
};

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
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 14,
    color: couleurs.texteFaible,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: couleurs.texte,
  },
  role: {
    fontSize: 13,
    color: couleurs.accent,
    fontWeight: '600',
    marginTop: 2,
  },
  // Stats rapides
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: couleurs.carte,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: couleurs.ombre,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconWrapper: {
    position: 'relative',
  },
  statBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: couleurs.danger,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  statBadgeText: {
    color: couleurs.texteInverse,
    fontSize: 9,
    fontWeight: '700',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: couleurs.texte,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: couleurs.texteFaible,
    marginTop: 2,
  },
  // Sections
  section: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: couleurs.texte,
    marginBottom: 12,
  },
  seeAll: {
    fontSize: 14,
    color: couleurs.accent,
    fontWeight: '600',
  },
  // Clients horizontaux
  clientList: {
    backgroundColor: couleurs.carte,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: couleurs.ombre,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  clientRowLast: {
    borderBottomWidth: 0,
  },
  clientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: couleurs.accentVoile,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  clientAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: couleurs.accent,
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
  clientGoal: {
    fontSize: 12,
    color: couleurs.texteFaible,
  },
  // Appointments
  apptCard: {
    backgroundColor: couleurs.carte,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: couleurs.ombre,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  apptIconCol: {
    marginRight: 12,
  },
  apptIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: couleurs.accentVoile,
    justifyContent: 'center',
    alignItems: 'center',
  },
  apptContent: {
    flex: 1,
  },
  apptTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: couleurs.texte,
    marginBottom: 2,
  },
  apptDateText: {
    fontSize: 13,
    color: couleurs.texteFaible,
    marginBottom: 2,
    textTransform: 'capitalize',
  },
  apptClient: {
    fontSize: 12,
    color: couleurs.texteFaible,
  },
  apptTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  apptPhysical: {
    backgroundColor: couleurs.succesVoile,
  },
  apptRemote: {
    backgroundColor: couleurs.infoVoile,
  },
  apptTypeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  apptPhysicalText: {
    color: couleurs.succes,
  },
  apptRemoteText: {
    color: couleurs.info,
  },
  // Empty
  emptyCard: {
    backgroundColor: couleurs.carte,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    shadowColor: couleurs.ombre,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyText: {
    fontSize: 14,
    color: couleurs.texteFaible,
    marginTop: 12,
  },
});

export default CoachDashboardScreen;
