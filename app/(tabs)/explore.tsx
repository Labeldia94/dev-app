import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, ActivityIndicator, TouchableOpacity, Modal, TextInput, Alert, ScrollView } from 'react-native';
import { db } from '../../firebaseConfig';
import { collection, query, where, onSnapshot, addDoc, writeBatch, getDocs } from 'firebase/firestore';
import { useFoyer } from '../../context/FoyerContext';
import { useAppTheme } from '../../hooks/use-app-theme';
import { RAYONS } from '../../constants/rayons';

export default function HistoryScreen() {
  const { activeCode, activeListId } = useFoyer();
  const theme = useAppTheme();

  const [history, setHistory]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [customQty, setCustomQty]   = useState('');
  const [activeTab, setActiveTab]   = useState<'historique' | 'stats'>('historique');
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    if (!activeCode) { setLoading(false); return; }
    const q = query(collection(db, 'historique'), where('familyCode', '==', activeCode));
    return onSnapshot(q, snapshot => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      setHistory(data);
      setLoading(false);
    });
  }, [activeCode]);

  // --- Calcul des stats ---
  const topArticles = Object.entries(
    history.reduce((acc, item) => {
      acc[item.text] = (acc[item.text] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const parCategorie = Object.entries(
    history.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]);

  const maxCategorie = parCategorie[0]?.[1] ?? 1;

  // Achats des 7 derniers jours
  const il_y_a_7_jours = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const achatsRecents  = history.filter(i => (i.createdAt ?? 0) > il_y_a_7_jours).length;

  // --- Actions ---
  const clearHistory = () => {
    Alert.alert(
      "Vider l'historique",
      'Supprimer tous les achats enregistrés ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Vider', style: 'destructive', onPress: async () => {
            try {
              const q = query(collection(db, 'historique'), where('familyCode', '==', activeCode));
              const snap = await getDocs(q);
              const batch = writeBatch(db);
              snap.docs.forEach(d => batch.delete(d.ref));
              await batch.commit();
            } catch {
              Alert.alert('Erreur', "Impossible de vider l'historique.");
            }
          },
        },
      ]
    );
  };

  const reAddToList = async (qty) => {
    if (!selectedItem || !activeListId || saving) return;
    const finalQty = qty ?? (customQty ? parseInt(customQty, 10) : null);
    if (!finalQty || isNaN(finalQty) || finalQty <= 0) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'shoppingList'), {
        text: selectedItem.text,
        category: selectedItem.category,
        quantity: finalQty.toString(),
        completed: false,
        familyCode: activeCode,
        listId: activeListId,
      });
      setModalVisible(false);
      setCustomQty('');
    } catch {
      Alert.alert('Erreur', "Impossible d'ajouter l'article.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ActivityIndicator size="large" color="#007AFF" style={{ flex: 1 }} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>
          {activeTab === 'historique' ? 'Derniers achats' : 'Statistiques'}
        </Text>
        {activeTab === 'historique' && history.length > 0 && (
          <TouchableOpacity onPress={clearHistory} style={styles.clearBtn}>
            <Text style={styles.clearText}>Vider</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Onglets */}
      <View style={[styles.tabs, { backgroundColor: theme.card }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'historique' && { backgroundColor: theme.tint }]}
          onPress={() => setActiveTab('historique')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'historique' ? '#fff' : theme.subtext }]}>
            Historique
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stats' && { backgroundColor: theme.tint }]}
          onPress={() => setActiveTab('stats')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'stats' ? '#fff' : theme.subtext }]}>
            Statistiques
          </Text>
        </TouchableOpacity>
      </View>

      {/* Vue Historique */}
      {activeTab === 'historique' && (
        <FlatList
          data={history}
          keyExtractor={item => item.id}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: theme.subtext }]}>Aucun achat enregistré.</Text>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <View style={styles.cardContent}>
                <Text style={styles.dateText}>{item.date}</Text>
                <Text style={[styles.itemText, { color: theme.text }]}>{item.text}</Text>
              </View>
              <TouchableOpacity
                style={styles.reAddBtn}
                onPress={() => { setSelectedItem(item); setModalVisible(true); }}
              >
                <Text style={styles.reAddText}>+</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Vue Statistiques */}
      {activeTab === 'stats' && (
        <ScrollView showsVerticalScrollIndicator={false}>
          {history.length === 0 ? (
            <Text style={[styles.empty, { color: theme.subtext }]}>
              Pas encore de données. Fais tes premières courses !
            </Text>
          ) : (
            <>
              {/* Cartes résumé */}
              <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: theme.card }]}>
                  <Text style={styles.statNumber}>{history.length}</Text>
                  <Text style={[styles.statLabel, { color: theme.subtext }]}>articles achetés</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: theme.card }]}>
                  <Text style={styles.statNumber}>{achatsRecents}</Text>
                  <Text style={[styles.statLabel, { color: theme.subtext }]}>cette semaine</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: theme.card }]}>
                  <Text style={styles.statNumber}>{topArticles.length > 0 ? topArticles[0][1] : 0}x</Text>
                  <Text style={[styles.statLabel, { color: theme.subtext }]}>record d'achat</Text>
                </View>
              </View>

              {/* Top articles */}
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Articles les plus achetés</Text>
              <View style={[styles.section, { backgroundColor: theme.card }]}>
                {topArticles.map(([nom, count], index) => (
                  <View key={nom} style={[styles.topRow, index < topArticles.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
                    <Text style={[styles.topRank, { color: theme.tint }]}>#{index + 1}</Text>
                    <Text style={[styles.topNom, { color: theme.text }]}>{nom}</Text>
                    <Text style={[styles.topCount, { color: theme.subtext }]}>{count}x</Text>
                  </View>
                ))}
              </View>

              {/* Par catégorie */}
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Par rayon</Text>
              <View style={[styles.section, { backgroundColor: theme.card }]}>
                {parCategorie.map(([catId, count]) => {
                  const rayon = RAYONS.find(r => r.id === catId);
                  const pct = (count / maxCategorie) * 100;
                  return (
                    <View key={catId} style={styles.catRow}>
                      <Text style={[styles.catLabel, { color: theme.text }]}>
                        {rayon?.label ?? 'Divers'}
                      </Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: rayon?.color ?? '#8E8E93' }]} />
                      </View>
                      <Text style={[styles.catCount, { color: theme.subtext }]}>{count}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* Modal re-ajout */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Ajouter {selectedItem?.text}
            </Text>
            <View style={styles.grid}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity
                  key={n}
                  style={[styles.circle, { backgroundColor: theme.bg }]}
                  onPress={() => reAddToList(n)}
                >
                  <Text style={[styles.circleText, { color: theme.tint }]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, color: theme.text }]}
              placeholder="Quantité..."
              placeholderTextColor={theme.subtext}
              keyboardType="numeric"
              onChangeText={setCustomQty}
              value={customQty}
            />
            <TouchableOpacity style={styles.validBtn} onPress={() => reAddToList(null)}>
              <Text style={styles.validBtnText}>Valider</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, padding: 20, paddingTop: 60 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title:        { fontSize: 24, fontWeight: 'bold' },
  clearBtn:     { backgroundColor: '#FF3B3015', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  clearText:    { color: '#FF3B30', fontWeight: 'bold', fontSize: 13 },
  empty:        { textAlign: 'center', marginTop: 40, fontSize: 15 },

  // Onglets
  tabs:         { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 16 },
  tab:          { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabText:      { fontWeight: '700', fontSize: 14 },

  // Historique
  card:         { padding: 15, borderRadius: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  cardContent:  { flex: 1 },
  dateText:     { fontSize: 10, color: '#8E8E93' },
  itemText:     { fontSize: 18, fontWeight: '600', textTransform: 'capitalize' },
  reAddBtn:     { backgroundColor: '#34C759', width: 35, height: 35, borderRadius: 17.5, justifyContent: 'center', alignItems: 'center' },
  reAddText:    { color: '#fff', fontSize: 20, fontWeight: 'bold' },

  // Stats — cartes résumé
  statsRow:     { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard:     { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center' },
  statNumber:   { fontSize: 26, fontWeight: '900', color: '#34C759' },
  statLabel:    { fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 4 },

  // Stats — sections
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  section:      { borderRadius: 14, padding: 14, marginBottom: 20 },

  // Top articles
  topRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  topRank:      { width: 28, fontWeight: '900', fontSize: 14 },
  topNom:       { flex: 1, fontSize: 15, fontWeight: '600', textTransform: 'capitalize' },
  topCount:     { fontSize: 13, fontWeight: '600' },

  // Par catégorie
  catRow:       { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  catLabel:     { width: 110, fontSize: 12, fontWeight: '600' },
  barTrack:     { flex: 1, height: 8, backgroundColor: '#E5E5EA', borderRadius: 4, marginHorizontal: 8, overflow: 'hidden' },
  barFill:      { height: '100%', borderRadius: 4 },
  catCount:     { width: 28, fontSize: 12, fontWeight: '600', textAlign: 'right' },

  // Modal
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modal:        { width: '85%', padding: 20, borderRadius: 20, alignItems: 'center' },
  modalTitle:   { fontSize: 18, fontWeight: 'bold', marginBottom: 20, textTransform: 'capitalize' },
  grid:         { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 20 },
  circle:       { width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center' },
  circleText:   { fontWeight: 'bold', fontSize: 16 },
  input:        { width: '100%', padding: 12, borderRadius: 10, textAlign: 'center', marginBottom: 10 },
  validBtn:     { backgroundColor: '#34C759', width: '100%', padding: 15, borderRadius: 12, alignItems: 'center' },
  validBtnText: { color: '#fff', fontWeight: 'bold' },
  cancelBtn:    { marginTop: 15 },
  cancelText:   { color: 'red' },
});
