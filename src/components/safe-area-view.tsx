import { styled } from 'nativewind';
import {
  SafeAreaView as RNSafeAreaView,
  type SafeAreaViewProps,
} from 'react-native-safe-area-context';

/**
 * SafeAreaView that accepts NativeWind `className`.
 *
 * NativeWind v5 only applies `className` to react-native primitives (the
 * react-native-css import-rewrite targets `react-native`). Third-party
 * components — like react-native-safe-area-context's `SafeAreaView` — ignore
 * `className`, so `flex-1`/`bg-background` on them silently no-op and the
 * screen collapses to 0 height. Wrapping with `styled()` makes `className`
 * work. All props (including `edges`) are forwarded.
 */
export const SafeAreaView = styled(RNSafeAreaView);
export type { SafeAreaViewProps };
