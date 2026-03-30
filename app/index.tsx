import { Redirect } from 'expo-router';
import { useFoyer } from '../context/FoyerContext';

export default function Index() {
  const { userName, loading } = useFoyer();

  if (loading) return null;
  if (!userName) return <Redirect href="/onboarding" />;
  return <Redirect href="/foyer" />;
}