import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { couleurs } from '../theme';

const PrimaryButton = ({ label, onPress, loading = false, disabled = false, variant = 'primary' }) => (
  <TouchableOpacity
    style={[styles.btn, variant === 'secondary' && styles.btnSecondary, (disabled || loading) && styles.btnDisabled]}
    onPress={onPress}
    disabled={disabled || loading}
    activeOpacity={0.8}
  >
    {loading
      ? <ActivityIndicator color={variant === 'secondary' ? couleurs.accent : couleurs.accentEncre} />
      : <Text style={[styles.label, variant === 'secondary' && styles.labelSecondary]}>{label}</Text>
    }
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  btn: {
    backgroundColor: couleurs.accent,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondary: {
    backgroundColor: couleurs.accentVoile,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  label: {
    // Le bouton plein est lime, une couleur claire : son texte doit être sombre.
    color: couleurs.accentEncre,
    fontSize: 16,
    fontWeight: '600',
  },
  labelSecondary: {
    color: couleurs.accent,
  },
});

export default PrimaryButton;
