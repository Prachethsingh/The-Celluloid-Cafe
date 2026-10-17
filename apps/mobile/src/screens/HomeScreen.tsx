import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { ContentCard } from '../components/ContentCard';
import { MovieItem } from '../api/client';
import { PLATFORMS_LIST } from '../data/platforms';

interface HomeScreenProps {
  catalog: MovieItem[];
  continueWatching: MovieItem[];
  country: string;
  selectedPlatform: string | null;
  onSelectPlatform: (platformId: string | null) => void;
  onOpenDetail: (item: MovieItem) => void;
  onPlay: (item: MovieItem) => void;
  onNavigateToSearch: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  catalog,
  continueWatching,
  country,
  selectedPlatform,
  onSelectPlatform,
  onOpenDetail,
  onPlay,
  onNavigateToSearch
}) => {
  const trendingMovies = catalog.filter(m => (m.rating || 0) >= 8.5);
  const seriesItems = catalog.filter(m => m.type === 'series');
  const actionMovies = catalog.filter(m => m.genres?.includes('Action') || m.genres?.includes('Sci-Fi'));

  const filteredCatalog = selectedPlatform
    ? catalog.filter(item => {
        const plats = item.availability?.[country] || item.availability?.['US'] || [];
        return plats.some(p => p.platform_id === selectedPlatform && p.available);
      })
    : catalog;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Search Input Bar Preview (PRD 3.1) */}
      <TouchableOpacity style={styles.searchBar} activeOpacity={0.8} onPress={onNavigateToSearch}>
        <Text style={styles.searchIcon}>🔍</Text>
        <Text style={styles.searchPlaceholder}>Search movies, series, actors, platforms...</Text>
      </TouchableOpacity>

      {/* Streaming Platform Pills (PRD Section 9) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.platformPills}>
        <TouchableOpacity
          style={[styles.pill, !selectedPlatform && styles.activePill]}
          onPress={() => onSelectPlatform(null)}
        >
          <Text style={[styles.pillText, !selectedPlatform && styles.activePillText]}>All Platforms</Text>
        </TouchableOpacity>
        {PLATFORMS_LIST.map(p => (
          <TouchableOpacity
            key={p.id}
            style={[styles.pill, selectedPlatform === p.id && styles.activePill]}
            onPress={() => onSelectPlatform(selectedPlatform === p.id ? null : p.id)}
          >
            <Text style={[styles.pillText, selectedPlatform === p.id && styles.activePillText]}>
              {p.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Continue Watching Row (PRD 3.1) */}
      {continueWatching.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Continue Watching</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {continueWatching.map(item => (
              <ContentCard
                key={'cw-' + item.id}
                item={item}
                country={country}
                onPress={onOpenDetail}
                onPlayPress={onPlay}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Platform Filter Results (if active) */}
      {selectedPlatform && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Available on {PLATFORMS_LIST.find(p => p.id === selectedPlatform)?.name} ({filteredCatalog.length})
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {filteredCatalog.map(item => (
              <ContentCard
                key={item.id}
                item={item}
                country={country}
                onPress={onOpenDetail}
                onPlayPress={onPlay}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Trending (PRD 3.1) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔥 Trending Now</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {trendingMovies.map(item => (
            <ContentCard
              key={item.id}
              item={item}
              country={country}
              onPress={onOpenDetail}
              onPlayPress={onPlay}
            />
          ))}
        </ScrollView>
      </View>

      {/* Popular Series (PRD 3.1) */}
      {seriesItems.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📺 Popular Series</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {seriesItems.map(item => (
              <ContentCard
                key={item.id}
                item={item}
                country={country}
                onPress={onOpenDetail}
                onPlayPress={onPlay}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Sci-Fi & Action Highlights */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🚀 Sci-Fi & Adventure</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {actionMovies.map(item => (
            <ContentCard
              key={item.id}
              item={item}
              country={country}
              onPress={onOpenDetail}
              onPlayPress={onPlay}
            />
          ))}
        </ScrollView>
      </View>

      <View style={{ height: 90 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
    paddingTop: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161e2e',
    marginHorizontal: 16,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchPlaceholder: {
    color: '#64748b',
    fontSize: 13,
  },
  platformPills: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  pill: {
    backgroundColor: '#161e2e',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  activePill: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  pillText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  activePillText: {
    color: '#ffffff',
  },
  section: {
    marginBottom: 20,
    paddingLeft: 16,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
});
