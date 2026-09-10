import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { sessionsAPI, setCompletionsAPI } from '../../services/api';
import ExerciseDetailModal from '../../components/ExerciseDetailModal';
import { couleurs } from '../../theme';

const CoachSessionFillScreen = ({ route, navigation }) => {
  const { sessionId, clientId } = route.params;
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [setCompletions, setSetCompletions] = useState({});
  const [selectedExerciseForDetail, setSelectedExerciseForDetail] = useState(null);

  useEffect(() => {
    fetchSession();
  }, [sessionId]);

  const fetchSession = async () => {
    try {
      const response = await sessionsAPI.getById(sessionId);
      const sessionData = response.data.data;
      setSession(sessionData);

      // Initialiser les completions depuis la base
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
      console.error('Erreur chargement séance:', error);
      Alert.alert('Erreur', 'Impossible de charger la séance');
    } finally {
      setLoading(false);
    }
  };

  const toggleSet = async (exerciseId, setNumber, exercise) => {
    const currentState = setCompletions[exerciseId]?.[setNumber];
    const isCompleted = currentState?.completed || false;

    try {
      if (isCompleted) {
        await setCompletionsAPI.delete(exerciseId, setNumber);
        setSetCompletions((prev) => {
          const newState = { ...prev };
          if (newState[exerciseId]) {
            delete newState[exerciseId][setNumber];
          }
          return newState;
        });
      } else {
        const chronometre = exercise.category === 'RENFORCEMENT';
        const repsAchieved = currentState?.repsAchieved || exercise.reps || '';
        const durationAchieved = currentState?.durationAchieved || exercise.duration || '';
        const weightUsed = currentState?.weightUsed || exercise.weight || '';

        await setCompletionsAPI.update({
          exerciseId,
          setNumber,
          // Champs exclusifs : un temps tenu envoyé en répétitions gonflerait le
          // volume et le 1RM d'un facteur soixante.
          repsAchieved: chronometre ? undefined : repsAchieved,
          durationAchieved: chronometre ? durationAchieved : undefined,
          weightUsed: chronometre ? undefined : weightUsed,
        });

        setSetCompletions((prev) => ({
          ...prev,
          [exerciseId]: {
            ...prev[exerciseId],
            [setNumber]: {
              repsAchieved,
              durationAchieved,
              weightUsed,
              completed: true,
            },
          },
        }));
      }
    } catch (error) {
      console.error('Erreur toggle série:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder');
    }
  };

  const updateSetData = async (exerciseId, setNumber, field, value) => {
    setSetCompletions((prev) => ({
      ...prev,
      [exerciseId]: {
        ...prev[exerciseId],
        [setNumber]: {
          ...prev[exerciseId]?.[setNumber],
          [field]: value,
        },
      },
    }));

    // Auto-save si la série est déjà cochée
    if (setCompletions[exerciseId]?.[setNumber]?.completed) {
      try {
        const updatedData = {
          ...setCompletions[exerciseId][setNumber],
          [field]: value,
        };
        await setCompletionsAPI.update({
          exerciseId,
          setNumber,
          repsAchieved: updatedData.repsAchieved,
          weightUsed: updatedData.weightUsed,
        });
      } catch (error) {
        console.error('Erreur mise à jour série:', error);
      }
    }
  };

  const handleValidateSession = async () => {
    Alert.alert(
      'Valider la séance',
      'Valider cette séance pour le client ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Valider',
          onPress: async () => {
            try {
              await sessionsAPI.validateSession(sessionId);
              Alert.alert('Succès', 'Séance validée !');
              navigation.goBack();
            } catch (error) {
              console.error('Erreur validation:', error);
              Alert.alert('Erreur', 'Impossible de valider la séance');
            }
          },
        },
      ]
    );
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'WARMUP': return 'flame-outline';
      case 'MAIN': return 'barbell-outline';
      case 'CARDIO': return 'heart-outline';
      case 'STRETCHING': return 'flower-outline';
      default: return 'fitness-outline';
    }
  };

  const getCategoryLabel = (category) => {
    switch (category) {
      case 'WARMUP': return 'Échauffement';
      case 'MAIN': return 'Musculation';
      case 'CARDIO': return 'Cardio';
      case 'STRETCHING': return 'Étirements';
      default: return category;
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'WARMUP': return couleurs.alerte;
      case 'MAIN': return couleurs.info;
      case 'CARDIO': return couleurs.danger;
      case 'STRETCHING': return couleurs.violet;
      default: return couleurs.texteFaible;
    }
  };

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
        <Ionicons name="alert-circle-outline" size={56} color={couleurs.texteFaible} />
        <Text style={styles.errorText}>Séance introuvable</Text>
      </View>
    );
  }

  const isReadOnly = session.status === 'DONE';

  const exercisesByCategory = session.exercises?.reduce((acc, exercise) => {
    if (!acc[exercise.category]) acc[exercise.category] = [];
    acc[exercise.category].push(exercise);
    return acc;
  }, {}) || {};

  const { total, completed } = getTotalCompletedSets();
  const allCompleted = total > 0 && completed === total;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Entête séance */}
        <View style={styles.sessionHeader}>
          <Text style={styles.sessionTitle}>
            {session.title || session.notes || 'Séance'}
          </Text>
          <Text style={styles.sessionDate}>
            {new Date(session.date).toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </Text>
          {session.status === 'DONE' && (
            <View style={styles.doneBadge}>
              <Ionicons name="checkmark-circle" size={16} color={couleurs.succes} />
              <Text style={styles.doneBadgeText}>Séance déjà validée</Text>
            </View>
          )}
        </View>

        {/* Exercices par catégorie */}
        {Object.entries(exercisesByCategory).map(([category, exercises]) => (
          <View key={category} style={styles.categorySection}>
            <View style={styles.categoryHeader}>
              <Ionicons
                name={getCategoryIcon(category)}
                size={22}
                color={getCategoryColor(category)}
              />
              <Text style={[styles.categoryTitle, { color: getCategoryColor(category) }]}>
                {getCategoryLabel(category)}
              </Text>
            </View>

            {exercises.map((exercise) => {
              const exerciseCompleted = isExerciseCompleted(exercise);
              return (
                <View key={exercise.id} style={styles.exerciseCard}>
                  <View style={styles.exerciseHeader}>
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                      onPress={() => setSelectedExerciseForDetail(exercise)}
                    >
                      <Text style={[styles.exerciseName, exerciseCompleted && styles.exerciseNameDone]}>
                        {exercise.name}
                      </Text>
                      {(exercise.exerciseRefId || exercise.exerciseRef) && (
                        <Ionicons name="information-circle-outline" size={18} color={couleurs.accent} />
                      )}
                    </TouchableOpacity>
                    {exerciseCompleted && (
                      <Ionicons name="checkmark-circle" size={24} color={couleurs.succes} />
                    )}
                  </View>

                  {exercise.description && (
                    <Text style={styles.exerciseDescription}>{exercise.description}</Text>
                  )}

                  {/* Séries */}
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
                        const chronometre = exercise.category === 'RENFORCEMENT';

                        return (
                          <View key={setNumber} style={styles.setRow}>
                            <TouchableOpacity
                              style={[styles.setCheckbox, setData.completed && styles.setCheckboxDone, isReadOnly && styles.setCheckboxReadOnly]}
                              onPress={() => !isReadOnly && toggleSet(exercise.id, setNumber, exercise)}
                              disabled={isReadOnly}
                            >
                              {setData.completed && (
                                <Ionicons name="checkmark" size={14} color={couleurs.texteInverse} />
                              )}
                            </TouchableOpacity>
                            <Text style={styles.setNumber}>Série {setNumber}</Text>
                            {chronometre ? (
                              <TextInput
                                style={[styles.setInput, { flex: 2 }, isReadOnly && styles.setInputReadOnly]}
                                placeholder="Temps tenu (45s)"
                                value={String(setData.durationAchieved || '')}
                                onChangeText={(v) => updateSetData(exercise.id, setNumber, 'durationAchieved', v)}
                                editable={!isReadOnly}
                              />
                            ) : (
                              <>
                                <TextInput
                                  style={[styles.setInput, isReadOnly && styles.setInputReadOnly]}
                                  placeholder="Reps"
                                  value={String(setData.repsAchieved || '')}
                                  onChangeText={(v) => updateSetData(exercise.id, setNumber, 'repsAchieved', v)}
                                  keyboardType="numeric"
                                  editable={!isReadOnly}
                                />
                                <TextInput
                                  style={[styles.setInput, isReadOnly && styles.setInputReadOnly]}
                                  placeholder="Poids"
                                  value={String(setData.weightUsed || '')}
                                  onChangeText={(v) => updateSetData(exercise.id, setNumber, 'weightUsed', v)}
                                  keyboardType="decimal-pad"
                                  editable={!isReadOnly}
                                />
                              </>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.exerciseDuration}>
                      {exercise.duration ? `Durée : ${exercise.duration}` : ''}
                    </Text>
                  )}

                  {exercise.restTime && (
                    <View style={styles.restRow}>
                      <Ionicons name="timer-outline" size={14} color={couleurs.texteFaible} />
                      <Text style={styles.restText}>Repos : {exercise.restTime}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Modale détail exercice */}
      <ExerciseDetailModal
        visible={!!selectedExerciseForDetail}
        exercise={selectedExerciseForDetail}
        onClose={() => setSelectedExerciseForDetail(null)}
      />

      {/* Footer */}
      <View style={styles.footer}>
        {isReadOnly ? (
          <View style={styles.readOnlyFooter}>
            <Ionicons name="lock-closed" size={18} color={couleurs.succes} />
            <Text style={styles.readOnlyText}>Séance terminée — lecture seule</Text>
          </View>
        ) : (
          <>
            <Text style={styles.progressText}>
              {completed} / {total} séries terminées
            </Text>
            <TouchableOpacity
              style={[styles.validateButton, !allCompleted && styles.validateButtonDisabled]}
              onPress={handleValidateSession}
              disabled={!allCompleted}
            >
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={couleurs.texteInverse}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.validateButtonText}>
                {allCompleted ? 'Valider la séance' : 'Terminez toutes les séries'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
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
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: couleurs.texteFaible,
    marginTop: 12,
  },
  scrollView: {
    flex: 1,
  },
  // Header séance
  sessionHeader: {
    backgroundColor: couleurs.carte,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  sessionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: couleurs.texte,
    marginBottom: 6,
  },
  sessionDate: {
    fontSize: 14,
    color: couleurs.texteFaible,
    textTransform: 'capitalize',
  },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  doneBadgeText: {
    fontSize: 13,
    color: couleurs.succes,
    fontWeight: '600',
  },
  // Catégories
  categorySection: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  // Exercice
  exerciseCard: {
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
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '600',
    color: couleurs.texte,
    flex: 1,
  },
  exerciseNameDone: {
    color: couleurs.succes,
  },
  exerciseDescription: {
    fontSize: 13,
    color: couleurs.texteFaible,
    marginBottom: 10,
    lineHeight: 18,
  },
  exerciseDuration: {
    fontSize: 13,
    color: couleurs.texteFaible,
  },
  // Séries
  setsContainer: {
    marginTop: 8,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  setCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: couleurs.bord,
    justifyContent: 'center',
    alignItems: 'center',
  },
  setCheckboxDone: {
    backgroundColor: couleurs.succes,
    borderColor: couleurs.succes,
  },
  setNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: couleurs.texte,
    width: 58,
  },
  setInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: couleurs.bord,
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 14,
    color: couleurs.texte,
    backgroundColor: couleurs.fond,
  },
  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  restText: {
    fontSize: 12,
    color: couleurs.texteFaible,
  },
  // Footer
  footer: {
    backgroundColor: couleurs.carte,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: couleurs.bord,
  },
  progressText: {
    fontSize: 14,
    color: couleurs.texteFaible,
    textAlign: 'center',
    marginBottom: 12,
  },
  validateButton: {
    backgroundColor: couleurs.accent,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  validateButtonDisabled: {
    backgroundColor: couleurs.eleve,
  },
  validateButtonText: {
    color: couleurs.texteInverse,
    fontSize: 16,
    fontWeight: '600',
  },
  setCheckboxReadOnly: {
    opacity: 0.6,
  },
  setInputReadOnly: {
    backgroundColor: couleurs.fond,
    color: couleurs.texteFaible,
    borderColor: couleurs.bord,
  },
  readOnlyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  readOnlyText: {
    fontSize: 15,
    color: couleurs.succes,
    fontWeight: '600',
  },
});

export default CoachSessionFillScreen;
