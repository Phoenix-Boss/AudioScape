/**
 * MAVIN DOWNLOAD MANAGER — CLIENT-ONLY
 * Pure client-side download management
 * Local storage | Download queue | Progress tracking
 * No cloud sync | No analytics | No creator tools
 */

import { useState, useEffect, useCallback } from 'react';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { SecureStorage } from '../../storage/SecureStore';

// ============================================================================
// TYPES
// ============================================================================

export interface DownloadTask {
  id: string;
  songId: string;
  title: string;
  artist: string;
  thumbnail?: string | null;
  url?: string;
  fileUri?: string;
  progress: number;
  status: 'pending' | 'downloading' | 'completed' | 'paused' | 'failed';
  createdAt: number;
  completedAt?: number;
  fileSize?: number;
  error?: string;
}

export interface DownloadedSong {
  id: string;
  songId: string;
  title: string;
  artist: string;
  thumbnail?: string | null;
  fileUri: string;
  downloadedAt: number;
  fileSize?: number;
  duration?: number;
}

export interface DownloadOptions {
  quality?: 'low' | 'medium' | 'high';
  onProgress?: (progress: number) => void;
  onComplete?: (song: DownloadedSong) => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEYS = {
  DOWNLOADS: 'downloads_completed',
  TASKS: 'downloads_tasks',
  SETTINGS: 'downloads_settings',
};

const DOWNLOAD_DIRECTORY = FileSystem.documentDirectory + 'downloads/';
const MAX_CONCURRENT_DOWNLOADS = 2;
const DEFAULT_QUALITY = 'medium';

// Mock download URLs for demo
const MOCK_DOWNLOAD_URLS: Record<string, string> = {
  'default': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
};

// ============================================================================
// DOWNLOAD STORAGE
// ============================================================================

class DownloadStorage {
  private static instance: DownloadStorage;
  private downloadsCache: DownloadedSong[] | null = null;
  private tasksCache: DownloadTask[] | null = null;

  private constructor() {}

  static getInstance(): DownloadStorage {
    if (!DownloadStorage.instance) {
      DownloadStorage.instance = new DownloadStorage();
    }
    return DownloadStorage.instance;
  }

  // Get all completed downloads
  async getDownloads(): Promise<DownloadedSong[]> {
    try {
      if (this.downloadsCache) {
        return this.downloadsCache;
      }

      const stored = await SecureStorage.getItem<DownloadedSong[]>(STORAGE_KEYS.DOWNLOADS);
      const downloads = stored || [];
      
      // Sort by newest first
      const sorted = downloads.sort((a, b) => 
        b.downloadedAt - a.downloadedAt
      );
      
      this.downloadsCache = sorted;
      return sorted;
    } catch {
      return [];
    }
  }

  // Get download by song ID
  async getDownload(songId: string): Promise<DownloadedSong | null> {
    const downloads = await this.getDownloads();
    return downloads.find(d => d.songId === songId) || null;
  }

  // Add completed download
  async addDownload(song: DownloadedSong): Promise<void> {
    try {
      const downloads = await this.getDownloads();
      const existing = downloads.findIndex(d => d.songId === song.songId);
      
      if (existing >= 0) {
        downloads[existing] = song;
      } else {
        downloads.unshift(song);
      }
      
      await SecureStorage.setItem(STORAGE_KEYS.DOWNLOADS, downloads);
      this.downloadsCache = downloads;
    } catch {
      // Silent fail
    }
  }

  // Remove download
  async removeDownload(songId: string): Promise<boolean> {
    try {
      const downloads = await this.getDownloads();
      const song = downloads.find(d => d.songId === songId);
      
      if (song?.fileUri) {
        // Delete file from device
        await FileSystem.deleteAsync(song.fileUri, { idempotent: true });
      }
      
      const filtered = downloads.filter(d => d.songId !== songId);
      await SecureStorage.setItem(STORAGE_KEYS.DOWNLOADS, filtered);
      this.downloadsCache = filtered;
      
      return true;
    } catch {
      return false;
    }
  }

