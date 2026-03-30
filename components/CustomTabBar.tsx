import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useFoyer } from '../context/FoyerContext';
import { lightColors, darkColors } from '../hooks/use-app-theme';

const TABS = [
  { name: 'foyer',   label: 'Foyer',      iconActive: 'people'           as const, iconInactive: 'people-outline'           as const },
  { name: 'index',   label: 'Courses',    iconActive: 'cart'             as const, iconInactive: 'cart-outline'             as const },
  { name: 'explore', label: 'Historique', iconActive: 'document-text'    as const, iconInactive: 'document-text-outline'    as const },
];

export default function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { isDark } = useFoyer();
  const theme = isDark ? darkColors : lightColors;

  return (
    <View style={[styles.wrapper, { backgroundColor: theme.bg }]}>
      <View style={[styles.container, { backgroundColor: theme.card, shadowColor: isDark ? '#000' : '#999' }]}>
        {state.routes.map((route, index) => {
          const tab = TABS[index];
          const isFocused = state.index === index;

          const onPress = () => {
            if (!isFocused) navigation.navigate(route.name);
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={styles.tab}
              activeOpacity={0.7}
            >
              <View style={[styles.pill, isFocused && { backgroundColor: theme.tint }]}>
                <Ionicons
                  name={isFocused ? tab.iconActive : tab.iconInactive}
                  size={26}
                  color={isFocused ? '#fff' : theme.subtext}
                />
              </View>
              <Text style={[styles.label, { color: isFocused ? theme.tint : theme.subtext }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'android' ? 12 : 24,
    paddingTop: 8,
  },
  container: {
    flexDirection: 'row',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  pill: {
    width: 52,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
});
