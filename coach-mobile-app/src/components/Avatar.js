import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { API_URL } from '../../config';
import { couleurs } from '../theme';

// Construit l'URL complète d'une photo stockée sur le backend
const getPhotoUrl = (user) => {
  // Priorité : champ avatarUrl direct, sinon chercher dans les profils imbriqués
  const path = user?.avatarUrl
    || user?.clientProfile?.profilePicture
    || user?.coachProfile?.profilePicture;

  if (!path) return null;

  // Déjà une URL complète (http/https)
  if (path.startsWith('http')) return path;

  // Chemin relatif : ex "/uploads/file.jpg"
  // API_URL = "http://192.168.x.x:5001/api" → base = "http://192.168.x.x:5001"
  const base = API_URL.replace(/\/api\/?$/, '');
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
};

const Avatar = ({ user, size = 40, onPress }) => {
  const getInitials = () => {
    if (!user) return '?';
    const firstInitial = user.firstName?.[0] || '';
    const lastInitial = user.lastName?.[0] || '';
    return `${firstInitial}${lastInitial}`.toUpperCase();
  };

  const photoUrl = getPhotoUrl(user);

  const renderAvatar = () => {
    if (photoUrl) {
      return (
        <Image
          source={{ uri: photoUrl }}
          style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
        />
      );
    }

    return (
      <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.initials, { fontSize: size * 0.4 }]}>
          {getInitials()}
        </Text>
      </View>
    );
  };

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {renderAvatar()}
      </TouchableOpacity>
    );
  }

  return renderAvatar();
};

const styles = StyleSheet.create({
  image: {
    resizeMode: 'cover',
  },
  placeholder: {
    backgroundColor: couleurs.info,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: couleurs.texteInverse,
    fontWeight: '600',
  },
});

export default Avatar;
