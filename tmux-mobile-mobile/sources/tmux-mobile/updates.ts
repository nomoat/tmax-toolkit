import * as React from "react";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { otaUpdatePolicy } from "@/tmux-mobile/ota-update-policy";

const LAST_SEEN_RUNNING_UPDATE_KEY = "tmux-mobile.ota.last-seen-running-update";
const AUTO_CHECK_DELAY_MS = 2_000;
const FOREGROUND_CHECK_INTERVAL_MS = 15 * 60 * 1_000;
const TRANSIENT_NOTICE_MS = 8_000;

export type OtaUpdatePhase =
  | "disabled"
  | "idle"
  | "checking"
  | "downloading"
  | "ready"
  | "restarting"
  | "updated"
  | "error";

export type OtaUpdateNoticeTone = "info" | "success" | "warning" | "danger";
export type OtaUpdateNoticeAction = "apply" | "check";
export type OtaUpdateCheckSource = "manual" | "startup" | "foreground";

export type OtaUpdateNotice = {
  id: string;
  title: string;
  message: string;
  tone: OtaUpdateNoticeTone;
  action?: OtaUpdateNoticeAction;
  actionLabel?: string;
};

export type OtaUpdateInfo = {
  enabled: boolean;
  appVersion: string;
  nativeBuild: string;
  jsVersion: string;
  updateId: string | null;
  updateLabel: string;
  channel: string;
  runtimeVersion: string;
  createdAt: string;
  launchType: string;
  checkOnLaunch: string;
};

export type OtaUpdateController = {
  phase: OtaUpdatePhase;
  statusLabel: string;
  isBusy: boolean;
  isReady: boolean;
  applyLabel: string;
  notice: OtaUpdateNotice | null;
  info: OtaUpdateInfo;
  checkForUpdate: (source?: OtaUpdateCheckSource) => Promise<void>;
  applyUpdate: () => Promise<void>;
  dismissNotice: () => void;
};

type CurrentlyRunningInfo = ReturnType<typeof Updates.useUpdates>["currentlyRunning"];

