import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  LayoutAnimation,
  Platform,
  UIManager,
  AppState,
} from 'react-native';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { isRunningInExpoGo } from 'expo';
import { sessionsAPI, setCompletionsAPI } from '../services/api';
import ExerciseDetailModal from '../components/ExerciseDetailModal';
import { couleurs } from '../theme';

/**
 * Notifications locales, chargees paresseusement.
 *
 * Sous Expo Go et sur Android, importer `expo-notifications` fait planter le
 * demarrage depuis le SDK 57 : le module enregistre un ecouteur de jeton push au
 * chargement, et cet enregistrement leve une erreur dans Expo Go. On ne charge donc
 * le module que la ou il peut reellement servir ; ailleurs, le chronometre de repos
 * fonctionne toujours, seule la notification de fin manque.
 */
const NOTIFS_UTILISABLES = !(isRunningInExpoGo() && Platform.OS === 'android');
let _notifs = null;
const notifs = () => {
  if (!NOTIFS_UTILISABLES) return null;
  if (!_notifs) _notifs = require('expo-notifications');
  return _notifs;
};

notifs()?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Convertit un temps de repos en secondes.
 *
 * Le champ est libre et plusieurs écritures coexistent en base : « 90s », « 2min »,
 * « 1min30 », « 1:30 », ou un nombre nu. L'implémentation précédente ne lisait que
 * « m:ss » et rendait 0 pour tout le reste — c'est-à-dire pour la totalité des valeurs
 * réellement enregistrées, ce qui empêchait le chrono de repos de démarrer.
 */
/**
 * Durée de repos appliquée quand l'exercice n'en précise aucune.
 *
 * Sans ce repli, valider une série d'un exercice sans `restTime` ne lançait rien :
 * le coach voyait le chrono démarrer sur certains exercices et pas sur d'autres,
 * sans comprendre pourquoi.
 */
const REPOS_PAR_DEFAUT = 90;

const parseRestTime = (str) => {
  if (str === null || str === undefined) return 0;
  const t = String(str).trim().toLowerCase().replace(/\s+/g, '');
  if (!t) return 0;

  // « 1:30 » — minutes et secondes séparées par deux-points.
  if (t.includes(':')) {
    const [min, sec] = t.split(':');
    return (parseInt(min, 10) || 0) * 60 + (parseInt(sec, 10) || 0);
  }

  // « 1min30 », « 1min30s », « 2min ».
  const avecMinutes = t.match(/^(\d+)\s*(?:min|m)\s*(\d+)?\s*s?$/);
  if (avecMinutes) {
    return parseInt(avecMinutes[1], 10) * 60 + (parseInt(avecMinutes[2], 10) || 0);
  }

  // « 90s » ou « 90 » : un nombre nu se lit en secondes.
  const secondes = t.match(/^(\d+)\s*s?$/);
  if (secondes) return parseInt(secondes[1], 10);

  return 0;
};

