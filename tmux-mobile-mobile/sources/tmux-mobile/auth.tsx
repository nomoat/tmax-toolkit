import { migrateControllerSession } from "./controller-origin";
import * as React from "react";
import * as Clipboard from "expo-clipboard";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { ApiError, defaultControllerUrl, normalizeBaseUrl, TmuxMobileApi } from "./api";
import type { DeviceLoginStart, TmuxMobileSession } from "./types";

const SESSION_KEY = "tmux-mobile.session.v1";
const POLL_FLOOR_MS = 1000;

interface AuthState {
  loading: boolean;
  signingIn: boolean;
  session: TmuxMobileSession | null;
  challenge: DeviceLoginStart | null;
  codeCopied: boolean;
  error: string;
  baseUrl: string;
  setBaseUrl: (url: string) => void;
  signIn: (baseUrlOverride?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthState | null>(null);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function expiresAt(seconds = 0): string {
  return new Date(Date.now() + Math.max(seconds, 60) * 1000).toISOString();
}

function isExpired(session: TmuxMobileSession): boolean {
  return Date.parse(session.expiresAt) <= Date.now() + 60_000;
}

function userCodeFromUrl(url: string | undefined): string {
  if (!url) return "";
  const match = /[?&]user_code=([^&#]+)/.exec(url);
  if (!match?.[1]) return "";
  try {
    return decodeURIComponent(match[1].replace(/\+/g, " ")).trim();
  } catch {
    return match[1].trim();
  }
}

function userCodeForClipboard(start: DeviceLoginStart): string {
  return (
    start.userCode?.trim() ||
    userCodeFromUrl(start.verificationUrlComplete) ||
    userCodeFromUrl(start.verificationUrl) ||
    ""
  );
}

async function copyUserCode(start: DeviceLoginStart): Promise<boolean> {
  const userCode = userCodeForClipboard(start);
  if (!userCode) return false;
  try {
    await Clipboard.setStringAsync(userCode);
    return true;
  } catch {
    return false;
  }
}

async function loadStoredSession(): Promise<TmuxMobileSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TmuxMobileSession;
    if (!parsed.sessionToken || isExpired(parsed)) return null;
    const migrated = migrateControllerSession(parsed);
    if (migrated !== parsed) await saveSession(migrated).catch(() => {});
    return migrated;
  } catch {
    return null;
  }
}

async function saveSession(session: TmuxMobileSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export function TmuxMobileAuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = React.useState(true);
  const [signingIn, setSigningIn] = React.useState(false);
  const [session, setSession] = React.useState<TmuxMobileSession | null>(null);
  const [challenge, setChallenge] = React.useState<DeviceLoginStart | null>(null);
  const [codeCopied, setCodeCopied] = React.useState(false);
  const [error, setError] = React.useState("");
  const [baseUrl, setBaseUrlState] = React.useState(defaultControllerUrl());

  React.useEffect(() => {
    let mounted = true;
    loadStoredSession()
      .then((stored) => {
        if (!mounted) return;
        if (stored) {
          setSession(stored);
          setBaseUrlState(stored.baseUrl);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const setBaseUrl = React.useCallback((url: string) => {
    setBaseUrlState(normalizeBaseUrl(url));
  }, []);

  const signIn = React.useCallback(async (baseUrlOverride?: string) => {
    setSigningIn(true);
    setError("");
    setChallenge(null);
    setCodeCopied(false);
    try {
      const requestedBaseUrl = normalizeBaseUrl(baseUrlOverride || baseUrl);
      setBaseUrlState(requestedBaseUrl);
      const api = new TmuxMobileApi(requestedBaseUrl);
      const start = await api.startDeviceLogin();
      const copied = await copyUserCode(start);
      setCodeCopied(copied);
      setChallenge(start);

      const loginUrl = start.verificationUrlComplete || start.verificationUrl || "";
      if (loginUrl) {
        void WebBrowser.openBrowserAsync(loginUrl);
      }

      const expires = Date.now() + Math.max(Number(start.expiresIn || 600), 60) * 1000;
      let intervalMs = Math.max(Number(start.interval || 5) * 1000, POLL_FLOOR_MS);
      while (Date.now() < expires) {
        await sleep(intervalMs);
        const result = await api.pollDeviceLogin(start.id);
        if ((result as { pending?: boolean }).pending) {
          intervalMs = Math.max(
            Number((result as { interval?: number }).interval || start.interval || 5) * 1000,
            POLL_FLOOR_MS,
          );
          continue;
        }
        if (!result.sessionToken) {
          throw new Error("Device login succeeded but did not return a session token.");
        }
        const nextSession: TmuxMobileSession = {
          baseUrl: api.baseUrl,
          sessionToken: result.sessionToken,
          expiresAt: expiresAt(result.sessionExpiresIn || 0),
          user: result.user || {},
        };
        await saveSession(nextSession);
        setSession(nextSession);
        setChallenge(null);
        setCodeCopied(false);
        return;
      }
      throw new Error("Device login expired.");
    } catch (err) {
      const message = err instanceof ApiError || err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setSigningIn(false);
    }
  }, [baseUrl]);

  const signOut = React.useCallback(async () => {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    setSession(null);
    setChallenge(null);
    setCodeCopied(false);
    setError("");
  }, []);

  const value = React.useMemo<AuthState>(
    () => ({
      loading,
      signingIn,
      session,
      challenge,
      codeCopied,
      error,
      baseUrl,
      setBaseUrl,
      signIn,
      signOut,
    }),
    [baseUrl, challenge, codeCopied, error, loading, session, setBaseUrl, signIn, signOut, signingIn],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useTmuxMobileAuth(): AuthState {
  const value = React.useContext(AuthContext);
  if (!value) throw new Error("useTmuxMobileAuth must be used inside TmuxMobileAuthProvider");
  return value;
}

export function useTmuxMobileApi(): TmuxMobileApi | null {
  const { session, baseUrl } = useTmuxMobileAuth();
  return React.useMemo(
    () => (session ? new TmuxMobileApi(session.baseUrl || baseUrl, session.sessionToken) : null),
    [baseUrl, session],
  );
}
