import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import SelectCard from '../../../components/SelectCard';
import TextField from '../../../components/TextField';
import PrimaryButton from '../../../components/PrimaryButton';
import { couleurs } from '../../../theme';

const GOALS = [
  { value: 'WEIGHT_LOSS', label: 'Perte de poids', icon: '⚖️' },
  { value: 'MUSCLE_GAIN', label: 'Prise de masse', icon: '💪' },
  { value: 'FITNESS', label: 'Remise en forme', icon: '🏃' },
  { value: 'REHAB', label: 'Rééducation', icon: '🏥' },
  { value: 'PERFORMANCE', label: 'Performance', icon: '🏆' },
  { value: 'ENDURANCE', label: 'Endurance', icon: '🚴' },
];

const LEVELS = [
  { value: 'BEGINNER', label: 'Débutant', icon: '🌱', desc: 'Moins de 1 an' },
  { value: 'INTERMEDIATE', label: 'Intermédiaire', icon: '⚡', desc: '1 à 3 ans' },
  { value: 'ADVANCED', label: 'Avancé', icon: '🔥', desc: 'Plus de 3 ans' },
];

const Step3Goal = ({ data, onChange, onSubmit, loading }) => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Votre objectif</Text>
      <Text style={styles.subtitle}>On trouvera les coachs les plus adaptés à vos besoins.</Text>

      {/* Objectifs */}
      <Text style={styles.sectionLabel}>Quel est votre objectif principal ?</Text>
      <View style={styles.goalList}>
        {GOALS.map((g) => (
          <SelectCard
            key={g.value}
            label={g.label}
            icon={g.icon}
            selected={data.goalCategory === g.value}
            onPress={() => onChange({ goalCategory: data.goalCategory === g.value ? null : g.value })}
            style={styles.goalCard}
          />
        ))}
      </View>

      <TextField
        label="Précisez votre objectif"
        value={data.customGoal || ''}
        onChangeText={(v) => onChange({ customGoal: v })}
        placeholder="Ex: Préparer un marathon, perdre 10kg..."
        multiline
        numberOfLines={2}
        optional
      />

      {/* Niveau */}
      <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Votre niveau sportif</Text>
      <View style={styles.levelRow}>
        {LEVELS.map((l) => (
          <SelectCard
            key={l.value}
            label={l.label}
            icon={l.icon}
            selected={data.level === l.value}
            onPress={() => onChange({ level: l.value })}
          />
        ))}
      </View>

      <PrimaryButton label="Terminer l'inscription" onPress={onSubmit} loading={loading} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingTop: 8, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: couleurs.texte, marginBottom: 8 },
  subtitle: { fontSize: 14, color: couleurs.texteDoux, marginBottom: 24, lineHeight: 20 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: couleurs.texte, marginBottom: 8 },
  goalList: { marginBottom: 16 },
  goalCard: { flex: undefined, flexDirection: 'row', justifyContent: 'flex-start', margin: 0, marginBottom: 8, paddingVertical: 14, paddingHorizontal: 16 },
  levelRow: { flexDirection: 'row', marginBottom: 24 },
});

export default Step3Goal;
