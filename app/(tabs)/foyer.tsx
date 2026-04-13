import React, { useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, Share, Modal, ActivityIndicator, Clipboard,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../firebaseConfig';
import { useFoyer, FoyerDoc, FoyerMember, InvitePreview } from '../../context/FoyerContext';
import { useAppTheme } from '../../hooks/use-app-theme';

export default function FoyerScreen() {
  const {
    activeCode, updateActiveCode,
    currentFoyer, myFoyers,
    userName, createFoyer, generateInviteCode, lookupInviteCode,
    acceptInvitation, rejectInvitation, removeMember, leaveFoyer,
    deleteFoyer, renameFoyer,
  } = useFoyer();
  const theme = useAppTheme();
  const currentUid = auth.currentUser?.uid;

  // ── Refs swipeables (pour fermer après action) ──
  const swipeRefs = useRef<Record<string, Swipeable | null>>({});

  // ── Modals ──
  const [createModal, setCreateModal]   = useState(false);
  const [joinModal, setJoinModal]       = useState(false);
  const [inviteModal, setInviteModal]   = useState(false);
  const [detailFoyer, setDetailFoyer]   = useState<FoyerDoc | null>(null);
  const [renameModal, setRenameModal]   = useState(false);
  const [renamingFoyer, setRenamingFoyer] = useState<FoyerDoc | null>(null);
  const [renameInput, setRenameInput]   = useState('');
  const [renaming, setRenaming]         = useState(false);

  // ── Formulaires ──
  const [foyerName, setFoyerName]         = useState('');
  const [inviteInput, setInviteInput]     = useState('');
  const [generatedCode, setGeneratedCode] = useState('');

  // ── Chargements ──
  const [creating, setCreating]     = useState(false);
  const [looking, setLooking]       = useState(false);
  const [generating, setGenerating] = useState(false);

  // ── Invitation preview ──
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null);
  const [accepting, setAccepting]         = useState(false);

  const closeAllSwipes = () => {
    Object.values(swipeRefs.current).forEach(ref => ref?.close());
  };

  // ─── Créer un foyer ────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!foyerName.trim()) return;
    setCreating(true);
    try {
      await createFoyer(foyerName.trim());
      setCreateModal(false);
      setFoyerName('');
    } catch {
      Alert.alert('Erreur', 'Impossible de créer le foyer.');
    } finally {
      setCreating(false);
    }
  };

  // ─── Renommer un foyer ─────────────────────────────────────────────────────
  const openRename = (foyer: FoyerDoc) => {
    closeAllSwipes();
    setRenamingFoyer(foyer);
    setRenameInput(foyer.name);
    setRenameModal(true);
  };

  const handleRename = async () => {
    if (!renamingFoyer || !renameInput.trim()) return;
    setRenaming(true);
    try {
      await renameFoyer(renamingFoyer.code, renameInput.trim());
      setRenameModal(false);
      setRenamingFoyer(null);
    } catch {
      Alert.alert('Erreur', 'Impossible de renommer le foyer.');
    } finally {
      setRenaming(false);
    }
  };

  // ─── Supprimer un foyer ───────────────────────────────────────────────────
  const handleDelete = (foyer: FoyerDoc) => {
    closeAllSwipes();
    Alert.alert(
      'Supprimer le foyer',
      `Supprimer "${foyer.name}" définitivement ?\n\nToutes les listes et articles seront supprimés pour tous les membres.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer', style: 'destructive', onPress: async () => {
            try {
              await deleteFoyer(foyer.code);
              setDetailFoyer(null);
            } catch {
              Alert.alert('Erreur', 'Impossible de supprimer ce foyer.');
            }
          },
        },
      ]
    );
  };

  // ─── Chercher une invitation ───────────────────────────────────────────────
  const handleLookup = async () => {
    if (!inviteInput.trim()) return;
    setLooking(true);
    try {
      const preview = await lookupInviteCode(inviteInput.trim());
      if (!preview) {
        Alert.alert('Code invalide', 'Ce code est introuvable ou a expiré.');
        return;
      }
      setInvitePreview(preview);
    } catch {
      Alert.alert('Erreur', 'Impossible de vérifier ce code.');
    } finally {
      setLooking(false);
    }
  };

  // ─── Accepter / refuser ────────────────────────────────────────────────────
  const handleAccept = async () => {
    if (!invitePreview) return;
    setAccepting(true);
    try {
      await acceptInvitation(invitePreview);
      setJoinModal(false);
      setInviteInput('');
      setInvitePreview(null);
    } catch {
      Alert.alert('Erreur', 'Impossible de rejoindre ce foyer.');
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!invitePreview) return;
    await rejectInvitation(invitePreview.id).catch(() => {});
    setInvitePreview(null);
    setInviteInput('');
    setJoinModal(false);
  };

  // ─── Générer un code d'invitation ─────────────────────────────────────────
  const handleGenerateInvite = async (foyer: FoyerDoc) => {
    if (activeCode !== foyer.code) await updateActiveCode(foyer.code);
    setGenerating(true);
    try {
      const code = await generateInviteCode();
      setGeneratedCode(code);
      setInviteModal(true);
    } catch {
      Alert.alert('Erreur', "Impossible de générer un code d'invitation.");
    } finally {
      setGenerating(false);
    }
  };

  const handleShareInvite = () => {
    const name = myFoyers.find(f => f.code === activeCode)?.name ?? '';
    Share.share({
      message: `Rejoins mon foyer "${name}" sur OubliePas !\nCode d'invitation : ${generatedCode}\n(valable 24h)`,
      title: 'Invitation OubliePas',
    });
  };

  // ─── Retirer un membre ─────────────────────────────────────────────────────
  const handleRemove = (member: FoyerMember, foyer: FoyerDoc) => {
    Alert.alert(
      'Retirer ce membre',
      `Voulez-vous retirer ${member.name} du foyer ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer', style: 'destructive', onPress: async () => {
            if (activeCode !== foyer.code) await updateActiveCode(foyer.code);
            await removeMember(member.uid);
          },
        },
      ]
    );
  };

  // ─── Quitter un foyer ─────────────────────────────────────────────────────
  const handleLeave = (foyer: FoyerDoc) => {
    Alert.alert(
      'Quitter le foyer',
      `Voulez-vous vraiment quitter "${foyer.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Quitter', style: 'destructive', onPress: async () => {
            try {
              if (activeCode !== foyer.code) await updateActiveCode(foyer.code);
              await leaveFoyer();
              setDetailFoyer(null);
            } catch (e: any) {
              if (e?.message === 'OWNER_CANNOT_LEAVE') {
                Alert.alert('Impossible', "Vous êtes le propriétaire de ce foyer.");
              } else {
                Alert.alert('Erreur', 'Impossible de quitter le foyer.');
              }
            }
          },
        },
      ]
    );
  };

  // ─── Actions swipe ─────────────────────────────────────────────────────────
  const renderLeftActions = (foyer: FoyerDoc, isOwner: boolean) => {
    if (!isOwner) return null;
    return (
      <TouchableOpacity
        style={styles.swipeRight}
        onPress={() => openRename(foyer)}
      >
        <Ionicons name="pencil" size={22} color="#fff" />
        <Text style={styles.swipeLabel}>Renommer</Text>
      </TouchableOpacity>
    );
  };

  const renderRightActions = (foyer: FoyerDoc, isOwner: boolean) => {
    if (!isOwner) return null;
    return (
      <TouchableOpacity
        style={styles.swipeLeft}
        onPress={() => handleDelete(foyer)}
      >
        <Ionicons name="trash" size={22} color="#fff" />
        <Text style={styles.swipeLabel}>Supprimer</Text>
      </TouchableOpacity>
    );
  };

  // ─── Pas encore de foyer ───────────────────────────────────────────────────
  if (myFoyers.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>🏠</Text>
          <Text style={[styles.heroTitle, { color: theme.text }]}>Mes Foyers</Text>
          <Text style={[styles.heroSub, { color: theme.subtext }]}>
            Crée un espace partagé avec ta famille ou rejoins-en un.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.mainBtn, { backgroundColor: theme.tint }]}
          onPress={() => setCreateModal(true)}
        >
          <Ionicons name="add-circle-outline" size={22} color="#fff" />
          <Text style={styles.mainBtnText}>Créer un foyer</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mainBtn, styles.outlineBtn, { borderColor: theme.tint }]}
          onPress={() => { setInvitePreview(null); setInviteInput(''); setJoinModal(true); }}
        >
          <Ionicons name="enter-outline" size={22} color={theme.tint} />
          <Text style={[styles.mainBtnText, { color: theme.tint }]}>Rejoindre avec un code</Text>
        </TouchableOpacity>

        {renderCreateModal()}
        {renderJoinModal()}
      </View>
    );
  }

  // ─── Liste des foyers ──────────────────────────────────────────────────────
  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={styles.scrollContent}>

      <Text style={[styles.pageTitle, { color: theme.text }]}>Mes Foyers</Text>
      <Text style={[styles.pageSub, { color: theme.subtext }]}>
        Glisse à droite pour renommer · à gauche pour supprimer
      </Text>

      {myFoyers.filter(f => f?.code && f?.name).map(foyer => {
        const members    = foyer.members ?? [];
        const isActive   = foyer.code === activeCode;
        const isOwner    = foyer.ownerUid === currentUid;
        const isExpanded = detailFoyer?.code === foyer.code;

        return (
          <Swipeable
            key={foyer.code}
            ref={ref => { swipeRefs.current[foyer.code] = ref; }}
            renderLeftActions={() => renderLeftActions(foyer, isOwner)}
            renderRightActions={() => renderRightActions(foyer, isOwner)}
            overshootLeft={false}
            overshootRight={false}
          >
            <View style={[styles.foyerCard, { backgroundColor: theme.card, borderWidth: 2, borderColor: isActive ? theme.tint : theme.border }]}>

              {/* En-tête carte */}
              <TouchableOpacity
                style={styles.cardHeader}
                onPress={() => setDetailFoyer(isExpanded ? null : foyer)}
                activeOpacity={0.7}
              >
                <View style={[styles.foyerIconBox, { backgroundColor: isActive ? theme.tint : theme.border }]}>
                  <Ionicons name="home" size={20} color={isActive ? '#fff' : theme.subtext} />
                </View>
                <View style={styles.cardHeaderText}>
                  <Text style={[styles.foyerName, { color: theme.text }]}>{foyer.name}</Text>
                  <Text style={[styles.foyerMeta, { color: theme.subtext }]}>
                    {members.length} membre{members.length > 1 ? 's' : ''}
                    {isOwner ? ' · Propriétaire' : ''}
                  </Text>
                </View>
                {isActive ? (
                  <View style={[styles.activeBadge, { backgroundColor: theme.tint }]}>
                    <Text style={styles.activeBadgeText}>ACTIF</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.switchBtn, { borderColor: theme.tint }]}
                    onPress={() => updateActiveCode(foyer.code)}
                  >
                    <Text style={[styles.switchBtnText, { color: theme.tint }]}>Activer</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              {/* Détail dépliable */}
              {isExpanded && (
                <View style={[styles.detail, { borderTopColor: theme.border }]}>

                  {/* Membres */}
                  <Text style={[styles.detailLabel, { color: theme.subtext }]}>MEMBRES</Text>
                  {members.map((member, i) => {
                    const isMe = member.uid === currentUid;
                    const isMemberOwner = member.uid === foyer.ownerUid;
                    const initials = (member.name ?? '?').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
                    return (
                      <View
                        key={member.uid}
                        style={[styles.memberRow, i < members.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}
                      >
                        <View style={[styles.memberAvatar, { backgroundColor: isMemberOwner ? theme.tint : '#8E8E93' }]}>
                          <Text style={styles.memberInitials}>{initials}</Text>
                        </View>
                        <Text style={[styles.memberName, { color: theme.text }]}>
                          {member.name}{isMe ? ' (moi)' : ''}{isMemberOwner ? ' 👑' : ''}
                        </Text>
                        {isOwner && !isMe && (
                          <TouchableOpacity onPress={() => handleRemove(member, foyer)}>
                            <Ionicons name="close-circle" size={20} color="#FF3B30" />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}

                  {/* Actions */}
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: theme.tint }]}
                      onPress={() => handleGenerateInvite(foyer)}
                      disabled={generating}
                    >
                      {generating
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <><Ionicons name="person-add" size={16} color="#fff" /><Text style={styles.actionBtnText}>Inviter</Text></>
                      }
                    </TouchableOpacity>
                    {!isOwner && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: '#FF3B3015' }]}
                        onPress={() => handleLeave(foyer)}
                      >
                        <Ionicons name="exit-outline" size={16} color="#FF3B30" />
                        <Text style={[styles.actionBtnText, { color: '#FF3B30' }]}>Quitter</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>
          </Swipeable>
        );
      })}

      {/* Boutons bas de page */}
      <TouchableOpacity
        style={[styles.mainBtn, { backgroundColor: theme.tint, marginTop: 8 }]}
        onPress={() => setCreateModal(true)}
      >
        <Ionicons name="add-circle-outline" size={20} color="#fff" />
        <Text style={styles.mainBtnText}>Créer un nouveau foyer</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.mainBtn, styles.outlineBtn, { borderColor: theme.tint }]}
        onPress={() => { setInvitePreview(null); setInviteInput(''); setJoinModal(true); }}
      >
        <Ionicons name="enter-outline" size={20} color={theme.tint} />
        <Text style={[styles.mainBtnText, { color: theme.tint }]}>Rejoindre avec un code</Text>
      </TouchableOpacity>

      {renderCreateModal()}
      {renderJoinModal()}
      {renderRenameModal()}

      {/* Modal code généré */}
      <Modal visible={inviteModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: theme.card }]}>
            <Ionicons name="link" size={32} color={theme.tint} style={{ marginBottom: 12 }} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Code d'invitation</Text>
            <Text style={[styles.modalSub, { color: theme.subtext }]}>Valable 24h · Usage unique</Text>
            <View style={[styles.codeBox, { backgroundColor: theme.bg }]}>
              <Text style={[styles.codeText, { color: theme.tint }]}>{generatedCode}</Text>
            </View>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: theme.tint }]} onPress={handleShareInvite}>
              <Text style={styles.modalBtnText}>Partager</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: theme.bg, marginTop: 8 }]}
              onPress={() => {
                Clipboard.setString(generatedCode);
                Alert.alert('Copié !', 'Le code a été copié dans le presse-papiers.');
              }}
            >
              <Text style={[styles.modalBtnText, { color: theme.text }]}>Copier</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setInviteModal(false)} style={styles.cancelBtn}>
              <Text style={[styles.cancelText, { color: theme.subtext }]}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );

  // ─── Modals partagés ───────────────────────────────────────────────────────
  function renderCreateModal() {
    return (
      <Modal visible={createModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Nouveau foyer</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, color: theme.text }]}
              placeholder="Nom du foyer (ex: Ma Famille)"
              placeholderTextColor={theme.subtext}
              value={foyerName}
              onChangeText={setFoyerName}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: theme.tint }]}
              onPress={handleCreate}
              disabled={creating}
            >
              {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Créer</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCreateModal(false)} style={styles.cancelBtn}>
              <Text style={[styles.cancelText, { color: theme.subtext }]}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  function renderRenameModal() {
    return (
      <Modal visible={renameModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Renommer le foyer</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, color: theme.text }]}
              placeholder="Nouveau nom"
              placeholderTextColor={theme.subtext}
              value={renameInput}
              onChangeText={setRenameInput}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: theme.tint }]}
              onPress={handleRename}
              disabled={renaming}
            >
              {renaming ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Renommer</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setRenameModal(false)} style={styles.cancelBtn}>
              <Text style={[styles.cancelText, { color: theme.subtext }]}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  function renderJoinModal() {
    return (
      <Modal visible={joinModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: theme.card }]}>
            {!invitePreview ? (
              <>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Rejoindre un foyer</Text>
                <Text style={[styles.modalSub, { color: theme.subtext }]}>Entre le code d'invitation reçu</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.bg, color: theme.text }]}
                  placeholder="Code (ex: AB3X7Y)"
                  placeholderTextColor={theme.subtext}
                  value={inviteInput}
                  onChangeText={t => setInviteInput(t.toUpperCase())}
                  autoCapitalize="characters"
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: theme.tint }]}
                  onPress={handleLookup}
                  disabled={looking}
                >
                  {looking ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Vérifier</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setJoinModal(false)} style={styles.cancelBtn}>
                  <Text style={[styles.cancelText, { color: theme.subtext }]}>Annuler</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>🏠</Text>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Invitation reçue</Text>
                <Text style={[styles.modalSub, { color: theme.subtext }]}>
                  <Text style={{ color: theme.text, fontWeight: '700' }}>{invitePreview.inviterName}</Text>
                  {' '}t'invite à rejoindre
                </Text>
                <View style={[styles.foyerNameBox, { backgroundColor: theme.tint + '20' }]}>
                  <Text style={[styles.foyerNameText, { color: theme.tint }]}>{invitePreview.foyerName}</Text>
                </View>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#34C759' }]} onPress={handleAccept} disabled={accepting}>
                  {accepting ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Accepter</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#FF3B3015', marginTop: 8 }]} onPress={handleReject}>
                  <Text style={[styles.modalBtnText, { color: '#FF3B30' }]}>Refuser</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    );
  }
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 60, paddingBottom: 40 },

  // Pas de foyer
  hero:      { alignItems: 'center', marginTop: 60, marginBottom: 48 },
  heroIcon:  { fontSize: 64, marginBottom: 12 },
  heroTitle: { fontSize: 26, fontWeight: '900', marginBottom: 8 },
  heroSub:   { fontSize: 15, textAlign: 'center', lineHeight: 22, paddingHorizontal: 24 },

  pageTitle: { fontSize: 26, fontWeight: '900', marginBottom: 4 },
  pageSub:   { fontSize: 12, marginBottom: 20 },

  // Swipe actions
  swipeLeft:  { backgroundColor: '#FF3B30', justifyContent: 'center', alignItems: 'center', width: 90, borderRadius: 16, marginBottom: 16 },
  swipeRight: { backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', width: 90, borderRadius: 16, marginBottom: 16 },
  swipeLabel: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 4 },

  // Carte foyer
  foyerCard:    { borderRadius: 16, marginBottom: 16 },
  cardHeader:   { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  foyerIconBox: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardHeaderText: { flex: 1 },
  foyerName:    { fontSize: 17, fontWeight: '700' },
  foyerMeta:    { fontSize: 12, marginTop: 2 },
  activeBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  activeBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  switchBtn:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1.5 },
  switchBtnText: { fontSize: 13, fontWeight: '700' },

  // Détail dépliable
  detail:      { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: StyleSheet.hairlineWidth },
  detailLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 14, marginBottom: 8 },
  memberRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  memberAvatar:   { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  memberInitials: { color: '#fff', fontWeight: '900', fontSize: 13 },
  memberName:  { flex: 1, fontSize: 15, fontWeight: '500' },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actionBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 12 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Boutons principaux
  mainBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginHorizontal: 20, marginBottom: 14, padding: 18, borderRadius: 16 },
  outlineBtn: { backgroundColor: 'transparent', borderWidth: 2 },
  mainBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Modals
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modal:     { width: '100%', borderRadius: 20, padding: 24, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '900', marginBottom: 6, textAlign: 'center' },
  modalSub:  { fontSize: 13, marginBottom: 20, textAlign: 'center' },
  input:     { width: '100%', borderRadius: 12, padding: 14, fontSize: 18, textAlign: 'center', marginBottom: 16, letterSpacing: 2 },
  modalBtn:  { width: '100%', padding: 16, borderRadius: 14, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  cancelBtn: { marginTop: 16 },
  cancelText: { fontSize: 14 },
  foyerNameBox:  { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, marginBottom: 20 },
  foyerNameText: { fontSize: 18, fontWeight: '900' },
  codeBox:   { paddingHorizontal: 28, paddingVertical: 16, borderRadius: 14, marginBottom: 20 },
  codeText:  { fontSize: 32, fontWeight: '900', letterSpacing: 6 },
});
