import React from 'react';
import { Tabs } from 'expo-router';
import { useAppTheme } from '../../hooks/use-app-theme';
import CustomTabBar from '../../components/CustomTabBar';

export default function TabLayout() {
  const theme = useAppTheme();

  return (
    <Tabs
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{
        headerTitleAlign: 'center',
        headerStyle: { backgroundColor: theme.header },
        headerTitleStyle: { fontWeight: '900', fontSize: 18, color: theme.headerText },
      }}>

      <Tabs.Screen name="foyer"   options={{ title: 'MON FOYER'  }} />
      <Tabs.Screen name="index"   options={{ title: 'MA LISTE'   }} />
      <Tabs.Screen name="explore" options={{ title: 'HISTORIQUE' }} />
    </Tabs>
  );
}
