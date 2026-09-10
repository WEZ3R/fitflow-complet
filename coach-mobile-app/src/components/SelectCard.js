import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { couleurs } from '../theme';

/**
 * Carte sélectionnable (objectif, niveau, genre)
 * Props: label, selected, onPress, icon? (emoji)
 */
const SelectCard = ({ label, selected, onPress, icon, style }) => (
  <TouchableOpacity
    style={[styles.card, selected && styles.cardSelected, style]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    {icon && <Text style={styles.icon}>{icon}</Text>}
    <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderColor: couleurs.bord,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: couleurs.carte,
    flex: 1,
    margin: 4,
  },
  cardSelected: {
    borderColor: couleurs.accent,
    backgroundColor: couleurs.accentVoile,
  },
  icon: {
    fontSize: 24,
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: couleurs.texteDoux,
    textAlign: 'center',
  },
  labelSelected: {
    color: couleurs.accent,
    fontWeight: '600',
  },
});

export default SelectCard;
