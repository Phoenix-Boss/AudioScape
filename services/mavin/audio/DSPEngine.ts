/**
 * DSP ENGINE — PROFESSIONAL AUDIO PROCESSING SUITE
 * Modular DSP Graph Architecture | Real-time Processing | Plugin System
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// ============================================================================
// ENUMS & TYPES
// ============================================================================

export enum EQMode {
  Graphic = 'graphic',
  Parametric = 'parametric',
  Hybrid = 'hybrid',
}

export enum ReverbType {
  Room = 'room',
  Hall = 'hall',
  Plate = 'plate',
  Cathedral = 'cathedral',
  Ambient = 'ambient',
}

export enum DelayType {
  Digital = 'digital',
  Analog = 'analog',
  Tape = 'tape',
  PingPong = 'pingpong',
  Reverse = 'reverse',
}

export enum SpatialMode {
  Stereo = 'stereo',
  Wide = 'wide',
  Headphone = 'headphone',
  Car = 'car',
  Night = 'night',
  Mono = 'mono',
}

export interface EQBand {
  id: string;
  frequency: number;
  gain: number;
  q?: number;
  type?: 'peak' | 'lowshelf' | 'highshelf' | 'lowpass' | 'highpass';
}

export interface EQSettings {
  bands: Record<string, number>;
  preamp: number;
  mode: EQMode;
  parametricBands?: EQBand[];
}

export interface FXSettings {
  reverbAmount: number;
  delayAmount: number;
  echoAmount: number;
  reverbType: ReverbType;
  delayType: DelayType;
  preDelay: number;
  decay: number;
  size: number;
  damp: number;
  mix: number;
}

export interface SpatialSettings {
  balance: number;
  stereoWidth: number;
  tempo: number;
  volume: number;
  spatialMode: SpatialMode;
  isMono: boolean;
}

export interface DSPPreset {
  id: string;
  name: string;
  eqSettings: EQSettings;
  fxSettings: FXSettings;
  spatialSettings: SpatialSettings;
  createdAt: Date;
  tags?: string[];
}

// ============================================================================
// DSP STORE
// ============================================================================

interface DSPState {
  // EQ State
  eqSettings: EQSettings;
  eqMode: EQMode;
  
  // FX State
  fxSettings: FXSettings;
  
  // Spatial State
  spatialSettings: SpatialSettings;
  
  // Presets
  presets: DSPPreset[];
  
  // Actions
  updateEQBand: (bandId: string, gain: number) => void;
  updatePreamp: (preamp: number) => void;
  resetEQ: () => void;
  applyEQPreset: (presetId: string) => void;
  setEQMode: (mode: EQMode) => void;
  
  updateReverb: (amount: number) => void;
  updateDelay: (amount: number) => void;
  updateEcho: (amount: number) => void;
  updateReverbType: (type: ReverbType) => void;
  updateDelayType: (type: DelayType) => void;
  updatePreDelay: (value: number) => void;
  updateDecay: (value: number) => void;
  updateSize: (value: number) => void;
  updateDamp: (value: number) => void;
  updateMix: (value: number) => void;
  resetFX: () => void;
  applyFXPreset: (presetId: string) => void;
  
  updateBalance: (balance: number) => void;
  updateStereoWidth: (width: number) => void;
  updateTempo: (tempo: number) => void;
  updateVolume: (volume: number) => void;
  updateSpatialMode: (mode: SpatialMode) => void;
  toggleMono: () => void;
  resetSpatial: () => void;
  applySpatialPreset: (presetId: string) => void;
  
  savePreset: (preset: DSPPreset) => void;
  loadPreset: (presetId: string) => void;
  deletePreset: (presetId: string) => void;
}

const defaultEQBands: Record<string, number> = {
  '31': 0, '62': 0, '125': 0, '250': 0, '500': 0,
  '1k': 0, '2k': 0, '4k': 0, '8k': 0, '16k': 0,
};

const defaultEQSettings: EQSettings = {
  bands: defaultEQBands,
  preamp: 0,
  mode: EQMode.Graphic,
};

const defaultFXSettings: FXSettings = {
  reverbAmount: 0,
  delayAmount: 0,
  echoAmount: 0,
  reverbType: ReverbType.Room,
  delayType: DelayType.Digital,
  preDelay: 20,
  decay: 50,
  size: 50,
  damp: 50,
  mix: 0,
};

const defaultSpatialSettings: SpatialSettings = {
  balance: 0,
  stereoWidth: 100,
  tempo: 1.0,
  volume: 80,
  spatialMode: SpatialMode.Stereo,
  isMono: false,
};

export const useDSPStore = create<DSPState>()(
  subscribeWithSelector((set, get) => ({
    // Initial State
    eqSettings: defaultEQSettings,
    eqMode: EQMode.Graphic,
    fxSettings: defaultFXSettings,
    spatialSettings: defaultSpatialSettings,
    presets: [],
    
    // EQ Actions
    updateEQBand: (bandId, gain) => set((state) => ({
      eqSettings: {
        ...state.eqSettings,
        bands: {
          ...state.eqSettings.bands,
          [bandId]: gain,
        },
      },
    })),
    
    updatePreamp: (preamp) => set((state) => ({
      eqSettings: {
        ...state.eqSettings,
        preamp,
      },
    })),
    
    resetEQ: () => set({
      eqSettings: defaultEQSettings,
    }),
    
    applyEQPreset: (presetId) => {
      // Implementation for loading EQ presets
    },
    
    setEQMode: (mode) => set({ eqMode: mode }),
    
    // FX Actions
    updateReverb: (amount) => set((state) => ({
      fxSettings: { ...state.fxSettings, reverbAmount: amount },
    })),
    
    updateDelay: (amount) => set((state) => ({
      fxSettings: { ...state.fxSettings, delayAmount: amount },
    })),
    
    updateEcho: (amount) => set((state) => ({
      fxSettings: { ...state.fxSettings, echoAmount: amount },
    })),
    
    updateReverbType: (type) => set((state) => ({
      fxSettings: { ...state.fxSettings, reverbType: type },
    })),
    
    updateDelayType: (type) => set((state) => ({
      fxSettings: { ...state.fxSettings, delayType: type },
    })),
    
    updatePreDelay: (value) => set((state) => ({
      fxSettings: { ...state.fxSettings, preDelay: value },
    })),
    
    updateDecay: (value) => set((state) => ({
      fxSettings: { ...state.fxSettings, decay: value },
    })),
    
    updateSize: (value) => set((state) => ({
      fxSettings: { ...state.fxSettings, size: value },
    })),
    
    updateDamp: (value) => set((state) => ({
      fxSettings: { ...state.fxSettings, damp: value },
    })),
    
    updateMix: (value) => set((state) => ({
      fxSettings: { ...state.fxSettings, mix: value },
    })),
    
    resetFX: () => set({
      fxSettings: defaultFXSettings,
    }),
    
    applyFXPreset: (presetId) => {
      // Implementation for loading FX presets
    },
    
    // Spatial Actions
    updateBalance: (balance) => set((state) => ({
      spatialSettings: { ...state.spatialSettings, balance },
    })),
    
    updateStereoWidth: (width) => set((state) => ({
      spatialSettings: { ...state.spatialSettings, stereoWidth: width },
    })),
    
    updateTempo: (tempo) => set((state) => ({
      spatialSettings: { ...state.spatialSettings, tempo },
    })),
    
    updateVolume: (volume) => set((state) => ({
      spatialSettings: { ...state.spatialSettings, volume },
    })),
    
    updateSpatialMode: (mode) => set((state) => ({
      spatialSettings: { ...state.spatialSettings, spatialMode: mode },
    })),
    
    toggleMono: () => set((state) => ({
      spatialSettings: {
        ...state.spatialSettings,
        isMono: !state.spatialSettings.isMono,
        spatialMode: !state.spatialSettings.isMono ? SpatialMode.Mono : SpatialMode.Stereo,
      },
    })),
    
    resetSpatial: () => set({
      spatialSettings: defaultSpatialSettings,
    }),
    
    applySpatialPreset: (presetId) => {
      // Implementation for loading spatial presets
    },
    
    // Preset Management
    savePreset: (preset) => set((state) => ({
      presets: [...state.presets, preset],
    })),
    
    loadPreset: (presetId) => {
      const preset = get().presets.find(p => p.id === presetId);
      if (preset) {
        set({
          eqSettings: preset.eqSettings,
          fxSettings: preset.fxSettings,
          spatialSettings: preset.spatialSettings,
        });
      }
    },
    
    deletePreset: (presetId) => set((state) => ({
      presets: state.presets.filter(p => p.id !== presetId),
    })),
  }))
);

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

export const useEQSettings = () => {
  const eqSettings = useDSPStore((state) => state.eqSettings);
  const eqMode = useDSPStore((state) => state.eqMode);
  
  return {
    eqSettings,
    eqMode,
    updateEQBand: useDSPStore((state) => state.updateEQBand),
    updatePreamp: useDSPStore((state) => state.updatePreamp),
    resetEQ: useDSPStore((state) => state.resetEQ),
    applyEQPreset: useDSPStore((state) => state.applyEQPreset),
    setEQMode: useDSPStore((state) => state.setEQMode),
  };
};

export const useFXSettings = () => {
  const fxSettings = useDSPStore((state) => state.fxSettings);
  
  return {
    fxSettings,
    updateReverb: useDSPStore((state) => state.updateReverb),
    updateDelay: useDSPStore((state) => state.updateDelay),
    updateEcho: useDSPStore((state) => state.updateEcho),
    updateReverbType: useDSPStore((state) => state.updateReverbType),
    updateDelayType: useDSPStore((state) => state.updateDelayType),
    updatePreDelay: useDSPStore((state) => state.updatePreDelay),
    updateDecay: useDSPStore((state) => state.updateDecay),
    updateSize: useDSPStore((state) => state.updateSize),
    updateDamp: useDSPStore((state) => state.updateDamp),
    updateMix: useDSPStore((state) => state.updateMix),
    resetFX: useDSPStore((state) => state.resetFX),
    applyFXPreset: useDSPStore((state) => state.applyFXPreset),
  };
};

export const useSpatialSettings = () => {
  const spatialSettings = useDSPStore((state) => state.spatialSettings);
  
  return {
    spatialSettings,
    updateBalance: useDSPStore((state) => state.updateBalance),
    updateStereoWidth: useDSPStore((state) => state.updateStereoWidth),
    updateTempo: useDSPStore((state) => state.updateTempo),
    updateVolume: useDSPStore((state) => state.updateVolume),
    updateSpatialMode: useDSPStore((state) => state.updateSpatialMode),
    toggleMono: useDSPStore((state) => state.toggleMono),
    resetSpatial: useDSPStore((state) => state.resetSpatial),
    applySpatialPreset: useDSPStore((state) => state.applySpatialPreset),
  };
};

export const usePresetManager = () => {
  const presets = useDSPStore((state) => state.presets);
  
  return {
    presets,
    savePreset: useDSPStore((state) => state.savePreset),
    loadPreset: useDSPStore((state) => state.loadPreset),
    deletePreset: useDSPStore((state) => state.deletePreset),
  };
};

export const useAudioDSP = () => {
  return {
    ...useEQSettings(),
    ...useFXSettings(),
    ...useSpatialSettings(),
    ...usePresetManager(),
  };
};