import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface HeaderProps {
  country: string;
  onSelectCountry?: (c: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ country, onSelectCountry }) => {
  return (
    <View style={styles.container}>
      <View style={styles.branding}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoBadgeText}>U</Text>
        </View>
        <Text style={styles.logoTitle}>Unified Cinema</Text>
      </View>
      <View style={styles.countryBadge}>
        <Text style={styles.countryText}>📍 {country}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#0b0f19',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  branding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadgeText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  logoTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  countryBadge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  countryText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
});
