import React from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView
} from 'react-native';
import { MovieItem } from '../api/client';

interface DetailModalProps {
  visible: boolean;
  item: MovieItem | null;
  country: string;
  isWatchlisted: boolean;
  onClose: () => void;
  onPlay: (item: MovieItem) => void;
  onToggleWatchlist: (item: MovieItem) => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({
  visible,
  item,
  country,
  isWatchlisted,
  onClose,
  onPlay,
  onToggleWatchlist
}) => {
  if (!item) return null;

  const platforms = item.availability?.[country] || item.availability?.['US'] || [];

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scroll}>
          {/* Backdrop */}
          <View style={styles.backdropWrap}>
            <Image source={{ uri: item.backdrop_url || item.poster_url }} style={styles.backdrop} />
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Header Info */}
          <View style={styles.contentWrap}>
            <Text style={styles.title}>{item.title}</Text>
            
            <View style={styles.metaRow}>
              <Text style={styles.rating}>{Number.isFinite(item.rating) ? `⭐ ${item.rating.toFixed(1)}` : 'Rating unavailable'}</Text>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.metaText}>{item.release_date?.slice(0, 4) || item.first_air_date?.slice(0, 4) || '2026'}</Text>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.metaText}>{item.runtime || 'Runtime unavailable'}</Text>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.metaText}>{item.language || 'Not supplied'}</Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.playBtn} onPress={() => onPlay(item)}>
                <Text style={styles.playBtnText}>▶ FIND PLAYBACK SOURCE</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.watchlistBtn, isWatchlisted && styles.watchlistActiveBtn]}
                onPress={() => onToggleWatchlist(item)}
              >
                <Text style={styles.watchlistBtnText}>
                  {isWatchlisted ? '✓ IN WATCHLIST' : '＋ WATCHLIST'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Genres */}
            {item.genres && (
              <View style={styles.genresRow}>
                {item.genres.map(g => (
                  <View key={g} style={styles.genrePill}>
                    <Text style={styles.genreText}>{g}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Description */}
            <Text style={styles.sectionHeader}>Overview</Text>
            <Text style={styles.description}>{item.description}</Text>

            {/* Where Available (Multi-Platform Matrix) */}
            <Text style={styles.sectionHeader}>Where Available in {country}</Text>
            <View style={styles.platformGrid}>
              {platforms.length > 0 ? (
                platforms.map(p => (
                  <View key={p.platform_id} style={[styles.platformCard, p.available ? styles.platformAvail : styles.platformUnavail]}>
                    <Text style={styles.platformName}>{p.name}</Text>
                    <Text style={[styles.platformStatus, p.available ? styles.availText : styles.unavailText]}>
                      {p.available ? '● Available' : '○ Not available'}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.unavailNotice}>Availability information coming soon for this territory.</Text>
              )}
            </View>

            {/* Cast & Crew */}
            {item.cast && item.cast.length > 0 && (
              <>
                <Text style={styles.sectionHeader}>Cast & Crew</Text>
                <View style={styles.castRow}>
                  {item.cast.map(c => (
                    <View key={c.name} style={styles.castCard}>
                      <Text style={styles.castName}>{c.name}</Text>
                      <Text style={styles.castRole}>{c.role}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Seasons & Episodes if Series */}
            {item.seasons && item.seasons.length > 0 && (
              <>
                <Text style={styles.sectionHeader}>Episodes</Text>
                {item.seasons.map(s => (
                  <View key={s.season_number} style={styles.seasonContainer}>
                    <Text style={styles.seasonTitle}>{s.title}</Text>
                    {s.episodes.map(ep => (
                      <View key={ep.episode_number} style={styles.epCard}>
                        <View style={styles.epHeader}>
                          <Text style={styles.epNum}>E{ep.episode_number}</Text>
                          <Text style={styles.epTitle}>{ep.title}</Text>
                          <Text style={styles.epRuntime}>{ep.runtime}</Text>
                        </View>
                        <Text style={styles.epDesc} numberOfLines={2}>{ep.description}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
  },
  scroll: {
    flex: 1,
  },
  backdropWrap: {
    width: '100%',
    height: 220,
    position: 'relative',
  },
  backdrop: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1f2937',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  contentWrap: {
    padding: 16,
  },
  title: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  rating: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '700',
  },
  bullet: {
    color: '#475569',
    fontSize: 12,
    marginHorizontal: 6,
  },
  metaText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  playBtn: {
    flex: 1,
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledBtn: {
    backgroundColor: '#334155',
  },
  playBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  watchlistBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  watchlistActiveBtn: {
    backgroundColor: '#065f46',
    borderColor: '#10b981',
  },
  watchlistBtnText: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 13,
  },
  genresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  genrePill: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  genreText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
  sectionHeader: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 8,
  },
  description: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 20,
  },
  platformGrid: {
    gap: 8,
  },
  platformCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  platformAvail: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  platformUnavail: {
    backgroundColor: 'rgba(51, 65, 85, 0.2)',
    borderColor: '#1e293b',
  },
  platformName: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
  },
  platformStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  availText: {
    color: '#10b981',
  },
  unavailText: {
    color: '#64748b',
  },
  unavailNotice: {
    color: '#64748b',
    fontSize: 12,
  },
  castRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  castCard: {
    backgroundColor: '#111827',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  castName: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
  },
  castRole: {
    color: '#64748b',
    fontSize: 10,
  },
  seasonContainer: {
    marginBottom: 12,
  },
  seasonTitle: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  epCard: {
    backgroundColor: '#111827',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  epHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  epNum: {
    color: '#6366f1',
    fontWeight: '700',
    fontSize: 12,
  },
  epTitle: {
    flex: 1,
    color: '#f8fafc',
    fontWeight: '600',
    fontSize: 12,
  },
  epRuntime: {
    color: '#64748b',
    fontSize: 11,
  },
  epDesc: {
    color: '#94a3b8',
    fontSize: 11,
  },
});
