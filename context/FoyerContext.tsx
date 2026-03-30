import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { db } from '../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';

const PROJECT_ID = 'c09d1d00-d450-4784-bf9b-6341c5973f11';

// L'app tourne-t-elle dans Expo Go ?
const isExpoGo = Constants.appOwnership === 'expo';

type FoyerContextType = {
  activeCode: string | null;
  updateActiveCode: (code: string | null) => Promise<void>;
  pushToken: string | null;
  loading: boolean;
  // Identité
  userName: string | null;
  saveUserName: (firstName: string, lastName: string) => Promise<void>;
  // Dark mode
  isDark: boolean;
  toggleDarkMode: () => void;
};

const FoyerContext = createContext<FoyerContextType>({
  activeCode: null,
  updateActiveCode: async () => {},
  pushToken: null,
  loading: true,
  userName: null,
  saveUserName: async () => {},
  isDark: false,
  toggleDarkMode: () => {},
});

export function FoyerProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);
  // null = suivre le système, true/false = override manuel
  const [darkOverride, setDarkOverride] = useState<boolean | null>(null);

  const isDark = darkOverride !== null ? darkOverride : systemScheme === 'dark';

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('family_code'),
      AsyncStorage.getItem('dark_mode'),
      AsyncStorage.getItem('user_name'),
    ]).then(([code, dark, name]) => {
      setActiveCode(code);
      if (dark !== null) setDarkOverride(dark === 'true');
      if (name) setUserName(name);
      setLoading(false);
    });

    // Les notifications ne fonctionnent pas dans Expo Go depuis SDK 53
    if (!isExpoGo) registerForNotifications();
  }, []);

  useEffect(() => {
    if (!activeCode || !pushToken) return;
    setDoc(
      doc(db, 'notifTokens', pushToken),
      { token: pushToken, familyCode: activeCode },
      { merge: true }
    ).catch(() => {});
  }, [activeCode, pushToken]);

  const saveUserName = async (firstName: string, lastName: string) => {
    const full = `${firstName.trim()} ${lastName.trim()}`;
    await AsyncStorage.setItem('user_name', full);
    setUserName(full);
  };

  const toggleDarkMode = async () => {
    const next = !isDark;
    setDarkOverride(next);
    await AsyncStorage.setItem('dark_mode', String(next));
  };

  const registerForNotifications = async () => {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('courses', {
          name: 'Liste de courses',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
        });
      }
      const { status: existing } = await Notifications.getPermissionsAsync();
      // Si déjà refusé → on n'insiste pas
      if (existing === 'denied') return;
      // Si pas encore demandé → on demande une fois
      let finalStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;
      const { data } = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
      setPushToken(data);
    } catch {
      // Notifications non disponibles (émulateur, pas de configuration EAS)
    }
  };

  const updateActiveCode = async (code: string | null) => {
    if (code) {
      await AsyncStorage.setItem('family_code', code);
    } else {
      await AsyncStorage.removeItem('family_code');
    }
    setActiveCode(code);
  };

  return (
    <FoyerContext.Provider value={{ activeCode, updateActiveCode, pushToken, loading, userName, saveUserName, isDark, toggleDarkMode }}>
      {children}
    </FoyerContext.Provider>
  );
}

export const useFoyer = () => useContext(FoyerContext);
