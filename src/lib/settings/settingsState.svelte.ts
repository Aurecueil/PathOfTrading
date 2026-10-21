export const settingsOverlay = $state({ open: false });

export function openSettings() {
  settingsOverlay.open = true;
}

export function closeSettings() {
  settingsOverlay.open = false;
}
