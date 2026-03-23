export type RosterUpdateReason =
  | "portal_sync_success"
  | "portal_sync_auto"
  | "manual_import"
  | "active_roster_changed";

const ROSTER_UPDATED_EVENT = "escalax:roster-updated";

type RosterUpdatedDetail = {
  userId: string;
  reason: RosterUpdateReason;
  at: string;
};

export function emitRosterUpdated(detail: RosterUpdatedDetail) {
  window.dispatchEvent(new CustomEvent<RosterUpdatedDetail>(ROSTER_UPDATED_EVENT, { detail }));
}

export function subscribeRosterUpdated(
  callback: (detail: RosterUpdatedDetail) => void
) {
  const handler = (event: Event) => {
    const custom = event as CustomEvent<RosterUpdatedDetail>;
    if (custom.detail) callback(custom.detail);
  };
  window.addEventListener(ROSTER_UPDATED_EVENT, handler as EventListener);
  return () => window.removeEventListener(ROSTER_UPDATED_EVENT, handler as EventListener);
}
