export const OPERATIONAL_PREFERENCES_CHANGED_EVENT = 'escalax:operational-preferences-changed';

export function dispatchOperationalPreferencesChanged(): void {
  window.dispatchEvent(new CustomEvent(OPERATIONAL_PREFERENCES_CHANGED_EVENT));
}
