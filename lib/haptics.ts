import * as Haptics from 'expo-haptics';

/** Light tap — for selections, toggles, pill taps */
export function hapticLight() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Medium tap — for confirming choices, Continue buttons */
export function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** Success — for onboarding done, completion moments */
export function hapticSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Selection changed — subtle tick for option switching */
export function hapticSelection() {
  Haptics.selectionAsync();
}
