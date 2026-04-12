import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert, Image, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useFoyer } from '../../context/FoyerContext';
import { useAppTheme } from '../../hooks/use-app-theme';
import { db } from '../../firebaseConfig';

export default function CompteScreen() {
  const { user, signOut } = useAuth();
  const { userName, isDark, toggleDarkMode, notificationsEnabled, toggleNotifications } = useFoyer();
  const theme = useAppTheme();
  const router = useRouter();

  const handleSignOut = () => {
    Alert.alert(
      'Se déconnecter',
      'Voulez-vous vraiment vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnecter', style: 'destructive', onPress: async () => {
            await signOut();
            router.replace('/onboarding');
          },
        },
      ]
    );
  };

  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const initials = userName
    ? userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.[0] ?? '?').toUpperCase();

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists() && snap.data().photoURL) setPhotoURL(snap.data().photoURL);
    });
  }, [user]);

  const handlePickPhoto = () => {
    Alert.alert('Photo de profil', 'Choisir la source', [
      {
        text: '📷 Appareil photo', onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission refusée', 'Active l\'accès à l\'appareil photo dans les paramètres.');
            return;
          }
          await savePhoto(await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.5 }));
        },
      },
      {
        text: '🖼 Galerie', onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission refusée', 'Active l\'accès à la galerie dans les paramètres.');
            return;
          }
          await savePhoto(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5 }));
        },
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const savePhoto = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 150, height: 150 } }],
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      const base64 = `data:image/jpeg;base64,${compressed.base64}`;
      setPhotoURL(base64);
      await setDoc(doc(db, 'users', user!.uid), { photoURL: base64 }, { merge: true });
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder la photo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={styles.content}
    >
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={handlePickPhoto} style={[styles.avatar, { backgroundColor: theme.tint }]}>
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : photoURL ? (
            <Image source={{ uri: photoURL }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarText}>{initials}</Text>
          )}
          <View style={styles.avatarEdit}>
            <Ionicons name="camera" size={12} color="#fff" />
          </View>
        </TouchableOpacity>
        {userName ? (
          <Text style={[styles.name, { color: theme.text }]}>{userName}</Text>
        ) : null}
        {user?.email ? (
          <Text style={[styles.email, { color: theme.subtext }]}>{user.email}</Text>
        ) : null}
      </View>

      {/* Section Préférences */}
      <Text style={[styles.sectionTitle, { color: theme.subtext }]}>PRÉFÉRENCES</Text>
      <View style={[styles.section, { backgroundColor: theme.card }]}>

        {/* Mode sombre */}
        <View style={[styles.row, { borderBottomColor: theme.border }]}>
          <View style={styles.rowLeft}>
            <View style={[styles.iconBox, { backgroundColor: '#1C1C1E' }]}>
              <Ionicons name="moon" size={18} color="#fff" />
            </View>
            <Text style={[styles.rowLabel, { color: theme.text }]}>Mode sombre</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleDarkMode}
            trackColor={{ false: '#E5E5EA', true: theme.tint }}
            thumbColor="#fff"
          />
        </View>

        {/* Notifications */}
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <View style={[styles.iconBox, { backgroundColor: '#FF9500' }]}>
              <Ionicons name="notifications" size={18} color="#fff" />
            </View>
            <Text style={[styles.rowLabel, { color: theme.text }]}>Notifications</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={toggleNotifications}
            trackColor={{ false: '#E5E5EA', true: theme.tint }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Section Compte */}
      <Text style={[styles.sectionTitle, { color: theme.subtext }]}>COMPTE</Text>
      <View style={[styles.section, { backgroundColor: theme.card }]}>
        <TouchableOpacity style={styles.row} onPress={handleSignOut}>
          <View style={styles.rowLeft}>
            <View style={[styles.iconBox, { backgroundColor: '#FF3B30' }]}>
              <Ionicons name="log-out" size={18} color="#fff" />
            </View>
            <Text style={[styles.rowLabel, { color: '#FF3B30' }]}>Se déconnecter</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.subtext} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  content:     { padding: 20, paddingTop: 60, paddingBottom: 40 },

  // Avatar
  avatarSection: { alignItems: 'center', marginBottom: 32 },
  avatar:        { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 12, overflow: 'hidden' },
  avatarImg:     { width: 80, height: 80, borderRadius: 40 },
  avatarText:    { color: '#fff', fontSize: 28, fontWeight: '900' },
  avatarEdit:    { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, padding: 3 },
  name:          { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  email:         { fontSize: 14 },

  // Sections
  sectionTitle: { fontSize: 12, fontWeight: '700', marginBottom: 8, marginLeft: 4, letterSpacing: 0.5 },
  section:      { borderRadius: 14, marginBottom: 28, overflow: 'hidden' },

  // Lignes
  row:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'transparent' },
  rowLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rowLabel: { fontSize: 16, flex: 1 },
  iconBox:  { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
});
