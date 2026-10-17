import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { MovieItem } from '../api/client';

interface ContentCardProps {
  item: MovieItem;
  country?: string;
  onPress: (item: MovieItem) => void;
  onPlayPress?: (item: MovieItem) => void;
}

export const ContentCard: React.FC<ContentCardProps> = ({ item, country = 'US', onPress, onPlayPress }) => {
  const platforms = item.availability?.[country] || item.availability?.['US'] || [];
  const availableCount = platforms.filter(p => p.available).length;

  return (
    <TouchableOpacity activeOpacity={0.85} style={styles.card} onPress={() => onPress(item)}>
      <View style={styles.posterContainer}>
        <Image source={{ uri: item.poster_url }} style={styles.poster} />
        <View style={styles.badgeTopLeft}>
          <Text style={styles.badgeText}>{item.type === 'series' ? 'TV' : 'MOVIE'}</Text>
        </View>
        <View style={styles.ratingBadge}>
          <Text style={styles.ratingText}>⭐ {item.rating.toFixed(1)}</Text>
        </View>
        {item.authorized_playback && (
          <TouchableOpacity
            style={styles.playOverlayBtn}
            onPress={() => onPlayPress ? onPlayPress(item) : onPress(item)}
          >
            <Text style={styles.playIcon}>▶</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{item.release_date?.slice(0, 4) || item.first_air_date?.slice(0, 4) || '2026'}</Text>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.metaText}>{item.runtime || '2h'}</Text>
        </View>
        <Text style={styles.availabilitySnippet} numberOfLines={1}>
          {availableCount > 0 ? `Stream on ${platforms[0]?.name}` : 'Check Rights'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 140,
    marginRight: 12,
    backgroundColor: '#111827',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  posterContainer: {
    width: '100%',
    height: 195,
    position: 'relative',
  },
  poster: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1e293b',
  },
  badgeTopLeft: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
  },
  ratingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ratingText: {
    color: '#fbbf24',
    fontSize: 10,
    fontWeight: '700',
  },
  playOverlayBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    color: '#ffffff',
    fontSize: 13,
    marginLeft: 2,
  },
  info: {
    padding: 8,
  },
  title: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  metaText: {
    color: '#64748b',
    fontSize: 11,
  },
  bullet: {
    color: '#64748b',
    fontSize: 11,
    marginHorizontal: 4,
  },
  availabilitySnippet: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '500',
  },
});
