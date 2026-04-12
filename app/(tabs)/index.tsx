import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, TextInput, FlatList,
  Keyboard, ActivityIndicator, Alert, ScrollView, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { db } from '../../firebaseConfig';
import {
  collection, addDoc, query, onSnapshot, orderBy, doc, getDoc,
  setDoc, deleteDoc, updateDoc, writeBatch, where,
  documentId, limit, getDocs, startAt, endAt,
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
  finalPrice?: number;
  category: string;
  completed: boolean;
  familyCode: string;
  addedBy?: string;
  completedBy?: string;
  listId?: string;
};

type Suggestion = { id: string; category: string };

export default function ShoppingScreen() {
  const { activeCode, pushToken, loading, userName, foyerLists, activeListId, setActiveListId, createList, currentFoyer } = useFoyer();
  const theme = useAppTheme();
  const router = useRouter();

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
  const [createListModal, setCreateListModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creatingList, setCreatingList] = useState(false);
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [showSynthese, setShowSynthese] = useState(false);
  const [showFilter, setShowFilter] = useState(false);

  // Cochés toujours en bas
  const sortedList = useMemo(() =>
    [...list].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return 0;
    }), [list]);

  const filteredList = activeFilter ? sortedList.filter(i => i.category === activeFilter) : sortedList;
  const total = list.length;
  const achete = list.filter(i => i.completed).length;
  const progression = total > 0 ? (achete / total) * 100 : 0;
  const budgetTotal = list.reduce((sum, i) => {
    const p = i.price ?? 0;
    const q = parseInt(i.quantity || '1', 10);
    return sum + (isNaN(q) ? 0 : p * q);
  }, 0);
  const hasBudget = list.some(i => i.price && i.price > 0);

  // Synthèse des contributions par membre
  const contributions: Record<string, number> = {};
  list.filter(i => i.completed && i.completedBy).forEach(i => {
    const price = i.finalPrice ?? i.price ?? 0;
    const qty   = parseInt(i.quantity || '1', 10);
    const name  = i.completedBy!;
    contributions[name] = (contributions[name] ?? 0) + (isNaN(qty) ? 0 : price * qty);
  });
  const hasContributions = Object.keys(contributions).length > 0;

  // Ecoute la liste en temps réel (filtrée par liste active)
  useEffect(() => {
    if (!activeCode || !activeListId) { setList([]); return; }
    const q = query(
      collection(db, 'shoppingList'),
      where('familyCode', '==', activeCode),
      where('listId', '==', activeListId),
      orderBy('category'),
      orderBy('text')
    );
    return onSnapshot(q, snapshot => {
      setList(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ShoppingItem)));
    });
  }, [activeCode, activeListId]);

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
          listId: activeListId ?? undefined,
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
    Keyboard.dismiss();
    setSuggestions([]);
    saveItem(s.category, s.id);
  };

  const handleToggle = (shoppingItem: ShoppingItem) => {
    const update: Record<string, any> = { completed: !shoppingItem.completed };
    if (!shoppingItem.completed) {
      update.completedBy = userName ?? 'Quelqu\'un';
      // Récupère le prix saisi inline s'il y en a un
      const typed = priceInputs[shoppingItem.id];
      if (typed !== undefined) {
        const fp = parseFloat(typed.replace(',', '.'));
        if (!isNaN(fp) && fp > 0) update.finalPrice = fp;
      }
    } else {
      update.completedBy = null;
    }
    updateDoc(doc(db, 'shoppingList', shoppingItem.id), update)
      .catch(() => Alert.alert('Erreur', 'Impossible de mettre à jour.'));
  };

  const saveFinalPrice = (itemId: string, value: string) => {
    const fp = parseFloat(value.replace(',', '.'));
    if (!isNaN(fp) && fp > 0) {
      updateDoc(doc(db, 'shoppingList', itemId), { finalPrice: fp }).catch(() => {});
    } else if (value.trim() === '') {
      updateDoc(doc(db, 'shoppingList', itemId), { finalPrice: null }).catch(() => {});
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    setCreatingList(true);
    try {
      await createList(newListName.trim());
      setNewListName('');
      setCreateListModal(false);
    } catch {
      Alert.alert('Erreur', 'Impossible de créer la liste.');
    } finally {
      setCreatingList(false);
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
    try {
      const batch = writeBatch(db);
      const dateStr = new Date().toLocaleDateString('fr-FR');
      const createdAt = Date.now();
      checked.forEach(i => {
        batch.set(doc(collection(db, 'historique')), {
          text: i.text, category: i.category, date: dateStr, createdAt,
          familyCode: activeCode,
          ...(i.completedBy ? { completedBy: i.completedBy } : {}),
          ...(i.finalPrice   ? { finalPrice: i.finalPrice }   : {}),
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
      updates.price = undefined;
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

      {/* Header : sélecteur de listes en premier, nom du foyer en dessous */}
      <View style={styles.topHeader}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listSelectorContainer}
        >
          {foyerLists.map(l => (
            <TouchableOpacity
              key={l.id}
              style={[styles.listPill, { borderColor: theme.border }, activeListId === l.id && { backgroundColor: theme.tint, borderColor: theme.tint }]}
              onPress={() => setActiveListId(l.id)}
            >
              <Text style={[styles.listPillText, { color: activeListId === l.id ? '#fff' : theme.text }]}>{l.name}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.listPill, styles.listPillAdd, { borderColor: theme.tint }]}
            onPress={() => setCreateListModal(true)}
          >
            <Text style={[styles.listPillText, { color: theme.tint }]}>+ Nouvelle liste</Text>
          </TouchableOpacity>
        </ScrollView>
        <Text style={[styles.foyerLabel, { color: theme.subtext }]}>
          {currentFoyer?.name ?? ''}
        </Text>
      </View>

      {/* Barre XP + bouton Mode Courses */}
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
        <TouchableOpacity style={styles.modeCoursesBtn} onPress={() => router.push('/mode-courses')}>
          <Text style={styles.modeCoursesBtnText}>🛒</Text>
        </TouchableOpacity>
      </View>

      {/* Filtre par rayon — collapsible */}
      <TouchableOpacity
        style={[styles.filterToggle, { backgroundColor: theme.card, borderColor: activeFilter ? (RAYONS.find(r => r.id === activeFilter)?.color ?? theme.tint) : theme.border }]}
        onPress={() => setShowFilter(v => !v)}
      >
        <Text style={[styles.filterToggleText, { color: activeFilter ? (RAYONS.find(r => r.id === activeFilter)?.color ?? theme.tint) : theme.subtext }]}>
          {activeFilter ? `● ${RAYONS.find(r => r.id === activeFilter)?.label}` : 'Filtrer par rayon'}
        </Text>
        <Text style={{ color: theme.subtext, fontSize: 11 }}>{showFilter ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {showFilter && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContainer}
        >
          <TouchableOpacity
            style={[styles.filterBtn, { borderColor: theme.border }, !activeFilter && { backgroundColor: theme.tint, borderColor: theme.tint }]}
            onPress={() => { setActiveFilter(null); setShowFilter(false); }}
          >
            <Text style={[styles.filterText, { color: !activeFilter ? '#fff' : theme.subtext }]}>Tous</Text>
          </TouchableOpacity>
          {RAYONS.map(r => (
            <TouchableOpacity
              key={r.id}
              style={[styles.filterBtn, { borderColor: theme.border }, activeFilter === r.id && { backgroundColor: r.color, borderColor: r.color }]}
              onPress={() => { setActiveFilter(activeFilter === r.id ? null : r.id); setShowFilter(false); }}
            >
              <Text style={[styles.filterText, { color: activeFilter === r.id ? '#fff' : theme.subtext }]}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

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
        <View style={[styles.suggestionsBox, { backgroundColor: theme.card }]} onTouchStart={Keyboard.dismiss}>
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

      {/* Sélection rayon — scroll horizontal */}
      {showRayons && (
        <View style={[styles.rayonBar, { backgroundColor: theme.card }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rayonHScroll}>
            {RAYONS.map(r => (
              <TouchableOpacity
                key={r.id}
                style={[styles.rayonPill, { backgroundColor: r.color }]}
                onPress={() => saveItem(r.id)}
              >
                <Text style={styles.rayonPillText}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {editingItem && (
            <TouchableOpacity onPress={() => { setEditingItem(null); setShowRayons(false); }} style={styles.cancelEdit}>
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
              {/* Checkbox */}
              <TouchableOpacity onPress={() => handleToggle(item)} style={styles.checkboxTouchable}>
                <View style={[styles.checkbox, item.completed && styles.checked]} />
              </TouchableOpacity>

              {/* Contenu principal — long press pour éditer */}
              <TouchableOpacity style={styles.itemContent} onLongPress={() => openEditModal(item)}>
                {/* Tag catégorie cliquable pour changer le rayon */}
                <TouchableOpacity
                  onPress={() => { setEditingItem(item); setShowRayons(true); }}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Text style={[styles.tag, { color: RAYONS.find(r => r.id === item.category)?.color ?? '#8E8E93' }]}>
                    {RAYONS.find(r => r.id === item.category)?.label ?? 'DIVERS'} ✎
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.itemText, { color: theme.text }, item.completed && styles.completedText]}>
                  {item.text} (x{item.quantity})
                </Text>
                {item.addedBy ? (
                  <Text style={styles.addedBy}>ajouté par {item.addedBy}</Text>
                ) : null}
                {item.completed && item.completedBy ? (
                  <Text style={styles.completedBy}>✓ acheté par {item.completedBy}</Text>
                ) : null}
              </TouchableOpacity>

              {/* Champ prix inline */}
              <TextInput
                style={[styles.inlinePriceInput, { color: theme.text, borderColor: theme.border }]}
                value={priceInputs[item.id] ?? (item.finalPrice ? String(item.finalPrice) : '')}
                onChangeText={v => setPriceInputs(prev => ({ ...prev, [item.id]: v }))}
                onEndEditing={e => saveFinalPrice(item.id, e.nativeEvent.text)}
                placeholder="€"
                placeholderTextColor={theme.subtext}
                keyboardType="decimal-pad"
              />
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

      {/* Synthèse des contributions */}
      {hasContributions && (
        <View style={[styles.syntheseCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TouchableOpacity onPress={() => setShowSynthese(v => !v)} style={styles.syntheseHeader}>
            <Text style={[styles.syntheseTitle, { color: theme.text }]}>💰 Synthèse des contributions</Text>
            <Text style={{ color: theme.tint, fontWeight: '700' }}>{showSynthese ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {showSynthese && (
            <View style={styles.syntheseBody}>
              {Object.entries(contributions).map(([name, total]) => (
                <View key={name} style={styles.syntheseRow}>
                  <Text style={[styles.syntheseName, { color: theme.text }]}>{name}</Text>
                  <Text style={[styles.syntheseAmount, { color: theme.tint }]}>
                    {total.toFixed(2)} €
                  </Text>
                </View>
              ))}
              <View style={[styles.syntheseDivider, { backgroundColor: theme.border }]} />
              <View style={styles.syntheseRow}>
                <Text style={[styles.syntheseName, { color: theme.subtext, fontWeight: '700' }]}>Total</Text>
                <Text style={[styles.syntheseAmount, { color: theme.text, fontWeight: '900' }]}>
                  {Object.values(contributions).reduce((a, b) => a + b, 0).toFixed(2)} €
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Modal créer une liste */}
      <Modal visible={createListModal} transparent animationType="fade">
        <View style={styles.editOverlay}>
          <View style={[styles.editModal, { backgroundColor: theme.card }]}>
            <Text style={[styles.editTitle, { color: theme.text }]}>Nouvelle liste</Text>
            <TextInput
              style={[styles.editInput, { backgroundColor: theme.bg, color: theme.text }]}
              value={newListName}
              onChangeText={setNewListName}
              placeholder="Ex: Courses du mois, Barbecue samedi..."
              placeholderTextColor={theme.subtext}
              autoFocus
              onSubmitEditing={handleCreateList}
            />
            <TouchableOpacity style={styles.editSaveBtn} onPress={handleCreateList} disabled={creatingList}>
              {creatingList
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.editSaveBtnText}>Créer</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setCreateListModal(false); setNewListName(''); }} style={styles.editCancelBtn}>
              <Text style={styles.editCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topHeader:      { marginBottom: 12 },
  foyerLabel:     { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 6, marginBottom: 2 },

  // Barre XP
  mmorpgContainer:    { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 5 },
  modeCoursesBtn:     { backgroundColor: '#34C759', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  modeCoursesBtnText: { fontSize: 18 },
  levelBadge:     { backgroundColor: '#FFD700', width: 35, height: 35, borderRadius: 5, borderWidth: 2, borderColor: '#B8860B', justifyContent: 'center', alignItems: 'center', transform: [{ rotate: '45deg' }], zIndex: 2, elevation: 5 },
  levelText:      { color: '#1C1C1E', fontWeight: '900', fontSize: 12, transform: [{ rotate: '-45deg' }] },
  xpTrack:        { flex: 1, height: 24, backgroundColor: '#333', borderRadius: 4, borderWidth: 2, borderColor: '#555', marginLeft: -15, overflow: 'hidden', justifyContent: 'center', elevation: 3 },
  xpBar:          { height: '100%', backgroundColor: '#00FF00' },
  shineEffect:    { position: 'absolute', top: 0, left: 0, right: 0, height: '40%', backgroundColor: 'rgba(255,255,255,0.3)' },
  xpText:         { position: 'absolute', width: '100%', textAlign: 'center', color: '#FFF', fontSize: 10, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2, letterSpacing: 1 },

  // Filtre
  filterToggle:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 8 },
  filterToggleText: { fontSize: 13, fontWeight: '700' },
  filterScroll:     { maxHeight: 44, marginBottom: 12 },
  filterContainer:  { paddingVertical: 4, gap: 8 },
  filterBtn:        { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  filterText:       { fontSize: 12, fontWeight: '600' },

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
  rayonBar:       { paddingVertical: 10, paddingHorizontal: 8, borderRadius: 15, marginBottom: 12, elevation: 5 },
  rayonHScroll:   { gap: 8, paddingHorizontal: 4 },
  rayonPill:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  rayonPillText:  { color: '#fff', fontSize: 12, fontWeight: '700' },
  cancelEdit:     { marginTop: 8, alignItems: 'center' },
  cancelEditText: { color: 'red', textAlign: 'center' },

  // Articles
  itemRow:            { flexDirection: 'row', marginBottom: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center' },
  checkboxTouchable:  { padding: 4, marginRight: 12 },
  checkbox:           { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#C7C7CC' },
  checked:            { backgroundColor: '#00FF00', borderColor: '#00FF00' },
  itemContent:        { flex: 1, minWidth: 0 },
  tag:                { fontSize: 10, fontWeight: '800', marginBottom: 2 },
  itemText:           { fontSize: 17, textTransform: 'capitalize' },
  completedText:      { textDecorationLine: 'line-through', color: '#AAA' },
  addedBy:            { fontSize: 11, color: '#8E8E93', marginTop: 2 },
  completedBy:        { fontSize: 11, color: '#34C759', marginTop: 2, fontWeight: '600' },
  inlinePriceInput:   { width: 60, borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4, fontSize: 13, textAlign: 'center', marginLeft: 8 },

  // Sélecteur de listes
  listSelectorContainer:  { paddingVertical: 4, gap: 8 },
  listPill:               { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5 },
  listPillAdd:            { backgroundColor: 'transparent' },
  listPillText:           { fontSize: 13, fontWeight: '700' },

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

  // Synthèse contributions
  syntheseCard:     { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, marginTop: 8, marginBottom: 4, overflow: 'hidden' },
  syntheseHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  syntheseTitle:    { fontSize: 14, fontWeight: '800' },
  syntheseBody:     { paddingHorizontal: 16, paddingBottom: 12 },
  syntheseRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  syntheseName:     { fontSize: 15, fontWeight: '600' },
  syntheseAmount:   { fontSize: 15, fontWeight: '700' },
  syntheseDivider:  { height: StyleSheet.hairlineWidth, marginVertical: 6 },

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
