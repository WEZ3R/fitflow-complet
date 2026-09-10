import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { couleurs } from '../theme';

const TextField = ({ label, error, optional = false, ...inputProps }) => (
  <View style={styles.container}>
    {label && (
      <Text style={styles.label}>
        {label}
        {optional && <Text style={styles.optional}> (facultatif)</Text>}
      </Text>
    )}
    <TextInput
      style={[styles.input, error && styles.inputError]}
      placeholderTextColor={couleurs.texteFaible}
      {...inputProps}
    />
    {error && <Text style={styles.error}>{error}</Text>}
  </View>
);

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: couleurs.texte, marginBottom: 6 },
  optional: { color: couleurs.texteDoux, fontWeight: '400' },
  input: {
    backgroundColor: couleurs.carte,
    borderWidth: 1,
    borderColor: couleurs.bord,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: couleurs.texte,
  },
  inputError: {
    color: couleurs.texte, borderColor: couleurs.danger },
  error: { fontSize: 12, color: couleurs.danger, marginTop: 4 },
});

export default TextField;
