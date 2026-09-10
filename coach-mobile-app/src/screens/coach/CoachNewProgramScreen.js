import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { programsAPI, templatesAPI } from '../../services/api';
import { format } from 'date-fns';
import DatePickerField from '../../components/DatePickerField';
import CalorieCalculator from '../../components/CalorieCalculator';
import { couleurs } from '../../theme';

// -----------------------------------------------------------------------
// Composant d'une ligne de toggle avec option de valeur
// -----------------------------------------------------------------------
const TrackingRow = ({ icon, iconColor, label, subtitle, value, onToggle, children }) => (
  <View style={styles.trackingRow}>
    <View style={styles.trackingRowLeft}>
      <View style={[styles.trackingIcon, { backgroundColor: iconColor + '22' }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.trackingText}>
        <Text style={styles.trackingLabel}>{label}</Text>
        {subtitle && <Text style={styles.trackingSubtitle}>{subtitle}</Text>}
      </View>
    </View>
    <Switch
      value={value}
      onValueChange={onToggle}
      trackColor={{ false: couleurs.bordFort, true: couleurs.accentVoileFort }}
      thumbColor={value ? couleurs.accent : couleurs.texteFaible}
    />
    {children && value && <View style={styles.trackingChild}>{children}</View>}
  </View>
);

// -----------------------------------------------------------------------
// Écran principal
// -----------------------------------------------------------------------
const CoachNewProgramScreen = ({ route, navigation }) => {
  const { clientId, clientName } = route.params;

  const scrollRef = useRef(null);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState('');
  const [cycleDays, setCycleDays] = useState('');

  // Tracking
  const [waterTracking, setWaterTracking] = useState(false);
  const [waterGoal, setWaterGoal] = useState('2');
  const [sleepTracking, setSleepTracking] = useState(false);
  const [weightTracking, setWeightTracking] = useState(false);
  const [dietEnabled, setDietEnabled] = useState(false);
  const [targetCalories, setTargetCalories] = useState('');

  // Objectifs personnalisés
  const [customGoals, setCustomGoals] = useState([]);

  const addGoal = () => {
    setCustomGoals((prev) => [...prev, { title: '', description: '' }]);
  };

  const updateGoal = (index, field, value) => {
    setCustomGoals((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeGoal = (index) => {
    setCustomGoals((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const newErrors = {};
    if (!title.trim()) newErrors.title = 'Le titre est requis';
    if (!startDate)    newErrors.startDate = 'La date de début est requise';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      const data = {
        clientId,
        title: title.trim(),
        description: description.trim() || undefined,
        startDate,
        endDate: endDate || undefined,
        cycleDays: cycleDays ? parseInt(cycleDays) : undefined,
        waterTrackingEnabled: waterTracking,
        waterGoal: waterTracking && waterGoal ? parseFloat(waterGoal) : undefined,
        sleepTrackingEnabled: sleepTracking,
        weightTrackingEnabled: weightTracking,
        dietEnabled,
        targetCalories: dietEnabled && targetCalories ? parseInt(targetCalories) : undefined,
        customGoalsData:
          customGoals.filter((g) => g.title.trim()).length > 0
            ? customGoals.filter((g) => g.title.trim())
            : undefined,
      };

      const response = await programsAPI.create(data);
      if (response.data.success) {
        const program = response.data.data;
        navigation.replace('CoachProgramCalendar', {
          programId: program.id,
          programTitle: program.title,
          clientName,
          clientId,
        });
      }
    } catch (error) {
      console.error('Erreur création programme:', error);
      const msg = error?.response?.data?.message || 'Impossible de créer le programme';
      Alert.alert('Erreur', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={couleurs.texte} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Nouveau programme</Text>
          {clientName && (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              Pour {clientName}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={couleurs.texteInverse} />
          ) : (
            <Text style={styles.saveButtonText}>Créer</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Informations de base */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations</Text>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, errors.title && styles.fieldLabelError]}>
              Titre du programme *
            </Text>
            <TextInput
              style={[styles.input, errors.title && styles.inputError]}
              value={title}
              onChangeText={(v) => { setTitle(v); if (errors.title) setErrors((e) => ({ ...e, title: undefined })); }}
              placeholder="Ex : Programme printemps, Force 12 semaines…"
              placeholderTextColor={couleurs.texteFaible}
            />
            {errors.title && <Text style={styles.fieldErrorText}>{errors.title}</Text>}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Objectifs, notes pour le client…"
              placeholderTextColor={couleurs.texteFaible}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Dates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dates</Text>

          <View style={styles.field}>
            <DatePickerField
              label="Date de début *"
              value={startDate}
              onChange={(v) => { setStartDate(v); if (errors.startDate) setErrors((e) => ({ ...e, startDate: undefined })); }}
              maximumDate={endDate ? new Date(endDate + 'T12:00:00') : undefined}
              error={errors.startDate}
            />
          </View>

          <View style={styles.field}>
            <DatePickerField
              label="Date de fin (optionnel)"
              value={endDate}
              onChange={setEndDate}
              minimumDate={startDate ? new Date(startDate + 'T12:00:00') : undefined}
              placeholder="Non définie"
            />
            {endDate ? (
              <TouchableOpacity
                onPress={() => setEndDate('')}
                style={styles.clearDateBtn}
              >
                <Ionicons name="close-circle-outline" size={14} color={couleurs.texteFaible} />
                <Text style={styles.clearDateText}>Effacer la date de fin</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Durée du cycle (jours)</Text>
            <TextInput
              style={[styles.input, styles.inputSmall]}
              value={cycleDays}
              onChangeText={setCycleDays}
              placeholder="Ex : 7"
              placeholderTextColor={couleurs.texteFaible}
              keyboardType="number-pad"
            />
            <Text style={styles.fieldHint}>
              Nombre de jours avant que le cycle se répète (laisser vide si pas de cycle)
            </Text>
          </View>
        </View>

        {/* Suivi */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Suivi client</Text>

          {/* Eau */}
          <TrackingRow
            icon="water-outline"
            iconColor={couleurs.info}
            label="Hydratation"
            subtitle="Suivi de la consommation d'eau"
            value={waterTracking}
            onToggle={setWaterTracking}
          />
          {waterTracking && (
            <View style={styles.subField}>
              <Text style={styles.fieldLabel}>Objectif eau (litres/jour)</Text>
              <TextInput
                style={[styles.input, styles.inputSmall]}
                value={waterGoal}
                onChangeText={setWaterGoal}
                keyboardType="decimal-pad"
                placeholder="2"
                placeholderTextColor={couleurs.texteFaible}
              />
            </View>
          )}

          {/* Sommeil */}
          <TrackingRow
            icon="moon-outline"
            iconColor={couleurs.violet}
            label="Sommeil"
            subtitle="Suivi des heures de sommeil"
            value={sleepTracking}
            onToggle={setSleepTracking}
          />

          {/* Poids */}
          <TrackingRow
            icon="scale-outline"
            iconColor={couleurs.succes}
            label="Poids"
            subtitle="Suivi du poids corporel"
            value={weightTracking}
            onToggle={setWeightTracking}
          />

          {/* Alimentation */}
          <TrackingRow
            icon="nutrition-outline"
            iconColor={couleurs.alerte}
            label="Alimentation"
            subtitle="Suivi des calories"
            value={dietEnabled}
            onToggle={setDietEnabled}
          />
          {dietEnabled && (
            <View style={styles.subField}>
              <Text style={styles.fieldLabel}>Objectif calorique (kcal/jour)</Text>
              <TextInput
                style={[styles.input, styles.inputSmall]}
                value={targetCalories}
                onChangeText={setTargetCalories}
                keyboardType="number-pad"
                placeholder="Ex : 2200"
                placeholderTextColor={couleurs.texteFaible}
              />
              <CalorieCalculator
                clientId={clientId}
                onApply={(cal) => setTargetCalories(cal)}
              />
            </View>
          )}
        </View>

        {/* Objectifs personnalisés */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Objectifs personnalisés</Text>
            <TouchableOpacity style={styles.addGoalBtn} onPress={addGoal}>
              <Ionicons name="add-circle-outline" size={20} color={couleurs.accent} />
              <Text style={styles.addGoalText}>Ajouter</Text>
            </TouchableOpacity>
          </View>

          {customGoals.length === 0 ? (
            <Text style={styles.emptyHint}>
              Ajoutez des objectifs spécifiques que le client devra valider chaque jour.
            </Text>
          ) : (
            customGoals.map((goal, index) => (
              <View key={index} style={styles.goalCard}>
                <View style={styles.goalCardHeader}>
                  <Text style={styles.goalCardIndex}>Objectif {index + 1}</Text>
                  <TouchableOpacity onPress={() => removeGoal(index)}>
                    <Ionicons name="trash-outline" size={18} color={couleurs.danger} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.input}
                  value={goal.title}
                  onChangeText={(v) => updateGoal(index, 'title', v)}
                  placeholder="Titre de l'objectif"
                  placeholderTextColor={couleurs.texteFaible}
                />
                <TextInput
                  style={[styles.input, styles.textArea, { marginTop: 8 }]}
                  value={goal.description}
                  onChangeText={(v) => updateGoal(index, 'description', v)}
                  placeholder="Description (optionnel)"
                  placeholderTextColor={couleurs.texteFaible}
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                />
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: couleurs.fond,
  },
  // Header
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
  saveButton: {
    backgroundColor: couleurs.accent,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 64,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: couleurs.texteInverse,
    fontSize: 14,
    fontWeight: '700',
  },
  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  // Section
  section: {
    backgroundColor: couleurs.carte,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    shadowColor: couleurs.ombre,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: couleurs.texte,
    marginBottom: 12,
  },
  // Champ
  field: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: couleurs.texteDoux,
    marginBottom: 6,
  },
  fieldHint: {
    fontSize: 11,
    color: couleurs.texteFaible,
    marginTop: 4,
  },
  fieldLabelError: {
    color: couleurs.danger,
  },
  inputError: {
    color: couleurs.texte,
    borderColor: couleurs.danger,
    backgroundColor: couleurs.dangerVoile,
  },
  fieldErrorText: {
    fontSize: 12,
    color: couleurs.danger,
    marginTop: 4,
  },
  input: {
    backgroundColor: couleurs.fond,
    borderWidth: 1,
    borderColor: couleurs.bord,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 14,
    color: couleurs.texte,
  },
  inputSmall: {
    color: couleurs.texte,
    maxWidth: 140,
  },
  textArea: {
    color: couleurs.texte,
    height: 80,
    paddingTop: 10,
  },
  row: {
    flexDirection: 'row',
  },
  // Tracking
  trackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  trackingRowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackingIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  trackingText: {
    flex: 1,
  },
  trackingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: couleurs.texte,
  },
  trackingSubtitle: {
    fontSize: 12,
    color: couleurs.texteFaible,
    marginTop: 1,
  },
  subField: {
    marginTop: 8,
    marginBottom: 4,
    marginLeft: 48,
  },
  // Objectifs
  addGoalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addGoalText: {
    fontSize: 13,
    color: couleurs.accent,
    fontWeight: '600',
  },
  emptyHint: {
    fontSize: 13,
    color: couleurs.texteFaible,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  goalCard: {
    backgroundColor: couleurs.fond,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: couleurs.bord,
  },
  goalCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  goalCardIndex: {
    fontSize: 12,
    fontWeight: '700',
    color: couleurs.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  clearDateText: {
    fontSize: 12,
    color: couleurs.texteFaible,
  },
});

export default CoachNewProgramScreen;
