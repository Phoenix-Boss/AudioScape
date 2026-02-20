// src/services/api/playlist/get.ts
import { Source, TrackData } from '../../types/track';
import getRequest from '../request/get';
import { CacheFortress } from '../../cache/fortress';

export interface PlaylistData {
  id: string | number;
  title: string;
  description?: string;
  owner?: string;
  trackCount?: number;
  duration?: number;
  cover?: string;
  coverSmall?: string;
  coverMedium?: string;
  source: Source;
  tracks?: TrackData[];
}

export interface GetPlaylistParams {
  source: Source;
  playlistId: string | number;
  userId?: string | number;
  includeTracks?: boolean;
  limit?: number;
}

export default async function getPlaylist({
  source,
  playlistId,
  userId,
  includeTracks = true,
  limit = 50,
}: GetPlaylistParams): Promise<PlaylistData | null> {
  const startTime = Date.now();
  const cacheKey = `playlist:${source}:${playlistId}`;

  const cached = await CacheFortress.get<PlaylistData>(cacheKey);
  if (cached) {
    console.log(`📦 Playlist cache hit: ${source}/${playlistId}`);
    return cached;
  }

  let url = '';
  let params = {};

  switch (source) {
    case 'spotify':
      url = `https://api.spotify.com/v1/playlists/${playlistId}`;
      break;
    case 'deezer':
      url = `https://api.deezer.com/playlist/${playlistId}`;
      break;
    case 'soundcloud':
      url = `https://api-v2.soundcloud.com/playlists/${playlistId}`;
      break;
    case 'youtube':
      url = `https://www.googleapis.com/youtube/v3/playlists`;
      params = { id: playlistId, part: 'snippet,contentDetails' };
      break;
    case 'tidal':
      url = `https://api.tidal.com/v1/playlists/${playlistId}`;
      break;
    case 'qobuz':
      url = `https://www.qobuz.com/api.json/0.2/playlist/get?playlist_id=${playlistId}`;
      break;
    case 'vk':
      url = `https://api.vk.com/method/audio.getPlaylistById`;
      params = { playlist_id: playlistId, owner_id: userId, v: '5.131' };
      break;
    case 'yandex':
      url = `https://api.music.yandex.net/users/${userId}/playlists/${playlistId}`;
      break;
    default:
      throw new Error(`Unsupported source for playlist: ${source}`);
  }

  const handleSuccess = async (response: any) => {
    const data = response.data;
    
    let playlistData: PlaylistData = {
      id: playlistId,
      title: '',
      source,
    };

    switch (source) {
      case 'spotify':
        playlistData = {
          id: data.id,
          title: data.name,
          description: data.description,
          owner: data.owner.display_name,
          trackCount: data.tracks.total,
          cover: data.images[0]?.url,
          coverMedium: data.images[1]?.url,
          coverSmall: data.images[2]?.url,
          source,
        };
        if (includeTracks && data.tracks?.items) {
          playlistData.tracks = data.tracks.items.map((item: any) => ({
            id: item.track.id,
            title: item.track.name,
            artist: item.track.artists[0]?.name,
            artistId: item.track.artists[0]?.id,
            album: item.track.album.name,
            albumId: item.track.album.id,
            duration: Math.floor(item.track.duration_ms / 1000),
            image: item.track.album.images[0]?.url,
            source,
          })).slice(0, limit);
        }
        break;
      case 'deezer':
        playlistData = {
          id: data.id,
          title: data.title,
          description: data.description,
          owner: data.creator.name,
          trackCount: data.nb_tracks,
          duration: data.duration,
          cover: data.picture_big,
          coverMedium: data.picture_medium,
          coverSmall: data.picture_small,
          source,
        };
        if (includeTracks && data.tracks?.data) {
          playlistData.tracks = data.tracks.data.map((track: any) => ({
            id: track.id,
            title: track.title,
            artist: track.artist.name,
            artistId: track.artist.id,
            album: track.album.title,
            albumId: track.album.id,
            duration: track.duration,
            image: track.album.cover_medium,
            source,
          })).slice(0, limit);
        }
        break;
    }

    await CacheFortress.set(cacheKey, playlistData);
    console.log(`📋 Playlist fetched from ${source} (${Date.now() - startTime}ms)`);
    
    return playlistData;
  };

  return getRequest({
    url,
    params,
    isWithSelfToken: source !== 'deezer',
    onSuccess: handleSuccess,
  });
}