// src/screens/TestScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Button, ScrollView, ActivityIndicator } from 'react-native';
import getTrack from '../services/api/track/get';
import searchGet from '../services/api/search/get';
import getPlayerSearch from '../services/api/player/search/get';

export const TestScreen = () => {
  const [query, setQuery] = useState('Asake Lonli');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState('spotify');

  const testSpotify = async () => {
    setLoading(true);
    try {
      const track = await getTrack({
        source: 'spotify',
        artistName: query.split(' ')[0],
        trackTitle: query.split(' ').slice(1).join(' '),
      });
      setResults({ type: 'spotify', data: track });
    } catch (error) {
      setResults({ type: 'error', error: error.message });
    }
    setLoading(false);
  };

  const testDeezer = async () => {
    setLoading(true);
    try {
      const track = await getTrack({
        source: 'deezer',
        artistName: query.split(' ')[0],
        trackTitle: query.split(' ').slice(1).join(' '),
      });
      setResults({ type: 'deezer', data: track });
    } catch (error) {
      setResults({ type: 'error', error: error.message });
    }
    setLoading(false);
  };

  const testSoundCloud = async () => {
    setLoading(true);
    try {
      const track = await getTrack({
        source: 'soundcloud',
        artistName: query.split(' ')[0],
        trackTitle: query.split(' ').slice(1).join(' '),
      });
      setResults({ type: 'soundcloud', data: track });
    } catch (error) {
      setResults({ type: 'error', error: error.message });
    }
    setLoading(false);
  };

  const testPlayerSearch = async () => {
    setLoading(true);
    try {
      const [artist, ...titleParts] = query.split(' ');
      const result = await getPlayerSearch({
        trackData: {
          artist,
          title: titleParts.join(' '),
        },
      });
      setResults({ type: 'player-search', data: result });
    } catch (error) {
      setResults({ type: 'error', error: error.message });
    }
    setLoading(false);
  };

  const testMultiSearch = async () => {
    setLoading(true);
    try {
      const result = await searchGet({
        query,
        source: 'all',
        limit: 10,
      });
      setResults({ type: 'multi-search', data: result });
    } catch (error) {
      setResults({ type: 'error', error: error.message });
    }
    setLoading(false);
  };

  return (
    <ScrollView style={{ padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
        🎵 STEP 3 TEST SCREEN
      </Text>

      <TextInput
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          padding: 10,
          marginBottom: 20,
          borderRadius: 5,
        }}
        value={query}
        onChangeText={setQuery}
        placeholder="Enter artist and track (e.g., Asake Lonli)"
      />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <Button title="Test Spotify" onPress={testSpotify} disabled={loading} />
        <Button title="Test Deezer" onPress={testDeezer} disabled={loading} />
        <Button title="Test SoundCloud" onPress={testSoundCloud} disabled={loading} />
        <Button title="Player Search" onPress={testPlayerSearch} disabled={loading} />
        <Button title="Multi-Search" onPress={testMultiSearch} disabled={loading} />
      </View>

      {loading && <ActivityIndicator size="large" />}

      {results && (
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Results:</Text>
          <Text>{JSON.stringify(results, null, 2)}</Text>
        </View>
      )}
    </ScrollView>
  );
};