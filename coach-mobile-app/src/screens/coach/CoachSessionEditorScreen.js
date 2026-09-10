import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { sessionsAPI, exerciseRefsAPI, sessionTemplatesAPI } from '../../services/api';
import ExerciseDetailModal from '../../components/ExerciseDetailModal';
import { couleurs } from '../../theme';

// -----------------------------------------------------------------------
// Constantes
// -----------------------------------------------------------------------
const CATEGORIES = [
  { key: 'WARMUP',    label: 'Échauff.',   color: couleurs.alerte, bg: couleurs.alerteVoile, icon: 'flame-outline' },
  { key: 'MAIN',      label: 'Muscu',      color: couleurs.accent, bg: couleurs.accentVoile, icon: 'barbell-outline' },
  { key: 'RENFORCEMENT', label: 'Renfo',   color: couleurs.accent, bg: couleurs.accentVoile, icon: 'timer-outline' },
  { key: 'CARDIO',    label: 'Cardio',     color: couleurs.danger, bg: couleurs.dangerVoile, icon: 'heart-outline' },
  { key: 'STRETCHING',label: 'Étirement', color: couleurs.succes, bg: couleurs.succesVoile, icon: 'body-outline' },
];

const getCategoryInfo = (key) => CATEGORIES.find((c) => c.key === key) || CATEGORIES[1];

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
  exerciseRef: null,
});

// -----------------------------------------------------------------------
// Composant : ligne de champ de saisie
// -----------------------------------------------------------------------
const FieldInput = ({ label, value, onChangeText, placeholder, keyboardType, small }) => (
  <View style={[styles.fieldGroup, small && styles.fieldGroupSmall]}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={styles.fieldInput}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={couleurs.texteFaible}
      keyboardType={keyboardType || 'default'}
    />
  </View>
);

