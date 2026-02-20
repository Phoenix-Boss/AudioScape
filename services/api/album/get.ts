// src/services/api/album/get.ts
import { Source, TrackData } from '../../types/track';
import getRequest from '../request/get';
import { CacheFortress } from '../../cache/fortress';

export interface AlbumData {
  id: string | number;
  title: string;
  artist: string;
  artistId?: string | number;
  year?: number;
  releaseDate?: string;
  trackCount?: number;
  duration?: number;
  cover?: string;
  coverSmall?: string;
  coverMedium?: string;
  source: Source;
  tracks?: TrackData[];
}

export interface GetAlbumParams {
  source: Source;
  albumId: string | number;
  artistId?: string | number;
  includeTracks?: boolean;
}

export default async function getAlbum({
  source,
  albumId,
  artistId,
  includeTracks = true,
}: GetAlbumParams): Promise<AlbumData | null> {
  const startTime = Date.now();
  const cacheKey = `album:${source}:${albumId}`;

  const cached = await CacheFortress.get<AlbumData>(cacheKey);
  if (cached) {
    console.log(`📦 Album cache hit: ${source}/${albumId}`);
    return cached;
  }

  let url = '';
  let params = {};

  switch (source) {
    case 'spotify':
      url = `https://api.spotify.com/v1/albums/${albumId}`;
      break;
    case 'deezer':
      url = `https://api.deezer.com/album/${albumId}`;
      break;
    case 'soundcloud':
      url = `https://api-v2.soundcloud.com/playlists/${albumId}`;
      break;
    case 'tidal':
      url = `https://api.tidal.com/v1/albums/${albumId}`;
      break;
    case 'qobuz':
      url = `https://www.qobuz.com/api.json/0.2/album/get?album_id=${albumId}`;
      break;
    case 'amazon':
      url = `https://api.amazon.com/music/albums/${albumId}`;
      break;
    case 'napster':
      url = `https://api.napster.com/v2.2/albums/${albumId}`;
      break;
    case 'pandora':
      url = `https://api.pandora.com/music/v1/albums/${albumId}`;
      break;
    case 'vk':
      url = `https://api.vk.com/method/audio.getAlbums`;
      params = { album_id: albumId, v: '5.131' };
      break;
    case 'yandex':
      url = `https://api.music.yandex.net/albums/${albumId}`;
      break;
    case 'bandcamp':
      url = `https://bandcamp.com/api/mobile/22/album/${albumId}`;
      break;
    default:
      throw new Error(`Unsupported source for album: ${source}`);
  }

  const handleSuccess = async (response: any) => {
    const data = response.data;
    
    let albumData: AlbumData = {
      id: albumId,
      title: '',
      artist: '',
      source,
    };

    switch (source) {
      case 'spotify':
        albumData = {
          id: data.id,
          title: data.name,
          artist: data.artists[0]?.name || '',
          artistId: data.artists[0]?.id,
          releaseDate: data.release_date,
          trackCount: data.total_tracks,
          cover: data.images[0]?.url,
          coverMedium: data.images[1]?.url,
          coverSmall: data.images[2]?.url,
          source,
        };
        break;
      case 'deezer':
        albumData = {
          id: data.id,
          title: data.title,
          artist: data.artist.name,
          artistId: data.artist.id,
          releaseDate: data.release_date,
          trackCount: data.nb_tracks,
          duration: data.duration,
          cover: data.cover_big,
          coverMedium: data.cover_medium,
          coverSmall: data.cover_small,
          source,
        };
        break;
    }

    if (includeTracks && data.tracks) {
      const items = data.tracks.items || data.tracks.data || data.tracks;
      albumData.tracks = items.map((track: any) => ({
        id: track.id,
        title: track.title || track.name,
        artist: track.artist?.name || track.artists?.[0]?.name || albumData.artist,
        artistId: track.artist?.id || track.artists?.[0]?.id,
        album: albumData.title,
        albumId: albumData.id,
        duration: track.duration_ms ? Math.floor(track.duration_ms / 1000) : track.duration,
        source,
      }));
    }

    await CacheFortress.set(cacheKey, albumData);
    console.log(`💿 Album fetched from ${source} (${Date.now() - startTime}ms)`);
    
    return albumData;
  };

  return getRequest({
    url,
    params,
    isWithSelfToken: source !== 'deezer' && source !== 'bandcamp',
    onSuccess: handleSuccess,
  });
}