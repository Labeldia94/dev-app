import React from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { FoyerProvider } from '../context/FoyerContext';
import { AuthProvider } from '../context/AuthContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ ...Ionicons.font });

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <FoyerProvider>
          <RootNavigatorWithRedirect />
        </FoyerProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigatorWithRedirect() {
  return (
    <Stack>
      <Stack.Screen name="index"        options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)"       options={{ headerShown: false }} />
      <Stack.Screen name="onboarding"   options={{ headerShown: false }} />
      <Stack.Screen name="mode-courses" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
    </Stack>
  );
}
