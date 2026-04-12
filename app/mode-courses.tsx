import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { db } from '../firebaseConfig';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc } from 'firebase/firestore';
import { useFoyer } from '../context/FoyerContext';
import { useAppTheme } from '../hooks/use-app-theme';
import { RAYONS } from '../constants/rayons';

type ShoppingItem = {
  id: string;
  text: string;
  quantity: string;
  category: string;
  completed: boolean;
  familyCode: string;
  completedBy?: string;
  finalPrice?: number;
  listId?: string;
};

export default function ModeCourses() {
  useKeepAwake();
  const router = useRouter();
  const { activeCode, activeListId, foyerLists, userName, currentFoyer, isDark } = useFoyer();
  const theme = useAppTheme();
  const [list, setList] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const activeListName = foyerLists.find(l => l.id === activeListId)?.name ?? 'Courses';
  const total  = list.length;
  const achete = list.filter(i => i.completed).length;
  const pct    = total > 0 ? Math.round((achete / total) * 100) : 0;

  // Articles non cochés en premier, cochés en bas
  const sortedList = useMemo(() =>
    [...list].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return 0;
    }),
    [list]
  );

  useEffect(() => {
    if (!activeCode || !activeListId) { setLoading(false); return; }
    const q = query(
      collection(db, 'shoppingList'),
      where('familyCode', '==', activeCode),
      where('listId', '==', activeListId),
      orderBy('category'),
      orderBy('text'),
    );
    return onSnapshot(q, snap => {
      setList(snap.docs.map(d => ({ id: d.id, ...d.data() } as ShoppingItem)));
      setLoading(false);
    });
  }, [activeCode, activeListId]);

  const handleToggle = (item: ShoppingItem) => {
    const update: Record<string, any> = { completed: !item.completed };
    if (!item.completed) update.completedBy = userName ?? 'Moi';
    else update.completedBy = null;
    updateDoc(doc(db, 'shoppingList', item.id), update).catch(() => {});
  };

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#34C759" />
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.foyerName, { color: theme.subtext }]}>{currentFoyer?.name ?? ''}</Text>
          <Text style={[styles.listName, { color: theme.text }]}>{activeListName}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.progress}>{achete}/{total} · {pct}%</Text>
          <TouchableOpacity style={[styles.quitBtn, { backgroundColor: theme.card }]} onPress={() => router.back()}>
            <Text style={styles.quitText}>✕ Quitter</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Barre de progression */}
      <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
        <View style={[styles.progressBar, { width: `${pct}%` }]} />
      </View>

      {/* Liste — non cochés en haut, cochés en bas */}
      <FlatList
        data={sortedList}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.subtext }]}>La liste est vide.</Text>
        }
        renderItem={({ item }) => {
          const rayon = RAYONS.find(r => r.id === item.category);
          return (
            <TouchableOpacity
              style={[styles.itemRow, { backgroundColor: theme.card }, item.completed && styles.itemRowDone]}
              onPress={() => handleToggle(item)}
              activeOpacity={0.6}
            >
              <View style={[styles.rayonAccent, { backgroundColor: rayon?.color ?? theme.border }]} />
              <View style={[styles.checkbox, item.completed && styles.checkboxDone]}>
                {item.completed && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <View style={styles.itemContent}>
                <Text style={[styles.itemText, { color: theme.text }, item.completed && styles.itemTextDone]}>
                  {item.text}
                </Text>
                <Text style={[styles.itemSub, { color: theme.subtext }]}>
                  {rayon?.label ?? 'Divers'} · x{item.quantity}
                  {item.finalPrice ? `  —  ${item.finalPrice.toFixed(2)} €` : ''}
                </Text>
                {item.completed && item.completedBy ? (
                  <Text style={styles.itemBy}>✓ par {item.completedBy}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {total > 0 && achete === total && (
        <View style={[styles.footer, { backgroundColor: theme.card }]}>
          <Text style={styles.footerText}>🎉 Tout est dans le panier !</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1 },

  header:        { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 },
  headerLeft:    { flex: 1 },
  foyerName:     { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  listName:      { fontSize: 22, fontWeight: '900', marginTop: 2 },
  headerRight:   { alignItems: 'flex-end', gap: 6 },
  progress:      { fontSize: 15, fontWeight: '700', color: '#34C759' },
  quitBtn:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  quitText:      { fontSize: 13, fontWeight: '700', color: '#FF3B30' },

  progressTrack: { height: 4, marginHorizontal: 20, borderRadius: 2, marginBottom: 12 },
  progressBar:   { height: '100%', backgroundColor: '#34C759', borderRadius: 2 },

  listContent:   { paddingHorizontal: 16, paddingBottom: 40 },
  empty:         { textAlign: 'center', marginTop: 60, fontSize: 16 },

  itemRow:       { flexDirection: 'row', alignItems: 'center', borderRadius: 14, marginBottom: 10, overflow: 'hidden', minHeight: 70 },
  itemRowDone:   { opacity: 0.45 },
  rayonAccent:   { width: 5, alignSelf: 'stretch' },
  checkbox:      { width: 30, height: 30, borderRadius: 15, borderWidth: 2.5, borderColor: '#C7C7CC', marginHorizontal: 14, justifyContent: 'center', alignItems: 'center' },
  checkboxDone:  { backgroundColor: '#34C759', borderColor: '#34C759' },
  checkMark:     { color: '#fff', fontSize: 16, fontWeight: '900' },
  itemContent:   { flex: 1, paddingVertical: 14, paddingRight: 14 },
  itemText:      { fontSize: 20, fontWeight: '700', textTransform: 'capitalize' },
  itemTextDone:  { textDecorationLine: 'line-through', color: '#8E8E93' },
  itemSub:       { fontSize: 13, marginTop: 3 },
  itemBy:        { fontSize: 12, color: '#34C759', fontWeight: '600', marginTop: 2 },

  footer:        { alignItems: 'center', padding: 20 },
  footerText:    { fontSize: 18, fontWeight: '800', color: '#34C759' },
});
