import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFoyer } from '../context/FoyerContext';

export default function OnboardingScreen() {
  const { saveUserName } = useFoyer();
  const router = useRouter();
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
    router.replace('/foyer');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Text style={styles.emoji}>👋</Text>
      <Text style={styles.title}>Bienvenue sur OubliePas !</Text>

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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', padding: 28 },
  emoji:     { fontSize: 56, marginBottom: 16 },
  title:     { fontSize: 24, fontWeight: '900', color: '#1C1C1E', textAlign: 'center', marginBottom: 8 },
  subtitle:  { fontSize: 16, color: '#6C6C70', textAlign: 'center', marginBottom: 32 },
  input:     { width: '100%', backgroundColor: '#F2F2F7', borderRadius: 12, padding: 14, fontSize: 16, color: '#1C1C1E', marginBottom: 14 },
  error:     { color: '#FF3B30', fontSize: 13, marginBottom: 10, textAlign: 'center' },
  btn:       { backgroundColor: '#34C759', width: '100%', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 4 },
  btnText:   { color: '#fff', fontWeight: '900', fontSize: 17 },
});
