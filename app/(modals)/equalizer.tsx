/**
 * EQUALIZER MODAL — PROFESSIONAL DSP CONTROL SUITE
 * Mavin Engine Integration - Modular 3-Layer Audio Processing Platform
 * 
 * EXACT IMPLEMENTATION OF:
 * - PAGE 1: Main Graphic Equalizer (Frequency Layer)
 * - PAGE 2: Effects Processing (FX Layer)
 * - PAGE 3: Output & Spatial Control (Output Layer)
 * 
 * Studio Console Aesthetic | Neon Glow Accents | Real-time DSP
 * Top Routing Icons = DSP Layer Selectors (NOT navigation)
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  ScrollView,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  ActivityIndicator,
  ToastAndroid,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";
import {
  Ionicons,
  MaterialIcons,
  MaterialCommunityIcons,
  Feather,
} from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Image } from "@d11/react-native-fast-image";
import Slider from "@react-native-community/slider";

import { Colors } from "@/constants/Colors";
import { unknownTrackImageUri } from "@/constants/images";
import { triggerHaptic } from "@/helpers/haptics";
import { defaultStyles } from "@/styles";
import { moderateScale, verticalScale, scale } from "react-native-size-matters/extend";
import { ScaledSheet } from "react-native-size-matters/extend";

// ============================================================================
// MAVIN ENGINE INTEGRATIONS
// ============================================================================
import { useMavinEngine } from "@/services/mavin/engine/Engine";
import { 
  useAudioDSP,
  useEQSettings,
  useFXSettings,
  useSpatialSettings,
  usePresetManager,
  EQMode,
  ReverbType,
  DelayType,
  SpatialMode,
  type DSPPreset,
} from "@/services/mavin/audio/DSPEngine";
import { useActiveTrack } from "react-native-track-player";
import { errorFromUnknown, logError } from "@/services/mavin/core/errors";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ============================================================================
// DSP LAYER TYPES — EXACT 3-LAYER ARCHITECTURE
// ============================================================================

type DSPLayer = "frequency" | "effects" | "output";

// ============================================================================
// CONSTANTS — EXACT SPECIFICATION
// ============================================================================

const EQ_BANDS = [
  { id: "preamp", frequency: "PRE", defaultValue: 0, min: -12, max: 12, color: "#FFD700" },
  { id: "31", frequency: "31Hz", defaultValue: 0, min: -12, max: 12, color: "#4CAF50" },
  { id: "62", frequency: "62Hz", defaultValue: 0, min: -12, max: 12, color: "#4CAF50" },
  { id: "125", frequency: "125Hz", defaultValue: 0, min: -12, max: 12, color: "#4CAF50" },
  { id: "250", frequency: "250Hz", defaultValue: 0, min: -12, max: 12, color: "#4CAF50" },
  { id: "500", frequency: "500Hz", defaultValue: 0, min: -12, max: 12, color: "#4CAF50" },
  { id: "1k", frequency: "1kHz", defaultValue: 0, min: -12, max: 12, color: "#4CAF50" },
  { id: "2k", frequency: "2kHz", defaultValue: 0, min: -12, max: 12, color: "#4CAF50" },
];

const FX_PRESETS = [
  { id: "room", name: "Room", damp: 40, filter: 50, fade: 30, preDelay: 15, preDelayMix: 20, size: 30 },
  { id: "hall", name: "Hall", damp: 60, filter: 40, fade: 50, preDelay: 25, preDelayMix: 30, size: 70 },
  { id: "plate", name: "Plate", damp: 30, filter: 60, fade: 40, preDelay: 10, preDelayMix: 25, size: 40 },
  { id: "cathedral", name: "Cathedral", damp: 70, filter: 30, fade: 70, preDelay: 35, preDelayMix: 40, size: 90 },
  { id: "ambient", name: "Ambient", damp: 50, filter: 50, fade: 80, preDelay: 30, preDelayMix: 50, size: 80 },
];

const SPATIAL_PRESETS = [
  { id: "stereo", name: "Stereo", balance: 0, stereoExpand: 100, tempo: 1.0, volume: 80, mono: false },
  { id: "wide", name: "Wide", balance: 0, stereoExpand: 150, tempo: 1.0, volume: 82, mono: false },
  { id: "headphone", name: "Headphone", balance: 0, stereoExpand: 90, tempo: 1.0, volume: 75, mono: false },
  { id: "car", name: "Car", balance: 0, stereoExpand: 70, tempo: 1.0, volume: 85, mono: false },
  { id: "night", name: "Night", balance: 0, stereoExpand: 60, tempo: 1.0, volume: 50, mono: false },
  { id: "mono", name: "Mono", balance: 0, stereoExpand: 0, tempo: 1.0, volume: 80, mono: true },
];

// ============================================================================
// COMPONENT: TOP ROUTING ICON BAR — PERSISTENT ON ALL PAGES
// EXACT SPECIFICATION: 3 routing icons, DSP layer selectors, neon glow on active
// ============================================================================

interface RoutingIconBarProps {
  activeLayer: DSPLayer;
  onLayerChange: (layer: DSPLayer) => void;
}

const RoutingIconBar: React.FC<RoutingIconBarProps> = ({
  activeLayer,
  onLayerChange,
}) => {
  const { top } = useSafeAreaInsets();

  return (
    <View style={[styles.routingBarContainer, { paddingTop: top + verticalScale(12) }]}>
      <View style={styles.routingBar}>
        {/* Icon 1: Equalizer Icon — Routes to Main Graphic Equalizer Page (Frequency Layer) */}
        <TouchableOpacity
          style={[
            styles.routingIcon,
            activeLayer === "frequency" && styles.routingIconActive,
          ]}
          onPress={() => {
            triggerHaptic("light");
            onLayerChange("frequency");
          }}
        >
          <View style={styles.iconContainer}>
            <View style={styles.eqIcon}>
              <View style={[styles.eqBar, { height: verticalScale(12) }]} />
              <View style={[styles.eqBar, { height: verticalScale(20) }]} />
              <View style={[styles.eqBar, { height: verticalScale(28) }]} />
              <View style={[styles.eqBar, { height: verticalScale(16) }]} />
              <View style={[styles.eqBar, { height: verticalScale(24) }]} />
            </View>
          </View>
          {activeLayer === "frequency" && <View style={styles.activeGlow} />}
        </TouchableOpacity>

        {/* Icon 2: Dial/Knob Icon — Routes to Effects Processing Page (FX Layer) */}
        <TouchableOpacity
          style={[
            styles.routingIcon,
            activeLayer === "effects" && styles.routingIconActive,
          ]}
          onPress={() => {
            triggerHaptic("light");
            onLayerChange("effects");
          }}
        >
          <View style={styles.iconContainer}>
            <View style={styles.knobIcon}>
              <View style={styles.knobIconOuter} />
              <View style={styles.knobIconInner} />
              <View style={styles.knobIconIndicator} />
            </View>
          </View>
          {activeLayer === "effects" && <View style={[styles.activeGlow, { backgroundColor: "#B388FF" }]} />}
        </TouchableOpacity>

        {/* Icon 3: Camera/Control Icon — Routes to Output & Spatial Control Page (Output Layer) */}
        <TouchableOpacity
          style={[
            styles.routingIcon,
            activeLayer === "output" && styles.routingIconActive,
          ]}
          onPress={() => {
            triggerHaptic("light");
            onLayerChange("output");
          }}
        >
          <View style={styles.iconContainer}>
            <View style={styles.spatialIcon}>
              <View style={styles.spatialIconLeft} />
              <View style={styles.spatialIconRight} />
              <View style={styles.spatialIconCenter} />
            </View>
          </View>
          {activeLayer === "output" && <View style={[styles.activeGlow, { backgroundColor: "#FFB74D" }]} />}
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ============================================================================
// COMPONENT: VERTICAL SLIDER — EXACT SPECIFICATION
// Vertical rail, floating thumb, active signal glow bar, frequency label, gain label
// ============================================================================

interface VerticalSliderProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  frequency: string;
  color: string;
  isPreamp?: boolean;
}

