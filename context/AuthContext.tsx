import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import Constants from 'expo-constants';
import { auth } from '../firebaseConfig';

// Google Sign-In non disponible dans Expo Go (requiert un build natif)
const isExpoGo = Constants.appOwnership === 'expo';
let GoogleSignin: any = null;
try {
  if (!isExpoGo) {
    GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
    GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID });
  }
} catch {}

type GoogleSignInResult = {
  displayName: string | null;
};

type AuthContextType = {
  user: User | null;
  authLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<GoogleSignInResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  authLoading: true,
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  signInWithGoogle: async () => ({ displayName: null }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmail = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const signInWithGoogle = async (): Promise<GoogleSignInResult> => {
    if (!GoogleSignin) throw new Error('Google Sign-In non disponible dans Expo Go');
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    if (response.type !== 'success') throw { code: 'SIGN_IN_CANCELLED' };
    const credential = GoogleAuthProvider.credential(response.data.idToken);
    const result = await signInWithCredential(auth, credential);
    return { displayName: result.user.displayName };
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    try { if (GoogleSignin) await GoogleSignin.signOut(); } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, authLoading, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
