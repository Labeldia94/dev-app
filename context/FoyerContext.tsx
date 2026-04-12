import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { db, auth } from '../firebaseConfig';
import {
  doc, setDoc, getDoc, addDoc, collection, updateDoc,
  query, where, getDocs, onSnapshot, deleteDoc, arrayUnion, arrayRemove, orderBy,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const PROJECT_ID = 'c09d1d00-d450-4784-bf9b-6341c5973f11';
const isExpoGo = Constants.appOwnership === 'expo';

// Génère un code aléatoire sans caractères ambigus (0/O, 1/I/L)
function generateCode(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ---- Types exportés ----

export type FoyerMember = {
  uid: string;
  name: string;
  joinedAt: number;
};

export type FoyerDoc = {
  code: string;
  name: string;
  ownerUid: string;
  members: FoyerMember[];
  createdAt: number;
};

export type InvitePreview = {
  id: string;
  foyerCode: string;
  foyerName: string;
  inviterName: string;
  expiresAt: number;
};

export type FoyerList = {
  id: string;
  foyerCode: string;
  name: string;
  createdAt: number;
};

// ---- Type du contexte ----

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
  // Notifications
  notificationsEnabled: boolean;
  toggleNotifications: () => Promise<void>;
  // Foyer
  currentFoyer: FoyerDoc | null;
  myFoyers: FoyerDoc[];
  createFoyer: (name: string) => Promise<string>;
  generateInviteCode: () => Promise<string>;
  lookupInviteCode: (code: string) => Promise<InvitePreview | null>;
  acceptInvitation: (invite: InvitePreview) => Promise<void>;
  rejectInvitation: (inviteId: string) => Promise<void>;
  removeMember: (memberUid: string) => Promise<void>;
  leaveFoyer: () => Promise<void>;
  // Listes
  foyerLists: FoyerList[];
  activeListId: string | null;
  setActiveListId: (id: string | null) => void;
  createList: (name: string) => Promise<string>;
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
  notificationsEnabled: true,
  toggleNotifications: async () => {},
  currentFoyer: null,
  myFoyers: [],
  createFoyer: async () => '',
  generateInviteCode: async () => '',
  lookupInviteCode: async () => null,
  acceptInvitation: async () => {},
  rejectInvitation: async () => {},
  removeMember: async () => {},
  leaveFoyer: async () => {},
  foyerLists: [],
  activeListId: null,
  setActiveListId: () => {},
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
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [currentFoyer, setCurrentFoyer] = useState<FoyerDoc | null>(null);
  const [myFoyers, setMyFoyers] = useState<FoyerDoc[]>([]);
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [foyerLists, setFoyerLists] = useState<FoyerList[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);

  const isDark = darkOverride !== null ? darkOverride : systemScheme === 'dark';

  // Chargement initial depuis AsyncStorage
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('family_code'),
      AsyncStorage.getItem('dark_mode'),
      AsyncStorage.getItem('user_name'),
      AsyncStorage.getItem('notifications_enabled'),
    ]).then(([code, dark, name, notif]) => {
      setActiveCode(code);
      if (dark !== null) setDarkOverride(dark === 'true');
      if (name) setUserName(name);
      if (notif !== null) setNotificationsEnabled(notif === 'true');
      setLoading(false);
    });

    if (!isExpoGo) registerForNotifications();
  }, []);

  // Suit l'état de connexion pour charger les foyers de l'utilisateur
  useEffect(() => {
    return onAuthStateChanged(auth, u => setCurrentUid(u?.uid ?? null));
  }, []);

  // Écoute tous les foyers de l'utilisateur en temps réel (un listener par foyer)
  useEffect(() => {
    if (!currentUid) { setMyFoyers([]); return; }

    const foyerMap = new Map<string, FoyerDoc>();
    const foyerUnsubs = new Map<string, () => void>();
    let currentCodes: string[] = [];

    const userUnsub = onSnapshot(doc(db, 'users', currentUid), userSnap => {
      const codes: string[] = userSnap.data()?.foyerCodes ?? [];

      // Nettoie les listeners des foyers supprimés
      currentCodes.filter(c => !codes.includes(c)).forEach(c => {
        foyerUnsubs.get(c)?.();
        foyerUnsubs.delete(c);
        foyerMap.delete(c);
      });

      currentCodes = codes;
      if (codes.length === 0) { setMyFoyers([]); return; }

      // Ajoute un listener temps réel pour chaque nouveau foyer
      codes.filter(c => !foyerUnsubs.has(c)).forEach(code => {
        const unsub = onSnapshot(doc(db, 'foyers', code), snap => {
          if (snap.exists()) foyerMap.set(code, snap.data() as FoyerDoc);
          else foyerMap.delete(code);
          setMyFoyers(currentCodes.filter(c => foyerMap.has(c)).map(c => foyerMap.get(c)!));
        });
        foyerUnsubs.set(code, unsub);
      });
    });

    return () => {
      userUnsub();
      foyerUnsubs.forEach(unsub => unsub());
    };
  }, [currentUid]);

  // Écoute le document foyer actif en temps réel
  useEffect(() => {
    if (!activeCode || !currentUid) { setCurrentFoyer(null); return; }
    return onSnapshot(doc(db, 'foyers', activeCode), snap => {
      setCurrentFoyer(snap.exists() ? (snap.data() as FoyerDoc) : null);
    });
  }, [activeCode, currentUid]);

  // Écoute les listes du foyer actif en temps réel
  useEffect(() => {
    if (!activeCode || !currentUid) { setFoyerLists([]); setActiveListId(null); return; }
    const q = query(
      collection(db, 'lists'),
      where('foyerCode', '==', activeCode),
      orderBy('createdAt'),
    );
    return onSnapshot(q, snap => {
      const lists = snap.docs.map(d => ({ id: d.id, ...d.data() } as FoyerList));
      setFoyerLists(lists);
      // Sélectionne automatiquement la première liste si aucune n'est sélectionnée
      setActiveListId(prev => {
        if (prev && lists.some(l => l.id === prev)) return prev;
        return lists.length > 0 ? lists[0].id : null;
      });
    });
  }, [activeCode, currentUid]);

  // Enregistre le token push dans Firestore
  useEffect(() => {
    if (!activeCode || !pushToken || !notificationsEnabled) return;
    setDoc(
      doc(db, 'notifTokens', pushToken),
      { token: pushToken, familyCode: activeCode },
      { merge: true }
    ).catch(() => {});
  }, [activeCode, pushToken, notificationsEnabled]);

  const saveUserName = async (firstName: string, lastName: string) => {
    const full = `${firstName.trim()} ${lastName.trim()}`;
    await AsyncStorage.setItem('user_name', full);
    setUserName(full);
    const user = auth.currentUser;
    if (user) {
      setDoc(doc(db, 'users', user.uid), { uid: user.uid, name: full, email: user.email }, { merge: true }).catch(() => {});
    }
  };

  const toggleDarkMode = async () => {
    const next = !isDark;
    setDarkOverride(next);
    await AsyncStorage.setItem('dark_mode', String(next));
  };

  const toggleNotifications = async () => {
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    await AsyncStorage.setItem('notifications_enabled', String(next));
    if (!next && pushToken) {
      deleteDoc(doc(db, 'notifTokens', pushToken)).catch(() => {});
    }
  };

  // ─── Fonctions Foyer ───────────────────────────────────────────────────────

  const createFoyer = async (name: string): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error('Non connecté');
    const code = generateCode(8);
    const member: FoyerMember = {
      uid: user.uid,
      name: userName ?? user.email ?? 'Moi',
      joinedAt: Date.now(),
    };
    await setDoc(doc(db, 'foyers', code), {
      code,
      name: name.trim(),
      ownerUid: user.uid,
      members: [member],
      memberUids: [user.uid],
      createdAt: Date.now(),
    });
    // Ajoute le code dans la liste des foyers de l'utilisateur
    await setDoc(doc(db, 'users', user.uid), { foyerCodes: arrayUnion(code) }, { merge: true });
    await updateActiveCode(code);
    return code;
  };

  const generateInviteCode = async (): Promise<string> => {
    if (!activeCode || !currentFoyer) throw new Error('Pas de foyer actif');
    const inviteCode = generateCode(6);
    await addDoc(collection(db, 'invitations'), {
      foyerCode: activeCode,
      foyerName: currentFoyer.name,
      inviterName: userName ?? 'Quelqu\'un',
      inviteCode,
      status: 'pending',
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // expire dans 24h
      createdAt: Date.now(),
    });
    return inviteCode;
  };

  const lookupInviteCode = async (code: string): Promise<InvitePreview | null> => {
    const q = query(
      collection(db, 'invitations'),
      where('inviteCode', '==', code.toUpperCase().trim()),
      where('status', '==', 'pending'),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    const data = d.data();
    if (data.expiresAt < Date.now()) return null;
    return {
      id: d.id,
      foyerCode: data.foyerCode,
      foyerName: data.foyerName,
      inviterName: data.inviterName,
      expiresAt: data.expiresAt,
    };
  };

  const acceptInvitation = async (invite: InvitePreview): Promise<void> => {
    const user = auth.currentUser;
    if (!user) throw new Error('Non connecté');
    const foyerSnap = await getDoc(doc(db, 'foyers', invite.foyerCode));
    if (!foyerSnap.exists()) throw new Error('Foyer introuvable');
    const foyerData = foyerSnap.data() as FoyerDoc;
    const alreadyMember = foyerData.members.some(m => m.uid === user.uid);
    if (!alreadyMember) {
      const member: FoyerMember = {
        uid: user.uid,
        name: userName ?? user.email ?? 'Moi',
        joinedAt: Date.now(),
      };
      await updateDoc(doc(db, 'foyers', invite.foyerCode), {
        members: [...foyerData.members, member],
        memberUids: arrayUnion(user.uid),
      });
    }
    await updateDoc(doc(db, 'invitations', invite.id), { status: 'accepted' });
    // Ajoute le foyer dans la liste de l'utilisateur
    await setDoc(doc(db, 'users', user.uid), { foyerCodes: arrayUnion(invite.foyerCode) }, { merge: true });
    await updateActiveCode(invite.foyerCode);
  };

  const rejectInvitation = async (inviteId: string): Promise<void> => {
    await updateDoc(doc(db, 'invitations', inviteId), { status: 'rejected' });
  };

  const removeMember = async (memberUid: string): Promise<void> => {
    if (!activeCode || !currentFoyer) return;
    const updated = currentFoyer.members.filter(m => m.uid !== memberUid);
    await updateDoc(doc(db, 'foyers', activeCode), {
      members: updated,
      memberUids: arrayRemove(memberUid),
    });
  };

  const createList = async (name: string): Promise<string> => {
    if (!activeCode) throw new Error('Pas de foyer actif');
    const ref = await addDoc(collection(db, 'lists'), {
      foyerCode: activeCode,
      name: name.trim(),
      createdAt: Date.now(),
    });
    setActiveListId(ref.id);
    return ref.id;
  };

  const deleteList = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, 'lists', id));
  };

  const leaveFoyer = async (): Promise<void> => {
    const user = auth.currentUser;
    if (!activeCode || !user || !currentFoyer) return;
    if (currentFoyer.ownerUid === user.uid) throw new Error('OWNER_CANNOT_LEAVE');
    const updated = currentFoyer.members.filter(m => m.uid !== user.uid);
    await updateDoc(doc(db, 'foyers', activeCode), {
      members: updated,
      memberUids: arrayRemove(user.uid),
    });
    // Retire le foyer de la liste de l'utilisateur
    await setDoc(doc(db, 'users', user.uid), { foyerCodes: arrayRemove(activeCode) }, { merge: true });
    await updateActiveCode(null);
  };

  // ─── Notifications ─────────────────────────────────────────────────────────

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
      let finalStatus: Notifications.PermissionStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;
      const { data } = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
      setPushToken(data);
    } catch {
      // Notifications non disponibles
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
      userName, saveUserName,
      isDark, toggleDarkMode,
      notificationsEnabled, toggleNotifications,
      currentFoyer, myFoyers, createFoyer, generateInviteCode, lookupInviteCode,
      acceptInvitation, rejectInvitation, removeMember, leaveFoyer,
      foyerLists, activeListId, setActiveListId, createList, deleteList,
    }}>
      {children}
    </FoyerContext.Provider>
  );
}

export const useFoyer = () => useContext(FoyerContext);
