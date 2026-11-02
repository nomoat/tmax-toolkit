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

/** Compact accordion cards are an iPhone-only presentation. */
export function shouldFoldSessionCards(platform: CardFoldingPlatform): boolean {
  return (
    platform.os === "ios" &&
    !platform.isPad &&
    !platform.isVision &&
    !platform.visionDeviceDetected
  );
}

/**
 * Recent cards use the full presentation because the same fourteen-hour activity
 * signal also gives them their emphasized timestamp. Only muted/stale iPhone
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