function getExtraString(key: string): string | null {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const value = extra?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function getNativeBuild(): string {
  const platformConstants = Constants.platform as
    | { ios?: { buildNumber?: string | null }; android?: { versionCode?: number | null } }
    | undefined;
  if (Platform.OS === "ios") return platformConstants?.ios?.buildNumber || "unknown";
  if (Platform.OS === "android") return String(platformConstants?.android?.versionCode || "unknown");
  return "web";
}

function getRuntimeVersionFromConfig(): string | null {
  const value = Constants.expoConfig?.runtimeVersion;
  return typeof value === "string" ? value : null;
}

function shortUpdateId(value: string | null | undefined): string {
  if (!value) return "embedded";
  return value.slice(0, 8);
}

function formatDate(value: Date | null | undefined): string {
  if (!value) return "unknown";
  return value.toLocaleString();
}

function phaseLabel(phase: OtaUpdatePhase, enabled: boolean): string {
  if (!enabled) return __DEV__ ? "Updates disabled in development" : "Updates unavailable";
  switch (phase) {
    case "checking":
      return "Checking for update";
    case "downloading":
      return "Downloading update";
    case "ready":
      return "Update ready to apply";
    case "restarting":
      return "Applying update";
    case "updated":
      return "Updated";
    case "error":
      return "Update check failed";
    case "disabled":
      return "Updates disabled";
    case "idle":
    default:
      return "Up to date";
  }
}

function buildInfo(currentlyRunning: CurrentlyRunningInfo, enabled: boolean): OtaUpdateInfo {
  const updateId = currentlyRunning.updateId ?? Updates.updateId ?? null;
  const channel = currentlyRunning.channel ?? Updates.channel ?? "none";
  const runtimeVersion =
    currentlyRunning.runtimeVersion ?? Updates.runtimeVersion ?? getRuntimeVersionFromConfig() ?? "unknown";
  const createdAt = currentlyRunning.createdAt ?? Updates.createdAt ?? null;
  const jsVersion = getExtraString("jsVersion") ?? getExtraString("buildTime") ?? shortUpdateId(updateId);
  const checkOnLaunch = Updates.checkAutomatically ? String(Updates.checkAutomatically) : "unknown";

  return {
    enabled,
    appVersion: Constants.expoConfig?.version || "unknown",
    nativeBuild: getNativeBuild(),
    jsVersion,
    updateId,
    updateLabel: shortUpdateId(updateId),
    channel,
    runtimeVersion,
    createdAt: formatDate(createdAt),
    launchType: currentlyRunning.isEmbeddedLaunch || Updates.isEmbeddedLaunch ? "embedded" : "OTA",
    checkOnLaunch,
  };
}

export function useOtaUpdates(): OtaUpdateController {
  const updatesState = Updates.useUpdates();
  const policy = React.useMemo(
    () => otaUpdatePolicy(Platform.OS === "ios"),
    [],
  );
  const enabled = Platform.OS !== "web" && !__DEV__ && Updates.isEnabled;
  const [phase, setPhase] = React.useState<OtaUpdatePhase>(enabled ? "idle" : "disabled");
  const [notice, setNotice] = React.useState<OtaUpdateNotice | null>(null);
  const mountedRef = React.useRef(true);
  const checkInFlightRef = React.useRef(false);
  const lastAutomaticCheckAtRef = React.useRef(0);
  const readyNoticeShownRef = React.useRef(false);
  const pendingRef = React.useRef(updatesState.isUpdatePending);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    pendingRef.current = updatesState.isUpdatePending;
  }, [updatesState.isUpdatePending]);

  const info = React.useMemo(
    () => buildInfo(updatesState.currentlyRunning, enabled),
    [enabled, updatesState.currentlyRunning],
  );

  const showNotice = React.useCallback((nextNotice: OtaUpdateNotice) => {
    if (!mountedRef.current) return;
    setNotice(nextNotice);
  }, []);

  const dismissNotice = React.useCallback(() => {
    setNotice(null);
  }, []);

  const checkForUpdate = React.useCallback(
    async (source: OtaUpdateCheckSource = "manual") => {
      const manual = source === "manual";
      if (!enabled) {
        if (manual) {
          showNotice({
            id: `updates-disabled-${Date.now()}`,
            title: "Updates unavailable",
            message: __DEV__ ? "OTA updates are disabled in development builds." : "This build cannot use OTA updates.",
            tone: "warning",
          });
        }
        return;
      }
      if (checkInFlightRef.current) return;

      const now = Date.now();
      if (!manual && now - lastAutomaticCheckAtRef.current < FOREGROUND_CHECK_INTERVAL_MS) return;
      lastAutomaticCheckAtRef.current = now;
      checkInFlightRef.current = true;
      setPhase("checking");

      if (manual) {
        showNotice({
          id: `checking-${now}`,
          title: "Checking for update",
          message: "Looking for a production OTA bundle.",
          tone: "info",
        });
      }

      try {
        const check = await Updates.checkForUpdateAsync();
        if (!mountedRef.current) return;

        if (check.isAvailable || check.isRollBackToEmbedded) {
          setPhase("downloading");
          showNotice({
            id: `downloading-${Date.now()}`,
            title: "Downloading update",
            message: "The new JS bundle is being saved locally.",
            tone: "info",
          });

          const result = await Updates.fetchUpdateAsync();
          if (!mountedRef.current) return;

          if (result.isNew || result.isRollBackToEmbedded || pendingRef.current) {
            readyNoticeShownRef.current = true;
            setPhase("ready");
            showNotice({
              id: `ready-${Date.now()}`,
              title: policy.readyTitle,
              message: policy.readyMessage,
              tone: "success",
              action: "apply",
              actionLabel: policy.applyLabel,
            });
          } else {
            setPhase("idle");
            if (manual) {
              showNotice({
                id: `current-${Date.now()}`,
                title: "Already current",
                message: `JS ${info.jsVersion} is the latest available update for ${info.channel}.`,
                tone: "success",
              });
            }
          }
        } else {
          setPhase("idle");
          if (manual) {
            showNotice({
              id: `current-${Date.now()}`,
              title: "Already current",
              message: `JS ${info.jsVersion} is the latest available update for ${info.channel}.`,
              tone: "success",
            });
          }
        }
      } catch (error) {
        if (!mountedRef.current) return;
        setPhase("error");
        const message = error instanceof Error ? error.message : "Expo update check failed.";
        showNotice({
          id: `error-${Date.now()}`,
          title: "Update check failed",
          message,
          tone: "danger",
          action: "check",
          actionLabel: "Retry",
        });
      } finally {
        checkInFlightRef.current = false;
      }
    },
    [enabled, info.channel, info.jsVersion, policy, showNotice],
  );

  const applyUpdate = React.useCallback(async () => {
    if (!enabled) return;
    if (policy.applyMode === "cold-start") {
      setPhase("ready");
      setNotice({
        id: `cold-start-${Date.now()}`,
        title: policy.readyTitle,
        message: policy.readyMessage,
        tone: "info",
      });
      return;
    }
    setPhase("restarting");
    setNotice({
      id: `restarting-${Date.now()}`,
      title: "Applying update",
      message: "T-MAX will reload into the downloaded JS bundle.",
      tone: "info",
    });
    try {
      await Updates.reloadAsync();
    } catch (error) {
      if (!mountedRef.current) return;
      setPhase("error");
      const message = error instanceof Error ? error.message : "Could not restart the app.";
      setNotice({
        id: `restart-error-${Date.now()}`,
        title: "Could not apply update",
        message,
        tone: "danger",
        action: "apply",
        actionLabel: "Retry",
      });
    }
  }, [enabled, policy]);

  React.useEffect(() => {
    if (!enabled) {
      setPhase("disabled");
      return;
    }
    const timer = setTimeout(() => {
      checkForUpdate("startup").catch(() => {});
    }, AUTO_CHECK_DELAY_MS);

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        checkForUpdate("foreground").catch(() => {});
      }
    });

    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [checkForUpdate, enabled]);

  React.useEffect(() => {
    if (!enabled || !updatesState.isUpdatePending) return;
    setPhase("ready");
    if (readyNoticeShownRef.current) return;
    readyNoticeShownRef.current = true;
    showNotice({
      id: `ready-hook-${Date.now()}`,
      title: policy.readyTitle,
      message: policy.readyMessage,
      tone: "success",
      action: "apply",
      actionLabel: policy.applyLabel,
    });
  }, [enabled, policy, showNotice, updatesState.isUpdatePending]);

  React.useEffect(() => {
    if (!enabled || info.launchType !== "OTA" || !info.updateId) return;

    let cancelled = false;
    const runningUpdateId = info.updateId;
    AsyncStorage.getItem(LAST_SEEN_RUNNING_UPDATE_KEY)
      .then((lastSeen) => {
        if (cancelled || lastSeen === runningUpdateId) return;
        return AsyncStorage.setItem(LAST_SEEN_RUNNING_UPDATE_KEY, runningUpdateId).then(() => {
          if (cancelled || !mountedRef.current) return;
          setPhase("updated");
          showNotice({
            id: `updated-${runningUpdateId}`,
            title: "T-MAX updated",
            message: `Now running JS ${info.jsVersion} (${info.updateLabel}).`,
            tone: "success",
          });
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [enabled, info.jsVersion, info.launchType, info.updateId, info.updateLabel, showNotice]);

  React.useEffect(() => {
    if (!notice || notice.action) return;
    const timer = setTimeout(() => {
      setNotice((current) => (current?.id === notice.id ? null : current));
    }, TRANSIENT_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const isReady = updatesState.isUpdatePending || phase === "ready";
  const isBusy =
    phase === "checking" ||
    phase === "downloading" ||
    phase === "restarting" ||
    updatesState.isChecking ||
    updatesState.isDownloading ||
    updatesState.isRestarting;

  return {
    phase,
    statusLabel:
      phase === "ready" && enabled
        ? policy.readyStatusLabel
        : phaseLabel(phase, enabled),
    isBusy,
    isReady,
    applyLabel: policy.applyLabel,
    notice,
    info,
    checkForUpdate,
    applyUpdate,
    dismissNotice,
  };
}
