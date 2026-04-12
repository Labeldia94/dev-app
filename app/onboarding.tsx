import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFoyer } from '../context/FoyerContext';
import { useAuth } from '../context/AuthContext';

type Step    = 'auth' | 'name';
type AuthTab = 'login' | 'register';

export default function OnboardingScreen() {
  const { saveUserName, userName } = useFoyer();
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const router = useRouter();

  const [step, setStep]       = useState<Step>('auth');
  const [tab, setTab]         = useState<AuthTab>('login');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  /* ---------- Auth email/password ---------- */
  const handleAuth = async () => {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Email et mot de passe requis.');
      return;
    }
    if (tab === 'register' && password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      if (tab === 'login') {
        await signInWithEmail(email.trim(), password);
        if (userName) router.replace('/foyer');
        else setStep('name');
      } else {
        await signUpWithEmail(email.trim(), password);
        setStep('name');
      }
    } catch (e: any) {
      setError(translateFirebaseError(e.code));
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Auth Google ---------- */
  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      const { displayName } = await signInWithGoogle();
      if (displayName) {
        const parts = displayName.split(' ');
        const first = parts[0] ?? displayName;
        const last  = parts.slice(1).join(' ') || (parts[0] ?? displayName);
        await saveUserName(first, last);
        router.replace('/foyer');
      } else {
        setStep('name');
      }
    } catch (e: any) {
      if (e.code !== 'SIGN_IN_CANCELLED') {
        const msg = [e.code, e.message, JSON.stringify(e)].filter(Boolean).join(' | ');
        Alert.alert('Erreur Google', msg || 'Erreur inconnue');
        setError('Erreur Google — voir la popup');
      }
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Étape nom ---------- */
  const handleName = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError('Merci de renseigner ton prénom et ton nom.');
      return;
    }
    setLoading(true);
    await saveUserName(firstName.trim(), lastName.trim());
    setLoading(false);
    router.replace('/foyer');
  };

  /* ============================
     ÉCRAN NOM
  ============================== */
  if (step === 'name') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Text style={styles.emoji}>👋</Text>
        <Text style={styles.title}>Comment tu t'appelles ?</Text>
        <Text style={styles.subtitle}>Pour personnaliser ton expérience</Text>

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

        <TouchableOpacity style={styles.btn} onPress={handleName} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Continuer →</Text>
          }
        </TouchableOpacity>
      </KeyboardAvoidingView>
    );
  }

  /* ============================
     ÉCRAN AUTH
  ============================== */
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Text style={styles.emoji}>🛒</Text>
      <Text style={styles.title}>OubliePas</Text>
      <Text style={styles.subtitle}>Connecte-toi pour partager ta liste en famille</Text>

      {/* Onglets */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'login' && styles.tabActive]}
          onPress={() => { setTab('login'); setError(''); }}
        >
          <Text style={[styles.tabText, tab === 'login' && styles.tabTextActive]}>Se connecter</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'register' && styles.tabActive]}
          onPress={() => { setTab('register'); setError(''); }}
        >
          <Text style={[styles.tabText, tab === 'register' && styles.tabTextActive]}>S'inscrire</Text>
        </TouchableOpacity>
      </View>

      {/* Formulaire */}
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#aaa"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        placeholderTextColor="#aaa"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {tab === 'register' && (
        <TextInput
          style={styles.input}
          placeholder="Confirmer le mot de passe"
          placeholderTextColor="#aaa"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
        />
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.btn} onPress={handleAuth} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>{tab === 'login' ? 'Se connecter' : "S'inscrire"}</Text>
        }
      </TouchableOpacity>

      {/* Séparateur */}
      <View style={styles.separator}>
        <View style={styles.separatorLine} />
        <Text style={styles.separatorText}>ou</Text>
        <View style={styles.separatorLine} />
      </View>

      {/* Bouton Google */}
      <TouchableOpacity style={styles.googleBtn} onPress={handleGoogle} disabled={loading}>
        <Text style={styles.googleG}>G</Text>
        <Text style={styles.googleText}>Continuer avec Google</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

function translateFirebaseError(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':  return 'Email ou mot de passe incorrect.';
    case 'auth/email-already-in-use': return 'Cet email est déjà utilisé.';
    case 'auth/weak-password':        return 'Mot de passe trop court (6 caractères min).';
    case 'auth/invalid-email':        return 'Email invalide.';
    case 'auth/too-many-requests':    return 'Trop de tentatives, réessaie plus tard.';
    default:                          return 'Une erreur est survenue.';
  }
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', padding: 28 },
  emoji:          { fontSize: 56, marginBottom: 8 },
  title:          { fontSize: 28, fontWeight: '900', color: '#1C1C1E', marginBottom: 4 },
  subtitle:       { fontSize: 14, color: '#6C6C70', marginBottom: 28, textAlign: 'center' },

  tabs:           { flexDirection: 'row', backgroundColor: '#F2F2F7', borderRadius: 12, padding: 4, width: '100%', marginBottom: 20 },
  tabBtn:         { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive:      { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabText:        { fontSize: 14, fontWeight: '600', color: '#8E8E93' },
  tabTextActive:  { color: '#1C1C1E' },

  input:          { width: '100%', backgroundColor: '#F2F2F7', borderRadius: 12, padding: 14, fontSize: 16, color: '#1C1C1E', marginBottom: 12 },
  error:          { color: '#FF3B30', fontSize: 13, marginBottom: 10, textAlign: 'center' },
  btn:            { backgroundColor: '#34C759', width: '100%', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 4 },
  btnText:        { color: '#fff', fontWeight: '900', fontSize: 17 },

  separator:      { flexDirection: 'row', alignItems: 'center', width: '100%', marginVertical: 20 },
  separatorLine:  { flex: 1, height: 1, backgroundColor: '#E5E5EA' },
  separatorText:  { marginHorizontal: 12, color: '#8E8E93', fontSize: 13 },

  googleBtn:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', width: '100%', padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E5EA', justifyContent: 'center', gap: 10 },
  googleG:        { fontSize: 20, fontWeight: '900', color: '#4285F4' },
  googleText:     { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
});
