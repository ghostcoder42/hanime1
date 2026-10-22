/** Non-interactive feedback overlays: center HUD, ripples, center play
 *  button, buffering spinner. */
import { Icon } from '@/components/icon';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Animated, { FadeIn, FadeOut, useAnimatedStyle } from 'react-native-reanimated';
import { ABS_FILL, HUD_BG, HUD_SEEK, HUD_SPEED, HUD_VOLUME } from './player-shared';

export interface PlayerHudProps {
  hudMode: number;
  hudText: string;
  ripple: { side: 1 | -1; key: number } | null;
  isPlaying: boolean;
  buffering: boolean;
  onPlay: () => void;
  hudOpacitySV: SharedValue<number>;
  hudLevelSV: SharedValue<number>;
}

export function PlayerHud({
  hudMode,
  hudText,
  ripple,
  isPlaying,
  buffering,
  onPlay,
  hudOpacitySV,
  hudLevelSV,
}: PlayerHudProps) {
  const hudStyle = useAnimatedStyle(() => ({ opacity: hudOpacitySV.value }));
  const hudBarStyle = useAnimatedStyle(() => ({ width: `${hudLevelSV.value * 100}%` }));

  return (
    <>
      {/* Center HUD (seek preview / volume / brightness / speed) */}
      <Animated.View
        pointerEvents="none"
        style={[ABS_FILL, hudStyle]}
        className="items-center justify-center"
      >
        <View
          className="min-w-28 items-center gap-2 rounded-2xl px-5 py-4"
          style={{ backgroundColor: HUD_BG }} // inline: NativeWind drops bg-*
        >
          {hudMode === HUD_SEEK ? (
            <Text className="text-lg font-semibold text-white tabular-nums">{hudText}</Text>
          ) : hudMode === HUD_SPEED ? (
            <View className="flex-row items-center gap-2">
              <Icon name="play-forward" size={22} color="#fb7185" />
              <Text className="text-lg font-semibold text-white">{hudText}</Text>
            </View>
          ) : (
            <>
              <View className="flex-row items-center gap-2">
                <Icon
                  name={hudMode === HUD_VOLUME ? 'volume-medium' : 'sunny'}
                  size={20}
                  color="white"
                />
                <Text className="text-base font-semibold text-white tabular-nums">{hudText}</Text>
              </View>
              <View className="h-1 w-40 overflow-hidden rounded-full bg-white/25">
                <Animated.View style={hudBarStyle} className="h-full rounded-full bg-white" />
              </View>
            </>
          )}
        </View>
      </Animated.View>

      {/* Double-tap seek ripples */}
      {ripple ? (
        <Animated.View
          key={ripple.key}
          entering={FadeIn.duration(120)}
          exiting={FadeOut.duration(450)}
          pointerEvents="none"
          className={`absolute top-1/2 -translate-y-1/2 ${
            ripple.side < 0 ? 'left-10' : 'right-10'
          }`}
        >
          <View className="flex-row items-center gap-1 rounded-full bg-black/60 px-4 py-2">
            {ripple.side < 0 ? (
              <>
                <Icon name="play-back" size={16} color="#fb7185" />
                <Text className="text-sm font-medium text-white">10s</Text>
              </>
            ) : (
              <>
                <Text className="text-sm font-medium text-white">10s</Text>
                <Icon name="play-forward" size={16} color="#fb7185" />
              </>
            )}
          </View>
        </Animated.View>
      ) : null}

      {/* Big center play button while paused */}
      {!isPlaying && !buffering ? (
        <View pointerEvents="box-none" className="absolute inset-0 items-center justify-center">
          <Pressable
            onPress={onPlay}
            className="rounded-full bg-black/45 p-4"
            hitSlop={12}
            accessibilityLabel="Play"
          >
            <Icon name="play" size={44} color="white" />
          </Pressable>
        </View>
      ) : null}

      {/* Buffering spinner */}
      {buffering ? (
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
          <ActivityIndicator size="large" color="#fb7185" />
        </View>
      ) : null}
    </>
  );
}