  // Get all download tasks
  async getTasks(): Promise<DownloadTask[]> {
    try {
      if (this.tasksCache) {
        return this.tasksCache;
      }

      const stored = await SecureStorage.getItem<DownloadTask[]>(STORAGE_KEYS.TASKS);
      const tasks = stored || [];
      
      this.tasksCache = tasks;
      return tasks;
    } catch {
      return [];
    }
  }

  // Save task
  async saveTask(task: DownloadTask): Promise<void> {
    try {
      const tasks = await this.getTasks();
      const index = tasks.findIndex(t => t.id === task.id);
      
      if (index >= 0) {
        tasks[index] = task;
      } else {
        tasks.push(task);
      }
      
      await SecureStorage.setItem(STORAGE_KEYS.TASKS, tasks);
      this.tasksCache = tasks;
    } catch {
      // Silent fail
    }
  }

  // Remove task
  async removeTask(taskId: string): Promise<void> {
    try {
      const tasks = await this.getTasks();
      const filtered = tasks.filter(t => t.id !== taskId);
      
      await SecureStorage.setItem(STORAGE_KEYS.TASKS, filtered);
      this.tasksCache = filtered;
    } catch {
      // Silent fail
    }
  }

  // Clear all downloads
  async clearAll(): Promise<void> {
    try {
      const downloads = await this.getDownloads();
      
      // Delete all files
      for (const download of downloads) {
        if (download.fileUri) {
          await FileSystem.deleteAsync(download.fileUri, { idempotent: true });
        }
      }
      
      await SecureStorage.removeItem(STORAGE_KEYS.DOWNLOADS);
      await SecureStorage.removeItem(STORAGE_KEYS.TASKS);
      await SecureStorage.removeItem(STORAGE_KEYS.SETTINGS);
      
      this.downloadsCache = null;
      this.tasksCache = null;
      
      // Delete download directory
      await FileSystem.deleteAsync(DOWNLOAD_DIRECTORY, { idempotent: true });
    } catch {
      // Silent fail
    }
  }

  // Get total storage size
  async getTotalSize(): Promise<number> {
    try {
      const downloads = await this.getDownloads();
      return downloads.reduce((total, song) => total + (song.fileSize || 0), 0);
    } catch {
      return 0;
    }
  }

  // Clear cache (for memory management)
  clearCache(): void {
    this.downloadsCache = null;
    this.tasksCache = null;
  }
}

// ============================================================================
// DOWNLOAD QUEUE MANAGER
// ============================================================================

class DownloadQueue {
  private static instance: DownloadQueue;
  private queue: DownloadTask[] = [];
  private activeDownloads: Map<string, { cancel: () => void }> = new Map();
  private listeners: Map<string, Function[]> = new Map();
  private storage: DownloadStorage;

  private constructor() {
    this.storage = DownloadStorage.getInstance();
  }

  static getInstance(): DownloadQueue {
    if (!DownloadQueue.instance) {
      DownloadQueue.instance = new DownloadQueue();
    }
    return DownloadQueue.instance;
  }

  // Add to queue
  async add(task: DownloadTask): Promise<void> {
    this.queue.push(task);
    this.emit('queueUpdated', this.queue);
    await this.processNext();
  }

  // Process next download
  private async processNext(): Promise<void> {
    if (this.activeDownloads.size >= MAX_CONCURRENT_DOWNLOADS) {
      return;
    }

    const nextTask = this.queue.find(t => t.status === 'pending');
    if (!nextTask) return;

    await this.startDownload(nextTask);
  }

  // Start download
  private async startDownload(task: DownloadTask): Promise<void> {
    try {
      // Update status
      task.status = 'downloading';
      await this.updateTask(task);

      // Ensure download directory exists
      await FileSystem.makeDirectoryAsync(DOWNLOAD_DIRECTORY, {
        intermediates: true,
      });

      // Generate file URI
      const fileUri = `${DOWNLOAD_DIRECTORY}${task.songId}_${Date.now()}.mp3`;
      task.fileUri = fileUri;

      // Mock download with progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 10;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          
          // Complete download
          this.completeDownload(task, fileUri, progress);
        } else {
          task.progress = Math.min(progress, 99);
          this.emit('progress', task);
          this.updateTask(task);
        }
      }, 300);

