import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Keyboard, Share, Alert, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFoyer } from '../../context/FoyerContext';
import { useAppTheme } from '../../hooks/use-app-theme';

export default function FoyerScreen() {
  const { activeCode, updateActiveCode, isDark, toggleDarkMode } = useFoyer();
  const theme = useAppTheme();

  const [code, setCode] = useState('');
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem('foyers_history').then(list => {
      if (list) setHistory(JSON.parse(list));
    });
  }, []);

  const saveFoyer = async (foyerToSave: string) => {
    const clean = foyerToSave.toLowerCase().trim();
    if (clean.length < 3) return;
    try {
      await updateActiveCode(clean);
      let newHistory = history.filter(h => h !== clean);
      newHistory = [clean, ...newHistory].slice(0, 5);
      await AsyncStorage.setItem('foyers_history', JSON.stringify(newHistory));
      setHistory(newHistory);
      setCode('');
      Keyboard.dismiss();
    } catch {
      Alert.alert("Erreur", "Impossible de sauvegarder le foyer.");
    }
  };

  const removeFoyerFromHistory = async (f: string) => {
    try {
      const newH = history.filter(h => h !== f);
      await AsyncStorage.setItem('foyers_history', JSON.stringify(newH));
      setHistory(newH);
      if (activeCode === f) await updateActiveCode(null);
    } catch {
      Alert.alert("Erreur", "Impossible de supprimer ce foyer.");
    }
  };

  const handleShare = async () => {
    if (!activeCode) return;
    await Share.share({
      message: `Rejoins ma liste de courses sur OubliePas avec le code : ${activeCode.toUpperCase()}`,
      title: 'OubliePas – Code de liste',
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.headerHero}>
        <Text style={styles.cartIcon}>🛒</Text>
        <Text style={[styles.appName, { color: theme.text }]}>OubliePas</Text>
        <Text style={[styles.title, { color: theme.subtext }]}>Gestion des Foyers</Text>
        {/* Toggle dark mode */}
        <View style={styles.darkToggleRow}>
          <Text style={[styles.darkToggleLabel, { color: theme.subtext }]}>☀️</Text>
          <Switch
            value={isDark}
            onValueChange={toggleDarkMode}
            trackColor={{ false: '#E5E5EA', true: '#0A84FF' }}
            thumbColor="#fff"
          />
          <Text style={[styles.darkToggleLabel, { color: theme.subtext }]}>🌙</Text>
        </View>
      </View>

      <View style={[styles.infoBox, { backgroundColor: theme.tint + '18' }]}>
        <Text style={[styles.infoText, { color: theme.tint }]}>
          Taper un code existant pour rejoindre, ou un nouveau pour créer.
        </Text>
      </View>

      <View style={[styles.activeCard, { backgroundColor: theme.card }]}>
        <Text style={[styles.label, { color: theme.subtext }]}>LISTE ACTIVE :</Text>
        <Text style={[styles.activeCode, { color: theme.tint }]}>
          {activeCode ? activeCode.toUpperCase() : 'AUCUNE'}
        </Text>
        {activeCode && (
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
            <Text style={styles.shareBtnText}>🔗 Partager le code</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.inputSection}>
        <TextInput
          style={[styles.input, { backgroundColor: theme.card, color: theme.text }]}
          placeholder="Code secret (ex: famille94)"
          placeholderTextColor={theme.subtext}
          value={code}
          onChangeText={setCode}
          autoCapitalize="none"
        />
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: theme.tint }]} onPress={() => saveFoyer(code)}>
          <Text style={styles.addBtnText}>Valider</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.subtitle, { color: theme.text }]}>Vos listes enregistrées :</Text>
      <FlatList
        data={history}
        keyExtractor={i => i}
        renderItem={({ item }) => (
          <View style={[styles.historyItem, { backgroundColor: theme.card }, item === activeCode && styles.activeBorder]}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => saveFoyer(item)}>
              <Text style={[styles.historyText, { color: theme.text }]}>{item.toUpperCase()}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removeFoyerFromHistory(item)}>
              <Text style={styles.deleteText}>Supprimer</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, padding: 25, paddingTop: 50 },
  headerHero:     { alignItems: 'center', marginBottom: 20 },
  darkToggleRow:  { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  darkToggleLabel: { fontSize: 18 },
  cartIcon:     { fontSize: 60, marginBottom: 5 },
  appName:      { fontSize: 28, fontWeight: '900', letterSpacing: 1 },
  title:        { fontSize: 16, fontWeight: '600', marginTop: -5 },
  infoBox:      { padding: 15, borderRadius: 12, marginBottom: 20 },
  infoText:     { fontSize: 12, textAlign: 'center', fontWeight: '500' },
  activeCard:   { padding: 20, borderRadius: 15, marginBottom: 25, alignItems: 'center', elevation: 2 },
  label:        { fontSize: 10, fontWeight: 'bold', marginBottom: 5 },
  activeCode:   { fontSize: 24, fontWeight: '900' },
  shareBtn:     { marginTop: 12, backgroundColor: '#34C75920', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  shareBtnText: { color: '#34C759', fontWeight: 'bold', fontSize: 13 },
  inputSection: { flexDirection: 'row', marginBottom: 25 },
  input:        { flex: 1, padding: 15, borderRadius: 12, marginRight: 10, elevation: 1 },
  addBtn:       { paddingHorizontal: 20, borderRadius: 12, justifyContent: 'center' },
  addBtnText:   { color: '#fff', fontWeight: 'bold' },
  subtitle:     { fontSize: 14, fontWeight: 'bold', marginBottom: 12 },
  historyItem:  { padding: 15, borderRadius: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 1 },
  activeBorder: { borderColor: '#34C759', borderWidth: 2 },
  historyText:  { fontSize: 16, fontWeight: 'bold' },
  deleteText:   { color: '#FF3B30', fontSize: 12, fontWeight: '600' },
});
