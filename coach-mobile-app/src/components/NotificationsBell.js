import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { notificationsAPI } from '../services/api';
import { couleurs } from '../theme';

const POLL_INTERVAL = 30000;

// Cloche notifications + panneau modal
// Props:
//   - size (default 40)
//   - onNotificationPress(notif) — appelé après markRead pour la navigation
const NotificationsBell = ({ size = 40, onNotificationPress }) => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef(null);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await notificationsAPI.getUnreadCount();
      setUnreadCount(res.data?.data?.count ?? 0);
    } catch {
      // silencieux
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationsAPI.getAll();
      setNotifications(res.data?.data ?? []);
    } catch {
      // silencieux
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnread();
    pollRef.current = setInterval(fetchUnread, POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchUnread]);

  const handleOpen = async () => {
    setOpen(true);
    await fetchAll();
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // silencieux
    }
  };

  const handlePress = async (notif) => {
    if (!notif.isRead) {
      try {
        await notificationsAPI.markRead(notif.id);
        setNotifications((prev) => prev.map((n) => n.id === notif.id ? { ...n, isRead: true } : n));
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // silencieux
      }
    }
    setOpen(false);
    if (onNotificationPress) onNotificationPress(notif);
  };

  const iconColor = (type) => {
    if (type === 'APPOINTMENT_CANCELLED') return couleurs.danger;
    if (type === 'APPOINTMENT_REMINDER') return couleurs.accent;
    return couleurs.alerte;
  };
  const bgColor = (type) => {
    if (type === 'APPOINTMENT_CANCELLED') return couleurs.dangerVoile;
    if (type === 'APPOINTMENT_REMINDER') return couleurs.accentVoile;
    return couleurs.alerteVoile;
  };

  return (
    <>
      <TouchableOpacity
        onPress={handleOpen}
        style={[styles.bellBtn, { width: size, height: size, borderRadius: size / 2 }]}
        activeOpacity={0.7}
      >
        <Ionicons name="notifications-outline" size={22} color={couleurs.texte} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notifications</Text>
              <View style={styles.modalHeaderActions}>
                {unreadCount > 0 && (
                  <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
                    <Ionicons name="checkmark-done" size={16} color={couleurs.accent} />
                    <Text style={styles.markAllText}>Tout lire</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setOpen(false)}>
                  <Ionicons name="close" size={24} color={couleurs.texte} />
                </TouchableOpacity>
              </View>
            </View>

            {loading ? (
              <View style={styles.centerContent}>
                <ActivityIndicator size="large" color={couleurs.accent} />
              </View>
            ) : notifications.length === 0 ? (
              <View style={styles.centerContent}>
                <Ionicons name="notifications-off-outline" size={48} color={couleurs.texteFaible} />
                <Text style={styles.emptyText}>Aucune notification</Text>
              </View>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.notifItem, item.isRead && styles.notifItemRead]}
                    onPress={() => handlePress(item)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.notifIcon, { backgroundColor: bgColor(item.type) }]}>
                      <Ionicons name="calendar" size={16} color={iconColor(item.type)} />
                    </View>
                    <View style={styles.notifContent}>
                      <View style={styles.notifTitleRow}>
                        <Text style={[styles.notifTitle, item.isRead && styles.notifTitleRead]} numberOfLines={1}>
                          {item.title}
                        </Text>
                        {!item.isRead && <View style={styles.unreadDot} />}
                      </View>
                      <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
                      <Text style={styles.notifDate}>
                        {format(parseISO(item.createdAt), "d MMM 'à' HH:mm", { locale: fr })}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  bellBtn: {
    backgroundColor: couleurs.fond,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: couleurs.danger,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    // Le liseré isole la pastille de l'icône : il prend la couleur de la surface
    // qui la porte, pas du blanc.
    borderColor: couleurs.carte,
  },
  badgeText: {
    color: couleurs.texteInverse,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: couleurs.carte,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: couleurs.texte,
  },
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  markAllText: {
    color: couleurs.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: couleurs.texteFaible,
    fontSize: 14,
    marginTop: 12,
  },
  notifItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
    alignItems: 'flex-start',
    gap: 12,
  },
  notifItemRead: {
    opacity: 0.6,
  },
  notifIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifContent: {
    flex: 1,
  },
  notifTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: couleurs.texte,
    flex: 1,
  },
  notifTitleRead: {
    color: couleurs.texteDoux,
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: couleurs.accent,
    marginLeft: 8,
  },
  notifBody: {
    fontSize: 12,
    color: couleurs.texteDoux,
    lineHeight: 16,
  },
  notifDate: {
    fontSize: 10,
    color: couleurs.texteFaible,
    marginTop: 4,
  },
});

export default NotificationsBell;
