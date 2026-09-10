import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Switch,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { sessionTemplatesAPI, exerciseRefsAPI, templatesAPI } from '../../services/api';
import { couleurs } from '../../theme';

// -----------------------------------------------------------------------
// Constantes catégories
// -----------------------------------------------------------------------
const CATEGORIES = [
  { key: 'WARMUP',     label: 'Échauff.',   color: couleurs.alerte, bg: couleurs.alerteVoile, icon: 'flame-outline' },
  { key: 'MAIN',       label: 'Muscu',      color: couleurs.accent, bg: couleurs.accentVoile, icon: 'barbell-outline' },
  { key: 'CARDIO',     label: 'Cardio',     color: couleurs.danger, bg: couleurs.dangerVoile, icon: 'heart-outline' },
  { key: 'STRETCHING', label: 'Étirement', color: couleurs.succes, bg: couleurs.succesVoile, icon: 'body-outline' },
];

const getCat = (key) => CATEGORIES.find((c) => c.key === key) || CATEGORIES[1];

const tempId = () => `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const emptyExercise = () => ({
  id: tempId(),
  name: '',
  category: 'MAIN',
  sets: '',
  reps: '',
  weight: '',
  duration: '',
  restTime: '',
  description: '',
  exerciseRefId: '',
});

// -----------------------------------------------------------------------
// Modal de recherche d'exercice (inline dans templates)
// -----------------------------------------------------------------------
const ExerciseSearchModal = ({ visible, onClose, onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (!q || q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await exerciseRefsAPI.search(q.trim(), 20);
      setResults(res.data.data || []);
    } catch { setResults([]); }
    finally { setSearching(false); }
  }, []);

  const handleChange = (text) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(text), 400);
  };

  const handleClose = () => { setQuery(''); setResults([]); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.searchModal}>
        <View style={styles.searchModalHeader}>
          <TouchableOpacity onPress={handleClose} style={{ padding: 4, marginRight: 10 }}>
            <Ionicons name="arrow-back" size={24} color={couleurs.texte} />
          </TouchableOpacity>
          <Text style={styles.searchModalTitle}>Rechercher un exercice</Text>
        </View>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search-outline" size={18} color={couleurs.texteFaible} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={handleChange}
            placeholder="Développé couché, squat…"
            placeholderTextColor={couleurs.texteFaible}
            autoFocus
            clearButtonMode="while-editing"
          />
          {searching && <ActivityIndicator size="small" color={couleurs.accent} />}
        </View>
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.searchResultItem}
              onPress={() => { onSelect(item); handleClose(); }}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.searchResultName} numberOfLines={1}>{item.name}</Text>
                {item.bodyParts?.length > 0 && (
                  <Text style={styles.searchResultMeta} numberOfLines={1}>{item.bodyParts.join(', ')}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color={couleurs.texteFaible} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            query.length >= 2 && !searching ? (
              <View style={styles.searchEmpty}>
                <Text style={styles.searchEmptyText}>Aucun résultat pour « {query} »</Text>
              </View>
            ) : (
              <View style={styles.searchHint}>
                <Ionicons name="search" size={40} color={couleurs.bordFort} />
                <Text style={{ color: couleurs.texteFaible, marginTop: 12 }}>Tapez au moins 2 caractères</Text>
              </View>
            )
          }
          contentContainerStyle={{ paddingBottom: 80 }}
        />
        {query.trim().length >= 1 && (
          <TouchableOpacity
            style={styles.freeExerciseBtn}
            onPress={() => { onSelect({ id: null, name: query.trim() }); handleClose(); }}
          >
            <Ionicons name="add-circle-outline" size={18} color={couleurs.accent} />
            <Text style={styles.freeExerciseBtnText}>Utiliser « {query.trim()} » comme exercice libre</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
};

// -----------------------------------------------------------------------
// Formulaire de création/édition de template de séance
// -----------------------------------------------------------------------
const TemplateFormModal = ({ visible, template, onClose, onSaved }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [exercises, setExercises] = useState([emptyExercise()]);
  const [saving, setSaving] = useState(false);
  const [searchTargetIndex, setSearchTargetIndex] = useState(null);
  const [searchVisible, setSearchVisible] = useState(false);

  // Pré-remplir si édition
  useEffect(() => {
    if (!visible) return;
    if (template) {
      setName(template.name ?? '');
      setDescription(template.description ?? '');
      setExercises(
        (template.exercisesData ?? []).map((ex) => ({
          id: tempId(),
          name: ex.name ?? '',
          category: ex.category ?? 'MAIN',
          sets: ex.sets?.toString() ?? '',
          reps: ex.reps ?? '',
          weight: ex.weight ?? '',
          duration: ex.duration ?? '',
          restTime: ex.restTime ?? '',
          description: ex.description ?? '',
          exerciseRefId: ex.exerciseRefId ?? '',
        }))
      );
    } else {
      setName('');
      setDescription('');
      setExercises([emptyExercise()]);
    }
  }, [visible, template]);

  const updateEx = (index, field, value) => {
    setExercises((prev) => {
      const u = [...prev];
      u[index] = { ...u[index], [field]: value };
      return u;
    });
  };

  const addEx = () => setExercises((prev) => [...prev, emptyExercise()]);

  const removeEx = (index) => setExercises((prev) => prev.filter((_, i) => i !== index));

  const moveEx = (index, dir) => {
    const target = dir === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= exercises.length) return;
    setExercises((prev) => {
      const n = [...prev];
      [n[index], n[target]] = [n[target], n[index]];
      return n;
    });
  };

  const handleSelectExercise = (ref) => {
    if (searchTargetIndex === null) return;
    setExercises((prev) => {
      const u = [...prev];
      u[searchTargetIndex] = {
        ...u[searchTargetIndex],
        name: ref.name,
        exerciseRefId: ref.id || '',
      };
      return u;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Le nom du template est requis');
      return;
    }
    setSaving(true);
    try {
      const exercisesData = exercises
        .filter((ex) => ex.name.trim())
        .map((ex, i) => ({
          name: ex.name,
          category: ex.category,
          sets: ex.sets ? parseInt(ex.sets) || undefined : undefined,
          reps: ex.reps || undefined,
          weight: ex.weight || undefined,
          duration: ex.duration || undefined,
          restTime: ex.restTime || undefined,
          description: ex.description || undefined,
          exerciseRefId: ex.exerciseRefId || undefined,
          order: i,
        }));

      const data = {
        name: name.trim(),
        description: description.trim() || undefined,
        exercisesData,
      };

      let res;
      if (template) {
        res = await sessionTemplatesAPI.update(template.id, data);
      } else {
        res = await sessionTemplatesAPI.create(data);
      }

      if (res.data.success) {
        onSaved(res.data.data);
        onClose();
      }
    } catch (error) {
      const msg = error?.response?.data?.message || 'Erreur lors de la sauvegarde';
      Alert.alert('Erreur', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent={false}>
        <View style={styles.formModalContainer}>
          {/* Header */}
          <View style={styles.formModalHeader}>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color={couleurs.texte} />
            </TouchableOpacity>
            <Text style={styles.formModalTitle}>
              {template ? 'Modifier le template' : 'Nouveau template'}
            </Text>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={couleurs.texteInverse} />
              ) : (
                <Text style={styles.saveBtnText}>Sauver</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formModalScroll} contentContainerStyle={{ padding: 16 }}>
            {/* Infos */}
            <View style={styles.formSection}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Nom du template *</Text>
                <TextInput
                  style={styles.formInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Ex : Push Day, Full Body…"
                  placeholderTextColor={couleurs.texteFaible}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Description</Text>
                <TextInput
                  style={[styles.formInput, { height: 60 }]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Description optionnelle…"
                  placeholderTextColor={couleurs.texteFaible}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            </View>

            {/* Exercices */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Exercices ({exercises.filter((e) => e.name).length})</Text>

              {exercises.map((ex, index) => {
                const cat = getCat(ex.category);
                const isMain = ex.category === 'MAIN';
                const isCardio = ex.category === 'CARDIO';

                return (
                  <View key={ex.id} style={styles.exCard}>
                    {/* Nom */}
                    <View style={styles.exCardHeader}>
                      <View style={styles.exNumBadge}>
                        <Text style={styles.exNumText}>{index + 1}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.exNameBtn}
                        onPress={() => { setSearchTargetIndex(index); setSearchVisible(true); }}
                      >
                        <Text style={ex.name ? styles.exName : styles.exNamePlaceholder} numberOfLines={1}>
                          {ex.name || 'Toucher pour choisir…'}
                        </Text>
                        <Ionicons name="search-outline" size={15} color={couleurs.texteFaible} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => removeEx(index)} style={{ padding: 4 }}>
                        <Ionicons name="trash-outline" size={17} color={couleurs.danger} />
                      </TouchableOpacity>
                    </View>

                    {/* Catégorie chips */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catScrollContent}>
                      {CATEGORIES.map((c) => (
                        <TouchableOpacity
                          key={c.key}
                          style={[styles.catChip, ex.category === c.key && { backgroundColor: c.bg, borderColor: c.color, borderWidth: 1.5 }]}
                          onPress={() => updateEx(index, 'category', c.key)}
                        >
                          <Text style={[styles.catChipText, { color: ex.category === c.key ? c.color : couleurs.texteFaible }]}>{c.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    {/* Params */}
                    <View style={styles.exParams}>
                      {isMain && (
                        <>
                          <View style={styles.exParamField}>
                            <Text style={styles.exParamLabel}>Séries</Text>
                            <TextInput style={styles.exParamInput} value={ex.sets} onChangeText={(v) => updateEx(index, 'sets', v)} placeholder="3" keyboardType="number-pad" placeholderTextColor={couleurs.texteFaible} />
                          </View>
                          <View style={styles.exParamField}>
                            <Text style={styles.exParamLabel}>Reps</Text>
                            <TextInput style={styles.exParamInput} value={ex.reps} onChangeText={(v) => updateEx(index, 'reps', v)} placeholder="10-12" placeholderTextColor={couleurs.texteFaible} />
                          </View>
                          <View style={styles.exParamField}>
                            <Text style={styles.exParamLabel}>Poids</Text>
                            <TextInput style={styles.exParamInput} value={ex.weight} onChangeText={(v) => updateEx(index, 'weight', v)} placeholder="20kg" placeholderTextColor={couleurs.texteFaible} />
                          </View>
                        </>
                      )}
                      {(isCardio || ex.category === 'WARMUP' || ex.category === 'STRETCHING') && (
                        <View style={styles.exParamField}>
                          <Text style={styles.exParamLabel}>Durée</Text>
                          <TextInput style={styles.exParamInput} value={ex.duration} onChangeText={(v) => updateEx(index, 'duration', v)} placeholder="20min" placeholderTextColor={couleurs.texteFaible} />
                        </View>
                      )}
                      <View style={styles.exParamField}>
                        <Text style={styles.exParamLabel}>Repos</Text>
                        <TextInput style={styles.exParamInput} value={ex.restTime} onChangeText={(v) => updateEx(index, 'restTime', v)} placeholder="90s" placeholderTextColor={couleurs.texteFaible} />
                      </View>
                    </View>

                    {/* Réordonner */}
                    <View style={styles.exReorder}>
                      <TouchableOpacity
                        style={[styles.reorderBtn, index === 0 && { opacity: 0.3 }]}
                        onPress={() => moveEx(index, 'up')}
                        disabled={index === 0}
                      >
                        <Ionicons name="chevron-up" size={15} color={couleurs.texteFaible} />
                        <Text style={styles.reorderText}>Monter</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.reorderBtn, index === exercises.length - 1 && { opacity: 0.3 }]}
                        onPress={() => moveEx(index, 'down')}
                        disabled={index === exercises.length - 1}
                      >
                        <Ionicons name="chevron-down" size={15} color={couleurs.texteFaible} />
                        <Text style={styles.reorderText}>Descendre</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}

              <TouchableOpacity style={styles.addExBtn} onPress={addEx}>
                <Ionicons name="add-circle-outline" size={18} color={couleurs.accent} />
                <Text style={styles.addExBtnText}>Ajouter un exercice</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Modal recherche */}
      <ExerciseSearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onSelect={handleSelectExercise}
      />
    </>
  );
};

// -----------------------------------------------------------------------
// Carte de template de séance (liste)
// -----------------------------------------------------------------------
const TemplateCard = ({ template, onEdit, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const exercises = template.exercisesData ?? [];

  return (
    <View style={styles.templateCard}>
      <TouchableOpacity
        style={styles.templateCardHeader}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.7}
      >
        <View style={styles.templateCardIcon}>
          <Ionicons name="copy-outline" size={18} color={couleurs.accent} />
        </View>
        <View style={styles.templateCardInfo}>
          <Text style={styles.templateCardName} numberOfLines={1}>{template.name}</Text>
          <Text style={styles.templateCardMeta}>
            {exercises.length} exercice{exercises.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.templateCardActions}>
          <TouchableOpacity
            onPress={onEdit}
            style={styles.templateActionBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="pencil-outline" size={18} color={couleurs.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Alert.alert('Supprimer ce template ?', template.name, [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Supprimer', style: 'destructive', onPress: onDelete },
            ])}
            style={styles.templateActionBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={18} color={couleurs.danger} />
          </TouchableOpacity>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={couleurs.texteFaible}
            style={{ marginLeft: 4 }}
          />
        </View>
      </TouchableOpacity>

      {expanded && exercises.length > 0 && (
        <View style={styles.templateExerciseList}>
          {exercises.map((ex, i) => {
            const cat = getCat(ex.category);
            return (
              <View key={i} style={styles.templateExerciseRow}>
                <View style={[styles.templateExCat, { backgroundColor: cat.bg }]}>
                  <Ionicons name={cat.icon} size={12} color={cat.color} />
                </View>
                <Text style={styles.templateExName} numberOfLines={1}>{ex.name}</Text>
                <Text style={styles.templateExParams}>
                  {ex.sets && ex.reps ? `${ex.sets}×${ex.reps}` : ex.duration || ''}
                  {ex.weight ? ` · ${ex.weight}` : ''}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

// -----------------------------------------------------------------------
// Ligne de suivi (programme template form)
// -----------------------------------------------------------------------
const ProgTrackingRow = ({ icon, iconColor, iconBg, label, subtitle, value, onValueChange }) => (
  <View style={styles.trackingRow}>
    <View style={[styles.trackingIconCircle, { backgroundColor: iconBg }]}>
      <Ionicons name={icon} size={18} color={iconColor} />
    </View>
    <View style={styles.trackingRowInfo}>
      <Text style={styles.trackingRowLabel}>{label}</Text>
      {subtitle ? <Text style={styles.trackingRowSubtitle}>{subtitle}</Text> : null}
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: couleurs.bordFort, true: couleurs.accentVoileFort }}
      thumbColor={value ? couleurs.accent : couleurs.eleve}
    />
  </View>
);

// -----------------------------------------------------------------------
// Formulaire de création/édition de template de programme
// -----------------------------------------------------------------------
const ProgramTemplateFormModal = ({ visible, template, onClose, onSaved }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cycleDays, setCycleDays] = useState('');
  const [waterTracking, setWaterTracking] = useState(false);
  const [waterGoal, setWaterGoal] = useState('2');
  const [sleepTracking, setSleepTracking] = useState(false);
  const [weightTracking, setWeightTracking] = useState(false);
  const [dietEnabled, setDietEnabled] = useState(false);
  const [targetCalories, setTargetCalories] = useState('');
  const [customGoals, setCustomGoals] = useState([]);
  const [saving, setSaving] = useState(false);

  // Pré-remplir si édition
  useEffect(() => {
    if (!visible) return;
    if (template) {
      setName(template.name ?? '');
      setDescription(template.description ?? '');
      setCycleDays(template.cycleDays ? template.cycleDays.toString() : '');
      setWaterTracking(template.waterTrackingEnabled ?? false);
      setWaterGoal(template.waterGoal ? template.waterGoal.toString() : '2');
      setSleepTracking(template.sleepTrackingEnabled ?? false);
      setWeightTracking(template.weightTrackingEnabled ?? false);
      setDietEnabled(template.dietEnabled ?? false);
      setTargetCalories(template.targetCalories ? template.targetCalories.toString() : '');
      setCustomGoals(
        (template.customGoalsData ?? []).map((g) => ({
          id: tempId(),
          title: g.title ?? '',
          description: g.description ?? '',
        }))
      );
    } else {
      setName('');
      setDescription('');
      setCycleDays('');
      setWaterTracking(false);
      setWaterGoal('2');
      setSleepTracking(false);
      setWeightTracking(false);
      setDietEnabled(false);
      setTargetCalories('');
      setCustomGoals([]);
    }
  }, [visible, template]);

  const addCustomGoal = () => {
    setCustomGoals((prev) => [...prev, { id: tempId(), title: '', description: '' }]);
  };

  const updateCustomGoal = (index, field, value) => {
    setCustomGoals((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeCustomGoal = (index) => {
    setCustomGoals((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Le nom du template est requis');
      return;
    }
    setSaving(true);
    try {
      const filteredGoals = customGoals.filter((g) => g.title.trim());
      const data = {
        name: name.trim(),
        description: description.trim() || undefined,
        cycleDays: cycleDays ? parseInt(cycleDays) : undefined,
        waterTrackingEnabled: waterTracking,
        waterGoal: waterTracking && waterGoal ? parseFloat(waterGoal) : undefined,
        sleepTrackingEnabled: sleepTracking,
        weightTrackingEnabled: weightTracking,
        dietEnabled,
        targetCalories: dietEnabled && targetCalories ? parseInt(targetCalories) : undefined,
        customGoalsData: filteredGoals.length > 0 ? filteredGoals : undefined,
      };

      let res;
      if (template) {
        res = await templatesAPI.update(template.id, data);
      } else {
        res = await templatesAPI.create(data);
      }

      if (res.data.success) {
        onSaved(res.data.data);
        onClose();
      }
    } catch (error) {
      const msg = error?.response?.data?.message || 'Erreur lors de la sauvegarde';
      Alert.alert('Erreur', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.formModalContainer}>
        {/* Header */}
        <View style={styles.formModalHeader}>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
            <Ionicons name="close" size={24} color={couleurs.texte} />
          </TouchableOpacity>
          <Text style={styles.formModalTitle}>
            {template ? 'Modifier le template' : 'Nouveau template'}
          </Text>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={couleurs.texteInverse} />
            ) : (
              <Text style={styles.saveBtnText}>Sauver</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.formModalScroll} contentContainerStyle={{ padding: 16 }}>
          {/* Section Informations */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Informations</Text>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Nom *</Text>
              <TextInput
                style={styles.formInput}
                value={name}
                onChangeText={setName}
                placeholder="Ex : Programme Force, Prise de masse…"
                placeholderTextColor={couleurs.texteFaible}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Description</Text>
              <TextInput
                style={[styles.formInput, { height: 60 }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Description optionnelle…"
                placeholderTextColor={couleurs.texteFaible}
                multiline
                textAlignVertical="top"
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Durée du cycle (jours)</Text>
              <TextInput
                style={[styles.formInput, { maxWidth: 120 }]}
                value={cycleDays}
                onChangeText={setCycleDays}
                placeholder="Ex : 7"
                placeholderTextColor={couleurs.texteFaible}
                keyboardType="number-pad"
              />
              <Text style={styles.formHint}>Laisser vide si pas de cycle</Text>
            </View>
          </View>

          {/* Section Suivi client */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Suivi client</Text>

            <ProgTrackingRow
              icon="water-outline"
              iconColor={couleurs.info}
              iconBg={couleurs.infoVoile}
              label="Suivi hydratation"
              subtitle="Rappels de boire de l'eau"
              value={waterTracking}
              onValueChange={setWaterTracking}
            />
            {waterTracking && (
              <View style={[styles.formGroup, { marginTop: 8, marginLeft: 48 }]}>
                <Text style={styles.formLabel}>Objectif eau (litres/jour)</Text>
                <TextInput
                  style={[styles.formInput, { maxWidth: 120 }]}
                  value={waterGoal}
                  onChangeText={setWaterGoal}
                  placeholder="2"
                  placeholderTextColor={couleurs.texteFaible}
                  keyboardType="decimal-pad"
                />
              </View>
            )}

            <View style={styles.trackingDivider} />
            <ProgTrackingRow
              icon="moon-outline"
              iconColor={couleurs.violet}
              iconBg={couleurs.accentVoile}
              label="Suivi sommeil"
              subtitle="Enregistrement des nuits"
              value={sleepTracking}
              onValueChange={setSleepTracking}
            />

            <View style={styles.trackingDivider} />
            <ProgTrackingRow
              icon="scale-outline"
              iconColor={couleurs.succes}
              iconBg={couleurs.succesVoile}
              label="Suivi poids"
              subtitle="Pesée régulière"
              value={weightTracking}
              onValueChange={setWeightTracking}
            />

            <View style={styles.trackingDivider} />
            <ProgTrackingRow
              icon="nutrition-outline"
              iconColor={couleurs.alerte}
              iconBg={couleurs.alerteVoile}
              label="Suivi nutrition"
              subtitle="Journal alimentaire"
              value={dietEnabled}
              onValueChange={setDietEnabled}
            />
            {dietEnabled && (
              <View style={[styles.formGroup, { marginTop: 8, marginLeft: 48 }]}>
                <Text style={styles.formLabel}>Objectif calorique (kcal/jour)</Text>
                <TextInput
                  style={[styles.formInput, { maxWidth: 120 }]}
                  value={targetCalories}
                  onChangeText={setTargetCalories}
                  placeholder="2000"
                  placeholderTextColor={couleurs.texteFaible}
                  keyboardType="number-pad"
                />
              </View>
            )}
          </View>

          {/* Section Objectifs personnalisés */}
          <View style={styles.formSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Objectifs personnalisés</Text>
              <TouchableOpacity onPress={addCustomGoal} style={styles.sectionAddBtn}>
                <Ionicons name="add-circle-outline" size={20} color={couleurs.accent} />
                <Text style={styles.sectionAddBtnText}>Ajouter</Text>
              </TouchableOpacity>
            </View>

            {customGoals.length === 0 ? (
              <Text style={styles.customGoalHint}>
                Aucun objectif personnalisé. Appuyez sur "Ajouter" pour en créer un.
              </Text>
            ) : (
              customGoals.map((goal, index) => (
                <View key={goal.id} style={styles.customGoalCard}>
                  <View style={styles.customGoalCardHeader}>
                    <Text style={styles.customGoalCardTitle}>Objectif {index + 1}</Text>
                    <TouchableOpacity onPress={() => removeCustomGoal(index)} style={{ padding: 4 }}>
                      <Ionicons name="trash-outline" size={17} color={couleurs.danger} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Titre</Text>
                    <TextInput
                      style={styles.formInput}
                      value={goal.title}
                      onChangeText={(v) => updateCustomGoal(index, 'title', v)}
                      placeholder="Ex : Perdre 5kg, Courir 10km…"
                      placeholderTextColor={couleurs.texteFaible}
                    />
                  </View>
                  <View style={[styles.formGroup, { marginBottom: 0 }]}>
                    <Text style={styles.formLabel}>Description</Text>
                    <TextInput
                      style={[styles.formInput, { height: 56 }]}
                      value={goal.description}
                      onChangeText={(v) => updateCustomGoal(index, 'description', v)}
                      placeholder="Description optionnelle…"
                      placeholderTextColor={couleurs.texteFaible}
                      multiline
                      textAlignVertical="top"
                    />
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
};

// -----------------------------------------------------------------------
// Carte de template de programme
// -----------------------------------------------------------------------
const ProgramTemplateCard = ({ template, onEdit, onDelete }) => {
  const trackingBadges = [];
  if (template.waterTrackingEnabled) trackingBadges.push({ icon: 'water-outline', label: 'Eau', color: couleurs.info, bg: couleurs.infoVoile });
  if (template.sleepTrackingEnabled) trackingBadges.push({ icon: 'moon-outline', label: 'Sommeil', color: couleurs.violet, bg: couleurs.accentVoile });
  if (template.weightTrackingEnabled) trackingBadges.push({ icon: 'scale-outline', label: 'Poids', color: couleurs.succes, bg: couleurs.succesVoile });
  if (template.dietEnabled) trackingBadges.push({ icon: 'nutrition-outline', label: 'Nutrition', color: couleurs.alerte, bg: couleurs.alerteVoile });

  const goalsCount = (template.customGoalsData ?? []).length;

  return (
    <View style={styles.templateCard}>
      <View style={styles.templateCardHeader}>
        <View style={[styles.templateCardIcon, { backgroundColor: couleurs.succesVoile }]}>
          <Ionicons name="options-outline" size={18} color={couleurs.succes} />
        </View>
        <View style={styles.templateCardInfo}>
          <Text style={styles.templateCardName} numberOfLines={1}>{template.name}</Text>
          {template.description ? (
            <Text style={styles.templateCardMeta} numberOfLines={1}>{template.description}</Text>
          ) : null}
          {template.cycleDays ? (
            <Text style={styles.templateCardMeta}>Cycle de {template.cycleDays} jours</Text>
          ) : null}
        </View>
        <View style={styles.templateCardActions}>
          <TouchableOpacity
            onPress={onEdit}
            style={styles.templateActionBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="pencil-outline" size={18} color={couleurs.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Alert.alert('Supprimer ce template ?', template.name, [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Supprimer', style: 'destructive', onPress: onDelete },
            ])}
            style={styles.templateActionBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={18} color={couleurs.danger} />
          </TouchableOpacity>
        </View>
      </View>

      {(trackingBadges.length > 0 || goalsCount > 0) && (
        <View style={styles.progCardBadgesRow}>
          {trackingBadges.map((badge) => (
            <View key={badge.label} style={[styles.trackingBadge, { backgroundColor: badge.bg }]}>
              <Ionicons name={badge.icon} size={11} color={badge.color} />
              <Text style={[styles.trackingBadgeText, { color: badge.color }]}>{badge.label}</Text>
            </View>
          ))}
          {goalsCount > 0 && (
            <View style={[styles.trackingBadge, { backgroundColor: couleurs.fond }]}>
              <Ionicons name="flag-outline" size={11} color={couleurs.texteFaible} />
              <Text style={[styles.trackingBadgeText, { color: couleurs.texteFaible }]}>
                {goalsCount} objectif{goalsCount !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

// -----------------------------------------------------------------------
// Écran principal
// -----------------------------------------------------------------------
const CoachTemplatesScreen = ({ navigation }) => {
  // --- Session templates state ---
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  // --- Program templates state ---
  const [programTemplates, setProgramTemplates] = useState([]);
  const [programTemplatesLoading, setProgramTemplatesLoading] = useState(false);
  const [progFormVisible, setProgFormVisible] = useState(false);
  const [editingProgTemplate, setEditingProgTemplate] = useState(null);

  // --- Tab state ---
  const [activeTab, setActiveTab] = useState('sessions');

  // --- Fetch session templates ---
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await sessionTemplatesAPI.getAll();
      setTemplates(res.data.data || []);
    } catch (error) {
      console.error('Erreur chargement templates séances:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // --- Fetch program templates ---
  const fetchProgramTemplates = useCallback(async () => {
    setProgramTemplatesLoading(true);
    try {
      const res = await templatesAPI.getAll();
      setProgramTemplates(res.data.data || []);
    } catch (error) {
      console.error('Erreur chargement templates programmes:', error);
    } finally {
      setProgramTemplatesLoading(false);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  // Charger les templates de programmes quand on passe sur l'onglet
  useEffect(() => {
    if (activeTab === 'programs' && programTemplates.length === 0 && !programTemplatesLoading) {
      fetchProgramTemplates();
    }
  }, [activeTab]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (activeTab === 'sessions') {
      fetchTemplates();
    } else {
      fetchProgramTemplates();
      setRefreshing(false);
    }
  }, [activeTab, fetchTemplates, fetchProgramTemplates]);

  // --- Session template handlers ---
  const handleDelete = async (template) => {
    try {
      await sessionTemplatesAPI.delete(template.id);
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
    } catch {
      Alert.alert('Erreur', 'Impossible de supprimer ce template');
    }
  };

  const handleSaved = (saved) => {
    setTemplates((prev) => {
      const idx = prev.findIndex((t) => t.id === saved.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = saved;
        return updated;
      }
      return [saved, ...prev];
    });
  };

  // --- Program template handlers ---
  const handleProgDelete = async (template) => {
    try {
      await templatesAPI.delete(template.id);
      setProgramTemplates((prev) => prev.filter((t) => t.id !== template.id));
    } catch {
      Alert.alert('Erreur', 'Impossible de supprimer ce template');
    }
  };

  const handleProgSaved = (saved) => {
    setProgramTemplates((prev) => {
      const idx = prev.findIndex((t) => t.id === saved.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = saved;
        return updated;
      }
      return [saved, ...prev];
    });
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={couleurs.texte} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Templates</Text>
          <Text style={styles.headerSubtitle}>
            {activeTab === 'sessions'
              ? `${templates.length} template${templates.length !== 1 ? 's' : ''} de séance`
              : `${programTemplates.length} template${programTemplates.length !== 1 ? 's' : ''} de programme`}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            if (activeTab === 'sessions') {
              setEditingTemplate(null);
              setFormVisible(true);
            } else {
              setEditingProgTemplate(null);
              setProgFormVisible(true);
            }
          }}
        >
          <Ionicons name="add" size={22} color={couleurs.texteInverse} />
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'sessions' && styles.tabItemActive]}
          onPress={() => setActiveTab('sessions')}
        >
          <Text style={[styles.tabLabel, activeTab === 'sessions' && styles.tabLabelActive]}>
            Séances
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'programs' && styles.tabItemActive]}
          onPress={() => setActiveTab('programs')}
        >
          <Text style={[styles.tabLabel, activeTab === 'programs' && styles.tabLabelActive]}>
            Programmes
          </Text>
        </TouchableOpacity>
      </View>

      {/* Contenu selon onglet actif */}
      {activeTab === 'sessions' ? (
        <>
          <FlatList
            data={templates}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TemplateCard
                template={item}
                onEdit={() => { setEditingTemplate(item); setFormVisible(true); }}
                onDelete={() => handleDelete(item)}
              />
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[couleurs.accent]} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="copy-outline" size={56} color={couleurs.texteFaible} />
                <Text style={styles.emptyTitle}>Aucun template</Text>
                <Text style={styles.emptySubtext}>
                  Créez des templates de séances réutilisables pour vos clients
                </Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => { setEditingTemplate(null); setFormVisible(true); }}
                >
                  <Ionicons name="add" size={16} color={couleurs.texteInverse} />
                  <Text style={styles.emptyButtonText}>Créer un template</Text>
                </TouchableOpacity>
              </View>
            }
          />

          {templates.length > 0 && (
            <TouchableOpacity
              style={styles.fab}
              onPress={() => { setEditingTemplate(null); setFormVisible(true); }}
            >
              <Ionicons name="add" size={28} color={couleurs.texteInverse} />
            </TouchableOpacity>
          )}
        </>
      ) : (
        <>
          {programTemplatesLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={couleurs.accent} />
            </View>
          ) : (
            <FlatList
              data={programTemplates}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <ProgramTemplateCard
                  template={item}
                  onEdit={() => { setEditingProgTemplate(item); setProgFormVisible(true); }}
                  onDelete={() => handleProgDelete(item)}
                />
              )}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[couleurs.accent]} />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="options-outline" size={56} color={couleurs.texteFaible} />
                  <Text style={styles.emptyTitle}>Aucun template</Text>
                  <Text style={styles.emptySubtext}>
                    Créez des templates de programmes réutilisables pour vos clients
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyButton}
                    onPress={() => { setEditingProgTemplate(null); setProgFormVisible(true); }}
                  >
                    <Ionicons name="add" size={16} color={couleurs.texteInverse} />
                    <Text style={styles.emptyButtonText}>Créer un template</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          )}

          {programTemplates.length > 0 && (
            <TouchableOpacity
              style={styles.fab}
              onPress={() => { setEditingProgTemplate(null); setProgFormVisible(true); }}
            >
              <Ionicons name="add" size={28} color={couleurs.texteInverse} />
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Formulaire séances */}
      <TemplateFormModal
        visible={formVisible}
        template={editingTemplate}
        onClose={() => setFormVisible(false)}
        onSaved={handleSaved}
      />

      {/* Formulaire programmes */}
      <ProgramTemplateFormModal
        visible={progFormVisible}
        template={editingProgTemplate}
        onClose={() => setProgFormVisible(false)}
        onSaved={handleProgSaved}
      />
    </View>
  );
};

// -----------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: couleurs.fond },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  backButton: { padding: 4, marginRight: 8 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: couleurs.texte },
  headerSubtitle: { fontSize: 12, color: couleurs.texteFaible, marginTop: 1 },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: couleurs.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
    backgroundColor: couleurs.carte,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
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
  // Liste
  listContent: { padding: 16, paddingBottom: 80 },
  // Carte template
  templateCard: {
    backgroundColor: couleurs.carte,
    borderRadius: 14,
    marginBottom: 12,
    shadowColor: couleurs.ombre,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  templateCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  templateCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: couleurs.accentVoile,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  templateCardInfo: { flex: 1 },
  templateCardName: { fontSize: 15, fontWeight: '700', color: couleurs.texte, marginBottom: 2 },
  templateCardMeta: { fontSize: 12, color: couleurs.texteFaible },
  templateCardActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  templateActionBtn: { padding: 6 },
  // Exercices du template (expanded)
  templateExerciseList: {
    borderTopWidth: 1,
    borderTopColor: couleurs.bord,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  templateExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  templateExCat: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  templateExName: { flex: 1, fontSize: 14, color: couleurs.texte, fontWeight: '500' },
  templateExParams: { fontSize: 12, color: couleurs.texteFaible, marginLeft: 8 },
  // Program template card badges
  progCardBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  trackingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  trackingBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // FAB
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
  // Empty
  emptyContainer: { alignItems: 'center', paddingVertical: 64 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: couleurs.texteDoux, marginTop: 16, marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: couleurs.texteFaible, textAlign: 'center', marginBottom: 24, paddingHorizontal: 24 },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: couleurs.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  emptyButtonText: { color: couleurs.texteInverse, fontWeight: '600', fontSize: 14 },
  // Modal formulaire
  formModalContainer: { flex: 1, backgroundColor: couleurs.fond },
  formModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: couleurs.carte,
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  formModalTitle: { fontSize: 17, fontWeight: '700', color: couleurs.texte, flex: 1, textAlign: 'center' },
  saveBtn: {
    backgroundColor: couleurs.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  saveBtnText: { color: couleurs.texteInverse, fontWeight: '700', fontSize: 14 },
  formModalScroll: { flex: 1 },
  formSection: {
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
  sectionTitle: { fontSize: 16, fontWeight: '700', color: couleurs.texte, marginBottom: 12 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionAddBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: couleurs.accent,
  },
  formGroup: { marginBottom: 14 },
  formLabel: { fontSize: 13, fontWeight: '600', color: couleurs.texteDoux, marginBottom: 6 },
  formHint: { fontSize: 11, color: couleurs.texteFaible, marginTop: 4 },
  formInput: {
    backgroundColor: couleurs.fond,
    borderWidth: 1,
    borderColor: couleurs.bord,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 14,
    color: couleurs.texte,
  },
  // Tracking rows
  trackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  trackingIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  trackingRowInfo: { flex: 1 },
  trackingRowLabel: { fontSize: 14, fontWeight: '600', color: couleurs.texte },
  trackingRowSubtitle: { fontSize: 12, color: couleurs.texteFaible, marginTop: 1 },
  trackingDivider: {
    height: 1,
    backgroundColor: couleurs.fond,
    marginVertical: 6,
  },
  // Custom goals
  customGoalHint: {
    fontSize: 13,
    color: couleurs.texteFaible,
    textAlign: 'center',
    paddingVertical: 12,
  },
  customGoalCard: {
    backgroundColor: couleurs.fond,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: couleurs.bord,
  },
  customGoalCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  customGoalCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: couleurs.texteDoux,
  },
  // Exercice card (dans formulaire)
  exCard: {
    backgroundColor: couleurs.fond,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: couleurs.bord,
    overflow: 'hidden',
  },
  exCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: couleurs.carte,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  exNumBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: couleurs.accentVoile,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  exNumText: { fontSize: 11, fontWeight: '700', color: couleurs.accent },
  exNameBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginRight: 8,
  },
  exName: { fontSize: 14, fontWeight: '600', color: couleurs.texte, flex: 1 },
  exNamePlaceholder: { fontSize: 13, color: couleurs.texteFaible, fontStyle: 'italic', flex: 1 },
  catScroll: { marginHorizontal: -12 },
  catScrollContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 6, flexDirection: 'row' },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: couleurs.fond,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  catChipText: { fontSize: 12, fontWeight: '600' },
  exParams: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 10 },
  exParamField: { minWidth: 60, flex: 1 },
  exParamLabel: { fontSize: 10, fontWeight: '700', color: couleurs.texteFaible, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
  exParamInput: {
    backgroundColor: couleurs.carte,
    borderWidth: 1,
    borderColor: couleurs.bord,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    fontSize: 13,
    color: couleurs.texte,
    textAlign: 'center',
  },
  exReorder: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: couleurs.bord, backgroundColor: couleurs.carte },
  reorderBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8 },
  reorderText: { fontSize: 12, color: couleurs.texteFaible, fontWeight: '500' },
  addExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: couleurs.accentVoileFort,
    borderRadius: 12,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addExBtnText: { fontSize: 14, fontWeight: '600', color: couleurs.accent },
  // Search modal
  searchModal: { flex: 1, backgroundColor: couleurs.fond },
  searchModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: couleurs.carte,
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  searchModalTitle: { fontSize: 17, fontWeight: '700', color: couleurs.texte },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: couleurs.carte,
    margin: 12,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: couleurs.bord,
  },
  searchInput: { flex: 1, fontSize: 15, color: couleurs.texte },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: couleurs.carte,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 10,
    padding: 14,
    shadowColor: couleurs.ombre,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  searchResultName: { fontSize: 15, fontWeight: '600', color: couleurs.texte, marginBottom: 2 },
  searchResultMeta: { fontSize: 12, color: couleurs.texteFaible, textTransform: 'capitalize' },
  searchEmpty: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  searchEmptyText: { fontSize: 15, color: couleurs.texteDoux, fontWeight: '500', textAlign: 'center' },
  searchHint: { alignItems: 'center', paddingVertical: 40 },
  freeExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: couleurs.accentVoile,
    margin: 12,
    padding: 14,
    borderRadius: 12,
  },
  freeExerciseBtnText: { fontSize: 14, fontWeight: '600', color: couleurs.accent, flex: 1 },
});

export default CoachTemplatesScreen;
