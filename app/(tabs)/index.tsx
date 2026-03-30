import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, TextInput, FlatList,
  Keyboard, ActivityIndicator, Alert, ScrollView, Modal,
} from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { db } from '../../firebaseConfig';
import {
  collection, addDoc, query, onSnapshot, orderBy, doc, getDoc,
  setDoc, deleteDoc, updateDoc, writeBatch, where,
  documentId, limit, getDocs, startAt, endAt, deleteField,
} from 'firebase/firestore';
import { RAYONS } from '../../constants/rayons';
import { useFoyer } from '../../context/FoyerContext';
import { useAppTheme } from '../../hooks/use-app-theme';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type ShoppingItem = {
  id: string;
  text: string;
  quantity: string;
  price?: number;
  category: string;
  completed: boolean;
  familyCode: string;
  addedBy?: string;
};

type Suggestion = { id: string; category: string };

export default function ShoppingScreen() {
  const { activeCode, pushToken, loading, userName } = useFoyer();
  const theme = useAppTheme();

  const [item, setItem] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [list, setList] = useState<ShoppingItem[]>([]);
  const [showRayons, setShowRayons] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editText, setEditText] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editPrice, setEditPrice] = useState('');

  const filteredList = activeFilter ? list.filter(i => i.category === activeFilter) : list;
  const total = list.length;
  const achete = list.filter(i => i.completed).length;
  const progression = total > 0 ? (achete / total) * 100 : 0;
  const budgetTotal = list.reduce((sum, i) => {
    const p = i.price ?? 0;
    const q = parseInt(i.quantity || '1', 10);
    return sum + (isNaN(q) ? 0 : p * q);
  }, 0);
  const hasBudget = list.some(i => i.price && i.price > 0);

  // Ecoute la liste en temps réel
  useEffect(() => {
    if (!activeCode) return;
    const q = query(
      collection(db, 'shoppingList'),
      where('familyCode', '==', activeCode),
      orderBy('category'),
      orderBy('text')
    );
    return onSnapshot(q, snapshot => {
      setList(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ShoppingItem)));
    });
  }, [activeCode]);

  // Autocomplete: recherche préfixe dans le dictionnaire (debounce 300ms)
  useEffect(() => {
    const prefix = item.trim().toLowerCase();
    if (prefix.length < 2) { setSuggestions([]); return; }
    const timeout = setTimeout(async () => {
      try {
        const q = query(
          collection(db, 'dictionnaire'),
          orderBy(documentId()),
          startAt(prefix),
          endAt(prefix + '\uf8ff'),
          limit(5)
        );
        const snap = await getDocs(q);
        setSuggestions(snap.docs.map(d => ({ id: d.id, category: d.data().category })));
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [item]);

  const notifyFamily = async (text: string) => {
    if (!pushToken || !activeCode) return;
    try {
      const snap = await getDocs(
        query(collection(db, 'notifTokens'), where('familyCode', '==', activeCode))
      );
      const tokens = snap.docs.map(d => d.data().token).filter((t: string) => t !== pushToken);
      if (tokens.length === 0) return;
      await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          tokens.map((token: string) => ({
            to: token,
            title: 'OubliePas 🛒',
            body: userName ? `${userName} a ajouté "${text}"` : `"${text}" ajouté à la liste`,
            sound: 'default',
          }))
        ),
      });
    } catch {
      // Echec silencieux: les notifications sont optionnelles
    }
  };

  const saveItem = async (category: string, overrideText?: string) => {
    setSaving(true);
    try {
      if (editingItem) {
        await updateDoc(doc(db, 'shoppingList', editingItem.id), { category });
        await setDoc(doc(db, 'dictionnaire', editingItem.text.toLowerCase()), { category });
        setEditingItem(null);
      } else {
        const rawText = overrideText ?? item;
        if (!rawText.trim()) return;
        const qty = parseInt(quantity, 10);
        if (isNaN(qty) || qty <= 0) {
          Alert.alert('Quantité invalide', 'Entrez un nombre entier positif.');
          return;
        }
        const cleanItem = rawText.trim().toLowerCase();
        const data: Omit<ShoppingItem, 'id'> = {
          text: cleanItem, quantity: qty.toString(), category,
          completed: false, familyCode: activeCode!,
          ...(userName ? { addedBy: userName } : {}),
        };
        if (price.trim()) {
          const p = parseFloat(price.replace(',', '.'));
          if (!isNaN(p) && p > 0) data.price = p;
        }
        await addDoc(collection(db, 'shoppingList'), data);
        await setDoc(doc(db, 'dictionnaire', cleanItem), { category });
        await notifyFamily(cleanItem);
        setItem(''); setQuantity('1'); setPrice(''); setSuggestions([]);
      }
      setShowRayons(false);
      Keyboard.dismiss();
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer l'article.");
    } finally {
      setSaving(false);
    }
  };

  const handleCheck = async () => {
    if (!item.trim()) return;
    try {
      const docSnap = await getDoc(doc(db, 'dictionnaire', item.trim().toLowerCase()));
      if (docSnap.exists()) saveItem(docSnap.data().category);
      else setShowRayons(true);
    } catch {
      Alert.alert('Erreur', "Impossible de vérifier l'article.");
    }
  };

  const selectSuggestion = (s: Suggestion) => {
    setSuggestions([]);
    saveItem(s.category, s.id);
  };

  const handleToggle = async (id: string, completed: boolean) => {
    try {
      await updateDoc(doc(db, 'shoppingList', id), { completed: !completed });
    } catch {
      Alert.alert('Erreur', 'Impossible de mettre à jour.');
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Supprimer',
      'Supprimer cet article de la liste ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer', style: 'destructive', onPress: async () => {
            try {
              await deleteDoc(doc(db, 'shoppingList', id));
            } catch {
              Alert.alert('Erreur', "Impossible de supprimer l'article.");
            }
          },
        },
      ]
    );
  };

  const finishShopping = async () => {
    const checked = list.filter(i => i.completed);
    if (checked.length === 0) return;
    // On prend les IDs à ce moment précis pour éviter la race condition
    // avec le listener Firestore qui peut modifier `list` en cours de batch
    const checkedIds = new Set(checked.map(i => i.id));
    try {
      const batch = writeBatch(db);
      const dateStr = new Date().toLocaleDateString('fr-FR');
      const createdAt = Date.now();
      checked.forEach(i => {
        if (!checkedIds.has(i.id)) return;
        batch.set(doc(collection(db, 'historique')), {
          text: i.text, category: i.category, date: dateStr, createdAt, familyCode: activeCode,
        });
        batch.delete(doc(db, 'shoppingList', i.id));
      });
      await batch.commit();
    } catch {
      Alert.alert('Erreur', 'Impossible de terminer les courses.');
    }
  };

  const openEditModal = (i: ShoppingItem) => {
    setEditingItem(i);
    setEditText(i.text);
    setEditQty(i.quantity);
    setEditPrice(i.price ? String(i.price) : '');
    setEditModal(true);
  };

  const saveEdit = async () => {
    if (!editingItem) return;
    if (!editText.trim()) { Alert.alert('Erreur', 'Le nom ne peut pas être vide.'); return; }
    const qty = parseInt(editQty, 10);
    if (isNaN(qty) || qty <= 0) { Alert.alert('Erreur', 'Quantité invalide.'); return; }
    const updates: Record<string, any> = {
      text: editText.trim().toLowerCase(),
      quantity: qty.toString(),
    };
    if (editPrice.trim()) {
      const p = parseFloat(editPrice.replace(',', '.'));
      if (!isNaN(p) && p > 0) updates.price = p;
    } else {
      updates.price = null;
    }
    try {
      await updateDoc(doc(db, 'shoppingList', editingItem.id), updates);
      setEditModal(false);
      setEditingItem(null);
    } catch {
      Alert.alert('Erreur', "Impossible de modifier l'article.");
    }
  };

  const renderRightActions = (id: string) => (
    <TouchableOpacity style={styles.swipeDelete} onPress={() => handleDelete(id)}>
      <Text style={styles.swipeDeleteText}>🗑 Supprimer</Text>
    </TouchableOpacity>
  );

  if (loading) return <ActivityIndicator size="large" color="#007AFF" style={{ flex: 1 }} />;
  if (!activeCode) return (
    <View style={[styles.center, { backgroundColor: theme.bg }]}>
      <Text style={{ color: theme.subtext }}>Veuillez choisir une liste dans l'onglet Foyer.</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Text style={[styles.listTitle, { color: theme.text }]}>
        {activeCode.charAt(0).toUpperCase() + activeCode.slice(1)}
      </Text>

      {/* Barre XP */}
      <View style={styles.mmorpgContainer}>
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>XP</Text>
        </View>
        <View style={styles.xpTrack}>
          <View style={[styles.xpBar, { width: `${progression}%` }]}>
            <View style={styles.shineEffect} />
          </View>
          <Text style={styles.xpText}>{achete} / {total} ARTICLES RÉCUPÉRÉS</Text>
        </View>
      </View>

      {/* Filtre par rayon */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContainer}
      >
        <TouchableOpacity
          style={[styles.filterBtn, { borderColor: theme.border }, !activeFilter && { backgroundColor: theme.tint, borderColor: theme.tint }]}
          onPress={() => setActiveFilter(null)}
        >
          <Text style={[styles.filterText, { color: !activeFilter ? '#fff' : theme.subtext }]}>Tous</Text>
        </TouchableOpacity>
        {RAYONS.map(r => (
          <TouchableOpacity
            key={r.id}
            style={[styles.filterBtn, { borderColor: theme.border }, activeFilter === r.id && { backgroundColor: r.color, borderColor: r.color }]}
            onPress={() => setActiveFilter(activeFilter === r.id ? null : r.id)}
          >
            <Text style={[styles.filterText, { color: activeFilter === r.id ? '#fff' : theme.subtext }]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Formulaire ajout */}
      {!editingItem && (
        <View style={[styles.inputRow, { backgroundColor: theme.card }]}>
          <TextInput
            style={[styles.inputArticle, { color: theme.text }]}
            placeholder="Article..."
            placeholderTextColor={theme.subtext}
            value={item}
            onChangeText={setItem}
          />
          <TextInput
            style={[styles.inputSmall, { color: theme.text }]}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
            placeholder="Qté"
            placeholderTextColor={theme.subtext}
          />
          <TextInput
            style={[styles.inputSmall, { color: theme.text }]}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder="€"
            placeholderTextColor={theme.subtext}
          />
          <TouchableOpacity style={styles.addButton} onPress={handleCheck} disabled={saving}>
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.addButtonText}>OK</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Suggestions autocomplete */}
      {suggestions.length > 0 && !showRayons && (
        <View style={[styles.suggestionsBox, { backgroundColor: theme.card }]}>
          {suggestions.map(s => (
            <TouchableOpacity
              key={s.id}
              style={[styles.suggestionItem, { borderBottomColor: theme.border }]}
              onPress={() => selectSuggestion(s)}
            >
              <Text style={[styles.suggestionText, { color: theme.text }]}>{s.id}</Text>
              <Text style={styles.suggestionCategory}>
                {RAYONS.find(r => r.id === s.category)?.label ?? ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Sélection rayon */}
      {showRayons && (
        <View style={[styles.rayonBar, { backgroundColor: theme.card }]}>
          <View style={styles.grid}>
            {RAYONS.map(r => (
              <TouchableOpacity
                key={r.id}
                style={[styles.rayonBtn, { backgroundColor: r.color }]}
                onPress={() => saveItem(r.id)}
              >
                <Text style={styles.rayonBtnText}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {editingItem && (
            <TouchableOpacity
              onPress={() => { setEditingItem(null); setShowRayons(false); }}
              style={styles.cancelEdit}
            >
              <Text style={styles.cancelEditText}>Annuler</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Liste (glisser gauche pour supprimer) */}
      <FlatList
        data={filteredList}
        keyExtractor={i => i.id}
        renderItem={({ item }) => (
          <ReanimatedSwipeable renderRightActions={() => renderRightActions(item.id)}>
            <View style={[styles.itemRow, { backgroundColor: theme.card }]}>
              <TouchableOpacity
                style={styles.itemTouchable}
                onPress={() => handleToggle(item.id, item.completed)}
                onLongPress={() => openEditModal(item)}
              >
                <View style={[styles.checkbox, item.completed && styles.checked]} />
                <View style={styles.itemContent}>
                  <Text style={styles.tag}>
                    {RAYONS.find(r => r.id === item.category)?.label ?? 'DIVERS'}
                  </Text>
                  <Text style={[styles.itemText, { color: theme.text }, item.completed && styles.completedText]}>
                    {item.text} (x{item.quantity})
                  </Text>
                  {item.price ? (
                    <Text style={styles.priceTag}>{item.price.toFixed(2)} €</Text>
                  ) : null}
                  {item.addedBy ? (
                    <Text style={styles.addedBy}>ajouté par {item.addedBy}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            </View>
          </ReanimatedSwipeable>
        )}
      />

      {/* Budget total */}
      {hasBudget && (
        <View style={[styles.budgetRow, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          <Text style={[styles.budgetLabel, { color: theme.subtext }]}>Total estimé</Text>
          <Text style={[styles.budgetTotal, { color: theme.text }]}>{budgetTotal.toFixed(2)} €</Text>
        </View>
      )}

      {/* Bouton terminer les courses */}
      {list.some(i => i.completed) && !showRayons && (
        <TouchableOpacity style={styles.finishBtn} onPress={finishShopping}>
          <Text style={styles.finishBtnText}>✅ Terminer les courses</Text>
        </TouchableOpacity>
      )}

      {/* Modal modification article */}
      <Modal visible={editModal} transparent animationType="slide">
        <View style={styles.editOverlay}>
          <View style={[styles.editModal, { backgroundColor: theme.card }]}>
            <Text style={[styles.editTitle, { color: theme.text }]}>Modifier l'article</Text>
            <TextInput
              style={[styles.editInput, { backgroundColor: theme.bg, color: theme.text }]}
              value={editText}
              onChangeText={setEditText}
              placeholder="Nom de l'article"
              placeholderTextColor={theme.subtext}
              autoCapitalize="none"
            />
            <View style={styles.editRow}>
              <TextInput
                style={[styles.editInputSmall, { backgroundColor: theme.bg, color: theme.text }]}
                value={editQty}
                onChangeText={setEditQty}
                placeholder="Qté"
                placeholderTextColor={theme.subtext}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.editInputSmall, { backgroundColor: theme.bg, color: theme.text }]}
                value={editPrice}
                onChangeText={setEditPrice}
                placeholder="Prix €"
                placeholderTextColor={theme.subtext}
                keyboardType="decimal-pad"
              />
            </View>
            <TouchableOpacity style={styles.editSaveBtn} onPress={saveEdit}>
              <Text style={styles.editSaveBtnText}>Enregistrer</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditModal(false)} style={styles.editCancelBtn}>
              <Text style={styles.editCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, padding: 20, paddingTop: 60 },
  listTitle:      { fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 15 },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Barre XP
  mmorpgContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 5 },
  levelBadge:     { backgroundColor: '#FFD700', width: 35, height: 35, borderRadius: 5, borderWidth: 2, borderColor: '#B8860B', justifyContent: 'center', alignItems: 'center', transform: [{ rotate: '45deg' }], zIndex: 2, elevation: 5 },
  levelText:      { color: '#1C1C1E', fontWeight: '900', fontSize: 12, transform: [{ rotate: '-45deg' }] },
  xpTrack:        { flex: 1, height: 24, backgroundColor: '#333', borderRadius: 4, borderWidth: 2, borderColor: '#555', marginLeft: -15, overflow: 'hidden', justifyContent: 'center', elevation: 3 },
  xpBar:          { height: '100%', backgroundColor: '#00FF00' },
  shineEffect:    { position: 'absolute', top: 0, left: 0, right: 0, height: '40%', backgroundColor: 'rgba(255,255,255,0.3)' },
  xpText:         { position: 'absolute', width: '100%', textAlign: 'center', color: '#FFF', fontSize: 10, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2, letterSpacing: 1 },

  // Filtre
  filterScroll:    { maxHeight: 44, marginBottom: 12 },
  filterContainer: { paddingVertical: 4, gap: 8 },
  filterBtn:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  filterText:      { fontSize: 12, fontWeight: '600' },

  // Formulaire
  inputRow:       { flexDirection: 'row', borderRadius: 12, padding: 8, marginBottom: 8, elevation: 3, alignItems: 'center' },
  inputArticle:   { flex: 3, paddingHorizontal: 10, fontSize: 16 },
  inputSmall:     { flex: 1, paddingHorizontal: 6, fontSize: 14, textAlign: 'center' },
  addButton:      { backgroundColor: '#34C759', padding: 12, borderRadius: 10, marginLeft: 6 },
  addButtonText:  { color: '#fff', fontWeight: 'bold' },

  // Suggestions
  suggestionsBox:     { borderRadius: 12, marginBottom: 8, elevation: 5, overflow: 'hidden' },
  suggestionItem:     { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  suggestionText:     { fontSize: 16, flex: 1, marginRight: 8 },
  suggestionCategory: { fontSize: 11, color: '#8E8E93', flexShrink: 0 },

  // Rayons
  rayonBar:       { padding: 12, borderRadius: 15, marginBottom: 15, elevation: 5 },
  grid:           { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  rayonBtn:       { width: '30%', minHeight: 55, margin: 3, borderRadius: 8, justifyContent: 'center', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 2 },
  rayonBtnText:   { color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center', flexWrap: 'wrap' },
  cancelEdit:     { marginTop: 10 },
  cancelEditText: { color: 'red', textAlign: 'center' },

  // Articles
  itemRow:        { flex: 1, flexDirection: 'row', marginBottom: 8, padding: 15, borderRadius: 12, alignItems: 'center' },
  itemTouchable:  { flex: 1, flexDirection: 'row', alignItems: 'center' },
  checkbox:       { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#C7C7CC', marginRight: 15 },
  checked:        { backgroundColor: '#00FF00', borderColor: '#00FF00' },
  itemContent:    { flex: 1, minWidth: 0 },
  tag:            { fontSize: 10, color: '#8E8E93', fontWeight: 'bold' },
  itemText:       { fontSize: 18, textTransform: 'capitalize' },
  completedText:  { textDecorationLine: 'line-through', color: '#AAA' },
  priceTag:       { fontSize: 14, color: '#8E8E93' },
  addedBy:        { fontSize: 11, color: '#8E8E93', marginTop: 2 },

  // Swipe suppression
  swipeDelete:     { backgroundColor: '#FF3B30', justifyContent: 'center', alignItems: 'center', width: 110, marginBottom: 8, borderTopRightRadius: 12, borderBottomRightRadius: 12 },
  swipeDeleteText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },

  // Budget
  budgetRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4 },
  budgetLabel:    { fontSize: 14, fontWeight: '600' },
  budgetTotal:    { fontSize: 22, fontWeight: '900' },

  // Bouton terminer
  finishBtn:      { backgroundColor: '#1C1C1E', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  finishBtnText:  { color: 'white', fontWeight: 'bold' },

  // Modal édition
  editOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  editModal:       { width: '100%', borderRadius: 20, padding: 20 },
  editTitle:       { fontSize: 18, fontWeight: '900', marginBottom: 16 },
  editInput:       { borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 12 },
  editRow:         { flexDirection: 'row', gap: 10, marginBottom: 12 },
  editInputSmall:  { flex: 1, borderRadius: 10, padding: 12, fontSize: 16, textAlign: 'center' },
  editSaveBtn:     { backgroundColor: '#34C759', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  editSaveBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  editCancelBtn:   { alignItems: 'center', padding: 10 },
  editCancelText:  { color: '#FF3B30', fontWeight: '600' },
});
