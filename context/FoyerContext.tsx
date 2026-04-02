import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { db } from '../firebaseConfig';
import {
  doc, setDoc, collection, query, where, onSnapshot,
  addDoc, getDocs, writeBatch,
} from 'firebase/firestore';

const PROJECT_ID = 'c09d1d00-d450-4784-bf9b-6341c5973f11';
const isExpoGo = Constants.appOwnership === 'expo';

export type List = {
  id: string;
  name: string;
  emoji: string;
  familyCode: string;
  createdAt: number;
};

type FoyerContextType = {
  activeCode: string | null;
  updateActiveCode: (code: string | null) => Promise<void>;
  pushToken: string | null;
  loading: boolean;
  userName: string | null;
  saveUserName: (firstName: string, lastName: string) => Promise<void>;
  isDark: boolean;
  toggleDarkMode: () => void;
  // Listes multiples
  lists: List[];
  activeListId: string | null;
  setActiveListId: (id: string) => Promise<void>;
  createList: (name: string, emoji: string) => Promise<string>;
  deleteList: (id: string) => Promise<void>;
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
  lists: [],
  activeListId: null,
  setActiveListId: async () => {},
  createList: async () => '',
  deleteList: async () => {},
});

export function FoyerProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);
  const [darkOverride, setDarkOverride] = useState<boolean | null>(null);
  const [lists, setLists] = useState<List[]>([]);
  const [activeListId, setActiveListIdState] = useState<string | null>(null);

  const isDark = darkOverride !== null ? darkOverride : systemScheme === 'dark';

  // Chargement initial
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
    }).catch(() => setLoading(false));
    if (!isExpoGo) registerForNotifications();
  }, []);

  // Listener sur les listes du foyer actif
  useEffect(() => {
    if (!activeCode) {
      setLists([]);
      setActiveListIdState(null);
      return;
    }
    // Charger l'activeListId persisté pour ce foyer
    AsyncStorage.getItem(`active_list_id_${activeCode}`).then(savedId => {
      if (savedId) setActiveListIdState(savedId);
    });

    const q = query(collection(db, 'lists'), where('familyCode', '==', activeCode));
    const unsub = onSnapshot(q, snapshot => {
      const data = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as List))
        .sort((a, b) => a.createdAt - b.createdAt);
      setLists(data);
      // Si la liste active a été supprimée, basculer sur la première disponible
      setActiveListIdState(prev => {
        if (prev && data.some(l => l.id === prev)) return prev;
        return data[0]?.id ?? null;
      });
    });
    return unsub;
  }, [activeCode]);

  // Enregistrement du token push dans Firestore
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

  const setActiveListId = async (id: string) => {
    if (!activeCode) return;
    await AsyncStorage.setItem(`active_list_id_${activeCode}`, id);
    setActiveListIdState(id);
  };

  const createList = async (name: string, emoji: string): Promise<string> => {
    if (!activeCode) throw new Error('Aucun foyer actif');
    const isFirstList = lists.length === 0;
    const docRef = await addDoc(collection(db, 'lists'), {
      name,
      emoji,
      familyCode: activeCode,
      createdAt: Date.now(),
    });
    // Migration : si c'est la première liste, rattacher les articles existants sans listId
    if (isFirstList) {
      const existingSnap = await getDocs(
        query(collection(db, 'shoppingList'), where('familyCode', '==', activeCode))
      );
      const toMigrate = existingSnap.docs.filter(d => !d.data().listId);
      if (toMigrate.length > 0) {
        const batch = writeBatch(db);
        toMigrate.forEach(d => batch.update(d.ref, { listId: docRef.id }));
        await batch.commit();
      }
    }
    await setActiveListId(docRef.id);
    return docRef.id;
  };

  const deleteList = async (id: string) => {
    const batch = writeBatch(db);
    const itemsSnap = await getDocs(
      query(collection(db, 'shoppingList'), where('listId', '==', id))
    );
    itemsSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(doc(db, 'lists', id));
    await batch.commit(); // throws on failure — caller handles it
    if (activeListId === id) {
      const remaining = lists.filter(l => l.id !== id);
      if (remaining.length > 0) {
        await setActiveListId(remaining[0].id);
      } else {
        setActiveListIdState(null);
      }
    }
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
      if (existing === 'denied') return;
      let finalStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;
      const { data } = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
      setPushToken(data);
    } catch {
      // Notifications non disponibles (émulateur, Expo Go)
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
    <FoyerContext.Provider value={{
      activeCode, updateActiveCode, pushToken, loading,
      userName, saveUserName, isDark, toggleDarkMode,
      lists, activeListId, setActiveListId, createList, deleteList,
    }}>
      {children}
    </FoyerContext.Provider>
  );
}

export const useFoyer = () => useContext(FoyerContext);
