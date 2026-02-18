/**
 * This file serves as a wrapper for the youtubei.js library, enabling interaction
 * with YouTube's internal API (Innertube). It handles fetching video information, stream URLs,
 * search results, and processing various page data types like albums and artists.
 */

// === START === Polyfills for youtubei.js in React Native
import { unknownTrackImageUri } from "@/constants/images";
import { decode, encode } from "base-64";
import "event-target-polyfill";
import { MMKV } from "react-native-mmkv";
import { Track } from "react-native-track-player";
import "react-native-url-polyfill/auto";
import "text-encoding-polyfill";
import { TransformStream } from "web-streams-polyfill";
import { Innertube, Platform, Types } from "youtubei.js";

if (typeof global.TransformStream === "undefined") {
  global.TransformStream = TransformStream;
}

// Polyfill for btoa and atob
if (!global.btoa) {
  global.btoa = encode;
}

if (!global.atob) {
  global.atob = decode;
}

Platform.shim.eval = async (
  data: Types.BuildScriptResult,
  env: Record<string, Types.VMPrimative>,
) => {
  const properties = [];

  if (env.n) {
    properties.push(`n: exportedVars.nFunction("${env.n}")`);
  }

  if (env.sig) {
    properties.push(`sig: exportedVars.sigFunction("${env.sig}")`);
  }

  const code = `${data.output}\nreturn { ${properties.join(", ")} }`;

  return new Function(code)();
};

// Assign MMKV storage to the global scope for caching
// @ts-expect-error
global.mmkvStorage = MMKV as any;

/**
 * CustomEvent polyfill.
 */
class CustomEvent extends Event {
  #detail;

  constructor(type: string, options?: CustomEventInit<any[]>) {
    super(type, options);
    this.#detail = options?.detail ?? null;
  }

  get detail() {
    return this.#detail;
  }
}

global.CustomEvent = CustomEvent as any;
// === END === Polyfills

/**
 * A promise that resolves to a singleton Innertube instance.
 * Initialized WITHOUT PO tokens - uses the built-in session management.
 */
export const innertube: Promise<Innertube> = (async () => {
  console.log(`[MusicPlayer] Creating Innertube instance without PO token...`);

  try {
    // Create Innertube WITHOUT po_token and visitor_data
    // The library handles session management internally
    const client = await Innertube.create({
      generate_session_locally: true,
      // Use a specific client type that doesn't require PO tokens
      client_type: "YTMUSIC", // Or "WEB", "ANDROID", etc.
    });

    console.log("[MusicPlayer] Innertube instance created successfully WITHOUT PO token.");
    return client;
  } catch (error) {
    console.error("[MusicPlayer] Failed to create Innertube:", error);
    throw error;
  }
})();

/**
 * Retrieves detailed information for a given YouTube video ID and formats it as a Track object.
 */