const formatTime = (s) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const SessionDetailScreen = ({ route, navigation }) => {
  const { sessionId } = route.params;
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [setCompletions, setSetCompletions] = useState({});
  const [selectedExerciseForDetail, setSelectedExerciseForDetail] = useState(null);

  // ── Chrono global ─────────────────────────────────────────────────────────
  // 'idle' | 'running' | 'paused'
  const [timerState, setTimerState] = useState('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const accumulatedRef = useRef(0);   // secondes accumulées avant le run actuel
  const runStartRef = useRef(null);   // timestamp du début du run actuel
  const globalIntervalRef = useRef(null);

  // ── Chrono repos ──────────────────────────────────────────────────────────
  // Actif par défaut : c'est le comportement attendu en salle. Seul un « false »
  // explicitement enregistré depuis le profil le désactive.
  const [restTimerEnabled, setRestTimerEnabled] = useState(true);
  const [restModalVisible, setRestModalVisible] = useState(false);
  // La barre de decompte sert au repos entre series ET aux exercices minutes :
  // seul le libelle change.
  const [chronoLabel, setChronoLabel] = useState('TEMPS DE REPOS');
  const [restSecondsLeft, setRestSecondsLeft] = useState(0);
  const [restTotalSeconds, setRestTotalSeconds] = useState(0);
  const restIntervalRef = useRef(null);
  const restEndTimeRef = useRef(null);   // timestamp absolu de fin du repos
  const restNotifIdRef = useRef(null);   // id de la notification planifiée

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchSession();
    notifs()?.requestPermissionsAsync();
    SecureStore.getItemAsync('restTimerEnabled').then(val => {
      setRestTimerEnabled(val !== 'false');
    });
    return () => {
      clearInterval(globalIntervalRef.current);
      clearInterval(restIntervalRef.current);
    };
  }, [sessionId]);

  const fetchSession = async () => {
    try {
      const response = await sessionsAPI.getById(sessionId);
      const sessionData = response.data.data;
      setSession(sessionData);
      const completions = {};
      sessionData.exercises?.forEach((exercise) => {
        completions[exercise.id] = {};
        exercise.setCompletions?.forEach((completion) => {
          completions[exercise.id][completion.setNumber] = {
            repsAchieved: completion.repsAchieved || exercise.reps || '',
            durationAchieved: completion.durationAchieved || exercise.duration || '',
            weightUsed: completion.weightUsed || exercise.weight || '',
            completed: completion.completed,
          };
        });
      });
      setSetCompletions(completions);
    } catch (error) {
      console.error('Error fetching session:', error);
      Alert.alert('Erreur', 'Impossible de charger la séance');
    } finally {
      setLoading(false);
    }
  };

  // ── Contrôles chrono global ───────────────────────────────────────────────
  const startTimer = () => {
    runStartRef.current = Date.now();
    setTimerState('running');
    globalIntervalRef.current = setInterval(() => {
      setElapsedSeconds(
        accumulatedRef.current + Math.floor((Date.now() - runStartRef.current) / 1000)
      );
    }, 1000);
  };

  const pauseTimer = () => {
    clearInterval(globalIntervalRef.current);
    accumulatedRef.current += Math.floor((Date.now() - runStartRef.current) / 1000);
    setElapsedSeconds(accumulatedRef.current);
    setTimerState('paused');
  };

  const resumeTimer = () => {
    runStartRef.current = Date.now();
    setTimerState('running');
    globalIntervalRef.current = setInterval(() => {
      setElapsedSeconds(
        accumulatedRef.current + Math.floor((Date.now() - runStartRef.current) / 1000)
      );
    }, 1000);
  };

  const getFinalDuration = () => {
    if (timerState === 'running') {
      return accumulatedRef.current + Math.floor((Date.now() - runStartRef.current) / 1000);
    }
    return accumulatedRef.current;
  };

  // ── Chrono repos ──────────────────────────────────────────────────────────
  const tickRest = () => {
    const remaining = Math.ceil((restEndTimeRef.current - Date.now()) / 1000);
    if (remaining <= 0) {
      clearInterval(restIntervalRef.current);
      // App en foreground : annuler la notification avant qu'elle ne se déclenche
      if (restNotifIdRef.current) {
        notifs()?.cancelScheduledNotificationAsync(restNotifIdRef.current).catch(() => {});
        restNotifIdRef.current = null;
      }
      restEndTimeRef.current = null;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setRestModalVisible(false);
      setRestSecondsLeft(0);
    } else {
      setRestSecondsLeft(remaining);
    }
  };

  const startRestTimer = async (secs, options = {}) => {
    const {
      label = 'TEMPS DE REPOS',
      titre = 'Repos terminé ! 💪',
      corps = "C'est reparti pour la prochaine série !",
    } = options;
    setChronoLabel(label);
    clearInterval(restIntervalRef.current);
    // Annuler la notification précédente si elle existe
    if (restNotifIdRef.current) {
      await notifs()?.cancelScheduledNotificationAsync(restNotifIdRef.current).catch(() => {});
      restNotifIdRef.current = null;
    }

    const endTime = Date.now() + secs * 1000;
    restEndTimeRef.current = endTime;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRestTotalSeconds(secs);
    setRestSecondsLeft(secs);
    setRestModalVisible(true);

    // Notification planifiée dans N secondes (fonctionne app fermée)
    try {
      const notifId = await notifs()?.scheduleNotificationAsync({
        content: {
          title: titre,
          body: corps,
        },
        trigger: {
          type: notifs()?.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.max(1, secs),
          repeats: false,
        },
      });
      restNotifIdRef.current = notifId;
    } catch (e) {
      console.warn('Notification scheduling failed:', e);
    }

    restIntervalRef.current = setInterval(tickRest, 500);
  };

  const skipRestTimer = async () => {
    clearInterval(restIntervalRef.current);
    if (restNotifIdRef.current) {
      await notifs()?.cancelScheduledNotificationAsync(restNotifIdRef.current).catch(() => {});
      restNotifIdRef.current = null;
    }
    restEndTimeRef.current = null;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRestModalVisible(false);
    setRestSecondsLeft(0);
  };

  // Resynchroniser le décompte au retour en foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && restEndTimeRef.current) {
        clearInterval(restIntervalRef.current);
        const remaining = Math.ceil((restEndTimeRef.current - Date.now()) / 1000);
        if (remaining <= 0) {
          restEndTimeRef.current = null;
          restNotifIdRef.current = null;
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setRestModalVisible(false);
          setRestSecondsLeft(0);
        } else {
          setRestSecondsLeft(remaining);
          restIntervalRef.current = setInterval(tickRest, 500);
        }
      }
    });
    return () => sub.remove();
  }, []);

  // ── Séries ────────────────────────────────────────────────────────────────
  const toggleSet = async (exerciseId, setNumber, exercise) => {
    const currentState = setCompletions[exerciseId]?.[setNumber];
    const isCompleted = currentState?.completed || false;

    try {
      if (isCompleted) {
        await setCompletionsAPI.delete(exerciseId, setNumber);
        setSetCompletions((prev) => {
          const newState = { ...prev };
          if (newState[exerciseId]) delete newState[exerciseId][setNumber];
          return newState;
        });
      } else {
        const chronometre = estChronometre(exercise);
        const repsAchieved = currentState?.repsAchieved || exercise.reps || '';
        const durationAchieved = currentState?.durationAchieved || exercise.duration || '';
        const weightUsed = currentState?.weightUsed || exercise.weight || '';

        await setCompletionsAPI.update({
          exerciseId,
          setNumber,
          // Un exercice tenu n'a ni répétitions ni charge : envoyer « 45 » dans
          // repsAchieved le ferait compter comme 45 répétitions dans le volume
          // et le 1RM. Les deux champs sont donc exclusifs.
          repsAchieved: chronometre ? undefined : repsAchieved,
          durationAchieved: chronometre ? durationAchieved : undefined,
          weightUsed: chronometre ? undefined : weightUsed,
        });

        setSetCompletions((prev) => ({
          ...prev,
          [exerciseId]: {
            ...prev[exerciseId],
            [setNumber]: { repsAchieved, durationAchieved, weightUsed, completed: true },
          },
        }));

        // Le chrono part à la validation. La durée vient de l'exercice quand elle est
        // lisible, sinon du repli : on ne laisse pas une série validée sans repos.
        if (restTimerEnabled) {
          startRestTimer(parseRestTime(exercise.restTime) || REPOS_PAR_DEFAUT);
        }
      }
    } catch (error) {
      console.error('Error toggling set:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder');
    }
  };

  const updateSetData = async (exerciseId, setNumber, field, value) => {
    setSetCompletions((prev) => ({
      ...prev,
      [exerciseId]: {
        ...prev[exerciseId],
        [setNumber]: { ...prev[exerciseId]?.[setNumber], [field]: value },
      },
    }));
    if (setCompletions[exerciseId]?.[setNumber]?.completed) {
      try {
        const updatedData = { ...setCompletions[exerciseId][setNumber], [field]: value };
        await setCompletionsAPI.update({
          exerciseId,
          setNumber,
          repsAchieved: updatedData.repsAchieved,
          weightUsed: updatedData.weightUsed,
        });
      } catch (error) {
        console.error('Error updating set data:', error);
      }
    }
  };

  const handleValidateSession = async () => {
    Alert.alert(
      'Valider la séance',
      'Êtes-vous sûr de vouloir terminer et valider cette séance ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Valider',
          onPress: async () => {
            try {
              clearInterval(globalIntervalRef.current);
              const durationSeconds = getFinalDuration();
              await sessionsAPI.validateSession(sessionId, durationSeconds);
              Alert.alert('Bravo ! 🎉', 'Séance validée avec succès !');
              navigation.goBack();
            } catch (error) {
              console.error('Validate session error:', error?.response?.status, error?.response?.data, error?.message);
              Alert.alert('Erreur', `Impossible de valider la séance (${error?.response?.status || error?.message || 'inconnu'})`);
            }
          },
        },
      ]
    );
  };

  // ── Helpers catégorie ─────────────────────────────────────────────────────
  const getCategoryIcon = (category) => {
    const icons = { WARMUP: 'flame-outline', MAIN: 'barbell-outline', CARDIO: 'heart-outline', STRETCHING: 'flower-outline' };
    return icons[category] || 'fitness-outline';
  };
  const getCategoryLabel = (category) => {
    const labels = { WARMUP: 'Échauffement', MAIN: 'Musculation', CARDIO: 'Cardio', STRETCHING: 'Étirements' };
    return labels[category] || category;
  };
  /**
   * Un exercice de renforcement — gainage, chaise, planche — se mesure au TEMPS TENU,
   * pas en répétitions ni en charge. Le champ de saisie change en conséquence.
   */
  const estChronometre = (exercise) => exercise?.category === 'RENFORCEMENT';

  // La catégorie se lit à son picto et à son libellé : elle n'a pas besoin d'une
  // couleur propre, qui ferait quatre accents concurrents sur le même écran.
  const getCategoryColor = () => couleurs.accent;

  const isExerciseCompleted = (exercise) => {
    if (!exercise.sets) return false;
    for (let i = 1; i <= exercise.sets; i++) {
      if (!setCompletions[exercise.id]?.[i]?.completed) return false;
    }
    return true;
  };

  const getTotalCompletedSets = () => {
    let total = 0;
    let completed = 0;
    session?.exercises?.forEach((exercise) => {
      if (exercise.sets) {
        total += exercise.sets;
        for (let i = 1; i <= exercise.sets; i++) {
          if (setCompletions[exercise.id]?.[i]?.completed) completed++;
        }
      }
    });
    return { total, completed };
  };

  /**
   * Exercice exprimé en temps (échauffement, étirement, cardio) : la durée, et un
   * bouton qui lance le décompte. Sans lui, le client devait compter ses dix minutes
   * de vélo de tête.
   *
   * Le bouton n'apparaît que si la durée est lisible — « 10 min », « 45s », « 1min30 » —
   * et jamais sur une séance déjà validée.
   */
  const renderDureeExercice = (exercise, readOnly) => {
    const secondes = parseRestTime(exercise.duration);
    if (!exercise.duration) return null;
    return (
      <View style={styles.dureeRangee}>
        <Text style={styles.exerciseDetails}>{exercise.duration}</Text>
        {secondes > 0 && !readOnly && (
          <TouchableOpacity
            style={styles.dureeBtn}
            onPress={() =>
              startRestTimer(secondes, {
                label: exercise.name.toUpperCase(),
                titre: `${exercise.name} terminé !`,
                corps: 'Passez à la suite.',
              })
            }
            accessibilityRole="button"
            accessibilityLabel={`Lancer le chronomètre de ${exercise.duration} pour ${exercise.name}`}
          >
            <Ionicons name="play" size={14} color={couleurs.accentEncre} />
            <Text style={styles.dureeBtnTexte}>Lancer</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Rendu du contenu d'un exercice (réutilisable pour single et superset)
  const renderExerciseContent = (exercise, exerciseCompleted, readOnly) => (
    <>
      <View style={styles.exerciseHeader}>
        <TouchableOpacity
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}
          onPress={() => setSelectedExerciseForDetail(exercise)}
        >
          <Text style={[styles.exerciseName, (exerciseCompleted || readOnly) && styles.exerciseNameCompleted]}>
            {exercise.name}
          </Text>
          {(exercise.exerciseRefId || exercise.exerciseRef) && (
            <Ionicons name="information-circle-outline" size={18} color={couleurs.accent} />
          )}
        </TouchableOpacity>
        {(exerciseCompleted || readOnly) && <Ionicons name="checkmark-circle" size={24} color={couleurs.accent} />}
      </View>

      {exercise.description && (
        <Text style={styles.exerciseDescription}>{exercise.description}</Text>
      )}

      {exercise.sets && exercise.sets > 0 ? (
        <View style={styles.setsContainer}>
          {[...Array(exercise.sets)].map((_, index) => {
            const setNumber = index + 1;
            const setData = setCompletions[exercise.id]?.[setNumber] || {
              repsAchieved: exercise.reps || '',
              durationAchieved: exercise.duration || '',
              weightUsed: exercise.weight || '',
              completed: false,
            };
            const chronometre = estChronometre(exercise);
            return (
              <View key={setNumber} style={styles.setRow}>
                <TouchableOpacity
                  style={[
                    styles.setCheckbox,
                    (setData.completed || readOnly) && styles.setCheckboxCompleted,
                    readOnly && styles.setCheckboxReadOnly,
                  ]}
                  onPress={() => !readOnly && toggleSet(exercise.id, setNumber, exercise)}
                >
                  {(setData.completed || readOnly) && <Ionicons name="checkmark" size={16} color={couleurs.texteInverse} />}
                </TouchableOpacity>
                <Text style={styles.setNumber}>Série {setNumber}</Text>
                {chronometre ? (
                  /* Renforcement : un seul champ, le temps tenu. Le champ occupe la
                     place des deux autres pour rester confortable au pouce. */
                  <View style={styles.champTempsRangee}>
                    <Ionicons name="timer-outline" size={16} color={couleurs.texteFaible} />
                    <TextInput
                      style={[styles.champTemps, readOnly && styles.setInputReadOnly]}
                      placeholder="45s"
                      value={setData.durationAchieved}
                      onChangeText={(v) => !readOnly && updateSetData(exercise.id, setNumber, 'durationAchieved', v)}
                      editable={!readOnly}
                    />
                    <Text style={styles.champTempsSuffixe}>tenu</Text>
                  </View>
                ) : (
                  <>
                    <TextInput
                      style={[styles.setInput, readOnly && styles.setInputReadOnly]}
                      placeholder="Reps"
                      value={setData.repsAchieved}
                      onChangeText={(v) => !readOnly && updateSetData(exercise.id, setNumber, 'repsAchieved', v)}
                      keyboardType="numeric"
                      editable={!readOnly}
                    />
                    <TextInput
                      style={[styles.setInput, readOnly && styles.setInputReadOnly]}
                      placeholder="Poids"
                      value={setData.weightUsed}
                      onChangeText={(v) => !readOnly && updateSetData(exercise.id, setNumber, 'weightUsed', v)}
                      editable={!readOnly}
                    />
                  </>
                )}
              </View>
            );
          })}
        </View>
      ) : (
        renderDureeExercice(exercise, readOnly)
      )}

      {exercise.restTime && (
        <View style={styles.restInfo}>
          <Ionicons name="timer-outline" size={14} color={couleurs.texteFaible} />
          <Text style={styles.restText}>Repos : {exercise.restTime}</Text>
        </View>
      )}
    </>
  );

  // ── Rendu ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={couleurs.accent} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Séance introuvable</Text>
      </View>
    );
  }

  // Regroupe les exercices par catégorie, en preservant l'ordre original
  const exercisesByCategory = (session?.exercises || []).reduce((acc, exercise) => {
    if (!acc[exercise.category]) acc[exercise.category] = [];
    acc[exercise.category].push(exercise);
    return acc;
  }, {});

  // Couleurs des super-sets (cycliques)
  const SUPERSET_COLORS_MOBILE = [couleurs.violetDoux, couleurs.info, couleurs.succes, couleurs.alerte, couleurs.danger];

  // Construit un mapping groupUUID → index (pour les couleurs)
  const supersetColorIndex = {};
  let ssColorIdx = 0;
  (session?.exercises || []).forEach((ex) => {
    if (ex.supersetGroup && supersetColorIndex[ex.supersetGroup] === undefined) {
      supersetColorIndex[ex.supersetGroup] = ssColorIdx++;
    }
  });

  // Groupes les exercices d'une catégorie : retourne des "slots" (single | superset)
  const groupExercises = (exercises) => {
    const result = [];
    let i = 0;
    while (i < exercises.length) {
      const ex = exercises[i];
      if (ex.supersetGroup) {
        // Ramasse tous les consécutifs du même groupe
        const group = [ex];
        let j = i + 1;
        while (j < exercises.length && exercises[j].supersetGroup === ex.supersetGroup) {
          group.push(exercises[j]);
          j++;
        }
        result.push({ type: 'superset', supersetGroup: ex.supersetGroup, items: group });
        i = j;
      } else {
        result.push({ type: 'single', exercise: ex });
        i++;
      }
    }
    return result;
  };

  const { total, completed } = getTotalCompletedSets();
  const allCompleted = total > 0 && completed === total;
  const restProgress = restTotalSeconds > 0 ? restSecondsLeft / restTotalSeconds : 0;

  return (
    <View style={styles.container}>

      {/* ── Chrono global (sticky en haut) ── */}
      {!session.completedByClient && (
        <View style={styles.timerBar}>
          {restModalVisible ? (
            /* ── Mode repos ── */
            <View>
              <View style={styles.restInlineHeader}>
                <Ionicons name="timer" size={15} color={couleurs.accent} />
                <Text style={styles.restInlineLabel}>{chronoLabel}</Text>
                <TouchableOpacity onPress={skipRestTimer} style={styles.restInlineSkipBtn}>
                  <Text style={styles.restInlineSkipText}>Passer</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.restInlineCount}>{formatTime(restSecondsLeft)}</Text>
              <View style={styles.restInlineProgressBar}>
                <View style={[styles.restInlineProgressFill, { width: `${restProgress * 100}%` }]} />
              </View>
              {/* Chrono global en dessous, plus petit (seulement si démarré) */}
              {timerState !== 'idle' && (
                <View style={styles.globalTimerSmallRow}>
                  <Ionicons
                    name={timerState === 'running' ? 'time-outline' : 'pause-circle-outline'}
                    size={13}
                    color={couleurs.texteFaible}
                  />
                  <Text style={styles.globalTimerSmallText}>
                    Séance : {formatTime(elapsedSeconds)}
                    {timerState === 'paused' ? '  · En pause' : ''}
                  </Text>
                </View>
              )}
            </View>
          ) : timerState === 'idle' ? (
            /* ── Mode idle ── */
            <TouchableOpacity style={styles.timerStartBtn} onPress={startTimer}>
              <Ionicons name="play-circle" size={22} color={couleurs.texteInverse} />
              <Text style={styles.timerStartText}>Démarrer la séance</Text>
            </TouchableOpacity>
          ) : (
            /* ── Mode running / paused ── */
            <View style={styles.timerRunRow}>
              <View style={styles.timerDisplay}>
                <Ionicons
                  name={timerState === 'running' ? 'time-outline' : 'pause-circle-outline'}
                  size={18}
                  color={timerState === 'running' ? couleurs.accent : couleurs.alerte}
                />
                <Text style={[styles.timerValue, timerState === 'paused' && styles.timerValuePaused]}>
                  {formatTime(elapsedSeconds)}
                </Text>
                {timerState === 'paused' && (
                  <Text style={styles.timerPausedLabel}>En pause</Text>
                )}
              </View>
              {timerState === 'running' ? (
                <TouchableOpacity style={styles.timerControlBtn} onPress={pauseTimer}>
                  <Ionicons name="pause" size={18} color={couleurs.accent} />
                  <Text style={styles.timerControlText}>Pause</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.timerControlBtn, styles.timerResumeBtn]} onPress={resumeTimer}>
                  <Ionicons name="play" size={18} color={couleurs.accent} />
                  <Text style={[styles.timerControlText, { color: couleurs.accent }]}>Reprendre</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}

      <ScrollView style={styles.scrollView}>
        <View style={[styles.header, session.completedByClient && styles.headerDone]}>
          <View style={styles.headerTop}>
            <Text style={styles.title}>{session.notes || 'Séance'}</Text>
            {session.completedByClient && (
              <View style={styles.doneBadge}>
                <Ionicons name="checkmark-circle" size={14} color={couleurs.texteInverse} />
                <Text style={styles.doneBadgeText}>Terminée</Text>
              </View>
            )}
          </View>
          <Text style={styles.date}>
            {new Date(session.date).toLocaleDateString('fr-FR', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </Text>
          {session.completedByClient && session.durationSeconds > 0 && (
            <View style={styles.durationRow}>
              <Ionicons name="time-outline" size={14} color={couleurs.accent} />
              <Text style={styles.durationText}>Durée : {formatTime(session.durationSeconds)}</Text>
            </View>
          )}
        </View>

        {Object.entries(exercisesByCategory).map(([category, catExercises]) => (
          <View key={category} style={styles.categorySection}>
            <View style={styles.categoryHeader}>
              <Ionicons name={getCategoryIcon(category)} size={22} color={getCategoryColor(category)} />
              <Text style={[styles.categoryTitle, { color: getCategoryColor(category) }]}>
                {getCategoryLabel(category)}
              </Text>
            </View>

            {groupExercises(catExercises).map((slot, slotIdx) => {
              if (slot.type === 'superset') {
                const ssColor = SUPERSET_COLORS_MOBILE[supersetColorIndex[slot.supersetGroup] % SUPERSET_COLORS_MOBILE.length];
                const allDone = slot.items.every(isExerciseCompleted);
                const readOnly = session.completedByClient;
                return (
                  <View key={slot.supersetGroup} style={[styles.supersetContainer, { borderColor: ssColor }]}>
                    <View style={[styles.supersetHeader, { backgroundColor: ssColor }]}>
                      <Ionicons name="layers-outline" size={14} color={couleurs.texteInverse} />
                      <Text style={styles.supersetHeaderText}>Super-set</Text>
                      {(allDone || readOnly) && <Ionicons name="checkmark-circle" size={14} color={couleurs.texteInverse} />}
                    </View>
                    {slot.items.map((exercise, exIdx) => {
                      const exerciseCompleted = isExerciseCompleted(exercise);
                      return (
                        <View key={exercise.id}>
                          {exIdx > 0 && <View style={[styles.supersetDivider, { backgroundColor: ssColor + '33' }]} />}
                          <View style={styles.supersetExercise}>
                            {renderExerciseContent(exercise, exerciseCompleted, readOnly)}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              }
              // slot.type === 'single'
              const exercise = slot.exercise;
              const exerciseCompleted = isExerciseCompleted(exercise);
              const readOnly = session.completedByClient;
              return (
                <View key={exercise.id} style={[styles.exerciseCard, (exerciseCompleted || readOnly) && styles.exerciseCardDone]}>
                  {renderExerciseContent(exercise, exerciseCompleted, readOnly)}
                </View>
              );
            })}
          </View>
        ))}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ── Footer ── */}
      {session.completedByClient ? (
        <View style={styles.footerDone}>
          <Ionicons name="checkmark-circle" size={22} color={couleurs.accent} />
          <Text style={styles.footerDoneText}>Séance terminée</Text>
        </View>
      ) : (
        <View style={styles.footer}>
          <Text style={styles.progressText}>{completed} / {total} séries terminées</Text>
          <TouchableOpacity
            style={[styles.validateButton, !allCompleted && styles.validateButtonDisabled]}
            onPress={handleValidateSession}
            disabled={!allCompleted}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color={couleurs.texteInverse} style={{ marginRight: 8 }} />
            <Text style={styles.validateButtonText}>
              {allCompleted ? 'Valider la séance' : 'Complétez toutes les séries'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ExerciseDetailModal
        visible={!!selectedExerciseForDetail}
        exercise={selectedExerciseForDetail}
        onClose={() => setSelectedExerciseForDetail(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: couleurs.fond },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: couleurs.texteFaible },

  // ── Chrono global ──
  timerBar: {
    backgroundColor: couleurs.carte,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  timerStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: couleurs.accent,
    paddingVertical: 12,
    borderRadius: 10,
  },
  timerStartText: { color: couleurs.texteInverse, fontSize: 15, fontWeight: '700' },
  timerRunRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timerDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timerValue: {
    fontSize: 28,
    fontWeight: '800',
    color: couleurs.accent,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  timerValuePaused: { color: couleurs.alerte },
  timerPausedLabel: {
    fontSize: 12,
    color: couleurs.alerte,
    fontWeight: '600',
    backgroundColor: couleurs.alerteVoile,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  timerControlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: couleurs.accentVoile,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  timerResumeBtn: { backgroundColor: couleurs.accentVoile },
  timerControlText: { fontSize: 14, fontWeight: '700', color: couleurs.accent },

  // ── Contenu ──
  scrollView: { flex: 1 },
  header: {
    backgroundColor: couleurs.carte,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  headerDone: {
    borderBottomColor: couleurs.accent,
    borderBottomWidth: 2,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: { fontSize: 22, fontWeight: 'bold', color: couleurs.texte, flex: 1 },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: couleurs.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginLeft: 8,
  },
  doneBadgeText: { fontSize: 12, fontWeight: '700', color: couleurs.texteInverse },
  date: { fontSize: 13, color: couleurs.texteFaible, textTransform: 'capitalize' },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  durationText: { fontSize: 13, color: couleurs.accent, fontWeight: '600' },

  categorySection: { marginTop: 20, paddingHorizontal: 16 },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  categoryTitle: { fontSize: 16, fontWeight: '600', marginLeft: 8 },

  // ── Super-set ──
  supersetContainer: {
    borderWidth: 2,
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    backgroundColor: couleurs.carte,
    shadowColor: couleurs.ombre,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  supersetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  supersetHeaderText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: couleurs.texteInverse,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  supersetDivider: {
    height: 1,
    marginHorizontal: 16,
  },
  supersetExercise: {
    padding: 14,
  },

  exerciseCard: {
    backgroundColor: couleurs.carte,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: couleurs.ombre,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  exerciseCardDone: { borderLeftWidth: 4, borderLeftColor: couleurs.accent },
  exerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  exerciseName: { fontSize: 15, fontWeight: '600', color: couleurs.texte, flex: 1 },
  exerciseNameCompleted: { color: couleurs.accent },
  exerciseDescription: { fontSize: 13, color: couleurs.texteFaible, marginBottom: 10 },
  exerciseDetails: { fontSize: 13, color: couleurs.texteFaible },
  dureeRangee: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, marginTop: 2,
  },
  dureeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 7, paddingHorizontal: 13,
    borderRadius: 999, backgroundColor: couleurs.accent,
  },
  dureeBtnTexte: { fontSize: 13, fontWeight: '700', color: couleurs.accentEncre },

  setsContainer: { marginTop: 6, gap: 6 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setCheckbox: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: couleurs.bord,
    justifyContent: 'center', alignItems: 'center',
  },
  setCheckboxCompleted: { backgroundColor: couleurs.accent, borderColor: couleurs.accent },
  setCheckboxReadOnly: { opacity: 0.7 },
  setNumber: { fontSize: 13, fontWeight: '600', color: couleurs.texteDoux, width: 58 },
  setInput: {
    color: couleurs.texte,
    flex: 1, height: 36,
    borderWidth: 1, borderColor: couleurs.bord,
    borderRadius: 8, paddingHorizontal: 8,
    fontSize: 14, backgroundColor: couleurs.fond,
  },
  // Renforcement : le champ de temps occupe la largeur des deux champs qu'il remplace.
  champTempsRangee: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  champTemps: {
    color: couleurs.texte,
    flex: 1, height: 36,
    borderWidth: 1, borderColor: couleurs.bord,
    borderRadius: 8, paddingHorizontal: 8,
    fontSize: 14, backgroundColor: couleurs.fond,
  },
  champTempsSuffixe: {
    fontSize: 12,
    color: couleurs.texteFaible,
  },
  setInputReadOnly: {
    backgroundColor: couleurs.fond,
    color: couleurs.texteFaible,
    borderColor: couleurs.bord,
  },
  restInfo: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  restText: { fontSize: 12, color: couleurs.texteFaible },

  // ── Repos inline (dans timerBar) ──
  restInlineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  restInlineLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: couleurs.accent,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  restInlineSkipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: couleurs.fond,
    borderRadius: 8,
  },
  restInlineSkipText: { fontSize: 12, fontWeight: '600', color: couleurs.texteFaible },
  restInlineCount: {
    fontSize: 52,
    fontWeight: '800',
    color: couleurs.accent,
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    marginVertical: 4,
  },
  restInlineProgressBar: {
    width: '100%',
    height: 4,
    backgroundColor: couleurs.eleve,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  restInlineProgressFill: {
    height: 4,
    backgroundColor: couleurs.accent,
    borderRadius: 2,
  },
  globalTimerSmallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  globalTimerSmallText: {
    fontSize: 12,
    color: couleurs.texteFaible,
    fontVariant: ['tabular-nums'],
  },

  // ── Footer ──
  footer: {
    backgroundColor: couleurs.carte,
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: couleurs.bord,
  },
  footerDone: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: couleurs.accentVoile,
    padding: 18,
    paddingBottom: 28,
    borderTopWidth: 2,
    borderTopColor: couleurs.accent,
  },
  footerDoneText: {
    fontSize: 16,
    fontWeight: '700',
    color: couleurs.accent,
  },
  progressText: { fontSize: 13, color: couleurs.texteFaible, textAlign: 'center', marginBottom: 10 },
  validateButton: {
    backgroundColor: couleurs.accent,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  validateButtonDisabled: { backgroundColor: couleurs.eleve },
  validateButtonText: { color: couleurs.texteInverse, fontSize: 15, fontWeight: '700' },
});

export default SessionDetailScreen;
