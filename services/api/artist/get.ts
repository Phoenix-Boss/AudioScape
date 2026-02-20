// src/services/api/artist/get.ts
import { Source } from '../../types/track';
import getRequest from '../request/get';
import { CacheFortress } from '../../cache/fortress';

export interface ArtistData {
  id: string | number;
  name: string;
  image?: string;
  imageMedium?: string;
  imageSmall?: string;
  biography?: string;
  genres?: string[];
  formedYear?: number;
  country?: string;
  source: Source;
  similar?: ArtistData[];
}

export interface GetArtistParams {
  source: Source;
  artistId: string | number;
  artistName?: string;
  includeSimilar?: boolean;
}

export default async function getArtist({
  source,
  artistId,
  artistName,
  includeSimilar = false,
}: GetArtistParams): Promise<ArtistData | null> {
  const startTime = Date.now();
  const cacheKey = `artist:${source}:${artistId}`;

  const cached = await CacheFortress.get<ArtistData>(cacheKey);
  if (cached) {
    console.log(`📦 Artist cache hit: ${source}/${artistId}`);
    return cached;
  }

  let url = '';
  let params = {};

  switch (source) {
    case 'spotify':
      url = `https://api.spotify.com/v1/artists/${artistId}`;
      break;
    case 'deezer':
      url = `https://api.deezer.com/artist/${artistId}`;
      break;
    case 'soundcloud':
      url = `https://api-v2.soundcloud.com/users/${artistId}`;
      break;
    case 'tidal':
      url = `https://api.tidal.com/v1/artists/${artistId}`;
      break;
    case 'qobuz':
      url = `https://www.qobuz.com/api.json/0.2/artist/get?artist_id=${artistId}`;
      break;
    case 'lastfm':
      if (!artistName) throw new Error('artistName required for Last.fm');
      url = `https://ws.audioscrobbler.com/2.0/`;
      params = {
        method: 'artist.getInfo',
        artist: artistName,
        api_key: process.env.LASTFM_API_KEY,
        format: 'json',
      };
      break;
    case 'vk':
      url = `https://api.vk.com/method/artists.get`;
      params = { artist_ids: artistId, v: '5.131' };
      break;
    case 'yandex':
      url = `https://api.music.yandex.net/artists/${artistId}`;
      break;
    case 'bandcamp':
      url = `https://bandcamp.com/api/mobile/22/artist/${artistId}`;
      break;
    default:
      throw new Error(`Unsupported source for artist: ${source}`);
  }

  const handleSuccess = async (response: any) => {
    const data = response.data;
    
    let artistData: ArtistData = {
      id: artistId,
      name: '',
      source,
    };

    switch (source) {
      case 'spotify':
        artistData = {
          id: data.id,
          name: data.name,
          image: data.images[0]?.url,
          imageMedium: data.images[1]?.url,
          imageSmall: data.images[2]?.url,
          genres: data.genres,
          source,
        };
        break;
      case 'deezer':
        artistData = {
          id: data.id,
          name: data.name,
          image: data.picture_big,
          imageMedium: data.picture_medium,
          imageSmall: data.picture_small,
          source,
        };
        break;
      case 'soundcloud':
        artistData = {
          id: data.id,
          name: data.username,
          image: data.avatar_url?.replace('large', 't500x500'),
          imageMedium: data.avatar_url?.replace('large', 't300x300'),
          imageSmall: data.avatar_url?.replace('large', 't67x67'),
          source,
        };
        break;
      case 'lastfm':
        artistData = {
          id: artistId,
          name: data.artist.name,
          image: data.artist.image?.find((img: any) => img.size === 'extralarge')?.['#text'],
          imageMedium: data.artist.image?.find((img: any) => img.size === 'large')?.['#text'],
          imageSmall: data.artist.image?.find((img: any) => img.size === 'medium')?.['#text'],
          biography: data.artist.bio?.summary,
          source,
        };
        break;
    }

    await CacheFortress.set(cacheKey, artistData);
    console.log(`👤 Artist fetched from ${source} (${Date.now() - startTime}ms)`);
    
    return artistData;
  };

  return getRequest({
    url,
    params,
    isWithSelfToken: source !== 'deezer' && source !== 'bandcamp' && source !== 'lastfm',
    onSuccess: handleSuccess,
  });
}