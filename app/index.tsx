import { Redirect } from 'expo-router';
import { useFoyer } from '../context/FoyerContext';
import { useAuth } from '../context/AuthContext';

export default function Index() {
  const { userName, loading } = useFoyer();
  const { user, authLoading } = useAuth();

  if (loading || authLoading) return null;
  if (!user || !userName) return <Redirect href="/onboarding" />;
  return <Redirect href="/foyer" />;
}