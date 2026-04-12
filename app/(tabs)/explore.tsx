import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, FlatList, ActivityIndicator, TouchableOpacity,
  Modal, TextInput, Alert, ScrollView, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { db } from '../../firebaseConfig';
import { collection, query, where, onSnapshot, addDoc, writeBatch, getDocs, doc, setDoc } from 'firebase/firestore';
import { useFoyer } from '../../context/FoyerContext';
import { useAppTheme } from '../../hooks/use-app-theme';
import { RAYONS } from '../../constants/rayons';

type HistoryItem = {
  id: string;
  text: string;
  category: string;
  date: string;
  createdAt?: number;
  completedBy?: string;
  finalPrice?: number;
};

type Receipt = {
  id: string;
  date: string;
  imageUrl: string;
  uploadedBy: string;
  uploadedAt: number;
};

export default function HistoryScreen() {
  const { activeCode, userName } = useFoyer();
  const theme = useAppTheme();

  const [history, setHistory]           = useState<HistoryItem[]>([]);
  const [receipts, setReceipts]         = useState<Receipt[]>([]);
  const [loading, setLoading]           = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [customQty, setCustomQty]       = useState('');
  const [activeTab, setActiveTab]       = useState<'historique' | 'stats'>('historique');
  const [uploadingDate, setUploadingDate] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl]     = useState<string | null>(null);

  useEffect(() => {
    if (!activeCode) { setLoading(false); return; }
    const q = query(collection(db, 'historique'), where('familyCode', '==', activeCode));
    return onSnapshot(q, snapshot => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as HistoryItem));
      data.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      setHistory(data);
      setLoading(false);
    });
  }, [activeCode]);

  useEffect(() => {
    if (!activeCode) return;
    const q = query(collection(db, 'receipts'), where('familyCode', '==', activeCode));
    return onSnapshot(q, snapshot => {
      setReceipts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Receipt)));
    });
  }, [activeCode]);

  // Groupe les articles par date
  const grouped = history.reduce<Record<string, HistoryItem[]>>((acc, item) => {
    (acc[item.date] = acc[item.date] ?? []).push(item);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort((a, b) => {
    const parse = (d: string) => d.split('/').reverse().join('');
    return parse(b).localeCompare(parse(a));
  });

  // Synthèse par membre pour une date donnée
  const syntheseForDate = (items: HistoryItem[]) => {
    const map: Record<string, number> = {};
    items.forEach(i => {
      if (!i.completedBy || !i.finalPrice) return;
      map[i.completedBy] = (map[i.completedBy] ?? 0) + i.finalPrice;
    });
    return map;
  };

  // Upload ticket de caisse (base64, pas de Firebase Storage)
  const handleAddReceipt = (date: string) => {
    Alert.alert('Ajouter un ticket', 'Choisir la source', [
      {
        text: '📷 Appareil photo', onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission refusée', 'Autorise l\'accès à l\'appareil photo dans les réglages.');
            return;
          }
          await pickAndSaveReceipt(date, 'camera');
        },
      },
      {
        text: '🖼 Galerie', onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission refusée', 'Autorise l\'accès à la galerie dans les réglages.');
            return;
          }
          await pickAndSaveReceipt(date, 'gallery');
        },
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const pickAndSaveReceipt = async (date: string, source: 'camera' | 'gallery') => {
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 1 });
    if (result.canceled || !result.assets[0]) return;
    setUploadingDate(date);
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 600 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      const imageUrl = `data:image/jpeg;base64,${compressed.base64}`;
      await addDoc(collection(db, 'receipts'), {
        familyCode: activeCode,
        date,
        imageUrl,
        uploadedBy: userName ?? 'Quelqu\'un',
        uploadedAt: Date.now(),
      });
    } catch {
      Alert.alert('Erreur', 'Impossible d\'envoyer le ticket.');
    } finally {
      setUploadingDate(null);
    }
  };

  // --- Stats ---
  const topArticles = (Object.entries(
    history.reduce<Record<string, number>>((acc, item) => {
      acc[item.text] = (acc[item.text] ?? 0) + 1;
      return acc;
    }, {})
  ) as [string, number][]).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const parCategorie = (Object.entries(
    history.reduce<Record<string, number>>((acc, item) => {
      acc[item.category] = (acc[item.category] ?? 0) + 1;
      return acc;
    }, {})
  ) as [string, number][]).sort((a, b) => b[1] - a[1]);

  const maxCategorie = parCategorie[0]?.[1] ?? 1;
  const il_y_a_7_jours = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const achatsRecents  = history.filter(i => (i.createdAt ?? 0) > il_y_a_7_jours).length;

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

  const reAddToList = async (qty: number | null) => {
    if (!selectedItem) return;
    const finalQty = qty ?? (customQty ? parseInt(customQty, 10) : null);
    if (!finalQty || isNaN(finalQty) || finalQty <= 0) return;
    try {
      await addDoc(collection(db, 'shoppingList'), {
        text: selectedItem.text, category: selectedItem.category,
        quantity: finalQty.toString(), completed: false, familyCode: activeCode,
      });
      setModalVisible(false);
      setCustomQty('');
    } catch {
      Alert.alert('Erreur', "Impossible d'ajouter l'article.");
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
        {(['historique', 'stats'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && { backgroundColor: theme.tint }]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, { color: activeTab === tab ? '#fff' : theme.subtext }]}>
              {tab === 'historique' ? 'Historique' : 'Statistiques'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Vue Historique — groupée par date */}
      {activeTab === 'historique' && (
        <FlatList
          data={dates}
          keyExtractor={d => d}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: theme.subtext }]}>Aucun achat enregistré.</Text>
          }
          renderItem={({ item: date }) => {
            const items   = grouped[date];
            const synthese = syntheseForDate(items);
            const receipt  = receipts.find(r => r.date === date);
            const isUploading = uploadingDate === date;

            return (
              <View style={[styles.sessionCard, { backgroundColor: theme.card }]}>
                {/* En-tête de session */}
                <View style={styles.sessionHeader}>
                  <Text style={[styles.sessionDate, { color: theme.tint }]}>{date}</Text>
                  <Text style={[styles.sessionCount, { color: theme.subtext }]}>
                    {items.length} article{items.length > 1 ? 's' : ''}
                  </Text>
                  {/* Bouton ticket */}
                  {isUploading ? (
                    <ActivityIndicator size="small" color={theme.tint} style={{ marginLeft: 8 }} />
                  ) : receipt ? (
                    <TouchableOpacity onPress={() => setPreviewUrl(receipt.imageUrl)} style={styles.receiptThumbBtn}>
                      <Image source={{ uri: receipt.imageUrl }} style={styles.receiptThumb} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={() => handleAddReceipt(date)} style={[styles.receiptAddBtn, { borderColor: theme.tint }]}>
                      <Text style={[styles.receiptAddText, { color: theme.tint }]}>📷 Ticket</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Articles de la session */}
                {items.map((item, idx) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.itemRow, idx < items.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}
                    onPress={() => { setSelectedItem(item); setModalVisible(true); }}
                  >
                    <View style={styles.itemLeft}>
                      <Text style={[styles.itemText, { color: theme.text }]}>{item.text}</Text>
                      {item.completedBy && (
                        <Text style={[styles.itemBy, { color: theme.subtext }]}>par {item.completedBy}</Text>
                      )}
                    </View>
                    <View style={styles.itemRight}>
                      {item.finalPrice ? (
                        <Text style={[styles.itemPrice, { color: theme.tint }]}>{item.finalPrice.toFixed(2)} €</Text>
                      ) : null}
                      <Text style={[styles.reAdd, { color: '#34C759' }]}>+</Text>
                    </View>
                  </TouchableOpacity>
                ))}

                {/* Synthèse contributions si disponible */}
                {Object.keys(synthese).length > 0 && (
                  <View style={[styles.syntheseBox, { borderTopColor: theme.border }]}>
                    {Object.entries(synthese).map(([name, total]) => (
                      <Text key={name} style={[styles.syntheseText, { color: theme.subtext }]}>
                        {name} : <Text style={{ color: theme.text, fontWeight: '700' }}>{total.toFixed(2)} €</Text>
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            );
          }}
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
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Par rayon</Text>
              <View style={[styles.section, { backgroundColor: theme.card }]}>
                {parCategorie.map(([catId, count]) => {
                  const rayon = RAYONS.find(r => r.id === catId);
                  return (
                    <View key={catId} style={styles.catRow}>
                      <Text style={[styles.catLabel, { color: theme.text }]}>{rayon?.label ?? 'Divers'}</Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${(count / maxCategorie) * 100}%`, backgroundColor: rayon?.color ?? '#8E8E93' }]} />
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

      {/* Modal re-ajout article */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Ajouter {selectedItem?.text}
            </Text>
            <View style={styles.grid}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity key={n} style={[styles.circle, { backgroundColor: theme.bg }]} onPress={() => reAddToList(n)}>
                  <Text style={[styles.circleText, { color: theme.tint }]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, color: theme.text }]}
              placeholder="Quantité..." placeholderTextColor={theme.subtext}
              keyboardType="numeric" onChangeText={setCustomQty} value={customQty}
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

      {/* Modal aperçu ticket */}
      <Modal visible={!!previewUrl} transparent animationType="fade">
        <TouchableOpacity style={styles.previewOverlay} onPress={() => setPreviewUrl(null)} activeOpacity={1}>
          {previewUrl && (
            <Image source={{ uri: previewUrl }} style={styles.previewImage} resizeMode="contain" />
          )}
          <Text style={styles.previewClose}>Appuie pour fermer</Text>
        </TouchableOpacity>
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

  tabs:         { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 16 },
  tab:          { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabText:      { fontWeight: '700', fontSize: 14 },

  // Session card
  sessionCard:      { borderRadius: 14, marginBottom: 14, overflow: 'hidden' },
  sessionHeader:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  sessionDate:      { fontSize: 14, fontWeight: '800', flex: 1 },
  sessionCount:     { fontSize: 12, marginRight: 8 },
  receiptThumbBtn:  { marginLeft: 4 },
  receiptThumb:     { width: 40, height: 40, borderRadius: 6 },
  receiptAddBtn:    { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 4 },
  receiptAddText:   { fontSize: 11, fontWeight: '700' },

  // Items de la session
  itemRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  itemLeft:     { flex: 1 },
  itemText:     { fontSize: 16, fontWeight: '600', textTransform: 'capitalize' },
  itemBy:       { fontSize: 11, marginTop: 2 },
  itemRight:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemPrice:    { fontSize: 14, fontWeight: '700' },
  reAdd:        { fontSize: 22, fontWeight: '900' },

  // Synthèse contributions
  syntheseBox:  { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  syntheseText: { fontSize: 12 },

  // Aperçu ticket
  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  previewImage:   { width: '95%', height: '80%' },
  previewClose:   { color: '#fff', marginTop: 16, fontSize: 13, opacity: 0.6 },

  // Stats
  statsRow:     { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard:     { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center' },
  statNumber:   { fontSize: 26, fontWeight: '900', color: '#34C759' },
  statLabel:    { fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  section:      { borderRadius: 14, padding: 14, marginBottom: 20 },
  topRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  topRank:      { width: 28, fontWeight: '900', fontSize: 14 },
  topNom:       { flex: 1, fontSize: 15, fontWeight: '600', textTransform: 'capitalize' },
  topCount:     { fontSize: 13, fontWeight: '600' },
  catRow:       { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  catLabel:     { width: 110, fontSize: 12, fontWeight: '600' },
  barTrack:     { flex: 1, height: 8, backgroundColor: '#E5E5EA', borderRadius: 4, marginHorizontal: 8, overflow: 'hidden' },
  barFill:      { height: '100%', borderRadius: 4 },
  catCount:     { width: 28, fontSize: 12, fontWeight: '600', textAlign: 'right' },

  // Modal re-ajout
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
