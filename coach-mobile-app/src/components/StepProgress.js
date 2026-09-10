import React from 'react';
import { View, StyleSheet } from 'react-native';
import { couleurs } from '../theme';

/**
 * Barre de progression en tirets pour les wizards d'onboarding
 * Props: total (nb d'étapes), current (étape active, base 1)
 */
const StepProgress = ({ total, current }) => (
  <View style={styles.container}>
    {Array.from({ length: total }, (_, i) => (
      <View
        key={i}
        style={[styles.step, i < current ? styles.stepActive : styles.stepInactive]}
      />
    ))}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  step: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  stepActive: {
    backgroundColor: couleurs.accent,
  },
  stepInactive: {
    backgroundColor: couleurs.eleve,
  },
});

export default StepProgress;
