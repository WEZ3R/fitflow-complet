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
import { programsAPI, sessionsAPI, statsAPI, clientsAPI } from '../../services/api';
import { format, addDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { couleurs } from '../../theme';

// -----------------------------------------------------------------------
// Helpers statut séance
// -----------------------------------------------------------------------
const SESSION_STATUS = {
  DONE: { color: couleurs.succes, label: 'Terminée', bg: couleurs.succesVoile },
  DRAFT: { color: couleurs.alerte, label: 'À faire', bg: couleurs.alerteVoile },
  EMPTY: { color: couleurs.texteFaible, label: 'Non commencée', bg: couleurs.eleve },
};

const getSessionStatus = (session) => {
  if (session.isRestDay) return { color: couleurs.accent, label: 'Repos', bg: couleurs.accentVoile };
  return SESSION_STATUS[session.status] || SESSION_STATUS.EMPTY;
};

const formatSessionDate = (dateString) => {
  try {
    return format(parseISO(dateString), 'EEE d MMM', { locale: fr });
  } catch {
    return dateString;
  }
};

// -----------------------------------------------------------------------
// Onglet Séances
// -----------------------------------------------------------------------
const SessionsTab = ({ clientId, clientName, navigation }) => {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPrograms = useCallback(async () => {
    try {
      const response = await programsAPI.getCoachPrograms();
      if (response.data.success) {
        const allPrograms = response.data.data || [];
        // Filtrer les programmes qui appartiennent à ce client
        const clientPrograms = allPrograms.filter(
          (p) =>
            p.clientId === clientId ||
            p.client?.id === clientId ||
            String(p.clientId) === String(clientId)
        );
        setPrograms(clientPrograms);
      }
    } catch (error) {
      console.error('Erreur chargement programmes:', error);
      Alert.alert('Erreur', 'Impossible de charger les programmes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPrograms();
  }, [fetchPrograms]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={couleurs.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.tabContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[couleurs.accent]} />
      }
    >
      {programs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="fitness-outline" size={56} color={couleurs.texteFaible} />
          <Text style={styles.emptyTitle}>Aucun programme</Text>
          <Text style={styles.emptySubtext}>Ce client n'a pas encore de programme</Text>
          <TouchableOpacity
            style={styles.createProgramBtn}
            onPress={() => navigation.navigate('CoachNewProgram', { clientId, clientName })}
          >
            <Ionicons name="add-circle-outline" size={18} color={couleurs.texteInverse} />
            <Text style={styles.createProgramBtnText}>Créer un programme</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {programs.map((program) => (
            <ProgramBlock
              key={program.id}
              program={program}
              clientId={clientId}
              clientName={clientName}
              navigation={navigation}
            />
          ))}
          <TouchableOpacity
            style={styles.newProgramBtn}
            onPress={() => navigation.navigate('CoachNewProgram', { clientId, clientName })}
          >
            <Ionicons name="add-circle-outline" size={16} color={couleurs.accent} />
            <Text style={styles.newProgramBtnText}>Nouveau programme</Text>
          </TouchableOpacity>
        </>
      )}
      <View style={{ height: 32 }} />
    </ScrollView>
  );
};

// Block programme avec ses séances
const ProgramBlock = ({ program, clientId, clientName, navigation }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const response = await sessionsAPI.getByProgram(program.id);
        if (response.data.success) {
          setSessions(response.data.data || []);
        }
      } catch (error) {
        console.error('Erreur chargement séances:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, [program.id]);

  return (
    <View style={styles.programBlock}>
      <TouchableOpacity
        style={styles.programBlockHeader}
        onPress={() => setCollapsed(!collapsed)}
        activeOpacity={0.7}
      >
        <View style={styles.programBlockTitleRow}>
          <Ionicons
            name={collapsed ? 'chevron-forward' : 'chevron-down'}
            size={18}
            color={couleurs.texteFaible}
          />
          <Text style={styles.programBlockTitle} numberOfLines={1}>
            {program.title}
          </Text>
        </View>
        {program.isActive && (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>Actif</Text>
          </View>
        )}
      </TouchableOpacity>

      {!collapsed && (
        <>
          {/* Bouton calendrier du programme */}
          <TouchableOpacity
            style={styles.calendarBtn}
            onPress={() =>
              navigation.navigate('CoachProgramCalendar', {
                programId: program.id,
                programTitle: program.title,
                clientId,
                clientName,
              })
            }
          >
            <Ionicons name="calendar-outline" size={15} color={couleurs.accent} />
            <Text style={styles.calendarBtnText}>Voir le calendrier</Text>
          </TouchableOpacity>

          {loading ? (
            <ActivityIndicator size="small" color={couleurs.accent} style={{ padding: 16 }} />
          ) : sessions.length === 0 ? (
            <Text style={styles.noSessionsText}>Aucune séance — ajoutez-en depuis le calendrier</Text>
          ) : (
            sessions.slice(0, 5).map((session) => {
              const statusInfo = getSessionStatus(session);
              return (
                <TouchableOpacity
                  key={session.id}
                  style={styles.sessionRow}
                  onPress={() => {
                    if (!session.isRestDay) {
                      navigation.navigate('CoachSessionFill', {
                        sessionId: session.id,
                        clientId,
                      });
                    }
                  }}
                  activeOpacity={session.isRestDay ? 1 : 0.7}
                >
                  <View style={[styles.sessionStatusDot, { backgroundColor: statusInfo.color }]} />
                  <View style={styles.sessionRowContent}>
                    <Text style={styles.sessionRowTitle} numberOfLines={1}>
                      {session.isRestDay
                        ? 'Jour de repos'
                        : session.title || session.notes || `Séance`}
                    </Text>
                    <Text style={styles.sessionRowDate}>
                      {formatSessionDate(session.date)}
                    </Text>
                  </View>
                  <View style={[styles.sessionStatusBadge, { backgroundColor: statusInfo.bg }]}>
                    <Text style={[styles.sessionStatusText, { color: statusInfo.color }]}>
                      {statusInfo.label}
                    </Text>
                  </View>
                  {!session.isRestDay && (
                    <Ionicons name="chevron-forward" size={16} color={couleurs.texteFaible} style={{ marginLeft: 4 }} />
                  )}
                </TouchableOpacity>
              );
            })
          )}
          {sessions.length > 5 && (
            <TouchableOpacity
              style={styles.seeAllSessionsBtn}
              onPress={() =>
                navigation.navigate('CoachProgramCalendar', {
                  programId: program.id,
                  programTitle: program.title,
                  clientId,
                  clientName: navigation.getState()?.routes?.slice(-1)[0]?.params?.clientName,
                })
              }
            >
              <Text style={styles.seeAllSessionsText}>
                Voir toutes les séances ({sessions.length})
              </Text>
              <Ionicons name="chevron-forward" size={14} color={couleurs.accent} />
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
};

// -----------------------------------------------------------------------
// Onglet Stats (lecture seule pour le coach)
// -----------------------------------------------------------------------
const StatsTab = ({ clientId, navigation }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const date = format(selectedDate, 'yyyy-MM-dd');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [daySession, setDaySession] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Stats du jour
      const statsRes = await statsAPI.getByDate(clientId, date).catch((e) => {
        if (e.response?.status !== 404) console.error('Erreur stats:', e);
        return null;
      });
      setStats(statsRes?.data?.data || null);

      // Séance du jour : récupère les programmes du coach filtrés par client
      const programsRes = await programsAPI.getCoachPrograms();
      const clientPrograms = (programsRes.data.data || []).filter(
        (p) => p.clientId === clientId || p.client?.id === clientId || String(p.clientId) === String(clientId)
      );

      let foundSession = null;
      for (const program of clientPrograms) {
        if (foundSession) break;
        const sessionsRes = await sessionsAPI.getByProgram(program.id, { date }).catch(() => null);
        const sessions = sessionsRes?.data?.data || [];
        const match = sessions.find((s) => s.date?.slice(0, 10) === date);
        if (match) foundSession = match;
      }
      setDaySession(foundSession);
    } finally {
      setLoading(false);
    }
  }, [clientId, date]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePrevDay = () => setSelectedDate((d) => addDays(d, -1));
  const handleNextDay = () => setSelectedDate((d) => addDays(d, 1));

  const StatRow = ({ icon, iconColor, label, value }) => (
    <View style={styles.statRow}>
      <Ionicons name={icon} size={18} color={iconColor} style={{ marginRight: 10 }} />
      <Text style={styles.statRowLabel}>{label}</Text>
      <Text style={styles.statRowValue}>{value || '—'}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.tabContent}>
      {/* Sélecteur de date */}
      <View style={styles.datePicker}>
        <TouchableOpacity onPress={handlePrevDay} style={styles.dateArrow}>
          <Ionicons name="chevron-back" size={22} color={couleurs.texteFaible} />
        </TouchableOpacity>
        <Text style={styles.dateText}>
          {format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}
        </Text>
        <TouchableOpacity onPress={handleNextDay} style={styles.dateArrow}>
          <Ionicons name="chevron-forward" size={22} color={couleurs.texteFaible} />
        </TouchableOpacity>
      </View>

      {/* Encadré séance du jour */}
      {!loading && (
        daySession && !daySession.isRestDay ? (
          <TouchableOpacity
            style={styles.sessionCard}
            onPress={() => navigation.navigate('CoachSessionFill', { sessionId: daySession.id, clientId })}
            activeOpacity={0.8}
          >
            <View style={styles.sessionCardLeft}>
              <Ionicons name="barbell-outline" size={22} color={couleurs.accent} />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.sessionCardTitle}>
                  {daySession.title || daySession.notes || 'Séance du jour'}
                </Text>
                <Text style={styles.sessionCardStatus}>
                  {getSessionStatus(daySession).label}
                </Text>
              </View>
            </View>
            <View style={[styles.sessionCardBadge, { backgroundColor: getSessionStatus(daySession).bg }]}>
              <Text style={[styles.sessionCardBadgeText, { color: getSessionStatus(daySession).color }]}>
                Voir
              </Text>
              <Ionicons name="chevron-forward" size={14} color={getSessionStatus(daySession).color} />
            </View>
          </TouchableOpacity>
        ) : daySession?.isRestDay ? (
          <View style={[styles.sessionCard, styles.sessionCardRest]}>
            <Ionicons name="bed-outline" size={22} color={couleurs.accent} />
            <Text style={styles.sessionCardRestText}>Jour de repos</Text>
          </View>
        ) : (
          <View style={[styles.sessionCard, styles.sessionCardNone]}>
            <Ionicons name="calendar-outline" size={20} color={couleurs.texteFaible} />
            <Text style={styles.sessionCardNoneText}>Pas de séance ce jour</Text>
          </View>
        )
      )}

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={couleurs.accent} />
        </View>
      ) : !stats ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="stats-chart-outline" size={48} color={couleurs.texteFaible} />
          <Text style={styles.emptyTitle}>Aucune donnée</Text>
          <Text style={styles.emptySubtext}>Le client n'a pas renseigné ses stats ce jour-là</Text>
        </View>
      ) : (
        <>
          <View style={styles.statsCard}>
            <View style={styles.statsCardHeader}>
              <Ionicons name="moon-outline" size={20} color={couleurs.violet} />
              <Text style={styles.statsCardTitle}>Sommeil</Text>
            </View>
            <StatRow
              icon="bed-outline"
              iconColor={couleurs.violet}
              label="Coucher"
              value={stats.bedTime ? new Date(stats.bedTime).toTimeString().slice(0, 5) : null}
            />
            <StatRow
              icon="sunny-outline"
              iconColor={couleurs.alerte}
              label="Réveil"
              value={stats.wakeTime ? new Date(stats.wakeTime).toTimeString().slice(0, 5) : null}
            />
            <StatRow
              icon="time-outline"
              iconColor={couleurs.accent}
              label="Durée"
              value={stats.sleepHours ? `${Math.round(stats.sleepHours * 10) / 10}h` : null}
            />
          </View>

          <View style={styles.statsCard}>
            <View style={styles.statsCardHeader}>
              <Ionicons name="water-outline" size={20} color={couleurs.info} />
              <Text style={styles.statsCardTitle}>Hydratation & Poids</Text>
            </View>
            <StatRow
              icon="water-outline"
              iconColor={couleurs.info}
              label="Eau"
              value={stats.waterIntake ? `${stats.waterIntake} L` : null}
            />
            <StatRow
              icon="scale-outline"
              iconColor={couleurs.succes}
              label="Poids"
              value={stats.weight ? `${stats.weight} kg` : null}
            />
          </View>

          <View style={styles.statsCard}>
            <View style={styles.statsCardHeader}>
              <Ionicons name="fitness-outline" size={20} color={couleurs.succes} />
              <Text style={styles.statsCardTitle}>Entraînement</Text>
            </View>
            <StatRow
              icon="timer-outline"
              iconColor={couleurs.succes}
              label="Durée séance"
              value={stats.workoutDuration ? `${stats.workoutDuration} min` : null}
            />
          </View>

          {stats.notes && (
            <View style={styles.statsCard}>
              <View style={styles.statsCardHeader}>
                <Ionicons name="document-text-outline" size={20} color={couleurs.alerte} />
                <Text style={styles.statsCardTitle}>Notes</Text>
              </View>
              <Text style={styles.notesText}>{stats.notes}</Text>
            </View>
          )}
        </>
      )}
      <View style={{ height: 32 }} />
    </ScrollView>
  );
};

