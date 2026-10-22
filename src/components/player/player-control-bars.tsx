/**
 * Fullscreen top bar and bottom control bar. The absolute-fill containers
 * are box-none so their empty area never swallows video gestures (an
 * 'auto' container did exactly that, including the bars' own buttons).
 */
import { Icon } from '@/components/icon';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import type { EdgeInsets } from 'react-native-safe-area-context';
import { ABS_FILL, OVERLAY_BG, TIME_TEXT_STYLE, formatTime } from './player-shared';
import type { AnyGesture } from './use-player-gestures';

export interface ControlBarsProps {
  fullscreen: boolean;
  title?: string;
  controlsVisible: boolean;
  controlsOpacitySV: SharedValue<number>;
  isPlaying: boolean;
  /** Finger target while scrubbing (decoupled from the player position). */
  scrubDisplay: number | null;
  currentTime: number;
  duration: number;
  sliderSV: SharedValue<number>;
  sliderGesture: AnyGesture;
  insets: EdgeInsets;
  onTogglePlay: () => void;
  onToggleFullscreen: (next: boolean) => void;
}

export function PlayerTopBar({
  fullscreen,
  title,
  controlsVisible,
  controlsOpacitySV,
  insets,
  onExit,
}: Pick<
  ControlBarsProps,
  'fullscreen' | 'title' | 'controlsVisible' | 'controlsOpacitySV' | 'insets'
> & { onExit: () => void }) {
  const topBarStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacitySV.value,
    transform: [{ translateY: (1 - controlsOpacitySV.value) * -24 }],
  }));

  if (!fullscreen) return null;
  return (
    <Animated.View
      style={[ABS_FILL, { alignItems: 'flex-start' }, topBarStyle]}
      pointerEvents={controlsVisible ? 'box-none' : 'none'}
    >
      <View
        className="w-full flex-row items-center gap-2 px-2"
        style={{
          backgroundColor: OVERLAY_BG,
          paddingTop: Math.max(insets.top, 10),
          paddingBottom: 8,
        }}
      >
        <Pressable onPress={onExit} hitSlop={12} accessibilityLabel="Exit fullscreen">
          <Icon name="chevron-back" size={28} color="white" />
        </Pressable>
        <Text
          numberOfLines={1}
          className="flex-1 pr-2 text-sm text-white/90"
          style={TIME_TEXT_STYLE}
        >
          {title ?? ''}
        </Text>
      </View>
    </Animated.View>
  );
}

export function PlayerBottomBar({
  fullscreen,
  controlsVisible,
  controlsOpacitySV,
  isPlaying,
  scrubDisplay,
  currentTime,
  duration,
  sliderSV,
  sliderGesture,
  insets,
  onTrackLayout,
  onTogglePlay,
  onToggleFullscreen,
}: Omit<ControlBarsProps, 'title'> & {
  onTrackLayout: (e: LayoutChangeEvent) => void;
}) {
  const bottomBarStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacitySV.value,
    transform: [{ translateY: (1 - controlsOpacitySV.value) * 24 }],
  }));
  const sliderFillStyle = useAnimatedStyle(() => ({ width: `${sliderSV.value * 100}%` }));
  // Both centering translations inline: an inline transform replaces any
  // className transform (-translate-y would be dropped). 7 = half of 14dp.
  const sliderThumbStyle = useAnimatedStyle(() => ({
    left: `${sliderSV.value * 100}%`,
    top: '50%',
    transform: [{ translateX: -7 }, { translateY: -7 }],
  }));

  return (
    <Animated.View
      style={[ABS_FILL, { justifyContent: 'flex-end' }, bottomBarStyle]}
      pointerEvents={controlsVisible ? 'box-none' : 'none'}
    >
      <View
        className="w-full flex-row items-center px-2"
        style={{
          backgroundColor: OVERLAY_BG,
          paddingBottom: fullscreen ? Math.max(insets.bottom, 8) : 10,
          paddingTop: 6,
        }}
      >
        <Pressable onPress={onTogglePlay} hitSlop={12} accessibilityLabel="Play or pause">
          <Icon name={isPlaying ? 'pause' : 'play'} size={28} color="white" />
        </Pressable>
        <Text
          className="w-16 text-center text-xs font-medium text-white tabular-nums"
          style={TIME_TEXT_STYLE}
        >
          {formatTime(scrubDisplay ?? currentTime)}
        </Text>
        <GestureDetector gesture={sliderGesture}>
          <View
            className="mx-1 flex-1 justify-center"
            style={{ paddingVertical: 16 }}
            onLayout={onTrackLayout}
            collapsable={false}
          >
            <View className="relative h-1 w-full rounded-full bg-white/25">
              <Animated.View
                style={[sliderFillStyle, { position: 'absolute', left: 0, top: 0, bottom: 0 }]}
                className="rounded-full bg-rose-500"
              />
              <Animated.View
                style={sliderThumbStyle}
                className="absolute h-3.5 w-3.5 rounded-full bg-white"
              />
            </View>
          </View>
        </GestureDetector>
        <Text
          className="w-16 text-center text-xs font-medium text-white/80 tabular-nums"
          style={TIME_TEXT_STYLE}
        >
          {formatTime(duration)}
        </Text>
        <Pressable
          onPress={() => onToggleFullscreen(!fullscreen)}
          hitSlop={12}
          accessibilityLabel="Toggle fullscreen"
        >
          <Icon name={fullscreen ? 'contract' : 'expand'} size={24} color="white" />
        </Pressable>
      </View>
    </Animated.View>
  );
}
