import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { programsAPI, statsAPI, mealsAPI, authAPI, onboardingAPI } from '../services/api';
import { addDays, format, isToday, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import Avatar from '../components/Avatar';
import NotificationsBell from '../components/NotificationsBell';
import FoodSearch from '../components/FoodSearch';
import { couleurs } from '../theme';

const MEAL_TYPES = [
  { key: 'breakfast', label: 'Petit-déjeuner', icon: 'sunny-outline', color: couleurs.accent },
  { key: 'lunch', label: 'Déjeuner', icon: 'restaurant-outline', color: couleurs.accent },
  { key: 'dinner', label: 'Dîner', icon: 'moon-outline', color: couleurs.accent },
  { key: 'snack', label: 'Collation', icon: 'cafe-outline', color: couleurs.accent },
];

const DashboardScreen = ({ navigation, onGoToProfile, onGoToAppointments, targetDate, onTargetDateConsumed }) => {
  const { user } = useAuth();
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Stats state
  const [selectedDate, setSelectedDate] = useState(new Date());
  const date = format(selectedDate, 'yyyy-MM-dd');

  // Date envoyée par l'Agenda quand on clique sur une séance — applique puis "consomme"
  useEffect(() => {
    if (!targetDate) return;
    try {
      const parsed = typeof targetDate === 'string' ? parseISO(targetDate) : targetDate;
      if (!Number.isNaN(parsed?.getTime())) setSelectedDate(parsed);
    } catch {
      // silencieux
    }
    onTargetDateConsumed?.();
  }, [targetDate, onTargetDateConsumed]);

  // 'repos' | 'enregistrement' | 'enregistre' | 'erreur'
  const [etatEnregistrement, setEtatEnregistrement] = useState('repos');
  /**
   * Vrai quand le formulaire vient d'être peuplé depuis le serveur. Sans ce garde-fou,
   * l'enregistrement automatique se déclencherait à chaque chargement et à chaque
   * changement de date, réécrivant les données avec ce qu'il vient de lire.
   */
  const vientDuServeur = useRef(true);
  const minuterieRef = useRef(null);
  const [clientId, setClientId] = useState(null);
  const [pickerActive, setPickerActive] = useState(null); // 'wakeTime' | 'bedTime' | null
  const [yesterdayBedTime, setYesterdayBedTime] = useState(null); // 'HH:mm' ou null
  const [formData, setFormData] = useState({
    water: '',
    sleep: '',
    bedTime: '',
    wakeTime: '',
    weight: '',
    workoutTime: '',
    workoutDuration: '',
    notes: '',
  });

  // Repas
  const [meals, setMeals] = useState([]);
  const [activeMealType, setActiveMealType] = useState('breakfast');

  // Coachs recommandés
  const [recommendedCoaches, setRecommendedCoaches] = useState([]);

  // Frise de dates
  const daysArray = useMemo(() => {
    const days = [];
    for (let i = -2; i <= 2; i++) {
      days.push(addDays(selectedDate, i));
    }
    return days;
  }, [selectedDate]);

  const handlePreviousDay = () => setSelectedDate((d) => addDays(d, -1));
  const handleNextDay = () => setSelectedDate((d) => addDays(d, 1));
  const handleDateSelect = (d) => setSelectedDate(d);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (clientId) {
      loadStats();
      loadMeals();
    }
  }, [date, clientId]);

  const loadInitialData = async () => {
    try {
      // Charger programmes + clientId en parallèle
      const [programsRes, meRes] = await Promise.all([
        programsAPI.getClientPrograms(),
        authAPI.getMe(),
      ]);
      setPrograms(programsRes.data.data || []);

      const userData = meRes.data.data;
      if (userData.clientProfile) {
        setClientId(userData.clientProfile.id);
        // Charger les coachs recommandés si pas encore de coach assigné
        const hasCoach = (userData.clientProfile.coaches?.length ?? 0) > 0;
        if (!hasCoach) {
          try {
            const recRes = await onboardingAPI.getRecommendedCoaches();
            setRecommendedCoaches(recRes.data.data?.slice(0, 5) || []);
          } catch {
            // Silencieux si pas de recommandations
          }
        }
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      setPrograms([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadInitialData();
    if (clientId) {
      loadStats();
      loadMeals();
    }
  }, [clientId, date]);

  /** Peuple le formulaire depuis le serveur sans déclencher d'enregistrement. */
  const hydrater = (valeurs) => {
    vientDuServeur.current = true;
    setFormData(valeurs);
  };

  const loadStats = async () => {
    try {
      const response = await statsAPI.getByDate(clientId, date);
      const stats = response.data.data;
      if (stats) {
        hydrater({
          water: stats.waterIntake?.toString() || '',
          sleep: stats.sleepHours?.toString() || '',
          bedTime: stats.bedTime ? new Date(stats.bedTime).toTimeString().slice(0, 5) : '',
          wakeTime: stats.wakeTime ? new Date(stats.wakeTime).toTimeString().slice(0, 5) : '',
          weight: stats.weight?.toString() || '',
          workoutTime: stats.workoutTime ? new Date(stats.workoutTime).toTimeString().slice(0, 5) : '',
          workoutDuration: stats.workoutDuration?.toString() || '',
          notes: stats.notes || '',
        });
      } else {
        hydrater({
          water: '', sleep: '', bedTime: '', wakeTime: '',
          weight: '', workoutTime: '', workoutDuration: '', notes: '',
        });
      }
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error('Error loading stats:', error);
      }
      hydrater({
        water: '', sleep: '', bedTime: '', wakeTime: '',
        weight: '', workoutTime: '', workoutDuration: '', notes: '',
      });
    }

    // Fetch du bedTime d'hier pour calculer la durée de sommeil
    try {
      const yesterday = format(addDays(selectedDate, -1), 'yyyy-MM-dd');
      const yRes = await statsAPI.getByDate(clientId, yesterday);
      const yBedTime = yRes.data.data?.bedTime;
      setYesterdayBedTime(yBedTime ? new Date(yBedTime).toTimeString().slice(0, 5) : null);
    } catch {
      setYesterdayBedTime(null);
    }
  };

  const loadMeals = async () => {
    try {
      const response = await mealsAPI.getClientMeals(clientId, { startDate: date, endDate: date });
      const existingMeals = (response.data.data || []).map((m) => ({
        id: m.id,
        mealType: m.mealType,
        description: m.description,
        calories: String(m.calories || 0),
        protein: String(m.protein || 0),
        carbs: String(m.carbs || 0),
        fats: String(m.fats || 0),
        saved: true,
      }));
      setMeals(existingMeals);
    } catch (error) {
      console.error('Error loading meals:', error);
      setMeals([]);
    }
  };

  // Sommeil = bedTime d'hier soir → wakeTime ce matin
  const calculateSleepHours = () => {
    if (yesterdayBedTime && formData.wakeTime) {
      const bed = new Date(`2000-01-01T${yesterdayBedTime}`);
      const wake = new Date(`2000-01-02T${formData.wakeTime}`);
      const diff = (wake - bed) / (1000 * 60 * 60);
      return diff > 0 && diff < 24 ? diff : null;
    }
    return null;
  };

  const getPickerDate = (timeStr) => {
    const d = new Date();
    if (timeStr) {
      const [h, m] = timeStr.split(':').map(Number);
      d.setHours(h, m, 0, 0);
    }
    return d;
  };

  const onPickerChange = (event, selected) => {
    if (Platform.OS === 'android') setPickerActive(null);
    if (selected && pickerActive) {
      updateField(pickerActive, format(selected, 'HH:mm'));
    }
  };

  const handleFoodSelect = async (food) => {
    const provisoire = {
      id: Date.now(),
      mealType: activeMealType,
      description: food.description,
      calories: String(food.calories),
      protein: String(food.protein),
      carbs: String(food.carbs),
      fats: String(food.fats),
      saved: false,
    };
    // Affiché d'abord, enregistré ensuite : la liste ne doit pas attendre le réseau.
    setMeals((prev) => [...prev, provisoire]);

    if (!clientId) return;
    setEtatEnregistrement('enregistrement');
    try {
      const reponse = await mealsAPI.create({
        clientId,
        date,
        mealType: provisoire.mealType,
        description: provisoire.description,
        calories: provisoire.calories,
        protein: provisoire.protein,
        carbs: provisoire.carbs,
        fats: provisoire.fats,
      });
      // On remplace l'entrée provisoire par celle du serveur, qui porte le véritable
      // identifiant — sans quoi la suppression ne saurait pas quoi effacer.
      const enregistre = reponse?.data?.data;
      setMeals((prev) => prev.map((m) => (
        m.id === provisoire.id
          ? { ...m, id: enregistre?.id ?? m.id, saved: true }
          : m
      )));
      setEtatEnregistrement('enregistre');
    } catch (error) {
      console.error('Error saving meal:', error);
      setEtatEnregistrement('erreur');
    }
  };

  const removeMeal = async (meal) => {
    if (meal.saved) {
      try {
        await mealsAPI.delete(meal.id);
      } catch (error) {
        console.error('Error deleting meal:', error);
        Alert.alert('Erreur', 'Impossible de supprimer cet aliment');
        return;
      }
    }
    setMeals((prev) => prev.filter((m) => m.id !== meal.id));
  };

  /**
   * Enregistre le suivi du jour. Appelé automatiquement après une pause de saisie,
   * plus par aucun bouton : une donnée saisie est une donnée conservée.
   */
  const enregistrerStats = async () => {
    if (!clientId) return;

    setEtatEnregistrement('enregistrement');
    try {
      const sleepHours = calculateSleepHours();

      await statsAPI.upsert({
        clientId,
        date,
        sleepHours,
        bedTime: formData.bedTime ? new Date(`${date}T${formData.bedTime}`) : null,
        wakeTime: formData.wakeTime ? new Date(`${date}T${formData.wakeTime}`) : null,
        waterIntake: formData.water ? parseFloat(formData.water) : null,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        workoutTime: formData.workoutTime ? new Date(`${date}T${formData.workoutTime}`) : null,
        workoutDuration: formData.workoutDuration ? parseInt(formData.workoutDuration) : null,
        notes: formData.notes || null,
      });

      setEtatEnregistrement('enregistre');
    } catch (error) {
      console.error('Error saving data:', error);
      setEtatEnregistrement('erreur');
    }
  };

  /**
   * Enregistrement automatique du suivi, après 900 ms sans frappe.
   *
   * Le délai n'est pas une optimisation de confort : sans lui, chaque caractère saisi
   * dans le champ de notes partirait en requête, et deux réponses arrivées dans le
   * désordre écraseraient la plus récente.
   */
  useEffect(() => {
    if (vientDuServeur.current) {
      vientDuServeur.current = false;
      return;
    }
    if (!clientId) return;

    if (minuterieRef.current) clearTimeout(minuterieRef.current);
    minuterieRef.current = setTimeout(enregistrerStats, 900);
    return () => {
      if (minuterieRef.current) clearTimeout(minuterieRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, clientId, date]);

  const updateField = (field, value) => {
    // Forme fonctionnelle : deux frappes rapprochées liraient sinon le même état
    // périmé, et la première serait perdue.
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Helpers programme
  // Si plusieurs programmes actifs, prendre le plus récent (createdAt desc)
  const getActiveProgram = () =>
    programs
      .filter(p => p.isActive)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;

  // Retourne la session pour la date sélectionnée dans la frise (heure locale)
  const getSessionForDate = (dateStr) => {
    const activeProgram = getActiveProgram();
    if (!activeProgram) return null;
    return (activeProgram?.sessions || []).find(s =>
      format(new Date(s.date), 'yyyy-MM-dd') === dateStr
    ) || null;
  };

  const getUpcomingSessions = () => {
    const activeProgram = getActiveProgram();
    if (!activeProgram) return [];
    return (activeProgram?.sessions || [])
      .filter(s => format(new Date(s.date), 'yyyy-MM-dd') > date)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 3);
  };

  const formatSessionDate = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  const getStatusColor = (session) => {
    if (session.completedByClient) return couleurs.succes;
    if (session.status === 'DRAFT') return couleurs.accent;
    return couleurs.texteFaible;
  };

  const getStatusText = (session) => {
    if (session.completedByClient) return 'Terminée';
    if (session.status === 'DRAFT') return 'À faire';
    return 'Non commencée';
  };

  // Totaux nutrition
  const totalCalories = meals.reduce((s, m) => s + parseInt(m.calories || '0'), 0);
  const totalProtein = meals.reduce((s, m) => s + parseFloat(m.protein || '0'), 0);
  const totalCarbs = meals.reduce((s, m) => s + parseFloat(m.carbs || '0'), 0);
  const totalFats = meals.reduce((s, m) => s + parseFloat(m.fats || '0'), 0);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={couleurs.accent} />
      </View>
    );
  }

  const activeProgram = getActiveProgram();
  const selectedDateSession = getSessionForDate(date);
  const upcomingSessions = getUpcomingSessions();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.brandRow}>
            {/* Variante claire du logo : l'original est noir sur blanc, invisible ici. */}
            <Image
              source={require('../../assets/logo-lime.png')}
              style={styles.brandLogo}
              resizeMode="contain"
            />
            <Text style={styles.brandName}>FitFlow</Text>
          </View>
          <View style={styles.headerActions}>
            <NotificationsBell
              size={40}
              onNotificationPress={(notif) => {
                const isAppt = ['APPOINTMENT_REMINDER', 'APPOINTMENT_CANCELLED', 'APPOINTMENT_MODIFIED']
                  .includes(notif.type);
                if (isAppt && onGoToAppointments) {
                  onGoToAppointments();
                }
              }}
            />
            <Avatar
              user={user}
              size={44}
              onPress={onGoToProfile}
            />
          </View>
        </View>

        {/* Frise de dates */}
        <View style={styles.dateStrip}>
          <TouchableOpacity onPress={handlePreviousDay} style={styles.dateArrow}>
            <Ionicons name="chevron-back" size={22} color={couleurs.texteDoux} />
          </TouchableOpacity>

          <View style={styles.daysRow}>
            {daysArray.map((d, index) => {
              const isSelected = index === 2;
              const isTodayDate = isToday(d);

              return (
                <TouchableOpacity
                  key={d.toISOString()}
                  onPress={() => handleDateSelect(d)}
                  style={[
                    styles.dayButton,
                    isSelected && styles.dayButtonSelected,
                  ]}
                >
                  <Text style={[styles.dayName, isSelected && styles.dayNameSelected]}>
                    {format(d, 'EEE', { locale: fr })}
                  </Text>
                  <Text style={[styles.dayNumber, isSelected && styles.dayNumberSelected]}>
                    {format(d, 'd')}
                  </Text>
                  <Text style={[styles.dayMonth, isSelected && styles.dayMonthSelected]}>
                    {format(d, 'MMM', { locale: fr })}
                  </Text>
                  {isTodayDate && !isSelected && (
                    <View style={styles.todayDot} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity onPress={handleNextDay} style={styles.dateArrow}>
            <Ionicons name="chevron-forward" size={22} color={couleurs.texteDoux} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* Coachs recommandés — visible si pas de programme */}
        {!activeProgram && recommendedCoaches.length > 0 && (
          <View style={styles.recommendedSection}>
            <Text style={styles.recommendedTitle}>Coachs recommandés pour vous</Text>
            {recommendedCoaches.map((coach) => (
              <TouchableOpacity
                key={coach.id}
                style={styles.recommendedCard}
                onPress={() => navigation.navigate('CoachDetail', { coachId: coach.id })}
              >
                <View style={styles.recommendedInfo}>
                  <Text style={styles.recommendedName}>
                    {coach.user?.firstName} {coach.user?.lastName}
                  </Text>
                  {coach.city && <Text style={styles.recommendedCity}>{coach.city}</Text>}
                  {coach.specialties?.length > 0 && (
                    <Text style={styles.recommendedSpecialties} numberOfLines={1}>
                      {coach.specialties.slice(0, 3).join(' · ')}
                    </Text>
                  )}
                </View>
                {coach.matchDetails?.specialtyMatch && (
                  <View style={styles.matchBadge}>
                    <Text style={styles.matchBadgeTxt}>✓ Objectif</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={18} color={couleurs.texteFaible} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Séance du jour sélectionné — affiché EN PREMIER */}
        {!activeProgram ? (
          <View style={styles.emptyState}>
            <Ionicons name="fitness-outline" size={64} color={couleurs.texteFaible} />
            <Text style={styles.emptyText}>Aucun programme actif</Text>
            <Text style={styles.emptySubtext}>
              Contactez votre coach pour commencer
            </Text>
          </View>
        ) : (
          <>
            {/* Séance ou repos pour la date sélectionnée */}
            <View style={styles.programSection}>
              <Text style={styles.programSectionTitle}>
                {isToday(selectedDate) ? "Séance du jour" : `Séance du ${format(selectedDate, 'd MMMM', { locale: fr })}`}
              </Text>

              {!selectedDateSession ? (
                <View style={[styles.card, { alignItems: 'center', paddingVertical: 20 }]}>
                  <Ionicons name="calendar-outline" size={28} color={couleurs.texteFaible} />
                  <Text style={{ fontSize: 14, color: couleurs.texteFaible, marginTop: 8 }}>
                    Aucune séance prévue ce jour
                  </Text>
                </View>
              ) : selectedDateSession.isRestDay ? (
                <View style={[styles.card, { alignItems: 'center', paddingVertical: 24 }]}>
                  <Ionicons name="bed-outline" size={32} color={couleurs.texteFaible} />
                  <Text style={{ fontSize: 16, fontWeight: '600', color: couleurs.texteFaible, marginTop: 8 }}>
                    Jour de repos
                  </Text>
                  <Text style={{ fontSize: 13, color: couleurs.texteFaible, marginTop: 4 }}>
                    Profitez-en pour récupérer
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.card, styles.todayCard, selectedDateSession.completedByClient && styles.todayCardDone]}
                  onPress={() =>
                    navigation.navigate('SessionDetail', { sessionId: selectedDateSession.id })
                  }
                >
                  <View style={styles.sessionHeader}>
                    <Text style={styles.sessionTitle}>
                      {selectedDateSession.notes || 'Séance'}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedDateSession) }]}>
                      <Text style={styles.statusText}>
                        {getStatusText(selectedDateSession)}
                      </Text>
                    </View>
                  </View>

                  {selectedDateSession.exercises && selectedDateSession.exercises.length > 0 && (
                    <View style={styles.todayExerciseList}>
                      {selectedDateSession.exercises.slice(0, 5).map((ex) => (
                        <View key={ex.id} style={styles.todayExerciseRow}>
                          <Ionicons
                            name={
                              ex.category === 'WARMUP' ? 'flame-outline' :
                              ex.category === 'CARDIO' ? 'heart-outline' :
                              ex.category === 'STRETCHING' ? 'flower-outline' :
                              'barbell-outline'
                            }
                            size={14}
                            color={couleurs.texteFaible}
                          />
                          <Text style={styles.todayExerciseName} numberOfLines={1}>
                            {ex.name}
                          </Text>
                          {ex.sets && (
                            <Text style={styles.todayExerciseDetail}>
                              {ex.sets}×{ex.reps || ''}
                            </Text>
                          )}
                          {ex.duration && !ex.sets && (
                            <Text style={styles.todayExerciseDetail}>{ex.duration}</Text>
                          )}
                        </View>
                      ))}
                      {selectedDateSession.exercises.length > 5 && (
                        <Text style={styles.todayExerciseMore}>
                          +{selectedDateSession.exercises.length - 5} autres exercices
                        </Text>
                      )}
                    </View>
                  )}

                  <Text style={styles.exerciseCount}>
                    {selectedDateSession.exercises?.length || 0} exercice(s)
                  </Text>
                  <View style={[styles.startButton, selectedDateSession.completedByClient && styles.startButtonDone]}>
                    <Text style={styles.startButtonText}>
                      {selectedDateSession.completedByClient ? 'Voir la séance' : 'Commencer'}
                    </Text>
                    <Ionicons name="chevron-forward" size={20} color={couleurs.texteInverse} />
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {/* Programme actif — résumé compact */}
            <View style={styles.programSection}>
              <Text style={styles.programSectionTitle}>Programme actif</Text>
              <View style={styles.card}>
                <Text style={styles.programTitle}>{activeProgram.title}</Text>
                {activeProgram.description && (
                  <Text style={styles.programDescription}>{activeProgram.description}</Text>
                )}
                <Text style={styles.sessionCount}>
                  {(activeProgram?.sessions || []).length} séance(s)
                </Text>
              </View>
            </View>

            {/* Séances à venir */}
            {upcomingSessions.length > 0 && (
              <View style={styles.programSection}>
                <Text style={styles.programSectionTitle}>Séances à venir</Text>
                {upcomingSessions.map((session) => (
                  <TouchableOpacity
                    key={session.id}
                    style={styles.card}
                    onPress={() =>
                      navigation.navigate('SessionDetail', { sessionId: session.id })
                    }
                  >
                    <View style={styles.sessionHeader}>
                      <Text style={styles.sessionTitle}>
                        {session.isRestDay ? 'Jour de repos' : (session.notes || 'Séance')}
                      </Text>
                      <View style={[
                        styles.statusBadge,
                        { backgroundColor: session.isRestDay ? couleurs.texteFaible : getStatusColor(session) },
                      ]}>
                        <Text style={styles.statusText}>
                          {session.isRestDay ? 'Repos' : getStatusText(session)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.sessionDate}>
                      {formatSessionDate(session.date)}
                    </Text>
                    {!session.isRestDay && (
                      <Text style={styles.exerciseCount}>
                        {session.exercises?.length || 0} exercice(s)
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        {/* Sommeil */}
        <View style={styles.statsSection}>
          <View style={styles.statsSectionHeader}>
            <Ionicons name="moon-outline" size={24} color={couleurs.accent} />
            <Text style={styles.statsSectionTitle}>Sommeil</Text>
          </View>
          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Réveil ce matin</Text>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setPickerActive('wakeTime')}
              >
                <Ionicons name="sunny-outline" size={16} color={couleurs.accent} />
                <Text style={[styles.timeButtonText, !formData.wakeTime && styles.timeButtonPlaceholder]}>
                  {formData.wakeTime || '--:--'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Coucher ce soir</Text>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setPickerActive('bedTime')}
              >
                <Ionicons name="moon-outline" size={16} color={couleurs.accent} />
                <Text style={[styles.timeButtonText, !formData.bedTime && styles.timeButtonPlaceholder]}>
                  {formData.bedTime || '--:--'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Picker natif */}
          {pickerActive && (
            <DateTimePicker
              value={getPickerDate(formData[pickerActive])}
              mode="time"
              is24Hour={true}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onPickerChange}
              locale="fr-FR"
            />
          )}
          {/* iOS : bouton Confirmer */}
          {pickerActive && Platform.OS === 'ios' && (
            <TouchableOpacity style={styles.timeConfirmBtn} onPress={() => setPickerActive(null)}>
              <Text style={styles.timeConfirmText}>Confirmer</Text>
            </TouchableOpacity>
          )}

          {/* Durée de sommeil calculée */}
          {(() => {
            const h = calculateSleepHours();
            return h ? (
              <Text style={styles.infoText}>
                Durée de sommeil estimée : {h.toFixed(1)} h
                <Text style={styles.infoTextSub}> (coucher hier → réveil ce matin)</Text>
              </Text>
            ) : formData.wakeTime && !yesterdayBedTime ? (
              <Text style={styles.infoTextMuted}>
                Renseignez le coucher d'hier pour voir la durée de sommeil.
              </Text>
            ) : null;
          })()}
        </View>

        {/* Hydratation */}
        <View style={styles.statsSection}>
          <View style={styles.statsSectionHeader}>
            <Ionicons name="water-outline" size={24} color={couleurs.accent} />
            <Text style={styles.statsSectionTitle}>Hydratation</Text>
          </View>
          <Text style={styles.label}>Eau (litres)</Text>
          <TextInput
            style={styles.input}
            placeholder="2.5"
            value={formData.water}
            onChangeText={(value) => updateField('water', value)}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Poids */}
        <View style={styles.statsSection}>
          <View style={styles.statsSectionHeader}>
            <Ionicons name="scale-outline" size={24} color={couleurs.accent} />
            <Text style={styles.statsSectionTitle}>Poids</Text>
          </View>
          <Text style={styles.label}>Poids (kg)</Text>
          <TextInput
            style={styles.input}
            placeholder="75.5"
            value={formData.weight}
            onChangeText={(value) => updateField('weight', value)}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Entraînement */}
        <View style={styles.statsSection}>
          <View style={styles.statsSectionHeader}>
            <Ionicons name="fitness-outline" size={24} color={couleurs.accent} />
            <Text style={styles.statsSectionTitle}>Entraînement</Text>
          </View>
          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Heure de la séance</Text>
              <TextInput
                style={styles.input}
                placeholder="18:00"
                value={formData.workoutTime}
                onChangeText={(value) => updateField('workoutTime', value)}
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Durée (minutes)</Text>
              <TextInput
                style={styles.input}
                placeholder="60"
                value={formData.workoutDuration}
                onChangeText={(value) => updateField('workoutDuration', value)}
                keyboardType="number-pad"
              />
            </View>
          </View>
        </View>

        {/* Repas */}
        <View style={styles.statsSection}>
          <View style={styles.statsSectionHeader}>
            <Ionicons name="nutrition-outline" size={24} color={couleurs.accent} />
            <Text style={styles.statsSectionTitle}>Repas</Text>
          </View>

          {MEAL_TYPES.map((type) => {
            const items = meals.filter((m) => m.mealType === type.key);
            const isActive = activeMealType === type.key;
            const mealCalories = items.reduce((s, m) => s + parseInt(m.calories || '0'), 0);

            return (
              <View key={type.key} style={styles.mealTypeContainer}>
                <TouchableOpacity
                  style={[styles.mealTypeHeader, isActive && styles.mealTypeHeaderActive]}
                  onPress={() => setActiveMealType(type.key)}
                >
                  <View style={styles.mealTypeLeft}>
                    <Ionicons name={type.icon} size={18} color={isActive ? type.color : couleurs.texteFaible} />
                    <Text style={[styles.mealTypeLabel, isActive && { color: type.color, fontWeight: '700' }]}>
                      {type.label}
                    </Text>
                  </View>
                  {items.length > 0 && (
                    <Text style={styles.mealTypeKcal}>{mealCalories} kcal</Text>
                  )}
                </TouchableOpacity>

                {items.map((meal) => (
                  <View key={meal.id} style={styles.mealItem}>
                    <View style={styles.mealItemInfo}>
                      <Text style={styles.mealItemName} numberOfLines={1}>{meal.description}</Text>
                      <Text style={styles.mealItemMacros}>
                        {meal.calories} kcal · P: {meal.protein}g · G: {meal.carbs}g · L: {meal.fats}g
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => removeMeal(meal)} style={styles.mealDeleteBtn}>
                      <Ionicons name="trash-outline" size={18} color={couleurs.danger} />
                    </TouchableOpacity>
                  </View>
                ))}

                {isActive && (
                  <View style={styles.foodSearchContainer}>
                    <FoodSearch onSelect={handleFoodSelect} />
                  </View>
                )}
              </View>
            );
          })}

          {meals.length > 0 && (
            <View style={styles.totalsContainer}>
              <Text style={styles.totalsTitle}>
                Total : <Text style={{ color: couleurs.accent }}>{totalCalories} kcal</Text>
              </Text>
              <Text style={styles.totalsDetail}>
                Protéines: {Math.round(totalProtein * 10) / 10}g · Glucides: {Math.round(totalCarbs * 10) / 10}g · Lipides: {Math.round(totalFats * 10) / 10}g
              </Text>
            </View>
          )}
        </View>

        {/* Notes */}
        <View style={styles.statsSection}>
          <View style={styles.statsSectionHeader}>
            <Ionicons name="create-outline" size={24} color={couleurs.accent} />
            <Text style={styles.statsSectionTitle}>Notes</Text>
          </View>
          <TextInput
            style={styles.textArea}
            placeholder="Notes supplémentaires (humeur, ressenti, etc.)"
            value={formData.notes}
            onChangeText={(value) => updateField('notes', value)}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Aucun bouton : la saisie est enregistrée d'elle-même. L'indicateur
            remplace la confirmation que le bouton donnait autrefois. */}
        {etatEnregistrement !== 'repos' && (
          <View style={styles.etatEnregistrement}>
            <Ionicons
              name={
                etatEnregistrement === 'erreur' ? 'cloud-offline-outline'
                  : etatEnregistrement === 'enregistre' ? 'checkmark-circle' : 'sync-outline'
              }
              size={16}
              color={etatEnregistrement === 'erreur' ? couleurs.danger : couleurs.accent}
            />
            <Text
              style={[
                styles.etatEnregistrementTexte,
                etatEnregistrement === 'erreur' && { color: couleurs.danger },
              ]}
            >
              {etatEnregistrement === 'erreur'
                ? 'Enregistrement impossible — vos données restent affichées'
                : etatEnregistrement === 'enregistre' ? 'Enregistré' : 'Enregistrement…'}
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
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
    paddingHorizontal: 12,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  brandName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: couleurs.texte,
    letterSpacing: -0.5,
  },
  // Frise de dates
  dateStrip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateArrow: {
    padding: 6,
  },
  daysRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dayButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 64,
    borderRadius: 14,
    backgroundColor: couleurs.fond,
    borderWidth: 1,
    borderColor: couleurs.bord,
  },
  dayButtonSelected: {
    width: 60,
    height: 68,
    borderRadius: 16,
    backgroundColor: couleurs.accent,
    borderColor: couleurs.accent,
    shadowColor: couleurs.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  dayName: {
    fontSize: 11,
    fontWeight: '600',
    color: couleurs.texteFaible,
    textTransform: 'capitalize',
  },
  dayNameSelected: {
    color: couleurs.accentEncre,
  },
  dayNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: couleurs.texte,
    marginVertical: 1,
  },
  dayNumberSelected: {
    color: couleurs.texteInverse,
  },
  dayMonth: {
    fontSize: 11,
    color: couleurs.texteFaible,
  },
  dayMonthSelected: {
    color: couleurs.accentEncre,
  },
  todayDot: {
    marginTop: 3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: couleurs.accent,
  },
  scrollView: {
    flex: 1,
  },
  // Programme sections
  programSection: {
    padding: 20,
  },
  programSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: couleurs.texte,
    marginBottom: 12,
  },
  card: {
    backgroundColor: couleurs.carte,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: couleurs.ombre,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  todayCard: {
    backgroundColor: couleurs.accentVoile,
    borderWidth: 2,
    borderColor: couleurs.accent,
  },
  todayCardDone: {
    backgroundColor: couleurs.succesVoile,
    borderColor: couleurs.succes,
  },
  programTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: couleurs.texte,
    marginBottom: 4,
  },
  programDescription: {
    fontSize: 14,
    color: couleurs.texteFaible,
    marginBottom: 8,
  },
  sessionCount: {
    fontSize: 12,
    color: couleurs.texteFaible,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: couleurs.texte,
    flex: 1,
  },
  sessionDate: {
    fontSize: 14,
    color: couleurs.texteFaible,
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  exerciseCount: {
    fontSize: 12,
    color: couleurs.texteFaible,
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: couleurs.texteInverse,
    fontSize: 12,
    fontWeight: '600',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: couleurs.accent,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  startButtonDone: {
    backgroundColor: couleurs.succes,
  },
  startButtonText: {
    color: couleurs.texteInverse,
    fontSize: 16,
    fontWeight: '600',
    marginRight: 4,
  },
  todayExerciseList: {
    marginBottom: 8,
    gap: 4,
  },
  todayExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 3,
  },
  todayExerciseName: {
    flex: 1,
    fontSize: 14,
    color: couleurs.texteDoux,
  },
  todayExerciseDetail: {
    fontSize: 12,
    color: couleurs.texteFaible,
    fontWeight: '500',
  },
  todayExerciseMore: {
    fontSize: 12,
    color: couleurs.accent,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  recommendedSection: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  recommendedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: couleurs.texte,
    marginBottom: 10,
  },
  recommendedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: couleurs.carte,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: couleurs.bord,
  },
  recommendedInfo: { flex: 1 },
  recommendedName: { fontSize: 14, fontWeight: '600', color: couleurs.texte },
  recommendedCity: { fontSize: 12, color: couleurs.texteDoux, marginTop: 2 },
  recommendedSpecialties: { fontSize: 11, color: couleurs.accent, marginTop: 3 },
  matchBadge: { backgroundColor: couleurs.succesVoile, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginRight: 8 },
  matchBadgeTxt: { fontSize: 10, color: couleurs.succes, fontWeight: '600' },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: couleurs.texteFaible,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: couleurs.texteFaible,
    marginTop: 8,
  },
  // Stats sections
  statsSection: {
    backgroundColor: couleurs.carte,
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  statsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statsSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
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
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: couleurs.texteDoux,
    marginBottom: 8,
  },
  input: {
    color: couleurs.texte,
    backgroundColor: couleurs.fond,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: couleurs.bord,
  },
  infoText: {
    marginTop: 12,
    fontSize: 14,
    color: couleurs.texteFaible,
    fontStyle: 'italic',
  },
  infoTextSub: {
    fontSize: 12,
    color: couleurs.texteFaible,
  },
  infoTextMuted: {
    marginTop: 8,
    fontSize: 12,
    color: couleurs.texteFaible,
    fontStyle: 'italic',
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: couleurs.fond,
    borderWidth: 1,
    borderColor: couleurs.bord,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 4,
  },
  timeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: couleurs.texte,
    fontVariant: ['tabular-nums'],
  },
  timeButtonPlaceholder: {
    color: couleurs.texteFaible,
    fontWeight: '400',
  },
  timeConfirmBtn: {
    alignSelf: 'flex-end',
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: couleurs.accent,
    borderRadius: 8,
  },
  timeConfirmText: {
    color: couleurs.texteInverse,
    fontWeight: '600',
    fontSize: 14,
  },
  textArea: {
    color: couleurs.texte,
    backgroundColor: couleurs.fond,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: couleurs.bord,
    textAlignVertical: 'top',
  },
  // Repas
  mealTypeContainer: {
    marginBottom: 12,
  },
  mealTypeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: couleurs.fond,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  mealTypeHeaderActive: {
    backgroundColor: couleurs.accentVoile,
    borderColor: couleurs.accentVoileFort,
  },
  mealTypeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mealTypeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: couleurs.texteDoux,
  },
  mealTypeKcal: {
    fontSize: 12,
    color: couleurs.texteFaible,
  },
  mealItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: couleurs.carte,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: couleurs.bord,
  },
  mealItemInfo: {
    flex: 1,
  },
  mealItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: couleurs.texte,
  },
  mealItemMacros: {
    fontSize: 12,
    color: couleurs.texteFaible,
    marginTop: 2,
  },
  mealDeleteBtn: {
    padding: 6,
  },
  foodSearchContainer: {
    marginLeft: 12,
    marginTop: 8,
    padding: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: couleurs.bord,
    borderRadius: 10,
  },
  totalsContainer: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: couleurs.bord,
  },
  totalsTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: couleurs.texte,
  },
  totalsDetail: {
    fontSize: 13,
    color: couleurs.texteFaible,
    marginTop: 4,
  },
  etatEnregistrement: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
    paddingVertical: 10,
  },
  etatEnregistrementTexte: {
    fontSize: 13,
    color: couleurs.texteFaible,
  },
});

export default DashboardScreen;