export async function getInfo(
  inid: string,
  title?: string,
  author?: string,
): Promise<Track | null> {
  try {
    const yt = await innertube;
    const info = await yt.getBasicInfo(inid, { client: "YTMUSIC" });

    if (info.playability_status?.status !== "OK") {
      console.log(
        `[MusicPlayer] Video ${inid} not available: ${info.playability_status?.reason}`,
      );
      return null;
    }

    const format = info.chooseFormat({ type: "audio", quality: "best" });
    if (!format) {
      console.log(`[MusicPlayer] No audio format found for ${inid}`);
      return null;
    }

    const streamUrl = `${format.decipher(yt.session.player)}`;
    const item = info.basic_info;

    const res: Track = {
      id: inid,
      url: streamUrl,
      title: title || item.title || "Unknown title",
      artist:
        author || item.author?.replace(" - Topic", "") || "Unknown artist",
      artwork:
        item.thumbnail && item.thumbnail[0]
          ? item.thumbnail[0].url
          : unknownTrackImageUri,
      duration: item.duration,
    };
    return res;
  } catch (error) {
    console.log(
      `[MusicPlayer] Error getting info for ${inid}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
    return null;
  }
}

// === TYPES (add these at the top or in a separate types file) ===
export interface Song {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
}

export interface Video {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  year: string;
}

export interface Artist {
  id: string;
  name: string;
  thumbnail: string;
  subtitle?: string;
}

export interface BaseItem {
  id: string;
  thumbnail: string;
}

export interface TopResult {
  type: string;
  id: string;
  title: string;
  thumbnail: string;
  subtitle: string;
  artist: string;
}

export interface SearchPageData {
  topResult: TopResult | null;
  songs: Song[];
  videos: Video[];
  albums: Album[];
  artists: Artist[];
}

export interface AlbumPageData {
  title: string;
  subtitle: string;
  second_subtitle: string;
  thumbnail: string;
  songs: { id: string; title: string; duration: string }[];
}

export interface PlaylistPageData {
  title: string;
  subtitle: string;
  second_subtitle: string;
  thumbnail: string;
  songs: { id: string; title: string; duration: number; thumbnail: string; artist: string }[];
}

export interface ArtistPageItem {
  id: string;
  title: string;
  subtitle: string;
  thumbnail: string;
  year?: string;
}

export interface ArtistPageData {
  title: string;
  description: string;
  thumbnail: string;
  albums: ArtistPageItem[];
  songs: Song[];
  singlesAndEPs: ArtistPageItem[];
  videos: ArtistPageItem[];
}

// === PROCESSING FUNCTIONS (unchanged from your original) ===
export function processItems(items: any[], type: "song"): Song[];
export function processItems(items: any[], type: "video"): Video[];
export function processItems(items: any[], type: "album"): Album[];
export function processItems(items: any[], type: "artist"): Artist[];
export function processItems(
  items: any[],
  type: "song" | "video" | "album" | "artist",
): (Song | Video | Album | Artist)[] {
  return items
    .filter((item) => item?.id && (item.title || item.name))
    .map((item) => {
      const baseItem: BaseItem = {
        id: item.id,
        thumbnail: item.thumbnail?.contents?.[0]?.url ?? unknownTrackImageUri,
      };
      switch (type) {
        case "song":
          return {
            ...baseItem,
            title: item.title,
            artist: item.artists?.[0]?.name ?? "Unknown Artist",
          } as Song;
        case "video":
          return {
            ...baseItem,
            title: item.title,
            artist: item.authors?.[0]?.name ?? "Unknown Artist",
          } as Video;
        case "album":
          return {
            ...baseItem,
            title: item.title,
            artist: item.author?.name ?? "Unknown Artist",
            year: item.year ?? "",
          } as Album;
        case "artist":
          return {
            ...baseItem,
            name: item.name,
            subtitle: item.subtitle?.text,
          } as Artist;
        default:
          return null;
      }
    })
    .filter((item): item is Song | Video | Album | Artist => item !== null);
}

export function processSearchPageData(searchResultsAll: any): SearchPageData {
  const topResultSection = searchResultsAll.contents.find(
    (c: any) => c?.type === "MusicCardShelf",
  );

  let topResult: TopResult | null = null;
  if (topResultSection) {
    topResult = {
      type: topResultSection.title?.text?.toLowerCase().includes("radio")
        ? "radio"
        : topResultSection.subtitle?.runs?.[0]?.text?.toLowerCase() ||
          "unknown",
      id:
        topResultSection.title.endpoint.payload.browseId ||
        topResultSection.title.endpoint.payload.videoId,
      title: topResultSection.title.text,
      thumbnail:
        topResultSection.thumbnail.contents[0]?.url ?? unknownTrackImageUri,
      subtitle: topResultSection.subtitle.text,
      artist: topResultSection.subtitle?.runs?.[2]?.text ?? "Unknown Artist",
    };
  }

  const results = searchResultsAll.contents.find(
    (c: any) => c?.type === "MusicShelf",
  );

  return {
    topResult,
    songs: processItems(
      results.contents.filter((c: any) => c?.item_type === "song") || [],
      "song",
    ),
    videos: processItems(
      results.contents.filter((c: any) => c?.item_type === "video") || [],
      "video",
    ),
    albums: processItems(
      searchResultsAll.contents[1]?.contents.filter(
        (c: any) => c?.item_type === "album",
      ) || [],
      "album",
    ),
    artists: processItems(
      results.contents.filter((c: any) => c?.item_type === "artist") || [],
      "artist",
    ),
  };
}

export function processAlbumPageData(albumResponse: any): AlbumPageData {
  return {
    title: albumResponse?.header?.title?.text,
    subtitle: albumResponse?.header?.subtitle?.text,
    second_subtitle: albumResponse?.header?.second_subtitle?.text,
    thumbnail:
      albumResponse?.header?.thumbnail?.contents?.[0]?.url ??
      unknownTrackImageUri,
    songs:
      albumResponse?.contents
        ?.filter((item: any) => item?.id && item?.title)
        .map((song: any) => ({
          id: song?.id,
          title: song?.title,
          duration: song?.duration?.text,
        })) ?? [],
  };
}

export function processPlaylistPageData(
  playlistResponse: any,
): PlaylistPageData {
  return {
    title: playlistResponse?.header?.title?.text,
    subtitle: playlistResponse?.header?.subtitle?.text,
    second_subtitle: playlistResponse?.header?.second_subtitle?.text,
    thumbnail:
      playlistResponse?.header?.thumbnail?.contents?.[0]?.url ??
      unknownTrackImageUri,
    songs:
      playlistResponse?.contents
        ?.filter((item: any) => item?.id && item?.title)
        .map((song: any) => ({
          id: song?.id,
          title: song?.title,
          duration: song?.duration?.seconds,
          thumbnail:
            song?.thumbnail?.contents?.[0]?.url ?? unknownTrackImageUri,
          artist: song?.authors?.[0]?.name ?? "Unknown Artist",
        })) ?? [],
  };
}

function processArtistPageDataItem(
  items: any[],
  type: "album" | "video",
): ArtistPageItem[] {
  return items
    .filter((item) => item?.id && item.title?.text)
    .map((item) => {
      const baseItem: ArtistPageItem = {
        id: item.id,
        title: item.title.text,
        subtitle: item.subtitle?.text ?? "",
        thumbnail: item.thumbnail?.[0]?.url ?? unknownTrackImageUri,
      };

      if (type === "album") {
        baseItem.year = item.year ?? "";
      }

      return baseItem;
    });
}

export function processArtistPageData(artistPage: any): ArtistPageData {
  const findSection = (titles: string[]): any[] => {
    for (const title of titles) {
      const section = artistPage.sections.find(
        (s: any) => s.title?.text === title || s.header?.title?.text === title,
      );
      if (section?.contents) {
        return section.contents;
      }
    }
    return [];
  };

  return {
    title: artistPage.header?.title?.text,
    description: artistPage.header?.description?.text ?? "",
    thumbnail:
      artistPage.header?.thumbnail?.contents?.[0]?.url ??
      unknownTrackImageUri,
    albums: processArtistPageDataItem(findSection(["Albums"]), "album"),
    songs: processItems(findSection(["Top songs", "Songs"]), "song"),
    singlesAndEPs: processArtistPageDataItem(
      findSection(["Singles & EPs", "Singles and EPs"]),
      "album",
    ),
    videos: processArtistPageDataItem(findSection(["Videos"]), "video"),
  };
}
