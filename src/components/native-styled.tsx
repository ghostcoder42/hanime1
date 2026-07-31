import { Image, type ImageProps } from 'expo-image';
import { VideoView, type VideoViewProps } from 'expo-video';
import { styled } from 'nativewind';
import type { ComponentProps, FC } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

/**
 * NativeWind only applies `className` to react-native primitives (the
 * react-native-css import-rewrite targets `react-native`). Third-party
 * components need `styled()` to opt in. In this NativeWind v5 preview
 * `styled()` returns `any`, so each is cast back to its real prop type
 * (+ `className`) — third-party components keep full type-checking AND gain
 * NativeWind className support.
 */

type Styled<P> = FC<P & { className?: string }>;

export const FlexGestureHandlerRootView = styled(GestureHandlerRootView) as unknown as Styled<
  ComponentProps<typeof GestureHandlerRootView>
>;

export const StyledImage = styled(Image) as unknown as Styled<ImageProps>;

export const StyledVideoView = styled(VideoView) as unknown as Styled<VideoViewProps>;
