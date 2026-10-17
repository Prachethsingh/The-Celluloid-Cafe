import React, { useState, useEffect } from 'react';
import { AppState, StyleSheet, SafeAreaView, View, StatusBar } from 'react-native';
import { Header } from './src/components/Header';
import { BottomNavBar, NavTab } from './src/components/BottomNavBar';
import { HomeScreen } from './src/screens/HomeScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { DetailModal } from './src/screens/DetailModal';
import { VideoPlayerModal } from './src/components/VideoPlayerModal';
import { MovieItem, fetchCatalog } from './src/api/client';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [country, setCountry] = useState<string>('US');
  const [catalog, setCatalog] = useState<MovieItem[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  // User Library States
  const [watchlist, setWatchlist] = useState<MovieItem[]>([]);
  const [favorites, setFavorites] = useState<MovieItem[]>([]);
  const [history, setHistory] = useState<MovieItem[]>([]);
  const [continueWatching, setContinueWatching] = useState<MovieItem[]>([]);

  // Modal States
  const [selectedItem, setSelectedItem] = useState<MovieItem | null>(null);
  const [detailVisible, setDetailVisible] = useState<boolean>(false);
  const [playerVisible, setPlayerVisible] = useState<boolean>(false);
  const [activePlayItem, setActivePlayItem] = useState<MovieItem | null>(null);

  // Keep the mobile catalog current with the live API.
  useEffect(() => {
    let mounted = true;
    const refresh = () => fetchCatalog().then(items => {
      if (mounted) setCatalog(items);
    }).catch(error => console.warn('Catalog refresh failed:', error));
    refresh();
    const interval = setInterval(refresh, 60_000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => {
      mounted = false;
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  const handleOpenDetail = (item: MovieItem) => {
    setSelectedItem(item);
    setDetailVisible(true);
  };

  const handlePlay = (item: MovieItem) => {
    setActivePlayItem(item);
    setPlayerVisible(true);

    // Add to continue watching and history
    if (!continueWatching.some(i => i.id === item.id)) {
      setContinueWatching(prev => [item, ...prev]);
    }
    if (!history.some(i => i.id === item.id)) {
      setHistory(prev => [item, ...prev]);
    }
  };

  const handleToggleWatchlist = (item: MovieItem) => {
    setWatchlist(prev => {
      const exists = prev.some(i => i.id === item.id);
      if (exists) {
        return prev.filter(i => i.id !== item.id);
      } else {
        return [item, ...prev];
      }
    });
  };

  const isWatchlisted = selectedItem ? watchlist.some(i => i.id === selectedItem.id) : false;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0b0f19" />
      <Header country={country} onSelectCountry={setCountry} />

      <View style={styles.content}>
        {currentTab === 'home' && (
          <HomeScreen
            catalog={catalog}
            continueWatching={continueWatching}
            country={country}
            selectedPlatform={selectedPlatform}
            onSelectPlatform={setSelectedPlatform}
            onOpenDetail={handleOpenDetail}
            onPlay={handlePlay}
            onNavigateToSearch={() => setCurrentTab('search')}
          />
        )}

        {currentTab === 'search' && (
          <SearchScreen
            catalog={catalog}
            country={country}
            onOpenDetail={handleOpenDetail}
            onPlay={handlePlay}
          />
        )}

        {currentTab === 'library' && (
          <LibraryScreen
            watchlist={watchlist}
            favorites={favorites}
            history={history}
            country={country}
            onOpenDetail={handleOpenDetail}
            onPlay={handlePlay}
          />
        )}

        {currentTab === 'downloads' && (
          <LibraryScreen
            watchlist={[]}
            favorites={[]}
            history={[]}
            country={country}
            onOpenDetail={handleOpenDetail}
            onPlay={handlePlay}
          />
        )}

        {currentTab === 'profile' && (
          <LibraryScreen
            watchlist={watchlist}
            favorites={favorites}
            history={history}
            country={country}
            onOpenDetail={handleOpenDetail}
            onPlay={handlePlay}
          />
        )}
      </View>

      <BottomNavBar currentTab={currentTab} onSelectTab={setCurrentTab} />

      {/* Movie & Series Detail Modal */}
      <DetailModal
        visible={detailVisible}
        item={selectedItem}
        country={country}
        isWatchlisted={isWatchlisted}
        onClose={() => setDetailVisible(false)}
        onPlay={(item) => {
          setDetailVisible(false);
          handlePlay(item);
        }}
        onToggleWatchlist={handleToggleWatchlist}
      />

      {/* In-App Video Player Modal */}
      <VideoPlayerModal
        visible={playerVisible}
        item={activePlayItem}
        onClose={() => setPlayerVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0b0f19',
  },
  content: {
    flex: 1,
  },
});