      // Store cancel function
      this.activeDownloads.set(task.id, {
        cancel: () => {
          clearInterval(interval);
          task.status = 'paused';
          task.progress = progress;
          this.updateTask(task);
          this.activeDownloads.delete(task.id);
          this.emit('paused', task);
        },
      });

    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Download failed';
      await this.updateTask(task);
      this.activeDownloads.delete(task.id);
      this.emit('error', task);
    }
  }

  // Complete download
  private async completeDownload(
    task: DownloadTask,
    fileUri: string,
    progress: number
  ): Promise<void> {
    try {
      task.status = 'completed';
      task.progress = 100;
      task.completedAt = Date.now();
      
      // Mock file size (5MB average)
      task.fileSize = 5 * 1024 * 1024;

      await this.updateTask(task);
      
      // Save to completed downloads - use Crypto.randomUUID()
      await this.storage.addDownload({
        id: Crypto.randomUUID(),
        songId: task.songId,
        title: task.title,
        artist: task.artist,
        thumbnail: task.thumbnail,
        fileUri: task.fileUri || fileUri,
        downloadedAt: Date.now(),
        fileSize: task.fileSize,
        duration: 180, // Mock 3 minutes
      });

      this.activeDownloads.delete(task.id);
      this.emit('completed', task);
      
      // Remove from queue
      this.queue = this.queue.filter(t => t.id !== task.id);
      await this.storage.removeTask(task.id);
      
      // Process next
      await this.processNext();

    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Save failed';
      await this.updateTask(task);
      this.activeDownloads.delete(task.id);
      this.emit('error', task);
    }
  }

  // Update task
  private async updateTask(task: DownloadTask): Promise<void> {
    await this.storage.saveTask(task);
    this.emit('taskUpdated', task);
  }

  // Pause download
  async pause(taskId: string): Promise<void> {
    const active = this.activeDownloads.get(taskId);
    if (active) {
      active.cancel();
      this.activeDownloads.delete(taskId);
    }
    
    const task = this.queue.find(t => t.id === taskId);
    if (task) {
      task.status = 'paused';
      await this.updateTask(task);
    }
  }

  // Resume download
  async resume(taskId: string): Promise<void> {
    const task = this.queue.find(t => t.id === taskId);
    if (task && task.status === 'paused') {
      task.status = 'pending';
      await this.updateTask(task);
      await this.processNext();
    }
  }

  // Cancel download
  async cancel(taskId: string): Promise<void> {
    const active = this.activeDownloads.get(taskId);
    if (active) {
      active.cancel();
      this.activeDownloads.delete(taskId);
    }
    
    this.queue = this.queue.filter(t => t.id !== taskId);
    
    await this.storage.removeTask(taskId);
    
    this.emit('queueUpdated', this.queue);
  }

  // Get queue
  getQueue(): DownloadTask[] {
    return [...this.queue];
  }

  // Get active downloads
  getActiveDownloads(): DownloadTask[] {
    return this.queue.filter(t => t.status === 'downloading');
  }

  // Event system
  on(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
    
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  private emit(event: string, ...args: any[]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(...args));
    }
  }
}

// ============================================================================
// HOOK: useDownloads
// ============================================================================

