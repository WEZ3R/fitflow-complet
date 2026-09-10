import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppNavigator />
        {/* L'interface est sombre en permanence : les icônes de la barre système
            doivent donc être claires, quel que soit le réglage de l'appareil. */}
        <StatusBar style="light" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
