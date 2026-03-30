export type Rayon = {
  id: string;
  label: string;
  color: string;
};

export const RAYONS: Rayon[] = [
  { id: '01_Frais',          label: '🛒 Frais',            color: '#007AFF' },
  { id: '02_FruitsLegumes',  label: '🍎 Fruits/Lég',       color: '#34C759' },
  { id: '03_Boucherie',      label: '🥩 Boucherie',         color: '#FF3B30' },
  { id: '04_Boulangerie',    label: '🥖 Boulangerie',       color: '#8E8E93' },
  { id: '05_EpicerieSalee',  label: '🍝 Épicerie Salée',   color: '#FF9500' },
  { id: '06_EpicerieSucree', label: '🍪 Gâteaux',          color: '#FF2D55' },
  { id: '07_Boissons',       label: '🥤 Boissons',          color: '#5AC8FA' },
  { id: '08_Surgeles',       label: '❄️ Surgelés',          color: '#00FFFF' },
  { id: '09_Hygiene',        label: '🧼 Hygiène',           color: '#AF52DE' },
  { id: '10_Entretien',      label: '🧹 Entretien',         color: '#4CD964' },
  { id: '11_Bebe',           label: '👶 Bébé',              color: '#FF2D55' },
  { id: '12_Animaux',        label: '🐶 Animaux',           color: '#A2845E' },
  { id: '13_Divers',         label: '📦 Divers',            color: '#5856D6' },
];