export const useDownloads = () => {
  const [downloads, setDownloads] = useState<DownloadedSong[]>([]);
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalSize, setTotalSize] = useState(0);
  const [activeDownloads, setActiveDownloads] = useState<DownloadTask[]>([]);

  const storage = DownloadStorage.getInstance();
  const queue = DownloadQueue.getInstance();

  // Load downloads on mount
  useEffect(() => {
    const loadDownloads = async () => {
      try {
        const [savedDownloads, savedTasks, size] = await Promise.all([
          storage.getDownloads(),
          storage.getTasks(),
          storage.getTotalSize(),
        ]);
        
        setDownloads(savedDownloads);
        setTasks(savedTasks);
        setTotalSize(size);
        
        // Restore queue from tasks
        const pendingTasks = savedTasks.filter(t => 
          t.status === 'pending' || t.status === 'downloading' || t.status === 'paused'
        );
        
        for (const task of pendingTasks) {
          if (task.status === 'downloading') {
            task.status = 'pending'; // Reset to pending
            await storage.saveTask(task);
          }
          queue.getQueue().push(task);
        }
        
      } catch (error) {
        console.error('Failed to load downloads:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDownloads();

    // Listen to queue events
    const unsubscribeCompleted = queue.on('completed', async (task: DownloadTask) => {
      const updatedDownloads = await storage.getDownloads();
      setDownloads(updatedDownloads);
      
      const size = await storage.getTotalSize();
      setTotalSize(size);
      
      setTasks(prev => prev.filter(t => t.id !== task.id));
      setActiveDownloads(queue.getActiveDownloads());
    });

    const unsubscribeProgress = queue.on('progress', (task: DownloadTask) => {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
      setActiveDownloads(queue.getActiveDownloads());
    });

    const unsubscribeQueueUpdated = queue.on('queueUpdated', () => {
      setActiveDownloads(queue.getActiveDownloads());
    });

    const unsubscribeTaskUpdated = queue.on('taskUpdated', (task: DownloadTask) => {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
    });

    return () => {
      unsubscribeCompleted();
      unsubscribeProgress();
      unsubscribeQueueUpdated();
      unsubscribeTaskUpdated();
    };
  }, []);

  // Download a song
  const downloadSong = useCallback(async (
    song: { id: string; title: string; artist: string; thumbnail?: string | null },
    options?: DownloadOptions
  ): Promise<DownloadTask> => {
    // Check if already downloaded
    const existing = await storage.getDownload(song.id);
    if (existing) {
      throw new Error('Song already downloaded');
    }

    // Check if already in queue
    const existingTask = tasks.find(t => 
      t.songId === song.id && 
      ['pending', 'downloading', 'paused'].includes(t.status)
    );
    
    if (existingTask) {
      return existingTask;
    }

    // Create new task with Crypto.randomUUID()
    const task: DownloadTask = {
      id: Crypto.randomUUID(),
      songId: song.id,
      title: song.title,
      artist: song.artist,
      thumbnail: song.thumbnail,
      progress: 0,
      status: 'pending',
      createdAt: Date.now(),
    };

    await storage.saveTask(task);
    setTasks(prev => [...prev, task]);
    
    // Add to queue
    await queue.add(task);
    
    return task;
  }, [tasks]);

  // Remove download
  const removeDownload = useCallback(async (songId: string): Promise<boolean> => {
    const success = await storage.removeDownload(songId);
    if (success) {
      const updatedDownloads = await storage.getDownloads();
      setDownloads(updatedDownloads);
      
      const size = await storage.getTotalSize();
      setTotalSize(size);
    }
    return success;
  }, []);

  // Pause download
  const pauseDownload = useCallback(async (taskId: string): Promise<void> => {
    await queue.pause(taskId);
  }, []);

  // Resume download
  const resumeDownload = useCallback(async (taskId: string): Promise<void> => {
    await queue.resume(taskId);
  }, []);

  // Cancel download
  const cancelDownload = useCallback(async (taskId: string): Promise<void> => {
    await queue.cancel(taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

  // Retry failed download
  const retryDownload = useCallback(async (taskId: string): Promise<void> => {
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status === 'failed') {
      task.status = 'pending';
      task.error = undefined;
      task.progress = 0;
      
      await storage.saveTask(task);
      setTasks(prev => prev.map(t => t.id === taskId ? task : t));
      await queue.add(task);
    }
  }, [tasks]);

  // Clear all downloads
  const clearAllDownloads = useCallback(async (): Promise<void> => {
    await storage.clearAll();
    setDownloads([]);
    setTasks([]);
    setTotalSize(0);
    storage.clearCache();
  }, []);

  // Check if song is downloaded
  const isDownloaded = useCallback((songId: string): boolean => {
    return downloads.some(d => d.songId === songId);
  }, [downloads]);

  // Check if song is downloading
  const isDownloading = useCallback((songId: string): boolean => {
    return tasks.some(t => 
      t.songId === songId && 
      ['pending', 'downloading'].includes(t.status)
    );
  }, [tasks]);

  // Get download progress
  const getDownloadProgress = useCallback((songId: string): number => {
    const task = tasks.find(t => t.songId === songId);
    return task?.progress || 0;
  }, [tasks]);

  // Get download task
  const getDownloadTask = useCallback((songId: string): DownloadTask | undefined => {
    return tasks.find(t => t.songId === songId);
  }, [tasks]);

  return {
    // State
    downloads,
    tasks,
    isLoading,
    totalSize,
    activeDownloads,
    
    // Actions
    downloadSong,
    removeDownload,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    retryDownload,
    clearAllDownloads,
    
    // Queries
    isDownloaded,
    isDownloading,
    getDownloadProgress,
    getDownloadTask,
  };
};

// ============================================================================
// HOOK: useDownloadQueue
// ============================================================================

export const useDownloadQueue = () => {
  const [queue, setQueue] = useState<DownloadTask[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  const queueInstance = DownloadQueue.getInstance();

  useEffect(() => {
    const updateQueue = () => {
      const tasks = queueInstance.getQueue();
      setQueue(tasks);
      setActiveCount(tasks.filter(t => t.status === 'downloading').length);
      setPendingCount(tasks.filter(t => t.status === 'pending').length);
    };

    updateQueue();

    const unsubscribe = queueInstance.on('queueUpdated', updateQueue);
    const unsubscribeProgress = queueInstance.on('progress', updateQueue);
    const unsubscribeCompleted = queueInstance.on('completed', updateQueue);

    return () => {
      unsubscribe();
      unsubscribeProgress();
      unsubscribeCompleted();
    };
  }, []);

  return {
    queue,
    activeCount,
    pendingCount,
    pauseDownload: queueInstance.pause.bind(queueInstance),
    resumeDownload: queueInstance.resume.bind(queueInstance),
    cancelDownload: queueInstance.cancel.bind(queueInstance),
  };
};

// ============================================================================
// HOOK: useDownloadSettings
// ============================================================================

export const useDownloadSettings = () => {
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>(DEFAULT_QUALITY);
  const [downloadOverCellular, setDownloadOverCellular] = useState(false);
  const [maxConcurrent, setMaxConcurrent] = useState(MAX_CONCURRENT_DOWNLOADS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const stored = await SecureStorage.getItem<{
          quality: 'low' | 'medium' | 'high';
          downloadOverCellular: boolean;
          maxConcurrent: number;
        }>(STORAGE_KEYS.SETTINGS);
        
        if (stored) {
          setQuality(stored.quality || DEFAULT_QUALITY);
          setDownloadOverCellular(stored.downloadOverCellular || false);
          setMaxConcurrent(stored.maxConcurrent || MAX_CONCURRENT_DOWNLOADS);
        }
      } catch {
        // Use defaults
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<{
    quality: 'low' | 'medium' | 'high';
    downloadOverCellular: boolean;
    maxConcurrent: number;
  }>) => {
    try {
      const settings = {
        quality,
        downloadOverCellular,
        maxConcurrent,
        ...newSettings,
      };

      await SecureStorage.setItem(STORAGE_KEYS.SETTINGS, settings);
      
      if (newSettings.quality !== undefined) setQuality(newSettings.quality);
      if (newSettings.downloadOverCellular !== undefined) setDownloadOverCellular(newSettings.downloadOverCellular);
      if (newSettings.maxConcurrent !== undefined) setMaxConcurrent(newSettings.maxConcurrent);
      
    } catch {
      // Silent fail
    }
  }, [quality, downloadOverCellular, maxConcurrent]);

  return {
    quality,
    downloadOverCellular,
    maxConcurrent,
    isLoading,
    updateSettings,
  };
};

// ============================================================================
// UTILITY: Format Bytes
// ============================================================================

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

// ============================================================================
// EXPORTS
// ============================================================================

const DownloadManager = {
  useDownloads,
  useDownloadQueue,
  useDownloadSettings,
  formatBytes,
};

export default DownloadManager;