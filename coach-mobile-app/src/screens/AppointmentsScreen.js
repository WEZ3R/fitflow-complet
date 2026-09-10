import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { appointmentsAPI } from '../services/api';
import { format, parseISO, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import { couleurs } from '../theme';

const STATUS_LABELS = {
  PROPOSED: 'En attente',
  CONFIRMED: 'Confirmé',
  CANCELLED: 'Annulé',
};

const STATUS_COLORS = {
  PROPOSED: couleurs.alerte,
  CONFIRMED: couleurs.succes,
  CANCELLED: couleurs.texteFaible,
};

const AppointmentsScreen = ({ navigation, onGoToDashboard }) => {
  const { user } = useAuth();
  const isCoach = user?.role === 'COACH';

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [markedDates, setMarkedDates] = useState({});
  const [actionLoading, setActionLoading] = useState(null);

  // Formulaire création (coach uniquement)
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    startTime: '10:00',
    durationMinutes: '60',
    locationType: 'PHYSICAL',
    locationDetail: '',
  });

  const fetchAppointments = useCallback(async () => {
    try {
      const res = await appointmentsAPI.getAll();
      const data = res.data.data || [];
      setAppointments(data);

      // Construire les markedDates pour le calendrier (markingType custom)
      const marks = {};
      const SESSION_BORDER = {
        borderWidth: 1.5,
        borderColor: couleurs.succes,
        borderRadius: 8,
      };

      data.forEach((appt) => {
        if (appt.status === 'CANCELLED') return;
        const dateKey = format(parseISO(appt.startAt), 'yyyy-MM-dd');
        if (!marks[dateKey]) {
          marks[dateKey] = {
            customStyles: {
              container: { ...SESSION_BORDER },
              text: { color: couleurs.texte, fontWeight: '600' },
            },
          };
        }
      });

      // Ajouter la sélection du jour (override visuel)
      const selectedStyles = {
        container: {
          backgroundColor: couleurs.accent,
          borderRadius: 8,
          // Si jour avec séance : on conserve l'anneau vert autour
          ...(marks[selectedDate] ? { borderWidth: 1.5, borderColor: couleurs.succes } : {}),
        },
        text: { color: couleurs.texteInverse, fontWeight: '700' },
      };
      marks[selectedDate] = { ...(marks[selectedDate] || {}), customStyles: selectedStyles };

      setMarkedDates(marks);
    } catch (error) {
      console.error('Erreur chargement RDV:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const onDayPress = (day) => {
    setSelectedDate(day.dateString);
    setMarkedDates((prev) => {
      const updated = { ...prev };
      const SESSION_BORDER = {
        borderWidth: 1.5,
        borderColor: couleurs.succes,
        borderRadius: 8,
      };

      // Restaurer l'ancien jour sélectionné (en gardant le contour vert s'il y a une séance)
      Object.keys(updated).forEach((k) => {
        const cur = updated[k];
        if (cur?.customStyles?.container?.backgroundColor === couleurs.accent) {
          // Ce jour était sélectionné → on retire le bg, on remet le contour vert si séance
          const hadSession = cur.customStyles.container.borderColor === couleurs.succes;
          updated[k] = hadSession
            ? {
                customStyles: {
                  container: { ...SESSION_BORDER },
                  text: { color: couleurs.texte, fontWeight: '600' },
                },
              }
            : {};
          if (!hadSession) delete updated[k];
        }
      });

      // Appliquer la nouvelle sélection
      const wasSession =
        prev[day.dateString]?.customStyles?.container?.borderColor === couleurs.succes;
      updated[day.dateString] = {
        customStyles: {
          container: {
            backgroundColor: couleurs.accent,
            borderRadius: 8,
            ...(wasSession ? { borderWidth: 1.5, borderColor: couleurs.succes } : {}),
          },
          text: { color: couleurs.texteInverse, fontWeight: '700' },
        },
      };
      return updated;
    });
  };

  const appointmentsOnSelectedDay = appointments.filter((appt) => {
    try {
      return isSameDay(parseISO(appt.startAt), parseISO(selectedDate));
    } catch {
      return false;
    }
  }).sort((a, b) => new Date(a.startAt) - new Date(b.startAt));

  const handleConfirm = async (appt) => {
    setActionLoading(appt.id);
    try {
      await appointmentsAPI.confirm(appt.id);
      await fetchAppointments();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Erreur lors de la confirmation.';
      Alert.alert('Erreur', msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (appt) => {
    Alert.alert(
      'Annuler le RDV',
      `Annuler « ${appt.title} » ?${!isCoach ? '\n\nVotre coach sera notifié.' : ''}`,
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Annuler le RDV',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(appt.id);
            try {
              await appointmentsAPI.cancel(appt.id, 'single');
              await fetchAppointments();
            } catch (err) {
              const msg = err?.response?.data?.message || "Erreur lors de l'annulation.";
              Alert.alert('Erreur', msg);
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleCreateAppointment = async () => {
    if (!form.title.trim()) {
      Alert.alert('Erreur', 'Le titre est requis.');
      return;
    }
    setFormLoading(true);
    try {
      const startAt = new Date(`${form.startDate}T${form.startTime}:00`).toISOString();
      await appointmentsAPI.create({
        title: form.title.trim(),
        startAt,
        durationMinutes: parseInt(form.durationMinutes) || 60,
        locationType: form.locationType,
        ...(form.locationDetail ? { locationDetail: form.locationDetail } : {}),
      });
      setShowForm(false);
      setForm({ title: '', startDate: format(new Date(), 'yyyy-MM-dd'), startTime: '10:00', durationMinutes: '60', locationType: 'PHYSICAL', locationDetail: '' });
      await fetchAppointments();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Erreur lors de la création.';
      Alert.alert('Erreur', msg);
    } finally {
      setFormLoading(false);
    }
  };

  const renderAppointment = ({ item }) => {
    const statusColor = STATUS_COLORS[item.status] || couleurs.texteFaible;
    const statusLabel = STATUS_LABELS[item.status] || item.status;
    const isLoading = actionLoading === item.id;
    const isFuture = new Date(item.startAt) > new Date();

    const handleOpenSession = () => {
      if (!onGoToDashboard) return;
      onGoToDashboard(format(parseISO(item.startAt), 'yyyy-MM-dd'));
    };

    return (
      <TouchableOpacity
        style={[styles.apptCard, item.status === 'CANCELLED' && styles.apptCardCancelled]}
        onPress={handleOpenSession}
        activeOpacity={0.7}
      >
        {/* Barre de couleur statut */}
        <View style={[styles.statusBar, { backgroundColor: statusColor }]} />

        <View style={styles.apptContent}>
          <View style={styles.apptHeader}>
            <Text style={styles.apptTitle} numberOfLines={1}>{item.title}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>

          <Text style={styles.apptTime}>
            {format(parseISO(item.startAt), 'HH:mm', { locale: fr })} · {item.durationMinutes} min
          </Text>

          <View style={styles.apptMeta}>
            <Ionicons
              name={item.locationType === 'PHYSICAL' ? 'location-outline' : 'videocam-outline'}
              size={13}
              color={couleurs.texteDoux}
            />
            <Text style={styles.apptMetaText}>
              {item.locationType === 'PHYSICAL' ? 'Présentiel' : 'Distanciel'}
              {item.locationDetail ? ` · ${item.locationDetail}` : ''}
            </Text>
          </View>

          {/* Coach ou client selon le rôle */}
          {isCoach && item.client && (
            <View style={styles.apptMeta}>
              <Ionicons name="person-outline" size={13} color={couleurs.accent} />
              <Text style={[styles.apptMetaText, { color: couleurs.accent }]}>
                {item.client.user.firstName} {item.client.user.lastName}
              </Text>
            </View>
          )}
          {!isCoach && item.coach && (
            <View style={styles.apptMeta}>
              <Ionicons name="person-outline" size={13} color={couleurs.accent} />
              <Text style={[styles.apptMetaText, { color: couleurs.accent }]}>
                Coach : {item.coach.user.firstName} {item.coach.user.lastName}
              </Text>
            </View>
          )}

          {/* Actions */}
          {item.status !== 'CANCELLED' && isFuture && (
            <View style={styles.apptActions}>
              {!isCoach && item.status === 'PROPOSED' && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.confirmBtn]}
                  onPress={() => handleConfirm(item)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={couleurs.succes} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={15} color={couleurs.succes} />
                      <Text style={[styles.actionBtnText, { color: couleurs.succes }]}>Confirmer</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.actionBtn, styles.cancelBtn]}
                onPress={() => handleCancel(item)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={couleurs.danger} />
                ) : (
                  <>
                    <Ionicons name="close-circle-outline" size={15} color={couleurs.danger} />
                    <Text style={[styles.actionBtnText, { color: couleurs.danger }]}>Annuler</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
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
        <View>
          <Text style={styles.headerTitle}>Agenda</Text>
          <Text style={styles.headerSubtitle}>Vos rendez-vous</Text>
        </View>
        {isCoach && (
          <TouchableOpacity style={styles.addButton} onPress={() => setShowForm(true)}>
            <Ionicons name="add" size={22} color={couleurs.texteInverse} />
          </TouchableOpacity>
        )}
      </View>

      {/* Calendrier */}
      <Calendar
        current={selectedDate}
        onDayPress={onDayPress}
        markedDates={markedDates}
        markingType="custom"
        theme={{
          selectedDayBackgroundColor: couleurs.accent,
          todayTextColor: couleurs.accent,
          arrowColor: couleurs.accent,
          dotColor: couleurs.accent,
          monthTextColor: couleurs.texte,
          // react-native-calendars ne dérive rien du fond : sans ces quatre clés, les
          // numéros de jour et les initiales des jours de semaine restent sombres, donc
          // invisibles sur la carte.
          dayTextColor: couleurs.texte,
          textSectionTitleColor: couleurs.texteFaible,
          textDisabledColor: couleurs.texteFaible,
          selectedDayTextColor: couleurs.accentEncre,
          textMonthFontWeight: '600',
          textDayFontSize: 14,
          textDayFontWeight: '700',
          calendarBackground: couleurs.carte,
          'stylesheet.day.basic': {
            selected: {
              backgroundColor: couleurs.accent,
              borderRadius: 8,
            },
            today: {
              borderRadius: 8,
            },
          },
        }}
        style={styles.calendar}
      />

      {/* Liste du jour sélectionné */}
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderText}>
          {format(parseISO(selectedDate), 'EEEE d MMMM', { locale: fr })}
        </Text>
        <Text style={styles.listHeaderCount}>
          {appointmentsOnSelectedDay.length} RDV
        </Text>
      </View>

      <FlatList
        data={appointmentsOnSelectedDay}
        keyExtractor={(item) => item.id}
        renderItem={renderAppointment}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAppointments(); }} colors={[couleurs.accent]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={48} color={couleurs.texteFaible} />
            <Text style={styles.emptyText}>Aucun RDV ce jour</Text>
            {isCoach && (
              <TouchableOpacity style={styles.emptyButton} onPress={() => setShowForm(true)}>
                <Text style={styles.emptyButtonText}>Créer un RDV</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Modal création (coach) */}
      {isCoach && (
        <Modal visible={showForm} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Nouveau rendez-vous</Text>
                  <TouchableOpacity onPress={() => setShowForm(false)}>
                    <Ionicons name="close" size={24} color={couleurs.texte} />
                  </TouchableOpacity>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Titre *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={form.title}
                    onChangeText={(t) => setForm({ ...form, title: t })}
                    placeholder="Ex: Séance bilan..."
                    placeholderTextColor={couleurs.texteFaible}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Date</Text>
                  <TextInput
                    style={styles.formInput}
                    value={form.startDate}
                    onChangeText={(t) => setForm({ ...form, startDate: t })}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={couleurs.texteFaible}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Heure (HH:MM)</Text>
                  <TextInput
                    style={styles.formInput}
                    value={form.startTime}
                    onChangeText={(t) => setForm({ ...form, startTime: t })}
                    placeholder="10:00"
                    placeholderTextColor={couleurs.texteFaible}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Durée (minutes)</Text>
                  <TextInput
                    style={styles.formInput}
                    value={form.durationMinutes}
                    onChangeText={(t) => setForm({ ...form, durationMinutes: t })}
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
                        style={[styles.radioBtn, form.locationType === val && styles.radioBtnActive]}
                        onPress={() => setForm({ ...form, locationType: val })}
                      >
                        <Ionicons name={icon} size={16} color={form.locationType === val ? couleurs.texteInverse : couleurs.texteDoux} />
                        <Text style={[styles.radioBtnText, form.locationType === val && styles.radioBtnTextActive]}>{lbl}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    {form.locationType === 'PHYSICAL' ? 'Adresse' : 'Lien visio'}
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    value={form.locationDetail}
                    onChangeText={(t) => setForm({ ...form, locationDetail: t })}
                    placeholder={form.locationType === 'PHYSICAL' ? 'Ex: 12 rue du sport...' : 'https://meet.google.com/...'}
                    placeholderTextColor={couleurs.texteFaible}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, formLoading && styles.submitBtnDisabled]}
                  onPress={handleCreateAppointment}
                  disabled={formLoading}
                >
                  {formLoading ? (
                    <ActivityIndicator color={couleurs.texteInverse} size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>Créer le rendez-vous</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
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
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: couleurs.texte,
  },
  headerSubtitle: {
    fontSize: 13,
    color: couleurs.texteDoux,
    marginTop: 2,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: couleurs.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendar: {
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: couleurs.fond,
  },
  listHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: couleurs.texte,
    textTransform: 'capitalize',
  },
  listHeaderCount: {
    fontSize: 12,
    color: couleurs.texteDoux,
  },
  listContent: {
    padding: 12,
    paddingBottom: 32,
  },
  apptCard: {
    backgroundColor: couleurs.carte,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: couleurs.ombre,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  apptCardCancelled: {
    opacity: 0.6,
  },
  statusBar: {
    width: 4,
  },
  apptContent: {
    flex: 1,
    padding: 12,
  },
  apptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  apptTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: couleurs.texte,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  apptTime: {
    fontSize: 13,
    color: couleurs.texteDoux,
    marginBottom: 4,
  },
  apptMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  apptMetaText: {
    fontSize: 12,
    color: couleurs.texteDoux,
    flex: 1,
  },
  apptActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: couleurs.bord,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  confirmBtn: {
    borderColor: couleurs.succes,
    backgroundColor: couleurs.succesVoile,
  },
  cancelBtn: {
    borderColor: couleurs.danger,
    backgroundColor: couleurs.dangerVoile,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 15,
    color: couleurs.texteFaible,
    marginTop: 12,
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: couleurs.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: couleurs.texteInverse,
    fontWeight: '600',
    fontSize: 14,
  },
  // Modal formulaire
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
    paddingVertical: 10,
    fontSize: 14,
    color: couleurs.texte,
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
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: couleurs.bord,
    backgroundColor: couleurs.fond,
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
    marginBottom: Platform.OS === 'ios' ? 24 : 8,
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

export default AppointmentsScreen;
