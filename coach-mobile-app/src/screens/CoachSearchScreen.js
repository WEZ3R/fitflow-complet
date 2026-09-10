import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { coachesAPI, clientsAPI } from '../services/api';
import { API_URL } from '../../config';
import { GYM_CHAINS } from '../constants/locations';
import { couleurs } from '../theme';

const CoachSearchScreen = ({ navigation }) => {
  const [coaches, setCoaches] = useState([]);
  const [filteredCoaches, setFilteredCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [gymFilter, setGymFilter] = useState('');
  const [remoteFilter, setRemoteFilter] = useState('all');
  const [clientProfile, setClientProfile] = useState(null);

  useEffect(() => {
    fetchCoaches();
    fetchClientProfile();
  }, []);

  useEffect(() => {
    filterCoaches();
  }, [searchTerm, cityFilter, gymFilter, remoteFilter, coaches]);

  const fetchClientProfile = async () => {
    try {
      const response = await clientsAPI.getMe();
      if (response.data.success) {
        setClientProfile(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching client profile:', error);
    }
  };

  const fetchCoaches = async () => {
    try {
      const response = await coachesAPI.getAll();
      if (response.data.success) {
        setCoaches(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching coaches:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterCoaches = useCallback(() => {
    let filtered = [...coaches];

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((coach) => {
        const fullName = `${coach.user.firstName} ${coach.user.lastName}`.toLowerCase();
        return fullName.includes(search);
      });
    }

    if (cityFilter) {
      filtered = filtered.filter(
        (coach) =>
          coach.city &&
          coach.city.toLowerCase().includes(cityFilter.toLowerCase())
      );
    }

    if (gymFilter) {
      filtered = filtered.filter(
        (coach) => coach.trainingLocations?.includes(gymFilter)
      );
    }

    if (remoteFilter !== 'all') {
      if (remoteFilter === 'remote') {
        filtered = filtered.filter((coach) => coach.isRemote);
      } else if (remoteFilter === 'onsite') {
        filtered = filtered.filter((coach) => !coach.isRemote);
      }
    }

    setFilteredCoaches(filtered);
  }, [searchTerm, cityFilter, gymFilter, remoteFilter, coaches]);

  const getMediaUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${API_URL.replace('/api', '')}${url}`;
  };

  const renderCoachCard = ({ item: coach }) => {
    const isCurrentCoach = clientProfile?.coachId === coach.id;

    return (
      <TouchableOpacity
        style={styles.coachCard}
        onPress={() => navigation.navigate('CoachDetail', { coachId: coach.id })}
      >
        {isCurrentCoach && (
          <View style={styles.currentCoachBadge}>
            <Text style={styles.currentCoachText}>Mon Coach</Text>
          </View>
        )}

        <View style={styles.coachImageContainer}>
          {coach.profilePicture ? (
            <Image
              source={{ uri: getMediaUrl(coach.profilePicture) }}
              style={styles.coachImage}
            />
          ) : (
            <View style={styles.coachImagePlaceholder}>
              <Ionicons name="person" size={40} color={couleurs.texteFaible} />
            </View>
          )}
        </View>

        <View style={styles.coachInfo}>
          <Text style={styles.coachName}>
            {coach.user.firstName} {coach.user.lastName}
          </Text>

          {coach.rating > 0 && (
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={14} color={couleurs.alerte} />
              <Text style={styles.ratingText}>
                {coach.rating.toFixed(1)} ({coach.ratingCount})
              </Text>
            </View>
          )}

          {coach.bio && (
            <Text style={styles.coachBio} numberOfLines={2}>
              {coach.bio}
            </Text>
          )}

          <View style={styles.tagsContainer}>
            {coach.city && (
              <View style={styles.tag}>
                <Ionicons name="location-outline" size={12} color={couleurs.texteDoux} />
                <Text style={styles.tagText}>{coach.city}</Text>
              </View>
            )}
            {coach.isRemote && (
              <View style={[styles.tag, styles.remoteTag]}>
                <Ionicons name="wifi-outline" size={12} color={couleurs.info} />
                <Text style={[styles.tagText, styles.remoteText]}>À distance</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={couleurs.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Trouver un Coach</Text>
        <Text style={styles.headerSubtitle}>
          {coaches.length} coach(s) disponibles
        </Text>
      </View>

      {/* Filtres */}
      <View style={styles.filtersContainer}>
        {/* Recherche par nom */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={couleurs.texteFaible} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher par nom..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholderTextColor={couleurs.texteFaible}
          />
        </View>

        {/* Filtre ville */}
        <View style={styles.filterRow}>
          <View style={styles.filterInput}>
            <Ionicons name="location-outline" size={18} color={couleurs.texteFaible} />
            <TextInput
              style={styles.filterTextInput}
              placeholder="Ville..."
              value={cityFilter}
              onChangeText={setCityFilter}
              placeholderTextColor={couleurs.texteFaible}
            />
          </View>
        </View>

        {/* Filtre salle de sport */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.chipContainer, { marginBottom: 8 }]}>
          <TouchableOpacity
            style={[styles.chip, gymFilter === '' && styles.chipActive]}
            onPress={() => setGymFilter('')}
          >
            <Text style={[styles.chipText, gymFilter === '' && styles.chipTextActive]}>
              Toutes les salles
            </Text>
          </TouchableOpacity>
          {GYM_CHAINS.map((gym) => (
            <TouchableOpacity
              key={gym}
              style={[styles.chip, gymFilter === gym && styles.chipActive]}
              onPress={() => setGymFilter(gymFilter === gym ? '' : gym)}
            >
              <Text style={[styles.chipText, gymFilter === gym && styles.chipTextActive]}>
                {gym}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Filtre coaching à distance */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
          <TouchableOpacity
            style={[styles.chip, remoteFilter === 'all' && styles.chipActive]}
            onPress={() => setRemoteFilter('all')}
          >
            <Text style={[styles.chipText, remoteFilter === 'all' && styles.chipTextActive]}>
              Tous
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, remoteFilter === 'remote' && styles.chipActive]}
            onPress={() => setRemoteFilter('remote')}
          >
            <Text style={[styles.chipText, remoteFilter === 'remote' && styles.chipTextActive]}>
              À distance
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, remoteFilter === 'onsite' && styles.chipActive]}
            onPress={() => setRemoteFilter('onsite')}
          >
            <Text style={[styles.chipText, remoteFilter === 'onsite' && styles.chipTextActive]}>
              En présentiel
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Liste des coachs */}
      {filteredCoaches.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="person-outline" size={64} color={couleurs.texteFaible} />
          <Text style={styles.emptyText}>
            {coaches.length === 0
              ? 'Aucun coach disponible'
              : 'Aucun coach ne correspond à votre recherche'}
          </Text>
          {coaches.length > 0 && (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => {
                setSearchTerm('');
                setCityFilter('');
                setGymFilter('');
                setRemoteFilter('all');
              }}
            >
              <Text style={styles.resetButtonText}>Réinitialiser les filtres</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredCoaches}
          renderItem={renderCoachCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: couleurs.fond,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: couleurs.carte,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: couleurs.texte,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: couleurs.texteDoux,
  },
  filtersContainer: {
    backgroundColor: couleurs.carte,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: couleurs.fond,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: couleurs.texte,
  },
  filterRow: {
    marginBottom: 12,
  },
  filterInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: couleurs.fond,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  filterTextInput: {
    flex: 1,
    paddingVertical: 8,
    marginLeft: 8,
    fontSize: 14,
    color: couleurs.texte,
  },
  chipContainer: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: couleurs.fond,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: couleurs.accent,
  },
  chipText: {
    fontSize: 14,
    color: couleurs.texteDoux,
    fontWeight: '500',
  },
  chipTextActive: {
    color: couleurs.texteInverse,
  },
  listContainer: {
    padding: 16,
  },
  coachCard: {
    backgroundColor: couleurs.carte,
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
    shadowColor: couleurs.ombre,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
  },
  currentCoachBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: couleurs.succes,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
  },
  currentCoachText: {
    color: couleurs.texteInverse,
    fontSize: 11,
    fontWeight: 'bold',
  },
  coachImageContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  coachImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  coachImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: couleurs.accentVoile,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coachInfo: {
    alignItems: 'center',
  },
  coachName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: couleurs.texte,
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingText: {
    fontSize: 13,
    color: couleurs.texteDoux,
    marginLeft: 4,
  },
  coachBio: {
    fontSize: 14,
    color: couleurs.texteDoux,
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: couleurs.fond,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  remoteTag: {
    backgroundColor: couleurs.infoVoile,
  },
  tagText: {
    fontSize: 12,
    color: couleurs.texteDoux,
    marginLeft: 4,
  },
  remoteText: {
    color: couleurs.info,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: couleurs.texteDoux,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  resetButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: couleurs.accent,
    borderRadius: 8,
  },
  resetButtonText: {
    color: couleurs.texteInverse,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default CoachSearchScreen;
