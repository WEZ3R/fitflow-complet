import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import TextField from '../components/TextField';
import PrimaryButton from '../components/PrimaryButton';
import { couleurs } from '../theme';

const RegisterScreen = ({ navigation }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('CLIENT');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  const handleRegister = async () => {
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setLoading(true);
    const result = await register({ firstName, lastName, email, phone: phone || undefined, password, role });
    setLoading(false);

    if (!result.success) {
      Alert.alert('Erreur', result.error);
      return;
    }

    // Redirection vers l'onboarding selon le rôle
    if (role === 'CLIENT') {
      navigation.replace('ClientOnboarding');
    } else {
      navigation.replace('CoachOnboarding');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>FitFlow</Text>
        <Text style={styles.subtitle}>Créer un compte</Text>

        {/* Switch Client / Coach */}
        <View style={styles.roleContainer}>
          <TouchableOpacity
            style={[styles.roleButton, role === 'CLIENT' && styles.roleButtonActive]}
            onPress={() => setRole('CLIENT')}
          >
            <Text style={[styles.roleButtonText, role === 'CLIENT' && styles.roleButtonTextActive]}>
              Je suis client
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.roleButton, role === 'COACH' && styles.roleButtonActive]}
            onPress={() => setRole('COACH')}
          >
            <Text style={[styles.roleButtonText, role === 'COACH' && styles.roleButtonTextActive]}>
              Je suis coach
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <TextField
                label="Prénom"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                editable={!loading}
                placeholder="Jean"
              />
            </View>
            <View style={styles.flex}>
              <TextField
                label="Nom"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                editable={!loading}
                placeholder="Dupont"
              />
            </View>
          </View>

          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
            placeholder="jean@exemple.fr"
          />

          <TextField
            label="Téléphone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            editable={!loading}
            placeholder="+33 6 00 00 00 00"
            optional
          />

          <TextField
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
            placeholder="6 caractères minimum"
          />

          <TextField
            label="Confirmer le mot de passe"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            editable={!loading}
            placeholder="Répéter le mot de passe"
          />

          <PrimaryButton label="Créer mon compte" onPress={handleRegister} loading={loading} />

          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Text style={styles.loginLinkText}>
              Déjà un compte ?{' '}
              <Text style={styles.loginLinkBold}>Se connecter</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: couleurs.fond,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 48,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: couleurs.accent,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: couleurs.texteDoux,
    textAlign: 'center',
    marginBottom: 28,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
    backgroundColor: couleurs.fond,
    borderRadius: 10,
    padding: 4,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  roleButtonActive: {
    backgroundColor: couleurs.carte,
    shadowColor: couleurs.ombre,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  roleButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: couleurs.texteDoux,
  },
  roleButtonTextActive: {
    color: couleurs.accent,
    fontWeight: '600',
  },
  form: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  loginLinkText: {
    fontSize: 14,
    color: couleurs.texteDoux,
  },
  loginLinkBold: {
    color: couleurs.accent,
    fontWeight: '600',
  },
});

export default RegisterScreen;