// -----------------------------------------------------------------------
// Onglet Infos
// -----------------------------------------------------------------------
const InfosTab = ({ clientId }) => {
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClient = async () => {
      try {
        const response = await clientsAPI.getById(clientId);
        if (response.data.success) {
          setClient(response.data.data);
        }
      } catch (error) {
        console.error('Erreur chargement client:', error);
        Alert.alert('Erreur', 'Impossible de charger les informations du client');
      } finally {
        setLoading(false);
      }
    };
    fetchClient();
  }, [clientId]);

  const getLevelLabel = (level) => {
    switch (level) {
      case 'debutant': return 'Débutant';
      case 'intermediaire': return 'Intermédiaire';
      case 'avance': return 'Avancé';
      default: return level || 'Non renseigné';
    }
  };

  const InfoRow = ({ icon, label, value }) => (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrapper}>
        <Ionicons name={icon} size={18} color={couleurs.accent} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || 'Non renseigné'}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={couleurs.accent} />
      </View>
    );
  }

  if (!client) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Impossible de charger les informations</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.tabContent}>
      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>Informations sportives</Text>
        <InfoRow icon="trophy-outline" label="Objectif" value={client.goals} />
        <InfoRow icon="barbell-outline" label="Niveau" value={getLevelLabel(client.level)} />
        <InfoRow
          icon="scale-outline"
          label="Poids"
          value={client.weight ? `${client.weight} kg` : null}
        />
        <InfoRow
          icon="resize-outline"
          label="Taille"
          value={client.height ? `${client.height} cm` : null}
        />
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>Contact</Text>
        <InfoRow icon="mail-outline" label="Email" value={client.user?.email} />
        <InfoRow icon="call-outline" label="Téléphone" value={client.user?.phone} />
      </View>

      {client.availability && (
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Disponibilités</Text>
          <Text style={styles.availabilityText}>{client.availability}</Text>
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
};

// -----------------------------------------------------------------------
// Écran principal
// -----------------------------------------------------------------------
const TABS = [
  { key: 'infos', label: 'Infos' },
  { key: 'stats', label: 'Stats' },
  { key: 'sessions', label: 'Séances' },
];

const CoachClientDetailScreen = ({ route, navigation }) => {
  const { clientId, clientName } = route.params;
  const [activeTab, setActiveTab] = useState('infos');

  useEffect(() => {
    navigation.setOptions({ title: clientName || 'Détail client' });
  }, [clientName, navigation]);

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Contenu */}
      {activeTab === 'sessions' && (
        <SessionsTab clientId={clientId} clientName={clientName} navigation={navigation} />
      )}
      {activeTab === 'stats' && (
        <StatsTab clientId={clientId} navigation={navigation} />
      )}
      {activeTab === 'infos' && (
        <InfosTab clientId={clientId} />
      )}
    </View>
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
    paddingVertical: 40,
  },
  errorText: {
    fontSize: 14,
    color: couleurs.texteFaible,
  },
  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: couleurs.carte,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: couleurs.accent,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: couleurs.texteFaible,
  },
  tabLabelActive: {
    color: couleurs.accent,
    fontWeight: '700',
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  // Programme block
  programBlock: {
    backgroundColor: couleurs.carte,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: couleurs.ombre,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  programBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  programBlockTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  programBlockTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: couleurs.texte,
    marginLeft: 8,
    flex: 1,
  },
  activeBadge: {
    backgroundColor: couleurs.succesVoile,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: couleurs.succes,
  },
  noSessionsText: {
    padding: 16,
    fontSize: 13,
    color: couleurs.texteFaible,
    textAlign: 'center',
  },
  // Ligne séance
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  sessionStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  sessionRowContent: {
    flex: 1,
  },
  sessionRowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: couleurs.texte,
    marginBottom: 2,
  },
  sessionRowDate: {
    fontSize: 12,
    color: couleurs.texteFaible,
    textTransform: 'capitalize',
  },
  sessionStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
  },
  sessionStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Stats
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: couleurs.carte,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    shadowColor: couleurs.ombre,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dateArrow: {
    padding: 6,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
    color: couleurs.texte,
    textTransform: 'capitalize',
    flex: 1,
    textAlign: 'center',
  },
  statsCard: {
    backgroundColor: couleurs.carte,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: couleurs.ombre,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statsCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: couleurs.texte,
    marginLeft: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: couleurs.texteDoux,
    marginBottom: 6,
  },
  input: {
    backgroundColor: couleurs.fond,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 8,
    fontSize: 15,
    borderWidth: 1,
    borderColor: couleurs.bord,
    color: couleurs.texte,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: couleurs.carte,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: couleurs.accent,
    shadowColor: couleurs.ombre,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sessionCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sessionCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: couleurs.texte,
  },
  sessionCardStatus: {
    fontSize: 12,
    color: couleurs.texteFaible,
    marginTop: 2,
  },
  sessionCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 2,
  },
  sessionCardBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sessionCardRest: {
    borderLeftColor: couleurs.violet,
    gap: 12,
    justifyContent: 'flex-start',
  },
  sessionCardRestText: {
    fontSize: 15,
    fontWeight: '600',
    color: couleurs.accent,
  },
  sessionCardNone: {
    borderLeftColor: couleurs.bord,
    gap: 10,
    justifyContent: 'flex-start',
  },
  sessionCardNoneText: {
    fontSize: 14,
    color: couleurs.texteFaible,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  statRowLabel: {
    flex: 1,
    fontSize: 14,
    color: couleurs.texteFaible,
  },
  statRowValue: {
    fontSize: 15,
    fontWeight: '600',
    color: couleurs.texte,
  },
  notesText: {
    fontSize: 14,
    color: couleurs.texteDoux,
    lineHeight: 20,
  },
  // Infos
  infoCard: {
    backgroundColor: couleurs.carte,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: couleurs.ombre,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: couleurs.texte,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  infoIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: couleurs.accentVoile,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: couleurs.texteFaible,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: couleurs.texte,
    fontWeight: '500',
  },
  availabilityText: {
    fontSize: 14,
    color: couleurs.texteDoux,
    lineHeight: 20,
  },
  // Empty
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
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
    marginBottom: 20,
  },
  createProgramBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: couleurs.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 4,
  },
  createProgramBtnText: {
    color: couleurs.texteInverse,
    fontWeight: '700',
    fontSize: 14,
  },
  newProgramBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 4,
    borderWidth: 1.5,
    borderColor: couleurs.accentVoileFort,
    borderRadius: 10,
    borderStyle: 'dashed',
  },
  newProgramBtnText: {
    color: couleurs.accent,
    fontWeight: '600',
    fontSize: 14,
  },
  calendarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
    backgroundColor: couleurs.accentVoile,
  },
  calendarBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: couleurs.accent,
  },
  seeAllSessionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: couleurs.bord,
  },
  seeAllSessionsText: {
    fontSize: 13,
    fontWeight: '600',
    color: couleurs.accent,
  },
});

export default CoachClientDetailScreen;
