import * as Haptics from 'expo-haptics';

/** Fire-and-forget haptic; silently no-ops on platforms without haptic support. */
export function haptic(
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light
): void {
  Haptics.impactAsync(style).catch(() => {});
}

export function hapticSuccess(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
