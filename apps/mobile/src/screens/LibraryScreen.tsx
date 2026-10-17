import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { ContentCard } from '../components/ContentCard';
import { MovieItem } from '../api/client';

interface LibraryScreenProps {
  watchlist: MovieItem[];
  favorites: MovieItem[];
  history: MovieItem[];
  country: string;
  onOpenDetail: (item: MovieItem) => void;
  onPlay: (item: MovieItem) => void;
}

const TABS = ['Watchlist', 'Favorites', 'History', 'Downloads'];

export const LibraryScreen: React.FC<LibraryScreenProps> = ({
  watchlist,
  favorites,
  history,
  country,
  onOpenDetail,
  onPlay
}) => {
  const [activeTab, setActiveTab] = useState('Watchlist');

  let itemsToDisplay: MovieItem[] = [];
  if (activeTab === 'Watchlist') itemsToDisplay = watchlist;
  if (activeTab === 'Favorites') itemsToDisplay = favorites;
  if (activeTab === 'History') itemsToDisplay = history;
  if (activeTab === 'Downloads') itemsToDisplay = []; // Authorized downloads list

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Library</Text>

      {/* Tabs */}
      <View style={styles.tabsWrap}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {itemsToDisplay.map(item => (
          <View key={'lib-' + item.id} style={styles.cardWrap}>
            <ContentCard
              item={item}
              country={country}
              onPress={onOpenDetail}
              onPlayPress={onPlay}
            />
          </View>
        ))}

        {itemsToDisplay.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>
              {activeTab === 'Watchlist' ? '📌' : activeTab === 'Favorites' ? '❤️' : activeTab === 'History' ? '🕒' : '💾'}
            </Text>
            <Text style={styles.emptyText}>No items in {activeTab}</Text>
            <Text style={styles.emptySub}>
              {activeTab === 'Downloads'
                ? 'Only DRM-authorized offline playback media can be saved here.'
                : 'Browse movies and series to add them to your personalized collection.'}
            </Text>
          </View>
        )}
        <View style={{ height: 90, width: '100%' }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
    paddingTop: 16,
  },
  title: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  tabsWrap: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 14,
    gap: 8,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#161e2e',
  },
  activeTab: {
    backgroundColor: '#6366f1',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#ffffff',
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
    marginTop: 50,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
