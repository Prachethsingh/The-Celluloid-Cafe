import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { createPlaybackSession, MovieItem } from '../api/client';

interface VideoPlayerModalProps {
  visible: boolean;
  item: MovieItem | null;
  onClose: () => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({ visible, item, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamUri, setStreamUri] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !item) return;
    let active = true;
    setLoading(true);
    setError(null);
    setStreamUri(null);
    createPlaybackSession(item.id, item.type || 'movie')
      .then(session => { if (active) setStreamUri(session.stream_url); })
      .catch(reason => { if (active) setError(reason.message || 'No configured playback source is available.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [visible, item?.id, item?.type]);

  if (!item) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose}>
            <Text style={styles.backText}>✕ Close Player</Text>
          </TouchableOpacity>
          <View style={styles.badgeWrap}>
            <Text style={styles.badgeText}>{streamUri ? 'SOURCE READY' : 'SOURCE CHECK'}</Text>
          </View>
        </View>

        <View style={styles.playerWrap}>
          {loading && (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={styles.loadingText}>Initializing Authorized HLS Session...</Text>
            </View>
          )}

          {error ? (
            <View style={styles.errorWrap}>
              <Text style={styles.errorTitle}>Playback unavailable</Text>
              <Text style={styles.errorSub}>{error}</Text>
            </View>
          ) : streamUri ? (
            <Video
              source={{ uri: streamUri }}
              rate={1.0}
              volume={1.0}
              isMuted={false}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              isLooping={false}
              useNativeControls
              style={styles.video}
              onLoad={() => setLoading(false)}
              onError={(err) => {
                setLoading(false);
                setError('The configured source could not be played: ' + JSON.stringify(err));
              }}
            />
          ) : null}
        </View>

        <View style={styles.details}>
          <Text style={styles.nowPlaying}>{streamUri ? 'NOW PLAYING' : 'PLAYBACK STATUS'}</Text>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.subtext}>{streamUri ? 'Stream supplied by the configured media provider.' : 'Playback requires an active source configured for this title.'}</Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#1e293b',
    borderRadius: 6,
  },
  backText: {
    color: '#cbd5e1',
    fontWeight: '600',
    fontSize: 12,
  },
  badgeWrap: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    color: '#10b981',
    fontWeight: '700',
    fontSize: 10,
  },
  playerWrap: {
    width: '100%',
    height: 260,
    backgroundColor: '#0b0f19',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingWrap: {
    position: 'absolute',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  errorWrap: {
    padding: 20,
    alignItems: 'center',
  },
  errorTitle: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  errorSub: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
  },
  details: {
    padding: 16,
  },
  nowPlaying: {
    color: '#6366f1',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtext: {
    color: '#64748b',
    fontSize: 12,
  },
});