// -----------------------------------------------------------------------
// Composant : carte d'exercice
// -----------------------------------------------------------------------
const ExerciseCard = ({
  exercise,
  index,
  total,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onOpenSearch,
  onShowDetail,
}) => {
  const [expanded, setExpanded] = useState(true);
  const cat = getCategoryInfo(exercise.category);
  const isMain = exercise.category === 'MAIN';
  const isCardio = exercise.category === 'CARDIO';
  const isWarmupOrStretch = exercise.category === 'WARMUP' || exercise.category === 'STRETCHING';
  // Renforcement : un travail isométrique se prescrit en temps à tenir, pas en
  // répétitions ni en charge.
  const isRenforcement = exercise.category === 'RENFORCEMENT';

  return (
    <View style={styles.exerciseCard}>
      {/* En-tête de la carte */}
      <View style={styles.exerciseCardHeader}>
        <View style={styles.exerciseOrderBadge}>
          <Text style={styles.exerciseOrderText}>{index + 1}</Text>
        </View>

        <TouchableOpacity
          style={styles.exerciseNameRow}
          onPress={() => onOpenSearch(index)}
          activeOpacity={0.7}
        >
          {exercise.name ? (
            <Text style={styles.exerciseName} numberOfLines={1}>{exercise.name}</Text>
          ) : (
            <Text style={styles.exerciseNamePlaceholder}>Toucher pour choisir un exercice…</Text>
          )}
          <Ionicons name="search-outline" size={16} color={couleurs.texteFaible} />
        </TouchableOpacity>

        {/* Actions */}
        <View style={styles.exerciseActions}>
          {exercise.exerciseRef && (
            <TouchableOpacity onPress={() => onShowDetail(exercise)} style={styles.exerciseActionBtn}>
              <Ionicons name="information-circle-outline" size={20} color={couleurs.accent} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setExpanded((v) => !v)}
            style={styles.exerciseActionBtn}
          >
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={couleurs.texteFaible}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Alert.alert('Supprimer cet exercice ?', exercise.name || 'Cet exercice', [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Supprimer', style: 'destructive', onPress: onRemove },
              ]);
            }}
            style={styles.exerciseActionBtn}
          >
            <Ionicons name="trash-outline" size={18} color={couleurs.danger} />
          </TouchableOpacity>
        </View>
      </View>

      {expanded && (
        <>
          {/* Catégorie */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryScrollContent}
          >
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.key}
                style={[
                  styles.categoryChip,
                  { backgroundColor: exercise.category === c.key ? c.bg : couleurs.eleve },
                  exercise.category === c.key && { borderColor: c.color, borderWidth: 1.5 },
                ]}
                onPress={() => onUpdate(index, 'category', c.key)}
              >
                <Ionicons
                  name={c.icon}
                  size={13}
                  color={exercise.category === c.key ? c.color : couleurs.texteFaible}
                />
                <Text
                  style={[
                    styles.categoryChipText,
                    { color: exercise.category === c.key ? c.color : couleurs.texteFaible },
                  ]}
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Paramètres selon catégorie */}
          {isMain && (
            <View style={styles.paramsRow}>
              <FieldInput
                label="Séries"
                value={exercise.sets}
                onChangeText={(v) => onUpdate(index, 'sets', v)}
                placeholder="3"
                keyboardType="number-pad"
                small
              />
              <FieldInput
                label="Reps"
                value={exercise.reps}
                onChangeText={(v) => onUpdate(index, 'reps', v)}
                placeholder="10-12"
                small
              />
              <FieldInput
                label="Poids"
                value={exercise.weight}
                onChangeText={(v) => onUpdate(index, 'weight', v)}
                placeholder="20kg"
                small
              />
              <FieldInput
                label="Repos"
                value={exercise.restTime}
                onChangeText={(v) => onUpdate(index, 'restTime', v)}
                placeholder="90s"
                small
              />
            </View>
          )}

          {isRenforcement && (
            <View style={styles.paramsRow}>
              <FieldInput
                label="Séries"
                value={exercise.sets}
                onChangeText={(v) => onUpdate(index, 'sets', v)}
                placeholder="3"
                keyboardType="number-pad"
                small
              />
              <FieldInput
                label="Temps"
                value={exercise.duration}
                onChangeText={(v) => onUpdate(index, 'duration', v)}
                placeholder="45s"
                small
              />
              <FieldInput
                label="Repos"
                value={exercise.restTime}
                onChangeText={(v) => onUpdate(index, 'restTime', v)}
                placeholder="60s"
                small
              />
            </View>
          )}

          {isCardio && (
            <View style={styles.paramsRow}>
              <FieldInput
                label="Séries"
                value={exercise.sets}
                onChangeText={(v) => onUpdate(index, 'sets', v)}
                placeholder="3"
                keyboardType="number-pad"
                small
              />
              <FieldInput
                label="Durée"
                value={exercise.duration}
                onChangeText={(v) => onUpdate(index, 'duration', v)}
                placeholder="20min"
                small
              />
              <FieldInput
                label="Repos"
                value={exercise.restTime}
                onChangeText={(v) => onUpdate(index, 'restTime', v)}
                placeholder="120s"
                small
              />
            </View>
          )}

          {isWarmupOrStretch && (
            <View style={styles.paramsRow}>
              <FieldInput
                label="Durée"
                value={exercise.duration}
                onChangeText={(v) => onUpdate(index, 'duration', v)}
                placeholder="10min"
                small
              />
            </View>
          )}

          {/* Notes/instructions */}
          <View style={styles.descriptionField}>
            <TextInput
              style={styles.descriptionInput}
              value={exercise.description}
              onChangeText={(v) => onUpdate(index, 'description', v)}
              placeholder="Instructions pour le client (optionnel)…"
              placeholderTextColor={couleurs.texteFaible}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>

          {/* Réordonner */}
          <View style={styles.exerciseReorder}>
            <TouchableOpacity
              onPress={onMoveUp}
              disabled={index === 0}
              style={[styles.reorderBtn, index === 0 && styles.reorderBtnDisabled]}
            >
              <Ionicons name="chevron-up" size={16} color={index === 0 ? couleurs.bordFort : couleurs.texteFaible} />
              <Text style={[styles.reorderText, index === 0 && { color: couleurs.texteFaible }]}>
                Monter
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onMoveDown}
              disabled={index === total - 1}
              style={[styles.reorderBtn, index === total - 1 && styles.reorderBtnDisabled]}
            >
              <Ionicons
                name="chevron-down"
                size={16}
                color={index === total - 1 ? couleurs.bordFort : couleurs.texteFaible}
              />
              <Text style={[styles.reorderText, index === total - 1 && { color: couleurs.texteFaible }]}>
                Descendre
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
};

