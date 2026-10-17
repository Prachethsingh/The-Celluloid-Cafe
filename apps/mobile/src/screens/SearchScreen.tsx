import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity
} from 'react-native';
import { ContentCard } from '../components/ContentCard';
import { MovieItem } from '../api/client';
import { PLATFORMS_LIST } from '../data/platforms';

interface SearchScreenProps {
  catalog: MovieItem[];
  country: string;
  onOpenDetail: (item: MovieItem) => void;
  onPlay: (item: MovieItem) => void;
}

const GENRES = ['All', 'Action', 'Sci-Fi', 'Drama', 'Adventure', 'Thriller', 'Animation'];
const TYPES = ['All', 'Movie', 'Series'];

export const SearchScreen: React.FC<SearchScreenProps> = ({
  catalog,
  country,
  onOpenDetail,
  onPlay
}) => {
  const [query, setQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  const results = useMemo(() => {
    return catalog.filter(item => {
      // Query filter
      if (query.trim()) {
        const q = query.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchCast = item.cast?.some(c => c.name.toLowerCase().includes(q));
        const matchGenre = item.genres?.some(g => g.toLowerCase().includes(q));
        if (!matchTitle && !matchCast && !matchGenre) return false;
      }

      // Type filter
      if (selectedType === 'Movie' && item.type !== 'movie') return false;
      if (selectedType === 'Series' && item.type !== 'series') return false;

      // Genre filter
      if (selectedGenre !== 'All' && !item.genres?.includes(selectedGenre)) return false;

      // Platform filter
      if (selectedPlatform) {
        const plats = item.availability?.[country] || item.availability?.['US'] || [];
        const isAvail = plats.some(p => p.platform_id === selectedPlatform && p.available);
        if (!isAvail) return false;
      }

      return true;
    });
  }, [catalog, query, selectedGenre, selectedType, selectedPlatform, country]);

  return (
    <View style={styles.container}>
      {/* Search Bar Input */}
      <View style={styles.inputWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.input}
          placeholder="Search by title, cast, genre..."
          placeholderTextColor="#64748b"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Chips: Type */}
      <View style={styles.filtersSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {TYPES.map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.chip, selectedType === t && styles.activeChip]}
              onPress={() => setSelectedType(t)}
            >
              <Text style={[styles.chipText, selectedType === t && styles.activeChipText]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Filter Chips: Genres */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {GENRES.map(g => (
            <TouchableOpacity
              key={g}
              style={[styles.chip, selectedGenre === g && styles.activeChip]}
              onPress={() => setSelectedGenre(g)}
            >
              <Text style={[styles.chipText, selectedGenre === g && styles.activeChipText]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Filter Chips: Platforms */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.chip, !selectedPlatform && styles.activeChip]}
            onPress={() => setSelectedPlatform(null)}
          >
            <Text style={[styles.chipText, !selectedPlatform && styles.activeChipText]}>All Streaming</Text>
          </TouchableOpacity>
          {PLATFORMS_LIST.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[styles.chip, selectedPlatform === p.id && styles.activeChip]}
              onPress={() => setSelectedPlatform(selectedPlatform === p.id ? null : p.id)}
            >
              <Text style={[styles.chipText, selectedPlatform === p.id && styles.activeChipText]}>{p.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Results Header */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>{results.length} titles found</Text>
      </View>

      {/* Results Grid */}
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {results.map(item => (
          <View key={item.id} style={styles.cardWrap}>
            <ContentCard
              item={item}
              country={country}
              onPress={onOpenDetail}
              onPlayPress={onPlay}
            />
          </View>
        ))}
        {results.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🎬</Text>
            <Text style={styles.emptyText}>No matching titles found.</Text>
            <Text style={styles.emptySub}>Try adjusting search keywords or resetting filters.</Text>
          </View>
        )}
        <View style={{ height: 100, width: '100%' }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
    paddingTop: 12,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161e2e',
    marginHorizontal: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
    fontSize: 14,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
  },
  clearIcon: {
    color: '#94a3b8',
    paddingHorizontal: 8,
    fontSize: 14,
  },
  filtersSection: {
    marginTop: 10,
    gap: 6,
  },
  filterRow: {
    paddingHorizontal: 16,
  },
  chip: {
    backgroundColor: '#161e2e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  activeChip: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  chipText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  activeChipText: {
    color: '#ffffff',
  },
  resultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  resultsCount: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
  },
  cardWrap: {
    marginBottom: 8,
  },
  emptyWrap: {
    width: '100%',
    alignItems: 'center',
    marginTop: 40,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 36,
  },
  emptyText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    color: '#64748b',
    fontSize: 12,
  },
});
