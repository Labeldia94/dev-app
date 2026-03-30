import React, { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFoyer } from '../context/FoyerContext';
import { lightColors } from '../hooks/use-app-theme';

export default function OnboardingModal() {
  const { userName, saveUserName, loading } = useFoyer();
  const theme = lightColors; // toujours en clair pour l'onboarding
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [error, setError]         = useState('');

  const handleValidate = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError('Merci de renseigner ton prénom et ton nom.');
      return;
    }
    setError('');
    await saveUserName(firstName, lastName);
  };

  if (loading || userName) return null;

  return (
    <Modal visible transparent animationType="fade">
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.card}>
          <Text style={styles.emoji}>👋</Text>
          <Text style={styles.title}>Bienvenue sur OubliePas !</Text>
          <Text style={styles.subtitle}>Pour commencer, qui es-tu ?</Text>

          <TextInput
            style={styles.input}
            placeholder="Prénom"
            placeholderTextColor="#aaa"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
          />
          <TextInput
            style={styles.input}
            placeholder="Nom de famille"
            placeholderTextColor="#aaa"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.btn} onPress={handleValidate}>
            <Text style={styles.btnText}>Commencer</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card:      { width: '100%', backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center' },
  emoji:     { fontSize: 48, marginBottom: 12 },
  title:     { fontSize: 22, fontWeight: '900', color: '#1C1C1E', textAlign: 'center', marginBottom: 6 },
  subtitle:  { fontSize: 15, color: '#6C6C70', textAlign: 'center', marginBottom: 24 },
  input:     { width: '100%', backgroundColor: '#F2F2F7', borderRadius: 12, padding: 14, fontSize: 16, color: '#1C1C1E', marginBottom: 12 },
  error:     { color: '#FF3B30', fontSize: 13, marginBottom: 10, textAlign: 'center' },
  btn:       { backgroundColor: '#34C759', width: '100%', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 4 },
  btnText:   { color: '#fff', fontWeight: '900', fontSize: 17 },
});
