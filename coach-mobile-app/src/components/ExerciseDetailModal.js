import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { couleurs } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// bodyParts utilise toujours des codes UPPERCASE (CHEST, BACK…)
const BODY_PART_LABELS = {
  BACK: 'Dos',
  CHEST: 'Poitrine',
  SHOULDERS: 'Épaules',
  UPPER_ARMS: 'Bras (haut)',
  LOWER_ARMS: 'Avant-bras',
  UPPER_LEGS: 'Cuisses',
  LOWER_LEGS: 'Mollets',
  WAIST: 'Abdominaux',
  CARDIO: 'Cardio',
  NECK: 'Cou',
};

// Les équipements sont déjà en français dans la BDD FitFlow — retourner tel quel
const formatEquipment = (eq) => eq;
const formatBodyPart = (bp) => BODY_PART_LABELS[bp] || bp.toLowerCase().replace(/_/g, ' ');

const ExerciseDetailModal = ({ visible, exercise, onClose }) => {
  if (!exercise) return null;

  const ref = exercise.exerciseRef;
  const gifUrl = ref?.gifUrl || exercise.gifUrl;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={2}>{exercise.name}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={couleurs.texteFaible} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* GIF */}
            {gifUrl && (
              <View style={styles.gifContainer}>
                <Image
                  source={{ uri: gifUrl }}
                  style={styles.gif}
                  resizeMode="contain"
                />
              </View>
            )}

            {ref && (
              <>
                {/* Muscles ciblés */}
                {ref.targetMuscles?.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Ionicons name="fitness" size={18} color={couleurs.danger} />
                      <Text style={styles.sectionTitle}>Muscles ciblés</Text>
                    </View>
                    <View style={styles.tagRow}>
                      {ref.targetMuscles.map((muscle) => (
                        <View key={muscle} style={[styles.tag, styles.tagPrimary]}>
                          <Text style={styles.tagPrimaryText}>{muscle}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Muscles secondaires */}
                {ref.secondaryMuscles?.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Ionicons name="flash" size={18} color={couleurs.alerte} />
                      <Text style={styles.sectionTitle}>Muscles secondaires</Text>
                    </View>
                    <View style={styles.tagRow}>
                      {ref.secondaryMuscles.map((muscle) => (
                        <View key={muscle} style={[styles.tag, styles.tagSecondary]}>
                          <Text style={styles.tagSecondaryText}>{muscle}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Infos */}
                <View style={styles.infoRow}>
                  {ref.bodyParts?.length > 0 && (
                    <View style={[styles.infoCard, styles.infoCardBlue]}>
                      <Text style={styles.infoLabel}>Zone du corps</Text>
                      <Text style={styles.infoValue}>
                        {ref.bodyParts.map(formatBodyPart).join(', ')}
                      </Text>
                    </View>
                  )}
                  {ref.equipments?.length > 0 && (
                    <View style={[styles.infoCard, styles.infoCardGray]}>
                      <Text style={styles.infoLabel}>Équipement</Text>
                      <Text style={styles.infoValue}>
                        {ref.equipments.map(formatEquipment).join(', ')}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Instructions */}
                {ref.instructions?.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Instructions</Text>
                    {ref.instructions.map((step, i) => (
                      <View key={i} style={styles.instructionRow}>
                        <View style={styles.instructionNumber}>
                          <Text style={styles.instructionNumberText}>{i + 1}</Text>
                        </View>
                        <Text style={styles.instructionText}>{step}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: couleurs.carte,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: couleurs.texte,
    flex: 1,
    marginRight: 12,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  gifContainer: {
    backgroundColor: couleurs.fond,
    borderRadius: 12,
    padding: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  gif: {
    width: SCREEN_WIDTH - 72,
    height: 220,
    borderRadius: 8,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: couleurs.texteDoux,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  tagPrimary: {
    backgroundColor: couleurs.dangerVoile,
  },
  tagPrimaryText: {
    fontSize: 13,
    color: couleurs.danger,
    fontWeight: '500',
  },
  tagSecondary: {
    backgroundColor: couleurs.alerteVoile,
  },
  tagSecondaryText: {
    fontSize: 13,
    color: couleurs.alerte,
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  infoCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
  },
  infoCardBlue: {
    backgroundColor: couleurs.infoVoile,
  },
  infoCardGray: {
    backgroundColor: couleurs.fond,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: couleurs.texteFaible,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 13,
    color: couleurs.texte,
    fontWeight: '500',
  },
  instructionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  instructionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: couleurs.accentVoile,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  instructionNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: couleurs.accent,
  },
  instructionText: {
    fontSize: 14,
    color: couleurs.texteDoux,
    flex: 1,
    lineHeight: 20,
  },
});

export default ExerciseDetailModal;