const VerticalSlider: React.FC<VerticalSliderProps> = ({
  value,
  min,
  max,
  onChange,
  frequency,
  color,
  isPreamp = false,
}) => {
  const [sliderHeight, setSliderHeight] = useState(0);
  const sliderValue = useSharedValue(value);
  const isDragging = useSharedValue(false);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      isDragging.value = true;
      triggerHaptic("selection");
    },
    onPanResponderMove: (event: GestureResponderEvent) => {
      if (sliderHeight > 0) {
        const touchY = event.nativeEvent.pageY;
        const position = touchY - (event.currentTarget as any)._nativeTag?.measure?.y || 0;
        const percentage = 1 - Math.max(0, Math.min(1, position / sliderHeight));
        const newValue = min + percentage * (max - min);
        const roundedValue = Math.round(newValue * 10) / 10;
        sliderValue.value = roundedValue;
        runOnJS(onChange)(roundedValue);
      }
    },
    onPanResponderEnd: () => {
      isDragging.value = false;
      triggerHaptic("light");
    },
  });

  const animatedFillStyle = useAnimatedStyle(() => {
    const percentage = (sliderValue.value - min) / (max - min);
    return {
      height: withSpring(`${percentage * 100}%`, {
        damping: 15,
        stiffness: 150,
      }),
    };
  });

  const animatedGlowStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(isDragging.value ? 0.8 : 0.2, { duration: 100 }),
    };
  });

  return (
    <View style={[styles.verticalSliderContainer, isPreamp && styles.preampContainer]}>
      {/* Frequency Label */}
      <Text style={[styles.frequencyLabel, isPreamp && styles.preampLabel]}>
        {frequency}
      </Text>
      
      {/* Vertical Rail with Floating Thumb */}
      <View
        style={styles.sliderRailContainer}
        onLayout={(event) => setSliderHeight(event.nativeEvent.layout.height)}
        {...panResponder.panHandlers}
      >
        <View style={[styles.sliderRail, { backgroundColor: isPreamp ? "rgba(255,215,0,0.2)" : "rgba(76,175,80,0.2)" }]}>
          {/* Active Signal Glow Bar */}
          <Animated.View
            style={[
              styles.sliderFill,
              { backgroundColor: color },
              animatedFillStyle,
            ]}
          />
          <Animated.View
            style={[
              styles.sliderGlow,
              { backgroundColor: color },
              animatedGlowStyle,
            ]}
          />
        </View>
        
        {/* Floating Thumb */}
        <View
          style={[
            styles.sliderThumb,
            { 
              top: `${100 - ((sliderValue.value - min) / (max - min)) * 100}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>

      {/* Gain Value Label */}
      <Text style={[styles.gainLabel, isPreamp && styles.preampGainLabel]}>
        {sliderValue.value > 0 ? `+${sliderValue.value}` : sliderValue.value}dB
      </Text>
    </View>
  );
};

// ============================================================================
// COMPONENT: ROTARY KNOB — EXACT SPECIFICATION
// Circular rotary knob, neon arc indicator, percentage/value label, touch drag
// ============================================================================

interface RotaryKnobProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
  unit?: string;
  color?: string;
  size?: number;
  arcColor?: string;
}

const RotaryKnob: React.FC<RotaryKnobProps> = ({
  value,
  min,
  max,
  onChange,
  label,
  unit = "%",
  color = "#B388FF",
  arcColor = "#B388FF",
  size = moderateScale(70),
}) => {
  const knobValue = useSharedValue(value);
  const rotation = useSharedValue(interpolate(value, [min, max], [0, 270]));

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gestureState) => {
      const deltaY = gestureState.dy;
      const deltaValue = (deltaY / 100) * (max - min) * -1;
      let newValue = knobValue.value + deltaValue;
      newValue = Math.max(min, Math.min(max, newValue));
      
      knobValue.value = newValue;
      rotation.value = interpolate(newValue, [min, max], [0, 270]);
      runOnJS(onChange)(Math.round(newValue));
    },
    onPanResponderEnd: () => {
      triggerHaptic("light");
    },
  });

  const animatedKnobStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  const percentage = ((knobValue.value - min) / (max - min)) * 100;

  return (
    <View style={styles.knobContainer}>
      {/* Label */}
      <Text style={styles.knobLabel}>{label}</Text>
      
      {/* Circular Rotary Knob */}
      <View style={[styles.knobWrapper, { width: size, height: size }]} {...panResponder.panHandlers}>
        <View style={[styles.knobTrack, { width: size, height: size }]}>
          {/* Neon Arc Indicator */}
          <View style={[styles.knobArc, { 
            width: size, 
            height: size,
            borderColor: arcColor,
          }]} />
          
          {/* Indicator Line */}
          <Animated.View
            style={[
              styles.knobIndicator,
              animatedKnobStyle,
              { backgroundColor: color },
            ]}
          />
          
          {/* Center Cap */}
          <View style={styles.knobCenter}>
            <Text style={styles.knobValueText}>
              {knobValue.value}{unit}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

// ============================================================================
// COMPONENT: FREQUENCY RESPONSE GRAPH — EXACT SPECIFICATION
// Horizontal response curve, dynamic EQ shaping line, live DSP visualization
// ============================================================================

interface FrequencyResponseGraphProps {
  bands: { frequency: number; gain: number }[];
  preamp: number;
}

const FrequencyResponseGraph: React.FC<FrequencyResponseGraphProps> = ({ bands, preamp }) => {
  const canvasWidth = SCREEN_WIDTH - scale(80);
  const canvasHeight = verticalScale(80);

  // Generate response curve points
  const points = useMemo(() => {
    const frequencies = [31, 62, 125, 250, 500, 1000, 2000];
    return frequencies.map((freq, index) => {
      const band = bands.find(b => b.frequency === freq);
      const gain = band ? band.gain : 0;
      const x = (index / (frequencies.length - 1)) * canvasWidth;
      const y = canvasHeight / 2 - (gain + preamp) * (canvasHeight / 2 / 12);
      return { x, y: Math.max(0, Math.min(canvasHeight, y)) };
    });
  }, [bands, preamp, canvasWidth, canvasHeight]);

  return (
    <View style={styles.graphContainer}>
      {/* Graph Title */}
      <Text style={styles.graphTitle}>FREQUENCY RESPONSE</Text>
      
      {/* Graph Canvas */}
      <View style={[styles.graphCanvas, { width: canvasWidth, height: canvasHeight }]}>
        {/* Grid Lines */}
        {[-12, -6, 0, 6, 12].map((db, i) => (
          <View
            key={`grid-${i}`}
            style={[
              styles.graphGridLine,
              {
                top: canvasHeight / 2 - (db * (canvasHeight / 2 / 12)),
                width: canvasWidth,
              },
            ]}
          />
        ))}

        {/* Frequency Markers */}
        <View style={styles.frequencyMarkers}>
          <Text style={styles.freqMarker}>31Hz</Text>
          <Text style={styles.freqMarker}>62Hz</Text>
          <Text style={styles.freqMarker}>125Hz</Text>
          <Text style={styles.freqMarker}>250Hz</Text>
          <Text style={styles.freqMarker}>500Hz</Text>
          <Text style={styles.freqMarker}>1kHz</Text>
          <Text style={styles.freqMarker}>2kHz</Text>
        </View>

        {/* Dynamic EQ Shaping Line */}
        <View style={styles.curveContainer}>
          {points.map((point, index) => {
            if (index === points.length - 1) return null;
            const nextPoint = points[index + 1];
            
            const dx = nextPoint.x - point.x;
            const dy = nextPoint.y - point.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);

            return (
              <View
                key={`curve-${index}`}
                style={[
                  styles.curveSegment,
                  {
                    left: point.x,
                    top: point.y,
                    width: length,
                    transform: [{ rotate: `${angle}deg` }],
                  },
                ]}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
};

// ============================================================================
// COMPONENT: NOW PLAYING STRIP — PERSISTENT ON ALL PAGES
// EXACT SPECIFICATION: Track name, artist name, play/pause, progress bar
// ============================================================================

interface NowPlayingStripProps {
  track: any;
  isPlaying: boolean;
  onPlayPause: () => void;
  progress: number;
  duration: number;
}

const NowPlayingStrip: React.FC<NowPlayingStripProps> = ({
  track,
  isPlaying,
  onPlayPause,
  progress,
  duration,
}) => {
  const progressPercentage = (progress / duration) * 100 || 0;

  return (
    <BlurView intensity={80} tint="dark" style={styles.nowPlayingStrip}>
      <View style={styles.nowPlayingContent}>
        {/* Artwork */}
        <FastImage
          source={{ uri: track?.artwork ?? unknownTrackImageUri }}
          style={styles.nowPlayingArtwork}
        />
        
        {/* Track Info */}
        <View style={styles.nowPlayingInfo}>
          <Text style={styles.nowPlayingTitle} numberOfLines={1}>
            {track?.title ?? "Unknown Track"}
          </Text>
          <Text style={styles.nowPlayingArtist} numberOfLines={1}>
            {track?.artist ?? "Unknown Artist"}
          </Text>
        </View>
        
        {/* Play/Pause */}
        <TouchableOpacity style={styles.nowPlayingPlayButton} onPress={onPlayPause}>
          <Ionicons
            name={isPlaying ? "pause-circle" : "play-circle"}
            size={moderateScale(40)}
            color="#FFD700"
          />
        </TouchableOpacity>
      </View>
      
      {/* Progress Bar */}
      <View style={styles.nowPlayingProgressBar}>
        <View style={[styles.nowPlayingProgressFill, { width: `${progressPercentage}%` }]} />
      </View>
    </BlurView>
  );
};

// ============================================================================
// PAGE 1 — MAIN GRAPHIC EQUALIZER PAGE (FREQUENCY LAYER)
// EXACT SPECIFICATION: Multi-band Graphic EQ Panel, Frequency Response Graph,
// Mode Control Bar, Tone Module, Limiter Module
// ============================================================================

interface FrequencyLayerProps {
  eqBands: Record<string, number>;
  preamp: number;
  onBandChange: (bandId: string, value: number) => void;
  onPreampChange: (value: number) => void;
  onReset: () => void;
  onPresetSelect: (presetId: string) => void;
  bassValue: number;
  onBassChange: (value: number) => void;
  trebleValue: number;
  onTrebleChange: (value: number) => void;
  limiterThreshold: number;
  onLimiterChange: (value: number) => void;
  activeTrack: any;
  isPlaying: boolean;
  onPlayPause: () => void;
  progress: number;
  duration: number;
}

const FrequencyLayer: React.FC<FrequencyLayerProps> = ({
  eqBands,
  preamp,
  onBandChange,
  onPreampChange,
  onReset,
  onPresetSelect,
  bassValue,
  onBassChange,
  trebleValue,
  onTrebleChange,
  limiterThreshold,
  onLimiterChange,
  activeTrack,
  isPlaying,
  onPlayPause,
  progress,
  duration,
}) => {
  const [showPresets, setShowPresets] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const eqPresets = [
    { id: "flat", name: "Flat", icon: "circle-outline" },
    { id: "rock", name: "Rock", icon: "guitar-electric" },
    { id: "pop", name: "Pop", icon: "music-circle" },
    { id: "jazz", name: "Jazz", icon: "saxophone" },
    { id: "classical", name: "Classical", icon: "piano" },
    { id: "hiphop", name: "Hip Hop", icon: "music-box" },
  ];

  const bandArrayForGraph = useMemo(() => {
    return EQ_BANDS.filter(b => b.id !== "preamp").map(band => ({
      frequency: parseInt(band.frequency.replace('Hz', '').replace('k', '000')),
      gain: eqBands[band.id] || 0,
    }));
  }, [eqBands]);

  return (
    <View style={styles.layerContainer}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.layerContent}
      >
        {/* ZONE D — MODE CONTROL BAR */}
        <View style={styles.modeControlBar}>
          <View style={styles.modeButtons}>
            <TouchableOpacity style={[styles.modeButton, styles.modeButtonActive]}>
              <Text style={[styles.modeButtonText, styles.modeButtonTextActive]}>EQ</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.modeButton}
              onPress={() => setShowPresets(!showPresets)}
            >
              <Text style={styles.modeButtonText}>PRESET</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.modeButton}
              onPress={() => setShowMenu(!showMenu)}
            >
              <Text style={styles.modeButtonText}>MENU</Text>
            </TouchableOpacity>
          </View>

          {/* Preset Dropdown */}
          {showPresets && (
            <Animated.View 
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
              style={styles.presetDropdown}
            >
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {eqPresets.map((preset) => (
                  <TouchableOpacity
                    key={preset.id}
                    style={styles.presetItem}
                    onPress={() => {
                      triggerHaptic("light");
                      onPresetSelect(preset.id);
                      setShowPresets(false);
                      ToastAndroid.show(`${preset.name} preset loaded`, ToastAndroid.SHORT);
                    }}
                  >
                    <View style={styles.presetIcon}>
                      <MaterialCommunityIcons name={preset.icon} size={moderateScale(20)} color="#FFD700" />
                    </View>
                    <Text style={styles.presetName}>{preset.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Animated.View>
          )}

          {/* Menu Dropdown */}
          {showMenu && (
            <Animated.View 
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
              style={styles.menuDropdown}
            >
              <TouchableOpacity style={styles.menuItem} onPress={onReset}>
                <MaterialIcons name="refresh" size={moderateScale(18)} color="#fff" />
                <Text style={styles.menuItemText}>Reset EQ</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem}>
                <Feather name="save" size={moderateScale(18)} color="#fff" />
                <Text style={styles.menuItemText}>Save Preset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem}>
                <MaterialIcons name="settings" size={moderateScale(18)} color="#fff" />
                <Text style={styles.menuItemText}>EQ Settings</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>

        {/* ZONE B — MULTI-BAND GRAPHIC EQ PANEL */}
        <View style={styles.eqPanel}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.eqSlidersContainer}
          >
            {/* Preamp Column — Yellow Glow */}
            <VerticalSlider
              value={preamp}
              min={-12}
              max={12}
              onChange={onPreampChange}
              frequency="PRE"
              color="#FFD700"
              isPreamp
            />

            {/* Frequency Bands — Green Glow */}
            {EQ_BANDS.filter(b => b.id !== "preamp").map((band) => (
              <VerticalSlider
                key={band.id}
                value={eqBands[band.id] || 0}
                min={band.min}
                max={band.max}
                onChange={(value) => onBandChange(band.id, value)}
                frequency={band.frequency}
                color={band.color}
              />
            ))}
          </ScrollView>
        </View>

        {/* ZONE C — FREQUENCY RESPONSE GRAPH */}
        <FrequencyResponseGraph bands={bandArrayForGraph} preamp={preamp} />

        {/* ZONE E — TONE MODULE */}
        <View style={styles.toneModule}>
          <Text style={styles.toneModuleTitle}>TONE</Text>
          <View style={styles.toneControls}>
            {/* Bass Knob (Left) */}
            <View style={styles.toneControl}>
              <RotaryKnob
                value={bassValue}
                min={0}
                max={100}
                onChange={onBassChange}
                label="BASS"
                unit="%"
                color="#4CAF50"
                arcColor="#4CAF50"
                size={moderateScale(65)}
              />
            </View>
            
            {/* Treble Knob (Right) */}
            <View style={styles.toneControl}>
              <RotaryKnob
                value={trebleValue}
                min={0}
                max={100}
                onChange={onTrebleChange}
                label="TREBLE"
                unit="%"
                color="#4CAF50"
                arcColor="#4CAF50"
                size={moderateScale(65)}
              />
            </View>
          </View>
        </View>

        {/* ZONE F — LIMITER MODULE */}
        <View style={styles.limiterModule}>
          <View style={styles.limiterHeader}>
            <MaterialIcons name="security" size={moderateScale(18)} color="#FFD700" />
            <Text style={styles.limiterTitle}>DYNAMIC LIMITER</Text>
          </View>
          
          <View style={styles.limiterControl}>
            <Text style={styles.limiterLabel}>Threshold</Text>
            <View style={styles.limiterSliderContainer}>
              <Text style={styles.limiterMin}>-24dB</Text>
              <Slider
                style={styles.limiterSlider}
                minimumValue={-24}
                maximumValue={0}
                value={limiterThreshold}
                onValueChange={onLimiterChange}
                minimumTrackTintColor="#FFD700"
                maximumTrackTintColor="rgba(255,255,255,0.2)"
                thumbTintColor="#FFD700"
              />
              <Text style={styles.limiterMax}>0dB</Text>
            </View>
            <Text style={styles.limiterValue}>{limiterThreshold}dB</Text>
          </View>
          
          <Text style={styles.limiterDescription}>
            Prevents clipping and distortion • Output protection active
          </Text>
        </View>
      </ScrollView>

      {/* ZONE G — PLAYER STRIP (Persistent) */}
      <NowPlayingStrip
        track={activeTrack}
        isPlaying={isPlaying}
        onPlayPause={onPlayPause}
        progress={progress}
        duration={duration}
      />
    </View>
  );
};

// ============================================================================
// PAGE 2 — EFFECTS PROCESSING PAGE (FX LAYER)
// EXACT SPECIFICATION: FX Control Grid (2 Row × 3 Column), FX Mode Bar, Mix Control
// Controls: Damp, Filter, Fade, Pre-Delay, Pre-Delay Mix, Size
// ============================================================================

interface EffectsLayerProps {
  fxSettings: {
    damp: number;
    filter: number;
    fade: number;
    preDelay: number;
    preDelayMix: number;
    size: number;
    mix: number;
  };
  onDampChange: (value: number) => void;
  onFilterChange: (value: number) => void;
  onFadeChange: (value: number) => void;
  onPreDelayChange: (value: number) => void;
  onPreDelayMixChange: (value: number) => void;
  onSizeChange: (value: number) => void;
  onMixChange: (value: number) => void;
  onReverbSelect: () => void;
  onEchoSelect: () => void;
  onSavePreset: () => void;
  onReset: () => void;
  activeFXMode: "reverb" | "echo";
  onFXModeChange: (mode: "reverb" | "echo") => void;
  activeTrack: any;
  isPlaying: boolean;
  onPlayPause: () => void;
  progress: number;
  duration: number;
}

const EffectsLayer: React.FC<EffectsLayerProps> = ({
  fxSettings,
  onDampChange,
  onFilterChange,
  onFadeChange,
  onPreDelayChange,
  onPreDelayMixChange,
  onSizeChange,
  onMixChange,
  onReverbSelect,
  onEchoSelect,
  onSavePreset,
  onReset,
  activeFXMode,
  onFXModeChange,
  activeTrack,
  isPlaying,
  onPlayPause,
  progress,
  duration,
}) => {
  const [showPresets, setShowPresets] = useState(false);

  return (
    <View style={styles.layerContainer}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.layerContent}
      >
        {/* ZONE C — FX MODE BAR */}
        <View style={styles.fxModeBar}>
          <View style={styles.fxModeButtons}>
            <TouchableOpacity
              style={[styles.fxModeButton, activeFXMode === "reverb" && styles.fxModeButtonActive]}
              onPress={() => {
                triggerHaptic("light");
                onFXModeChange("reverb");
              }}
            >
              <Text style={[styles.fxModeButtonText, activeFXMode === "reverb" && styles.fxModeButtonTextActive]}>
                REVERB
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.fxModeButton, activeFXMode === "echo" && styles.fxModeButtonActive]}
              onPress={() => {
                triggerHaptic("light");
                onFXModeChange("echo");
              }}
            >
              <Text style={[styles.fxModeButtonText, activeFXMode === "echo" && styles.fxModeButtonTextActive]}>
                ECHO
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.fxActionButtons}>
            <TouchableOpacity style={styles.fxActionButton} onPress={() => setShowPresets(!showPresets)}>
              <MaterialIcons name="library-music" size={moderateScale(18)} color="#fff" />
              <Text style={styles.fxActionButtonText}>Preset</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.fxActionButton} onPress={onSavePreset}>
              <Feather name="save" size={moderateScale(16)} color="#fff" />
              <Text style={styles.fxActionButtonText}>Save</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.fxActionButton} onPress={onReset}>
              <MaterialIcons name="refresh" size={moderateScale(18)} color="#fff" />
              <Text style={styles.fxActionButtonText}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Preset Dropdown */}
        {showPresets && (
          <Animated.View 
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={styles.fxPresetDropdown}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {FX_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.id}
                  style={styles.fxPresetItem}
                  onPress={() => {
                    triggerHaptic("light");
                    onDampChange(preset.damp);
                    onFilterChange(preset.filter);
                    onFadeChange(preset.fade);
                    onPreDelayChange(preset.preDelay);
                    onPreDelayMixChange(preset.preDelayMix);
                    onSizeChange(preset.size);
                    setShowPresets(false);
                    ToastAndroid.show(`${preset.name} preset loaded`, ToastAndroid.SHORT);
                  }}
                >
                  <Text style={styles.fxPresetName}>{preset.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* ZONE B — FX CONTROL GRID (2 ROW × 3 COLUMN) */}
        <View style={styles.fxControlGrid}>
          {/* TOP ROW CONTROLS */}
          <View style={styles.fxGridRow}>
            {/* 1. Damp */}
            <View style={styles.fxGridCell}>
              <RotaryKnob
                value={fxSettings.damp}
                min={0}
                max={100}
                onChange={onDampChange}
                label="DAMP"
                unit="%"
                color="#B388FF"
                arcColor="#B388FF"
                size={moderateScale(65)}
              />
              <Text style={styles.fxControlDesc}>High-frequency decay</Text>
            </View>

            {/* 2. Filter */}
            <View style={styles.fxGridCell}>
              <RotaryKnob
                value={fxSettings.filter}
                min={0}
                max={100}
                onChange={onFilterChange}
                label="FILTER"
                unit="%"
                color="#B388FF"
                arcColor="#B388FF"
                size={moderateScale(65)}
              />
              <Text style={styles.fxControlDesc}>Reverb tone filtering</Text>
            </View>

            {/* 3. Fade */}
            <View style={styles.fxGridCell}>
              <RotaryKnob
                value={fxSettings.fade}
                min={0}
                max={100}
                onChange={onFadeChange}
                label="FADE"
                unit="%"
                color="#B388FF"
                arcColor="#B388FF"
                size={moderateScale(65)}
              />
              <Text style={styles.fxControlDesc}>Echo decay time</Text>
            </View>
          </View>

          {/* BOTTOM ROW CONTROLS */}
          <View style={styles.fxGridRow}>
            {/* 4. Pre-Delay */}
            <View style={styles.fxGridCell}>
              <RotaryKnob
                value={fxSettings.preDelay}
                min={0}
                max={100}
                onChange={onPreDelayChange}
                label="PRE-DELAY"
                unit="ms"
                color="#B388FF"
                arcColor="#B388FF"
                size={moderateScale(65)}
              />
              <Text style={styles.fxControlDesc}>Time before onset</Text>
            </View>

            {/* 5. Pre-Delay Mix */}
            <View style={styles.fxGridCell}>
              <RotaryKnob
                value={fxSettings.preDelayMix}
                min={0}
                max={100}
                onChange={onPreDelayMixChange}
                label="PRE-DELAY MIX"
                unit="%"
                color="#B388FF"
                arcColor="#B388FF"
                size={moderateScale(65)}
              />
              <Text style={styles.fxControlDesc}>Early reflection blend</Text>
            </View>

            {/* 6. Size */}
            <View style={styles.fxGridCell}>
              <RotaryKnob
                value={fxSettings.size}
                min={0}
                max={100}
                onChange={onSizeChange}
                label="SIZE"
                unit="%"
                color="#B388FF"
                arcColor="#B388FF"
                size={moderateScale(65)}
              />
              <Text style={styles.fxControlDesc}>Virtual room size</Text>
            </View>
          </View>
        </View>

        {/* ZONE D — MIX CONTROL (Large central knob) */}
        <View style={styles.mixControlContainer}>
          <Text style={styles.mixControlTitle}>MASTER FX MIX</Text>
          <View style={styles.mixKnobWrapper}>
            <RotaryKnob
              value={fxSettings.mix}
              min={0}
              max={100}
              onChange={onMixChange}
              label="MIX"
              unit="%"
              color="#B388FF"
              arcColor="#B388FF"
              size={moderateScale(100)}
            />
          </View>
          <View style={styles.mixIndicator}>
            <Text style={styles.mixDryText}>Dry</Text>
            <View style={styles.mixBarContainer}>
              <View style={[styles.mixBarFill, { width: `${fxSettings.mix}%` }]} />
            </View>
            <Text style={styles.mixWetText}>Wet</Text>
          </View>
          <Text style={styles.mixValue}>{fxSettings.mix}% Wet</Text>
        </View>
      </ScrollView>

      {/* ZONE E — PLAYER STRIP (Persistent) */}
      <NowPlayingStrip
        track={activeTrack}
        isPlaying={isPlaying}
        onPlayPause={onPlayPause}
        progress={progress}
        duration={duration}
      />
    </View>
  );
};

// ============================================================================
// PAGE 3 — OUTPUT & SPATIAL CONTROL PAGE (OUTPUT LAYER)
// EXACT SPECIFICATION: Stereo Control Panel, Tempo Control, Mode Buttons, Master Volume
// Controls: Balance, Stereo Expand, Tempo (+/- buttons), Mono, Reset, Master Volume
// ============================================================================

interface OutputLayerProps {
  spatialSettings: {
    balance: number;
    stereoExpand: number;
    tempo: number;
    volume: number;
    isMono: boolean;
  };
  onBalanceChange: (value: number) => void;
  onStereoExpandChange: (value: number) => void;
  onTempoChange: (value: number) => void;
  onVolumeChange: (value: number) => void;
  onMonoToggle: () => void;
  onReset: () => void;
  onPresetSelect: (presetId: string) => void;
  activeTrack: any;
  isPlaying: boolean;
  onPlayPause: () => void;
  progress: number;
  duration: number;
}

const OutputLayer: React.FC<OutputLayerProps> = ({
  spatialSettings,
  onBalanceChange,
  onStereoExpandChange,
  onTempoChange,
  onVolumeChange,
  onMonoToggle,
  onReset,
  onPresetSelect,
  activeTrack,
  isPlaying,
  onPlayPause,
  progress,
  duration,
}) => {
  const [showPresets, setShowPresets] = useState(false);

  const formatTempo = (value: number) => {
    return `${(value * 100).toFixed(0)}%`;
  };

  return (
    <View style={styles.layerContainer}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.layerContent}
      >
        {/* Preset Bar */}
        <View style={styles.outputPresetBar}>
          <TouchableOpacity 
            style={styles.outputPresetButton}
            onPress={() => setShowPresets(!showPresets)}
          >
            <MaterialIcons name="library-music" size={moderateScale(18)} color="#FFB74D" />
            <Text style={styles.outputPresetButtonText}>SPATIAL PRESETS</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.outputResetButton} onPress={onReset}>
            <MaterialIcons name="refresh" size={moderateScale(18)} color="#fff" />
            <Text style={styles.outputResetButtonText}>RESET</Text>
          </TouchableOpacity>
        </View>

        {/* Preset Dropdown */}
        {showPresets && (
          <Animated.View 
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={styles.spatialPresetDropdown}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {SPATIAL_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.id}
                  style={[
                    styles.spatialPresetItem,
                    spatialSettings.isMono === preset.mono && 
                    spatialSettings.stereoExpand === preset.stereoExpand &&
                    styles.spatialPresetItemActive
                  ]}
                  onPress={() => {
                    triggerHaptic("light");
                    onPresetSelect(preset.id);
                    setShowPresets(false);
                  }}
                >
                  <Text style={styles.spatialPresetName}>{preset.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* ZONE B — STEREO CONTROL PANEL */}
        <View style={styles.stereoControlPanel}>
          <Text style={styles.stereoPanelTitle}>STEREO FIELD</Text>
          
          {/* Top Row: Balance & Stereo Expand */}
          <View style={styles.stereoControlRow}>
            {/* 1. Balance */}
            <View style={styles.stereoControlItem}>
              <Text style={styles.stereoControlLabel}>BALANCE</Text>
              <View style={styles.balanceControl}>
                <Text style={styles.balanceIndicator}>L</Text>
                <Slider
                  style={styles.balanceSlider}
                  minimumValue={-50}
                  maximumValue={50}
                  value={spatialSettings.balance}
                  onValueChange={onBalanceChange}
                  minimumTrackTintColor="#FFB74D"
                  maximumTrackTintColor="#FFB74D"
                  thumbTintColor="#FFB74D"
                />
                <Text style={styles.balanceIndicator}>R</Text>
              </View>
              <Text style={styles.stereoControlValue}>
                {spatialSettings.balance < 0 
                  ? `${Math.abs(spatialSettings.balance)}% L` 
                  : spatialSettings.balance > 0 
                    ? `${spatialSettings.balance}% R` 
                    : "Center"}
              </Text>
            </View>

            {/* 2. Stereo Expand */}
            <View style={styles.stereoControlItem}>
              <Text style={styles.stereoControlLabel}>STEREO EXPAND</Text>
              <View style={styles.expandControl}>
                <Slider
                  style={styles.expandSlider}
                  minimumValue={0}
                  maximumValue={200}
                  value={spatialSettings.stereoExpand}
                  onValueChange={onStereoExpandChange}
                  minimumTrackTintColor="#FFB74D"
                  maximumTrackTintColor="rgba(255,255,255,0.2)"
                  thumbTintColor="#FFB74D"
                />
              </View>
              <Text style={styles.stereoControlValue}>{spatialSettings.stereoExpand}%</Text>
            </View>
          </View>
        </View>

        {/* ZONE C — TEMPO CONTROL */}
        <View style={styles.tempoControlPanel}>
          <Text style={styles.tempoPanelTitle}>PLAYBACK TEMPO</Text>
          
          <View style={styles.tempoControl}>
            {/* Minus Button */}
            <TouchableOpacity
              style={styles.tempoButton}
              onPress={() => onTempoChange(Math.max(0.5, spatialSettings.tempo - 0.05))}
            >
              <MaterialIcons name="remove" size={moderateScale(24)} color="#fff" />
            </TouchableOpacity>

            {/* Center Large Knob */}
            <View style={styles.tempoKnobWrapper}>
              <RotaryKnob
                value={spatialSettings.tempo * 100}
                min={50}
                max={150}
                onChange={(val) => onTempoChange(val / 100)}
                label="TEMPO"
                unit="%"
                color="#FFB74D"
                arcColor="#FFB74D"
                size={moderateScale(90)}
              />
            </View>

            {/* Plus Button */}
            <TouchableOpacity
              style={styles.tempoButton}
              onPress={() => onTempoChange(Math.min(1.5, spatialSettings.tempo + 0.05))}
            >
              <MaterialIcons name="add" size={moderateScale(24)} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.tempoValue}>{formatTempo(spatialSettings.tempo)}</Text>
          <Text style={styles.tempoDescription}>
            {spatialSettings.tempo === 1.0 
              ? "Normal speed" 
              : spatialSettings.tempo < 1.0 
                ? "Slowed down (pitch corrected)" 
                : "Sped up (pitch corrected)"}
          </Text>
        </View>

        {/* ZONE D — MODE BUTTONS */}
        <View style={styles.modeButtonsPanel}>
          {/* Left: Mono */}
          <TouchableOpacity
            style={[styles.modeButton, spatialSettings.isMono && styles.modeButtonActive]}
            onPress={onMonoToggle}
          >
            <MaterialCommunityIcons 
              name={spatialSettings.isMono ? "speaker-off" : "speaker"} 
              size={moderateScale(20)} 
              color={spatialSettings.isMono ? "#FFB74D" : "#fff"} 
            />
            <Text style={[styles.modeButtonLabel, spatialSettings.isMono && styles.modeButtonLabelActive]}>
              {spatialSettings.isMono ? "MONO ON" : "MONO"}
            </Text>
          </TouchableOpacity>

          {/* Right: Reset */}
          <TouchableOpacity
            style={styles.modeButton}
            onPress={onReset}
          >
            <MaterialIcons name="refresh" size={moderateScale(20)} color="#fff" />
            <Text style={styles.modeButtonLabel}>RESET</Text>
          </TouchableOpacity>
        </View>

        {/* ZONE E — MASTER VOLUME MODULE */}
        <View style={styles.masterVolumeModule}>
          <View style={styles.masterVolumeHeader}>
            <MaterialIcons name="volume-up" size={moderateScale(24)} color="#FFB74D" />
            <Text style={styles.masterVolumeTitle}>MASTER VOLUME</Text>
          </View>
          
          {/* Large Bottom Knob — Neon Green Active Arc */}
          <View style={styles.masterVolumeKnobWrapper}>
            <RotaryKnob
              value={spatialSettings.volume}
              min={0}
              max={100}
              onChange={onVolumeChange}
              label="VOLUME"
              unit="%"
              color="#4CAF50"
              arcColor="#4CAF50"
              size={moderateScale(100)}
            />
          </View>
          
          <View style={styles.volumeLevelIndicator}>
            <View style={[styles.volumeLevelFill, { width: `${spatialSettings.volume}%` }]} />
          </View>
          
          <Text style={styles.volumeValue}>{spatialSettings.volume}%</Text>
        </View>
      </ScrollView>

      {/* ZONE F — PLAYER STRIP (Persistent) */}
      <NowPlayingStrip
        track={activeTrack}
        isPlaying={isPlaying}
        onPlayPause={onPlayPause}
        progress={progress}
        duration={duration}
      />
    </View>
  );
};

// ============================================================================
// MAIN EQUALIZER MODAL — DSP LAYER CONTROLLER
// Top icons perform DSP layer switching, preserve state between pages
// ============================================================================

export default function EqualizerModal() {
  const router = useRouter();
  const { currentTrack, isPlaying, togglePlay } = useMavinEngine();
  const activeTrack = useActiveTrack();
  
  // ============================================================================
  // DSP LAYER STATE — EXACT 3-LAYER ARCHITECTURE
  // ============================================================================
  const [activeLayer, setActiveLayer] = useState<DSPLayer>("frequency");
  
  // ============================================================================
  // DSP ENGINE STATE — PRESERVED BETWEEN LAYER SWITCHES
  // ============================================================================
  const {
    eqSettings,
    updateEQBand,
    updatePreamp,
    resetEQ,
    applyEQPreset,
  } = useEQSettings();

  const {
    fxSettings: engineFXSettings,
    updateFXParameter,
    resetFX,
    applyFXPreset,
  } = useFXSettings();

  const {
    spatialSettings: engineSpatialSettings,
    updateBalance,
    updateStereoWidth,
    updateTempo,
    updateVolume,
    toggleMono,
    resetSpatial,
    applySpatialPreset,
  } = useSpatialSettings();

  // ============================================================================
  // UI STATE FOR EACH LAYER
  // ============================================================================
  const [bassValue, setBassValue] = useState(50);
  const [trebleValue, setTrebleValue] = useState(50);
  const [limiterThreshold, setLimiterThreshold] = useState(-6);
  const [activeFXMode, setActiveFXMode] = useState<"reverb" | "echo">("reverb");
  
  // FX Settings State — Maps to exact specification
  const [fxSettings, setFxSettings] = useState({
    damp: 50,
    filter: 50,
    fade: 50,
    preDelay: 20,
    preDelayMix: 30,
    size: 50,
    mix: 30,
  });

  // Spatial Settings State — Maps to exact specification
  const [spatialSettings, setSpatialSettings] = useState({
    balance: 0,
    stereoExpand: 100,
    tempo: 1.0,
    volume: 80,
    isMono: false,
  });

  // ============================================================================
  // PLAYBACK PROGRESS
  // ============================================================================
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // ============================================================================
  // LAYER SWITCHING — NO AUDIO INTERRUPTION, STATE PRESERVED
  // ============================================================================
  const handleLayerChange = useCallback((layer: DSPLayer) => {
    triggerHaptic("light");
    setActiveLayer(layer);
    // DSP layer switching — UI remaps to different engine controls
    // No audio interruption, state preserved between pages
  }, []);

  // ============================================================================
  // FX HANDLERS
  // ============================================================================
  const handleDampChange = useCallback((value: number) => {
    setFxSettings(prev => ({ ...prev, damp: value }));
    updateFXParameter('damp', value);
  }, [updateFXParameter]);

  const handleFilterChange = useCallback((value: number) => {
    setFxSettings(prev => ({ ...prev, filter: value }));
    updateFXParameter('filter', value);
  }, [updateFXParameter]);

  const handleFadeChange = useCallback((value: number) => {
    setFxSettings(prev => ({ ...prev, fade: value }));
    updateFXParameter('fade', value);
  }, [updateFXParameter]);

  const handlePreDelayChange = useCallback((value: number) => {
    setFxSettings(prev => ({ ...prev, preDelay: value }));
    updateFXParameter('preDelay', value);
  }, [updateFXParameter]);

  const handlePreDelayMixChange = useCallback((value: number) => {
    setFxSettings(prev => ({ ...prev, preDelayMix: value }));
    updateFXParameter('preDelayMix', value);
  }, [updateFXParameter]);

  const handleSizeChange = useCallback((value: number) => {
    setFxSettings(prev => ({ ...prev, size: value }));
    updateFXParameter('size', value);
  }, [updateFXParameter]);

  const handleMixChange = useCallback((value: number) => {
    setFxSettings(prev => ({ ...prev, mix: value }));
    updateFXParameter('mix', value);
  }, [updateFXParameter]);

  const handleFXReset = useCallback(() => {
    setFxSettings({
      damp: 50,
      filter: 50,
      fade: 50,
      preDelay: 20,
      preDelayMix: 30,
      size: 50,
      mix: 30,
    });
    resetFX();
    ToastAndroid.show("FX settings reset", ToastAndroid.SHORT);
  }, [resetFX]);

  // ============================================================================
  // SPATIAL HANDLERS
  // ============================================================================
  const handleBalanceChange = useCallback((value: number) => {
    setSpatialSettings(prev => ({ ...prev, balance: value }));
    updateBalance(value);
  }, [updateBalance]);

  const handleStereoExpandChange = useCallback((value: number) => {
    setSpatialSettings(prev => ({ ...prev, stereoExpand: value }));
    updateStereoWidth(value);
  }, [updateStereoWidth]);

  const handleTempoChange = useCallback((value: number) => {
    setSpatialSettings(prev => ({ ...prev, tempo: value }));
    updateTempo(value);
  }, [updateTempo]);

  const handleVolumeChange = useCallback((value: number) => {
    setSpatialSettings(prev => ({ ...prev, volume: value }));
    updateVolume(value);
  }, [updateVolume]);

  const handleMonoToggle = useCallback(() => {
    setSpatialSettings(prev => ({ ...prev, isMono: !prev.isMono }));
    toggleMono();
    triggerHaptic("light");
  }, [toggleMono]);

  const handleSpatialReset = useCallback(() => {
    setSpatialSettings({
      balance: 0,
      stereoExpand: 100,
      tempo: 1.0,
      volume: 80,
      isMono: false,
    });
    resetSpatial();
    ToastAndroid.show("Spatial settings reset", ToastAndroid.SHORT);
  }, [resetSpatial]);

  const handleSpatialPresetSelect = useCallback((presetId: string) => {
    const preset = SPATIAL_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setSpatialSettings({
        balance: preset.balance,
        stereoExpand: preset.stereoExpand,
        tempo: preset.tempo,
        volume: preset.volume,
        isMono: preset.mono,
      });
      applySpatialPreset(presetId);
    }
  }, [applySpatialPreset]);

  // ============================================================================
  // RENDER DSP LAYER
  // ============================================================================
  const renderLayer = () => {
    switch (activeLayer) {
      case "frequency":
        return (
          <FrequencyLayer
            eqBands={eqSettings.bands}
            preamp={eqSettings.preamp}
            onBandChange={updateEQBand}
            onPreampChange={updatePreamp}
            onReset={resetEQ}
            onPresetSelect={applyEQPreset}
            bassValue={bassValue}
            onBassChange={setBassValue}
            trebleValue={trebleValue}
            onTrebleChange={setTrebleValue}
            limiterThreshold={limiterThreshold}
            onLimiterChange={setLimiterThreshold}
            activeTrack={activeTrack || currentTrack}
            isPlaying={isPlaying}
            onPlayPause={togglePlay}
            progress={progress}
            duration={duration}
          />
        );

      case "effects":
        return (
          <EffectsLayer
            fxSettings={fxSettings}
            onDampChange={handleDampChange}
            onFilterChange={handleFilterChange}
            onFadeChange={handleFadeChange}
            onPreDelayChange={handlePreDelayChange}
            onPreDelayMixChange={handlePreDelayMixChange}
            onSizeChange={handleSizeChange}
            onMixChange={handleMixChange}
            onReverbSelect={() => setActiveFXMode("reverb")}
            onEchoSelect={() => setActiveFXMode("echo")}
            onSavePreset={() => ToastAndroid.show("Preset saved", ToastAndroid.SHORT)}
            onReset={handleFXReset}
            activeFXMode={activeFXMode}
            onFXModeChange={setActiveFXMode}
            activeTrack={activeTrack || currentTrack}
            isPlaying={isPlaying}
            onPlayPause={togglePlay}
            progress={progress}
            duration={duration}
          />
        );

      case "output":
        return (
          <OutputLayer
            spatialSettings={spatialSettings}
            onBalanceChange={handleBalanceChange}
            onStereoExpandChange={handleStereoExpandChange}
            onTempoChange={handleTempoChange}
            onVolumeChange={handleVolumeChange}
            onMonoToggle={handleMonoToggle}
            onReset={handleSpatialReset}
            onPresetSelect={handleSpatialPresetSelect}
            activeTrack={activeTrack || currentTrack}
            isPlaying={isPlaying}
            onPlayPause={togglePlay}
            progress={progress}
            duration={duration}
          />
        );

      default:
        return null;
    }
  };

  return (
    <View style={[defaultStyles.container, styles.container]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* TOP ROUTING ICON BAR — PERSISTENT ON ALL PAGES */}
      <RoutingIconBar
        activeLayer={activeLayer}
        onLayerChange={handleLayerChange}
      />

      {/* ACTIVE DSP LAYER — FREQUENCY, EFFECTS, OR OUTPUT */}
      {renderLayer()}
    </View>
  );
}

// ============================================================================
// STYLES — PROFESSIONAL DSP CONSOLE AESTHETIC
// Dark matte background, neon glow accents, glassy overlays, studio-console
// ============================================================================

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  
  // ==========================================================================
  // TOP ROUTING ICON BAR
  // ==========================================================================
  routingBarContainer: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingBottom: '12@vs',
  },
  routingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: '16@s',
    gap: '32@s',
  },
  routingIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '56@s',
    height: '56@s',
    borderRadius: '28@s',
    position: 'relative',
  },
  routingIconActive: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  iconContainer: {
    width: '40@s',
    height: '40@s',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eqIcon: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: '4@s',
    height: '28@vs',
  },
  eqBar: {
    width: '4@s',
    backgroundColor: '#00E5FF',
    borderRadius: '2@s',
  },
  knobIcon: {
    width: '28@s',
    height: '28@s',
    borderRadius: '14@s',
    borderWidth: 2,
    borderColor: '#B388FF',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  knobIconOuter: {
    width: '24@s',
    height: '24@s',
    borderRadius: '12@s',
    borderWidth: 1,
    borderColor: 'rgba(179,136,255,0.5)',
  },
  knobIconInner: {
    width: '12@s',
    height: '12@s',
    borderRadius: '6@s',
    backgroundColor: '#B388FF',
  },
  knobIconIndicator: {
    position: 'absolute',
    top: -2,
    width: '4@s',
    height: '8@s',
    backgroundColor: '#B388FF',
    borderRadius: '2@s',
  },
  spatialIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: '4@s',
  },
  spatialIconLeft: {
    width: '10@s',
    height: '20@s',
    backgroundColor: '#FFB74D',
    borderRadius: '2@s',
    transform: [{ skewY: '-10deg' }],
  },
  spatialIconRight: {
    width: '10@s',
    height: '20@s',
    backgroundColor: '#FFB74D',
    borderRadius: '2@s',
    transform: [{ skewY: '10deg' }],
  },
  spatialIconCenter: {
    width: '8@s',
    height: '8@s',
    borderRadius: '4@s',
    backgroundColor: '#FFB74D',
    marginHorizontal: '2@s',
  },
  activeGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: '32@s',
    borderWidth: 2,
    borderColor: '#00E5FF',
    opacity: 0.6,
  },
  
  // ==========================================================================
  // LAYER CONTAINERS
  // ==========================================================================
  layerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  layerContent: {
    paddingBottom: '140@vs',
  },
  
  // ==========================================================================
  // FREQUENCY LAYER — PAGE 1
  // ==========================================================================
  modeControlBar: {
    paddingHorizontal: '20@s',
    paddingVertical: '16@vs',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    position: 'relative',
    zIndex: 100,
  },
  modeButtons: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: '20@ms',
    padding: '4@s',
  },
  modeButton: {
    flex: 1,
    paddingVertical: '8@vs',
    paddingHorizontal: '12@s',
    borderRadius: '16@ms',
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: 'rgba(0,229,255,0.15)',
  },
  modeButtonText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '12@ms',
    fontWeight: '600',
  },
  modeButtonTextActive: {
    color: '#00E5FF',
  },
  presetDropdown: {
    position: 'absolute',
    top: '70@vs',
    left: '20@s',
    right: '20@s',
    backgroundColor: '#1A1A1A',
    borderRadius: '12@ms',
    padding: '12@s',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 200,
  },
  presetItem: {
    alignItems: 'center',
    marginRight: '20@s',
    width: '60@s',
  },
  presetIcon: {
    width: '40@s',
    height: '40@s',
    borderRadius: '20@s',
    backgroundColor: 'rgba(255,215,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '4@vs',
  },
  presetName: {
    color: '#fff',
    fontSize: '11@ms',
  },
  menuDropdown: {
    position: 'absolute',
    top: '70@vs',
    right: '20@s',
    width: '180@s',
    backgroundColor: '#1A1A1A',
    borderRadius: '12@ms',
    padding: '8@s',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 200,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: '10@vs',
    paddingHorizontal: '12@s',
    gap: '12@s',
  },
  menuItemText: {
    color: '#fff',
    fontSize: '13@ms',
  },
  eqPanel: {
    marginTop: '20@vs',
    marginBottom: '24@vs',
  },
  eqSlidersContainer: {
    paddingHorizontal: '20@s',
    gap: '16@s',
  },
  verticalSliderContainer: {
    alignItems: 'center',
    width: '40@s',
  },
  preampContainer: {
    backgroundColor: 'rgba(255,215,0,0.05)',
    paddingHorizontal: '8@s',
    paddingVertical: '12@vs',
    borderRadius: '20@ms',
    marginRight: '8@s',
  },
  frequencyLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '11@ms',
    marginBottom: '8@vs',
  },
  preampLabel: {
    color: '#FFD700',
    fontWeight: '600',
  },
  sliderRailContainer: {
    height: '180@vs',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  sliderRail: {
    width: '6@s',
    height: '100%',
    borderRadius: '3@s',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  sliderFill: {
    width: '100%',
    borderRadius: '3@s',
  },
  sliderGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.2,
  },
  sliderThumb: {
    position: 'absolute',
    width: '16@s',
    height: '16@s',
    borderRadius: '8@s',
    backgroundColor: '#fff',
    left: '-5@s',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  gainLabel: {
    color: '#fff',
    fontSize: '11@ms',
    marginTop: '8@vs',
    fontWeight: '500',
  },
  preampGainLabel: {
    color: '#FFD700',
  },
  graphContainer: {
    marginTop: '16@vs',
    paddingHorizontal: '20@s',
  },
  graphTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: '12@ms',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: '12@vs',
  },
  graphCanvas: {
    position: 'relative',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: '8@ms',
    overflow: 'hidden',
  },
  graphGridLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  frequencyMarkers: {
    position: 'absolute',
    bottom: -20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: '4@s',
  },
  freqMarker: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: '9@ms',
  },
  curveContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  curveSegment: {
    position: 'absolute',
    height: 2,
    backgroundColor: '#00E5FF',
    transformOrigin: 'top left',
  },
  toneModule: {
    marginTop: '40@vs',
    paddingHorizontal: '20@s',
  },
  toneModuleTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: '13@ms',
    fontWeight: '600',
    marginBottom: '16@vs',
    letterSpacing: 1,
  },
  toneControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  toneControl: {
    alignItems: 'center',
  },
  limiterModule: {
    marginTop: '32@vs',
    marginHorizontal: '20@s',
    backgroundColor: 'rgba(255,215,0,0.05)',
    borderRadius: '16@ms',
    padding: '16@s',
  },
  limiterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: '8@s',
    marginBottom: '12@vs',
  },
  limiterTitle: {
    color: '#FFD700',
    fontSize: '13@ms',
    fontWeight: '600',
  },
  limiterControl: {
    marginBottom: '8@vs',
  },
  limiterLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '11@ms',
    marginBottom: '8@vs',
  },
  limiterSliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: '12@s',
  },
  limiterMin: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '11@ms',
  },
  limiterSlider: {
    flex: 1,
    height: '30@vs',
  },
  limiterMax: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '11@ms',
  },
  limiterValue: {
    color: '#FFD700',
    fontSize: '14@ms',
    fontWeight: '600',
    textAlign: 'right',
    marginTop: '4@vs',
  },
  limiterDescription: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '11@ms',
    marginTop: '8@vs',
  },
  
  // ==========================================================================
  // EFFECTS LAYER — PAGE 2
  // ==========================================================================
  fxModeBar: {
    paddingHorizontal: '20@s',
    paddingVertical: '16@vs',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fxModeButtons: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: '20@ms',
    padding: '4@s',
  },
  fxModeButton: {
    paddingVertical: '6@vs',
    paddingHorizontal: '16@s',
    borderRadius: '16@ms',
  },
  fxModeButtonActive: {
    backgroundColor: 'rgba(179,136,255,0.15)',
  },
  fxModeButtonText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '12@ms',
    fontWeight: '600',
  },
  fxModeButtonTextActive: {
    color: '#B388FF',
  },
  fxActionButtons: {
    flexDirection: 'row',
    gap: '12@s',
  },
  fxActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: '4@s',
    paddingVertical: '6@vs',
    paddingHorizontal: '12@s',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: '16@ms',
  },
  fxActionButtonText: {
    color: '#fff',
    fontSize: '11@ms',
  },
  fxPresetDropdown: {
    position: 'absolute',
    top: '80@vs',
    left: '20@s',
    right: '20@s',
    backgroundColor: '#1A1A1A',
    borderRadius: '12@ms',
    padding: '12@s',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 200,
  },
  fxPresetItem: {
    paddingHorizontal: '16@s',
    paddingVertical: '8@vs',
    backgroundColor: 'rgba(179,136,255,0.1)',
    borderRadius: '16@ms',
    marginRight: '12@s',
  },
  fxPresetName: {
    color: '#B388FF',
    fontSize: '12@ms',
    fontWeight: '500',
  },
  fxControlGrid: {
    paddingHorizontal: '20@s',
    marginTop: '24@vs',
  },
  fxGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: '24@vs',
  },
  fxGridCell: {
    flex: 1,
    alignItems: 'center',
  },
  fxControlDesc: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: '9@ms',
    marginTop: '4@vs',
    textAlign: 'center',
  },
  mixControlContainer: {
    alignItems: 'center',
    marginTop: '16@vs',
    marginBottom: '20@vs',
  },
  mixControlTitle: {
    color: '#B388FF',
    fontSize: '14@ms',
    fontWeight: '600',
    marginBottom: '16@vs',
  },
  mixKnobWrapper: {
    marginBottom: '16@vs',
  },
  mixIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '200@s',
    marginTop: '8@vs',
  },
  mixDryText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '11@ms',
    marginRight: '8@s',
  },
  mixBarContainer: {
    flex: 1,
    height: '4@vs',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: '2@vs',
    overflow: 'hidden',
  },
  mixBarFill: {
    height: '100%',
    backgroundColor: '#B388FF',
  },
  mixWetText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '11@ms',
    marginLeft: '8@s',
  },
  mixValue: {
    color: '#B388FF',
    fontSize: '16@ms',
    fontWeight: '600',
    marginTop: '8@vs',
  },
  
  // ==========================================================================
  // OUTPUT LAYER — PAGE 3
  // ==========================================================================
  outputPresetBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: '20@s',
    paddingVertical: '16@vs',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  outputPresetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: '8@s',
    paddingVertical: '8@vs',
    paddingHorizontal: '16@s',
    backgroundColor: 'rgba(255,183,77,0.1)',
    borderRadius: '20@ms',
  },
  outputPresetButtonText: {
    color: '#FFB74D',
    fontSize: '12@ms',
    fontWeight: '600',
  },
  outputResetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: '4@s',
    paddingVertical: '8@vs',
    paddingHorizontal: '16@s',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: '20@ms',
  },
  outputResetButtonText: {
    color: '#fff',
    fontSize: '12@ms',
  },
  spatialPresetDropdown: {
    position: 'absolute',
    top: '80@vs',
    left: '20@s',
    right: '20@s',
    backgroundColor: '#1A1A1A',
    borderRadius: '12@ms',
    padding: '12@s',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 200,
  },
  spatialPresetItem: {
    paddingHorizontal: '16@s',
    paddingVertical: '8@vs',
    backgroundColor: 'rgba(255,183,77,0.1)',
    borderRadius: '16@ms',
    marginRight: '12@s',
  },
  spatialPresetItemActive: {
    backgroundColor: 'rgba(255,183,77,0.2)',
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  spatialPresetName: {
    color: '#FFB74D',
    fontSize: '12@ms',
    fontWeight: '500',
  },
  stereoControlPanel: {
    paddingHorizontal: '20@s',
    marginTop: '24@vs',
  },
  stereoPanelTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: '13@ms',
    fontWeight: '600',
    marginBottom: '20@vs',
    letterSpacing: 1,
  },
  stereoControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: '20@s',
  },
  stereoControlItem: {
    flex: 1,
  },
  stereoControlLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '11@ms',
    marginBottom: '12@vs',
  },
  balanceControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: '12@s',
  },
  balanceIndicator: {
    color: '#FFB74D',
    fontSize: '14@ms',
    fontWeight: '600',
  },
  balanceSlider: {
    flex: 1,
    height: '30@vs',
  },
  expandControl: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expandSlider: {
    flex: 1,
    height: '30@vs',
  },
  stereoControlValue: {
    color: '#FFB74D',
    fontSize: '12@ms',
    marginTop: '8@vs',
    textAlign: 'center',
  },
  tempoControlPanel: {
    paddingHorizontal: '20@s',
    marginTop: '32@vs',
  },
  tempoPanelTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: '13@ms',
    fontWeight: '600',
    marginBottom: '20@vs',
    letterSpacing: 1,
  },
  tempoControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tempoButton: {
    width: '44@s',
    height: '44@s',
    borderRadius: '22@s',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tempoKnobWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tempoValue: {
    color: '#FFB74D',
    fontSize: '18@ms',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: '12@vs',
  },
  tempoDescription: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '12@ms',
    textAlign: 'center',
    marginTop: '4@vs',
  },
  modeButtonsPanel: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: '20@s',
    marginTop: '32@vs',
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: '8@s',
    paddingVertical: '10@vs',
    paddingHorizontal: '20@s',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: '20@ms',
  },
  modeButtonActive: {
    backgroundColor: 'rgba(255,183,77,0.1)',
  },
  modeButtonLabel: {
    color: '#fff',
    fontSize: '12@ms',
    fontWeight: '500',
  },
  modeButtonLabelActive: {
    color: '#FFB74D',
  },
  masterVolumeModule: {
    alignItems: 'center',
    marginTop: '32@vs',
    marginBottom: '20@vs',
  },
  masterVolumeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: '8@s',
    marginBottom: '20@vs',
  },
  masterVolumeTitle: {
    color: '#FFB74D',
    fontSize: '16@ms',
    fontWeight: '600',
  },
  masterVolumeKnobWrapper: {
    marginBottom: '16@vs',
  },
  volumeLevelIndicator: {
    width: '200@s',
    height: '6@vs',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: '3@vs',
    marginTop: '16@vs',
    overflow: 'hidden',
  },
  volumeLevelFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: '3@vs',
  },
  volumeValue: {
    color: '#4CAF50',
    fontSize: '20@ms',
    fontWeight: '700',
    marginTop: '8@vs',
  },
  
  // ==========================================================================
  // KNOB COMPONENT
  // ==========================================================================
  knobContainer: {
    alignItems: 'center',
  },
  knobLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '11@ms',
    marginBottom: '8@vs',
    fontWeight: '500',
  },
  knobWrapper: {
    position: 'relative',
    marginBottom: '4@vs',
  },
  knobTrack: {
    borderRadius: '999@s',
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  knobArc: {
    position: 'absolute',
    borderRadius: '999@s',
    borderWidth: 3,
    borderStyle: 'solid',
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    transform: [{ rotate: '45deg' }],
  },
  knobIndicator: {
    position: 'absolute',
    width: '4@s',
    height: '25%',
    backgroundColor: '#B388FF',
    top: '15%',
    borderRadius: '2@s',
  },
  knobCenter: {
    width: '50%',
    height: '50%',
    borderRadius: '999@s',
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  knobValueText: {
    color: '#fff',
    fontSize: '11@ms',
    fontWeight: '600',
  },
  
  // ==========================================================================
  // NOW PLAYING STRIP
  // ==========================================================================
  nowPlayingStrip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  nowPlayingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: '16@s',
    paddingVertical: '12@vs',
  },
  nowPlayingArtwork: {
    width: '40@s',
    height: '40@s',
    borderRadius: '8@ms',
    marginRight: '12@s',
  },
  nowPlayingInfo: {
    flex: 1,
  },
  nowPlayingTitle: {
    color: '#fff',
    fontSize: '14@ms',
    fontWeight: '500',
    marginBottom: '2@vs',
  },
  nowPlayingArtist: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '12@ms',
  },
  nowPlayingPlayButton: {
    marginLeft: '12@s',
  },
  nowPlayingProgressBar: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    width: '100%',
  },
  nowPlayingProgressFill: {
    height: '100%',
    backgroundColor: '#FFD700',
  },
});