// -----------------------------------------------------------------------
// Modal recherche d'exercice
// -----------------------------------------------------------------------
const ExerciseSearchModal = ({ visible, onClose, onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (!q || q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await exerciseRefsAPI.search(q.trim(), 20);
      setResults(res.data.data || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleChange = (text) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(text), 400);
  };

  const handleClose = () => {
    setQuery('');
    setResults([]);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.searchModal}>
        {/* Header */}
        <View style={styles.searchModalHeader}>
          <TouchableOpacity onPress={handleClose} style={styles.searchModalBack}>
            <Ionicons name="arrow-back" size={24} color={couleurs.texte} />
          </TouchableOpacity>
          <Text style={styles.searchModalTitle}>Rechercher un exercice</Text>
        </View>

        {/* Input */}
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search-outline" size={18} color={couleurs.texteFaible} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={handleChange}
            placeholder="Développé couché, squat, tractions…"
            placeholderTextColor={couleurs.texteFaible}
            autoFocus
            clearButtonMode="while-editing"
          />
          {searching && <ActivityIndicator size="small" color={couleurs.accent} />}
        </View>

        {/* Résultats */}
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.searchResultItem}
              onPress={() => {
                onSelect(item);
                handleClose();
              }}
              activeOpacity={0.7}
            >
              <View style={styles.searchResultInfo}>
                <Text style={styles.searchResultName} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.bodyParts?.length > 0 && (
                  <Text style={styles.searchResultMeta} numberOfLines={1}>
                    {item.bodyParts.join(', ')}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color={couleurs.texteFaible} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            query.length >= 2 && !searching ? (
              <View style={styles.searchEmpty}>
                <Text style={styles.searchEmptyText}>Aucun résultat pour « {query} »</Text>
                <Text style={styles.searchEmptyHint}>
                  Vous pouvez tout de même créer un exercice personnalisé
                </Text>
              </View>
            ) : query.length < 2 ? (
              <View style={styles.searchHint}>
                <Ionicons name="search" size={40} color={couleurs.bordFort} />
                <Text style={styles.searchHintText}>Tapez au moins 2 caractères</Text>
              </View>
            ) : null
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />

        {/* Bouton "exercice libre" */}
        {query.trim().length >= 1 && (
          <TouchableOpacity
            style={styles.freeExerciseBtn}
            onPress={() => {
              onSelect({ id: null, name: query.trim() });
              handleClose();
            }}
          >
            <Ionicons name="add-circle-outline" size={18} color={couleurs.accent} />
            <Text style={styles.freeExerciseBtnText}>
              Utiliser « {query.trim()} » comme exercice libre
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
};

// -----------------------------------------------------------------------
// Modal templates de séance
// -----------------------------------------------------------------------
const TemplatePickerModal = ({ visible, onClose, onApply }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await sessionTemplatesAPI.getAll();
        setTemplates(res.data.data || []);
      } catch {
        setTemplates([]);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Appliquer un template</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={couleurs.texteDoux} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={couleurs.accent} style={{ marginVertical: 32 }} />
          ) : templates.length === 0 ? (
            <View style={styles.templateEmpty}>
              <Ionicons name="copy-outline" size={40} color={couleurs.texteFaible} />
              <Text style={styles.templateEmptyText}>Aucun template disponible</Text>
              <Text style={styles.templateEmptyHint}>
                Créez des templates depuis l'onglet Templates
              </Text>
            </View>
          ) : (
            <FlatList
              data={templates}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.templateItem}
                  onPress={() => {
                    onApply(item);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.templateItemIcon}>
                    <Ionicons name="copy-outline" size={18} color={couleurs.accent} />
                  </View>
                  <View style={styles.templateItemInfo}>
                    <Text style={styles.templateItemName}>{item.name}</Text>
                    <Text style={styles.templateItemMeta}>
                      {item.exercisesData?.length ?? 0} exercice
                      {(item.exercisesData?.length ?? 0) !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={couleurs.texteFaible} />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

// -----------------------------------------------------------------------
// Écran principal
// -----------------------------------------------------------------------
const CoachSessionEditorScreen = ({ route, navigation }) => {
  const { sessionId, programId, clientName } = route.params || {};

  const [loading, setLoading] = useState(!!sessionId);
  const [saving, setSaving] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [isRestDay, setIsRestDay] = useState(false);
  const [exercises, setExercises] = useState([]);

  // Modals
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchTargetIndex, setSearchTargetIndex] = useState(null);
  const [detailExercise, setDetailExercise] = useState(null);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [saveTemplateModalVisible, setSaveTemplateModalVisible] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // ─── Chargement de la séance existante ─────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    const fetchSession = async () => {
      try {
        const res = await sessionsAPI.getById(sessionId);
        const s = res.data.data;
        setName(s.name ?? s.title ?? '');
        setNotes(s.notes ?? '');
        setIsRestDay(s.isRestDay ?? false);
        setExercises(
          (s.exercises ?? []).map((ex) => ({
            id: ex.id,
            name: ex.name,
            category: ex.category ?? 'MAIN',
            sets: ex.sets?.toString() ?? '',
            reps: ex.reps ?? '',
            weight: ex.weight ?? '',
            duration: ex.duration ?? '',
            restTime: ex.restTime ?? '',
            description: ex.description ?? '',
            exerciseRefId: ex.exerciseRefId ?? '',
            exerciseRef: ex.exerciseRef ?? null,
          }))
        );
      } catch {
        Alert.alert('Erreur', 'Impossible de charger la séance');
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, [sessionId]);

  // ─── Opérations exercices ───────────────────────────────────────────
  const updateExercise = (index, field, value) => {
    setExercises((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addExercise = () => {
    setExercises((prev) => [...prev, emptyExercise()]);
  };

  const removeExercise = (index) => {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  };

  const moveExercise = (index, direction) => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= exercises.length) return;
    setExercises((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleExerciseSelect = (ref) => {
    if (searchTargetIndex === null) return;
    if (ref.id) {
      setExercises((prev) => {
        const updated = [...prev];
        updated[searchTargetIndex] = {
          ...updated[searchTargetIndex],
          name: ref.name,
          exerciseRefId: ref.id,
          exerciseRef: ref,
          category:
            ref.exerciseType === 'CARDIO'
              ? 'CARDIO'
              : ref.exerciseType === 'STRETCHING'
              ? 'STRETCHING'
              : updated[searchTargetIndex].category === 'WARMUP'
              ? 'WARMUP'
              : 'MAIN',
        };
        return updated;
      });
    } else {
      // Exercice libre (nom uniquement)
      setExercises((prev) => {
        const updated = [...prev];
        updated[searchTargetIndex] = {
          ...updated[searchTargetIndex],
          name: ref.name,
          exerciseRefId: '',
          exerciseRef: null,
        };
        return updated;
      });
    }
  };

  const applyTemplate = (template) => {
    const newExercises = (template.exercisesData || []).map((ex) => ({
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
      exerciseRef: null,
    }));
    setExercises(newExercises);
    if (!name && template.name) setName(template.name);
  };

  // ─── Sauvegarde ────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const cleanedExercises = exercises.map((ex, i) => {
        const cleaned = {
          name: ex.name || 'Exercice',
          category: ex.category,
          order: i,
        };
        if (ex.sets) cleaned.sets = parseInt(ex.sets) || null;
        if (ex.reps) cleaned.reps = ex.reps;
        if (ex.weight) cleaned.weight = ex.weight;
        if (ex.duration) cleaned.duration = ex.duration;
        if (ex.restTime) cleaned.restTime = ex.restTime;
        if (ex.description) cleaned.description = ex.description;
        if (ex.exerciseRefId) cleaned.exerciseRefId = ex.exerciseRefId;
        if (ex.id && !String(ex.id).startsWith('temp-')) cleaned.id = ex.id;
        return cleaned;
      });

      await sessionsAPI.upsert({
        ...(sessionId ? { id: sessionId } : {}),
        programId,
        name: name || null,
        title: name || null,
        notes,
        isRestDay,
        exercises: cleanedExercises,
      });

      navigation.goBack();
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      const msg = error?.response?.data?.message || 'Erreur lors de la sauvegarde';
      Alert.alert('Erreur', msg);
    } finally {
      setSaving(false);
    }
  };

  // ─── Sauvegarder comme template ────────────────────────────────────
  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) {
      Alert.alert('Erreur', 'Le nom du template est requis');
      return;
    }
    setSavingTemplate(true);
    try {
      const exercisesData = exercises.map((ex, i) => ({
        name: ex.name || 'Exercice',
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
      await sessionTemplatesAPI.create({
        name: templateName.trim(),
        exercisesData,
      });
      setSaveTemplateModalVisible(false);
      setTemplateName('');
      Alert.alert('Succès', 'Template sauvegardé');
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder le template');
    } finally {
      setSavingTemplate(false);
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={couleurs.texte} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {sessionId ? 'Éditer la séance' : 'Nouvelle séance'}
        </Text>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={couleurs.texteInverse} />
          ) : (
            <Text style={styles.saveButtonText}>Sauver</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Infos séance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations</Text>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Titre de la séance</Text>
            <TextInput
              style={styles.formInput}
              value={name}
              onChangeText={setName}
              placeholder="Ex : Push Day, Full Body, Cardio…"
              placeholderTextColor={couleurs.texteFaible}
            />
          </View>

          {/* Jour de repos */}
          <View style={styles.restDayRow}>
            <View>
              <Text style={styles.formLabel}>Jour de repos</Text>
              <Text style={styles.formHint}>Aucun exercice ce jour</Text>
            </View>
            <Switch
              value={isRestDay}
              onValueChange={setIsRestDay}
              trackColor={{ false: couleurs.bordFort, true: couleurs.accentVoileFort }}
              thumbColor={isRestDay ? couleurs.accent : couleurs.texteFaible}
            />
          </View>

          {!isRestDay && (
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Notes générales</Text>
              <TextInput
                style={[styles.formInput, styles.formTextArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Instructions ou commentaires pour cette séance…"
                placeholderTextColor={couleurs.texteFaible}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          )}
        </View>

        {/* Exercices */}
        {!isRestDay && (
          <View style={styles.section}>
            {/* Header section exercices */}
            <View style={styles.exercisesSectionHeader}>
              <Text style={styles.sectionTitle}>
                Exercices ({exercises.length})
              </Text>
              <View style={styles.exercisesActions}>
                <TouchableOpacity
                  style={styles.templatePickBtn}
                  onPress={() => setTemplateModalVisible(true)}
                >
                  <Ionicons name="copy-outline" size={15} color={couleurs.accent} />
                  <Text style={styles.templatePickBtnText}>Template</Text>
                </TouchableOpacity>
                {exercises.length > 0 && (
                  <TouchableOpacity
                    style={styles.templatePickBtn}
                    onPress={() => setSaveTemplateModalVisible(true)}
                  >
                    <Ionicons name="bookmark-outline" size={15} color={couleurs.accent} />
                    <Text style={styles.templatePickBtnText}>Sauver</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Liste d'exercices */}
            {exercises.length === 0 ? (
              <View style={styles.exercisesEmpty}>
                <Ionicons name="barbell-outline" size={40} color={couleurs.texteFaible} />
                <Text style={styles.exercisesEmptyText}>Aucun exercice</Text>
                <Text style={styles.exercisesEmptyHint}>
                  Ajoutez des exercices ou appliquez un template
                </Text>
              </View>
            ) : (
              exercises.map((exercise, index) => (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  index={index}
                  total={exercises.length}
                  onUpdate={updateExercise}
                  onRemove={() => removeExercise(index)}
                  onMoveUp={() => moveExercise(index, 'up')}
                  onMoveDown={() => moveExercise(index, 'down')}
                  onOpenSearch={(i) => {
                    setSearchTargetIndex(i);
                    setSearchModalVisible(true);
                  }}
                  onShowDetail={(ex) => setDetailExercise(ex)}
                />
              ))
            )}

            {/* Bouton ajouter */}
            <TouchableOpacity style={styles.addExerciseBtn} onPress={addExercise}>
              <Ionicons name="add-circle-outline" size={20} color={couleurs.accent} />
              <Text style={styles.addExerciseBtnText}>Ajouter un exercice</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ─── Modals ──────────────────────────────────────────────────── */}

      {/* Recherche d'exercice */}
      <ExerciseSearchModal
        visible={searchModalVisible}
        onClose={() => setSearchModalVisible(false)}
        onSelect={handleExerciseSelect}
      />

      {/* Détail exercice */}
      <ExerciseDetailModal
        visible={!!detailExercise}
        exercise={detailExercise}
        onClose={() => setDetailExercise(null)}
      />

      {/* Choisir un template */}
      <TemplatePickerModal
        visible={templateModalVisible}
        onClose={() => setTemplateModalVisible(false)}
        onApply={applyTemplate}
      />

      {/* Sauvegarder comme template */}
      <Modal visible={saveTemplateModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { paddingBottom: Platform.OS === 'ios' ? 36 : 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sauvegarder comme template</Text>
              <TouchableOpacity onPress={() => setSaveTemplateModalVisible(false)}>
                <Ionicons name="close" size={24} color={couleurs.texteDoux} />
              </TouchableOpacity>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Nom du template</Text>
              <TextInput
                style={styles.formInput}
                value={templateName}
                onChangeText={setTemplateName}
                placeholder="Ex : Push Day standard…"
                placeholderTextColor={couleurs.texteFaible}
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={[styles.submitBtn, savingTemplate && styles.submitBtnDisabled]}
              onPress={handleSaveAsTemplate}
              disabled={savingTemplate}
            >
              {savingTemplate ? (
                <ActivityIndicator color={couleurs.texteInverse} size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Sauvegarder</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: couleurs.texte,
  },
  saveButton: {
    backgroundColor: couleurs.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
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
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: couleurs.texte,
    marginBottom: 12,
  },
  // Formulaire séance
  formGroup: { marginBottom: 14 },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: couleurs.texteDoux,
    marginBottom: 6,
  },
  formHint: { fontSize: 11, color: couleurs.texteFaible, marginTop: 2 },
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
  formTextArea: {
    color: couleurs.texte, height: 80, paddingTop: 10 },
  restDayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  // Section exercices header
  exercisesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  exercisesActions: { flexDirection: 'row', gap: 8 },
  templatePickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: couleurs.accentVoile,
  },
  templatePickBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: couleurs.accent,
  },
  // Exercice card
  exerciseCard: {
    backgroundColor: couleurs.fond,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: couleurs.bord,
    overflow: 'hidden',
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: couleurs.carte,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  exerciseOrderBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: couleurs.accentVoile,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  exerciseOrderText: {
    fontSize: 12,
    fontWeight: '700',
    color: couleurs.accent,
  },
  exerciseNameRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: '600',
    color: couleurs.texte,
    flex: 1,
    marginRight: 6,
  },
  exerciseNamePlaceholder: {
    fontSize: 13,
    color: couleurs.texteFaible,
    fontStyle: 'italic',
    flex: 1,
  },
  exerciseActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  exerciseActionBtn: { padding: 4 },
  // Catégories
  categoryScroll: { marginHorizontal: -16 },
  categoryScrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Paramètres
  paramsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  fieldGroup: {
    minWidth: 70,
    flex: 1,
  },
  fieldGroupSmall: {
    minWidth: 60,
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: couleurs.texteFaible,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  fieldInput: {
    backgroundColor: couleurs.carte,
    borderWidth: 1,
    borderColor: couleurs.bord,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: couleurs.texte,
    textAlign: 'center',
  },
  // Description
  descriptionField: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  descriptionInput: {
    backgroundColor: couleurs.carte,
    borderWidth: 1,
    borderColor: couleurs.bord,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: couleurs.texteDoux,
    minHeight: 56,
  },
  // Réordonner
  exerciseReorder: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: couleurs.bord,
    backgroundColor: couleurs.carte,
  },
  reorderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  reorderBtnDisabled: { opacity: 0.4 },
  reorderText: { fontSize: 12, color: couleurs.texteFaible, fontWeight: '500' },
  // Vide exercices
  exercisesEmpty: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  exercisesEmptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: couleurs.texteDoux,
    marginTop: 12,
  },
  exercisesEmptyHint: {
    fontSize: 13,
    color: couleurs.texteFaible,
    marginTop: 4,
    textAlign: 'center',
  },
  // Ajouter exercice
  addExerciseBtn: {
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
  addExerciseBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: couleurs.accent,
  },
  // Search modal
  searchModal: {
    flex: 1,
    backgroundColor: couleurs.fond,
  },
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
  searchModalBack: { padding: 4, marginRight: 10 },
  searchModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: couleurs.texte,
  },
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
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: couleurs.texte,
  },
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
  searchResultInfo: { flex: 1 },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: couleurs.texte,
    marginBottom: 2,
  },
  searchResultMeta: {
    fontSize: 12,
    color: couleurs.texteFaible,
    textTransform: 'capitalize',
  },
  searchEmpty: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  searchEmptyText: {
    fontSize: 15,
    color: couleurs.texteDoux,
    fontWeight: '500',
    textAlign: 'center',
  },
  searchEmptyHint: {
    fontSize: 13,
    color: couleurs.texteFaible,
    marginTop: 6,
    textAlign: 'center',
  },
  searchHint: { alignItems: 'center', paddingVertical: 40 },
  searchHintText: { fontSize: 14, color: couleurs.texteFaible, marginTop: 12 },
  freeExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: couleurs.accentVoile,
    margin: 12,
    padding: 14,
    borderRadius: 12,
  },
  freeExerciseBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: couleurs.accent,
    flex: 1,
  },
  // Modal commun
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
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: couleurs.texte,
  },
  // Template picker
  templateEmpty: { alignItems: 'center', paddingVertical: 32 },
  templateEmptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: couleurs.texteDoux,
    marginTop: 12,
  },
  templateEmptyHint: {
    fontSize: 13,
    color: couleurs.texteFaible,
    marginTop: 4,
    textAlign: 'center',
  },
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  templateItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: couleurs.accentVoile,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  templateItemInfo: { flex: 1 },
  templateItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: couleurs.texte,
    marginBottom: 2,
  },
  templateItemMeta: { fontSize: 12, color: couleurs.texteFaible },
  // Save template modal
  submitBtn: {
    backgroundColor: couleurs.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: couleurs.texteInverse, fontSize: 15, fontWeight: '600' },
});

export default CoachSessionEditorScreen;
