import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { programsAPI, sessionsAPI } from '../../services/api';
import { format, parseISO, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import DatePickerField from '../../components/DatePickerField';
import { couleurs } from '../../theme';

// -----------------------------------------------------------------------
// Constantes de dimensions
// -----------------------------------------------------------------------
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CELL_SIZE = Math.floor((SCREEN_WIDTH - 24) / 7);

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------
const buildCells = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let startDow = firstDay.getDay(); // 0=Sun
  startDow = startDow === 0 ? 6 : startDow - 1; // Mon=0
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

const toDateKey = (year, month, day) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

// Statuts séance
const SESSION_STATUS = {
  DONE: { color: couleurs.succes, bg: couleurs.succesVoile, label: 'Terminée', icon: 'checkmark-circle' },
  DRAFT: { color: couleurs.alerte, bg: couleurs.alerteVoile, label: 'À faire', icon: 'time-outline' },
  EMPTY: { color: couleurs.texteFaible, bg: couleurs.eleve, label: 'Brouillon', icon: 'document-outline' },
};

const getStatus = (session) => {
  if (session.isRestDay) return { color: couleurs.accent, bg: couleurs.accentVoile, label: 'Repos', icon: 'bed-outline' };
  return SESSION_STATUS[session.status] || SESSION_STATUS.EMPTY;
};

// En-têtes de colonnes (lun→dim)
const DAY_HEADERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// -----------------------------------------------------------------------
// Modal d'ajout de séance (bottom sheet)
// -----------------------------------------------------------------------
const AddSessionModal = ({ visible, programId, initialDate, onClose, onCreated }) => {
  const [date, setDate] = useState(initialDate || format(new Date(), 'yyyy-MM-dd'));
  const [isRestDay, setIsRestDay] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setDate(initialDate || format(new Date(), 'yyyy-MM-dd'));
      setIsRestDay(false);
    }
  }, [visible, initialDate]);

  const handleCreate = async () => {
    if (!date) {
      Alert.alert('Erreur', 'La date est requise');
      return;
    }
    setLoading(true);
    try {
      const res = await sessionsAPI.upsert({
        programId,
        date,
        isRestDay,
        exercises: [],
      });
      if (res.data.success) {
        onCreated(res.data.data);
      }
    } catch (error) {
      const msg = error?.response?.data?.message || 'Erreur lors de la création';
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalDismissArea} onPress={onClose} activeOpacity={1} />
        <View style={styles.modalSheet}>
          {/* Handle bar */}
          <View style={styles.modalHandle} />

          <Text style={styles.modalTitle}>Ajouter une séance</Text>

          <DatePickerField
            label="Date de la séance"
            value={date}
            onChange={setDate}
            style={styles.formGroup}
          />

          <View style={styles.restDayRow}>
            <View>
              <Text style={styles.formLabel}>Jour de repos</Text>
              <Text style={styles.formHint}>Marquer cette journée comme repos</Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, isRestDay && styles.toggleActive]}
              onPress={() => setIsRestDay((v) => !v)}
            >
              <View style={[styles.toggleThumb, isRestDay && styles.toggleThumbActive]} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={couleurs.texteInverse} size="small" />
            ) : (
              <Text style={styles.submitBtnText}>
                {isRestDay ? 'Ajouter le repos' : 'Créer la séance'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// -----------------------------------------------------------------------
// Écran principal
// -----------------------------------------------------------------------
const CoachProgramCalendarScreen = ({ route, navigation }) => {
  const { programId, programTitle, clientName, clientId } = route.params;

  const [sessions, setSessions] = useState([]);
  const [program, setProgram] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalInitialDate, setModalInitialDate] = useState(null);

  // Mois affiché dans le calendrier
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  // Jour sélectionné (chaîne 'yyyy-MM-dd')
  const [selectedDate, setSelectedDate] = useState(null);

  // -----------------------------------------------------------------------
  // Chargement des données
  // -----------------------------------------------------------------------
  const fetchData = useCallback(async () => {
    try {
      const [sessionsRes, programRes] = await Promise.all([
        sessionsAPI.getByProgram(programId),
        programsAPI.getById(programId),
      ]);
      if (sessionsRes.data.success) {
        const sorted = (sessionsRes.data.data || []).sort((a, b) =>
          (a.date || '').localeCompare(b.date || '')
        );
        setSessions(sorted);
      }
      if (programRes.data.success) {
        const prog = programRes.data.data;
        setProgram(prog);

        // Initialiser sur le mois de startDate
        if (prog.startDate) {
          const start = parseISO(prog.startDate.slice(0, 10) + 'T12:00:00');
          setCalYear(start.getFullYear());
          setCalMonth(start.getMonth());
          setSelectedDate(prog.startDate.slice(0, 10));
        } else {
          const today = new Date();
          setSelectedDate(format(today, 'yyyy-MM-dd'));
        }
      } else {
        const today = new Date();
        setSelectedDate(format(today, 'yyyy-MM-dd'));
      }
    } catch (error) {
      console.error('Erreur chargement programme:', error);
      Alert.alert('Erreur', 'Impossible de charger le programme');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [programId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // -----------------------------------------------------------------------
  // Index des séances par date
  // -----------------------------------------------------------------------
  const sessionsByDate = useMemo(() => {
    const map = {};
    sessions.forEach((s) => {
      if (s.date) {
        const key = s.date.slice(0, 10);
        map[key] = s;
      }
    });
    return map;
  }, [sessions]);

  // -----------------------------------------------------------------------
  // Navigation calendrier
  // -----------------------------------------------------------------------
  const goToPrevMonth = () => {
    if (calMonth === 0) {
      setCalYear((y) => y - 1);
      setCalMonth(11);
    } else {
      setCalMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (calMonth === 11) {
      setCalYear((y) => y + 1);
      setCalMonth(0);
    } else {
      setCalMonth((m) => m + 1);
    }
  };

  // -----------------------------------------------------------------------
  // Calcul des cellules et lignes du calendrier
  // -----------------------------------------------------------------------
  const cells = useMemo(() => buildCells(calYear, calMonth), [calYear, calMonth]);

  const rows = useMemo(() => {
    const result = [];
    for (let i = 0; i < cells.length; i += 7) {
      result.push(cells.slice(i, i + 7));
    }
    return result;
  }, [cells]);

  // -----------------------------------------------------------------------
  // Libellé du mois
  // -----------------------------------------------------------------------
  const monthLabel = useMemo(() => {
    return format(new Date(calYear, calMonth, 1), 'MMMM yyyy', { locale: fr });
  }, [calYear, calMonth]);

  // -----------------------------------------------------------------------
  // Séance du jour sélectionné
  // -----------------------------------------------------------------------
  const selectedSession = selectedDate ? sessionsByDate[selectedDate] : null;

  // -----------------------------------------------------------------------
  // Suppression d'une séance
  // -----------------------------------------------------------------------
  const handleDeleteSession = (session) => {
    Alert.alert(
      'Supprimer cette séance ?',
      session.isRestDay ? 'Jour de repos' : (session.title || 'Séance sans titre'),
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await sessionsAPI.delete(session.id);
              setSessions((prev) => prev.filter((s) => s.id !== session.id));
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer cette séance');
            }
          },
        },
      ]
    );
  };

  // -----------------------------------------------------------------------
  // Après création d'une séance
  // -----------------------------------------------------------------------
  const handleSessionCreated = (newSession) => {
    setSessions((prev) => {
      const updated = [...prev, newSession].sort((a, b) =>
        (a.date || '').localeCompare(b.date || '')
      );
      return updated;
    });
    setShowAddModal(false);

    if (!newSession.isRestDay) {
      navigation.navigate('CoachSessionEditor', {
        sessionId: newSession.id,
        programId,
        clientName,
      });
    }
  };

  // -----------------------------------------------------------------------
  // Libellé date sélectionnée en français complet
  // -----------------------------------------------------------------------
  const selectedDateLabel = useMemo(() => {
    if (!selectedDate) return '';
    const d = parseISO(selectedDate + 'T12:00:00');
    return format(d, 'EEEE d MMMM yyyy', { locale: fr });
  }, [selectedDate]);

  // -----------------------------------------------------------------------
  // Libellé court pour le bouton "Ajouter"
  // -----------------------------------------------------------------------
  const selectedDateShortLabel = useMemo(() => {
    if (!selectedDate) return '';
    const d = parseISO(selectedDate + 'T12:00:00');
    return format(d, 'd MMMM', { locale: fr });
  }, [selectedDate]);

  // -----------------------------------------------------------------------
  // Rendu loading
  // -----------------------------------------------------------------------
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={couleurs.accent} />
      </View>
    );
  }

  // -----------------------------------------------------------------------
  // Rendu principal
  // -----------------------------------------------------------------------
  return (
    <View style={styles.container}>
      {/* ---- Header ---- */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={couleurs.texte} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {programTitle || 'Programme'}
          </Text>
          {clientName ? (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {clientName}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.templatesButton}
          onPress={() => navigation.navigate('CoachTemplates')}
        >
          <Ionicons name="copy-outline" size={20} color={couleurs.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[couleurs.accent]} />
        }
      >
        {/* ---- Barre d'infos programme ---- */}
        {program ? (
          <View style={styles.programInfo}>
            <View style={styles.programInfoItem}>
              <Ionicons name="calendar-outline" size={14} color={couleurs.texteFaible} />
              <Text style={styles.programInfoText}>
                {program.startDate
                  ? format(parseISO(program.startDate.slice(0, 10) + 'T12:00:00'), 'd MMM yyyy', { locale: fr })
                  : '—'}
                {program.endDate
                  ? ` → ${format(parseISO(program.endDate.slice(0, 10) + 'T12:00:00'), 'd MMM yyyy', { locale: fr })}`
                  : ''}
              </Text>
            </View>
            <View style={styles.programInfoItem}>
              <Ionicons name="fitness-outline" size={14} color={couleurs.texteFaible} />
              <Text style={styles.programInfoText}>
                {sessions.filter((s) => !s.isRestDay).length} séance
                {sessions.filter((s) => !s.isRestDay).length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        ) : null}

        {/* ---- Section calendrier ---- */}
        <View style={styles.calSection}>
          {/* Navigation mois */}
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={goToPrevMonth} style={styles.monthNavBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-back" size={20} color={couleurs.texteDoux} />
            </TouchableOpacity>
            <Text style={styles.monthNavLabel}>{monthLabel}</Text>
            <TouchableOpacity onPress={goToNextMonth} style={styles.monthNavBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-forward" size={20} color={couleurs.texteDoux} />
            </TouchableOpacity>
          </View>

          {/* En-têtes des jours */}
          <View style={styles.dayHeadersRow}>
            {DAY_HEADERS.map((h, idx) => (
              <View key={idx} style={styles.dayHeaderCell}>
                <Text style={[styles.dayHeaderText, idx >= 5 && styles.dayHeaderWeekend]}>
                  {h}
                </Text>
              </View>
            ))}
          </View>

          {/* Grille calendrier */}
          {rows.map((row, rowIdx) => (
            <View key={rowIdx} style={styles.calRow}>
              {row.map((day, colIdx) => {
                if (day === null) {
                  // Cellule vide
                  return <View key={colIdx} style={styles.dayCell} />;
                }

                const dateKey = toDateKey(calYear, calMonth, day);
                const session = sessionsByDate[dateKey];
                const todayFlag = isToday(parseISO(dateKey + 'T12:00:00'));
                const isSelected = selectedDate === dateKey;
                const isWeekend = colIdx >= 5;

                // Couleur du point de statut
                let dotColor = null;
                if (session) {
                  dotColor = getStatus(session).color;
                }

                return (
                  <TouchableOpacity
                    key={colIdx}
                    style={[
                      styles.dayCell,
                      isSelected && styles.dayCellSelected,
                    ]}
                    onPress={() => setSelectedDate(dateKey)}
                    activeOpacity={0.7}
                  >
                    {/* Anneau aujourd'hui */}
                    {todayFlag ? (
                      <View style={[styles.todayRing, { width: CELL_SIZE * 0.62, height: CELL_SIZE * 0.62, borderRadius: (CELL_SIZE * 0.62) / 2 }]}>
                        <Text style={[styles.dayNumber, styles.dayNumberToday, isWeekend && styles.dayNumberWeekend]}>
                          {day}
                        </Text>
                      </View>
                    ) : (
                      <Text style={[styles.dayNumber, isWeekend && styles.dayNumberWeekend]}>
                        {day}
                      </Text>
                    )}

                    {/* Point de statut */}
                    {dotColor ? (
                      <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          {/* Légende */}
          <View style={styles.legendRow}>
            {[
              { color: couleurs.succes, label: 'Terminée' },
              { color: couleurs.alerte, label: 'À faire' },
              { color: couleurs.texteFaible, label: 'Brouillon' },
              { color: couleurs.accent, label: 'Repos' },
            ].map((item) => (
              <View key={item.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={styles.legendLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ---- Panneau du jour sélectionné ---- */}
        {selectedDate ? (
          <View style={styles.selectedPanel}>
            <Text style={styles.selectedDateLabel}>{selectedDateLabel}</Text>

            {selectedSession ? (
              // Carte de séance existante
              <View style={styles.sessionCard}>
                {/* Barre de couleur */}
                <View style={[styles.sessionCardBar, { backgroundColor: getStatus(selectedSession).color }]} />

                <View style={styles.sessionCardBody}>
                  {/* Titre + badge */}
                  <View style={styles.sessionCardTopRow}>
                    <Text style={styles.sessionCardTitle} numberOfLines={1}>
                      {selectedSession.isRestDay
                        ? 'Jour de repos'
                        : selectedSession.title || 'Séance sans titre'}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatus(selectedSession).bg }]}>
                      <Ionicons
                        name={getStatus(selectedSession).icon}
                        size={12}
                        color={getStatus(selectedSession).color}
                      />
                      <Text style={[styles.statusBadgeText, { color: getStatus(selectedSession).color }]}>
                        {getStatus(selectedSession).label}
                      </Text>
                    </View>
                  </View>

                  {/* Nombre d'exercices */}
                  {!selectedSession.isRestDay ? (
                    <Text style={styles.sessionCardMeta}>
                      {(selectedSession.exercises?.length ?? 0) > 0
                        ? `${selectedSession.exercises.length} exercice${selectedSession.exercises.length > 1 ? 's' : ''}`
                        : 'Aucun exercice'}
                    </Text>
                  ) : null}

                  {/* Boutons d'action */}
                  <View style={styles.sessionCardActions}>
                    {!selectedSession.isRestDay ? (
                      <TouchableOpacity
                        style={styles.actionBtnPrimary}
                        onPress={() =>
                          navigation.navigate('CoachSessionEditor', {
                            sessionId: selectedSession.id,
                            programId,
                            clientName,
                          })
                        }
                      >
                        <Ionicons name="pencil-outline" size={14} color={couleurs.texteInverse} />
                        <Text style={styles.actionBtnPrimaryText}>Modifier</Text>
                      </TouchableOpacity>
                    ) : null}

                    <TouchableOpacity
                      style={styles.actionBtnDelete}
                      onPress={() => handleDeleteSession(selectedSession)}
                    >
                      <Ionicons name="trash-outline" size={16} color={couleurs.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : (
              // Aucune séance ce jour → bouton d'ajout
              <TouchableOpacity
                style={styles.emptyDayBtn}
                onPress={() => {
                  setModalInitialDate(selectedDate);
                  setShowAddModal(true);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.emptyDayIconWrapper}>
                  <Ionicons name="add" size={20} color={couleurs.accent} />
                </View>
                <Text style={styles.emptyDayText}>
                  Ajouter une séance le {selectedDateShortLabel}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {/* Spacer pour le FAB */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ---- FAB ---- */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setModalInitialDate(selectedDate);
          setShowAddModal(true);
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color={couleurs.texteInverse} />
      </TouchableOpacity>

      {/* ---- Modal ajout séance ---- */}
      <AddSessionModal
        visible={showAddModal}
        programId={programId}
        initialDate={modalInitialDate}
        onClose={() => setShowAddModal(false)}
        onCreated={handleSessionCreated}
      />
    </View>
  );
};

// -----------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------
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
  scrollView: {
    flex: 1,
  },

  // ---- Header ----
  header: {
    backgroundColor: couleurs.carte,
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: couleurs.texte,
  },
  headerSubtitle: {
    fontSize: 12,
    color: couleurs.texteFaible,
    marginTop: 1,
  },
  templatesButton: {
    padding: 8,
  },

  // ---- Barre infos programme ----
  programInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: couleurs.carte,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  programInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  programInfoText: {
    fontSize: 12,
    color: couleurs.texteFaible,
  },

  // ---- Section calendrier ----
  calSection: {
    backgroundColor: couleurs.carte,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 12,
    marginTop: 12,
    shadowColor: couleurs.ombre,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },

  // Navigation mois
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  monthNavBtn: {
    padding: 4,
  },
  monthNavLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: couleurs.texte,
    textTransform: 'capitalize',
  },

  // En-têtes des jours
  dayHeadersRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayHeaderCell: {
    width: CELL_SIZE,
    alignItems: 'center',
    paddingBottom: 6,
  },
  dayHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: couleurs.texteFaible,
  },
  dayHeaderWeekend: {
    color: couleurs.violetDoux,
  },

  // Grille
  calRow: {
    flexDirection: 'row',
  },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  dayCellSelected: {
    backgroundColor: couleurs.accentVoile,
    borderRadius: 8,
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: couleurs.texte,
  },
  dayNumberWeekend: {
    color: couleurs.texteFaible,
  },
  dayNumberToday: {
    color: couleurs.accent,
    fontWeight: '700',
  },
  todayRing: {
    borderWidth: 2,
    borderColor: couleurs.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    position: 'absolute',
    bottom: 4,
  },

  // Légende
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: couleurs.bord,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 11,
    color: couleurs.texteFaible,
  },

  // ---- Panneau jour sélectionné ----
  selectedPanel: {
    backgroundColor: couleurs.carte,
    borderRadius: 14,
    margin: 12,
    padding: 16,
    shadowColor: couleurs.ombre,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  selectedDateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: couleurs.texteDoux,
    textTransform: 'capitalize',
    marginBottom: 12,
  },

  // Carte de séance dans le panel
  sessionCard: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: couleurs.bord,
  },
  sessionCardBar: {
    width: 4,
  },
  sessionCardBody: {
    flex: 1,
    padding: 12,
  },
  sessionCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sessionCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: couleurs.texte,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sessionCardMeta: {
    fontSize: 12,
    color: couleurs.texteFaible,
    marginBottom: 10,
  },
  sessionCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: couleurs.accent,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  actionBtnPrimaryText: {
    color: couleurs.texteInverse,
    fontSize: 13,
    fontWeight: '600',
  },
  actionBtnDelete: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: couleurs.dangerVoile,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Bouton ajout jour vide
  emptyDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: couleurs.accentVoileFort,
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  emptyDayIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: couleurs.accentVoile,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyDayText: {
    fontSize: 14,
    color: couleurs.accent,
    fontWeight: '500',
  },

  // ---- FAB ----
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: couleurs.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: couleurs.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },

  // ---- Modal bottom sheet ----
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalDismissArea: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: couleurs.carte,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: couleurs.eleve,
    alignSelf: 'center',
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: couleurs.texte,
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: couleurs.texteDoux,
    marginBottom: 2,
  },
  formHint: {
    fontSize: 11,
    color: couleurs.texteFaible,
    marginTop: 2,
  },
  restDayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: couleurs.eleve,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleActive: {
    backgroundColor: couleurs.accentVoileFort,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: couleurs.eleve,
  },
  toggleThumbActive: {
    backgroundColor: couleurs.accent,
    transform: [{ translateX: 18 }],
  },
  submitBtn: {
    backgroundColor: couleurs.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: couleurs.texteInverse,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default CoachProgramCalendarScreen;
