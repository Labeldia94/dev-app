import { useFoyer } from '../context/FoyerContext';

export const lightColors = {
  bg:         '#F2F2F7',
  card:       '#FFFFFF',
  text:       '#1C1C1E',
  subtext:    '#8E8E93',
  input:      '#FFFFFF',
  border:     '#E5E5EA',
  tint:       '#007AFF',
  tabBar:     '#FFFFFF',
  header:     '#FFFFFF',
  headerText: '#1C1C1E',
};

export const darkColors = {
  bg:         '#000000',
  card:       '#1C1C1E',
  text:       '#FFFFFF',
  subtext:    '#8E8E93',
  input:      '#2C2C2E',
  border:     '#38383A',
  tint:       '#0A84FF',
  tabBar:     '#1C1C1E',
  header:     '#1C1C1E',
  headerText: '#FFFFFF',
};

export type AppTheme = typeof lightColors;

export function useAppTheme(): AppTheme {
  const { isDark } = useFoyer();
  return isDark ? darkColors : lightColors;
}
