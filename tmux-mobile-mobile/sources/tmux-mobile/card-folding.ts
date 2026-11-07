export type CardFoldingPlatform = {
  os: string;
  isPad?: boolean;
  isVision?: boolean;
  visionDeviceDetected?: boolean;
};

export type SessionCardFoldStateOptions = {
  foldSessionCards: boolean;
  recentActivity: boolean;
  manuallyExpanded: boolean;
};

/** Ordinary native clients share the same compact card presentation. */
export function shouldFoldSessionCards(platform: CardFoldingPlatform): boolean {
  return (
    (platform.os === "ios" || platform.os === "android") &&
    !platform.isPad &&
    !platform.isVision &&
    !platform.visionDeviceDetected
  );
}

/**
 * Recent cards use the full presentation because the same fourteen-hour activity
 * signal also gives them their emphasized timestamp. Only muted/stale native
 * cards participate in the compact accordion.
 */
export function sessionCardFoldState({
  foldSessionCards,
  recentActivity,
  manuallyExpanded,
}: SessionCardFoldStateOptions): {
  collapsible: boolean;
  expanded: boolean;
} {
  const collapsible = foldSessionCards && !recentActivity;
  return {
    collapsible,
    expanded: !collapsible || manuallyExpanded,
  };
}
