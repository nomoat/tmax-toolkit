import { CloseButton, VisionControlsContext, useVisionControls, controlIcon, VISION_TARGET_SIZE } from "@/tmux-mobile/interaction-controls";
import { SpeechSettings } from "@/tmux-mobile/speech-settings";
import { streamingDictationControl, type StreamingDictationMode } from "@/tmux-mobile/streaming-asr-session";
import { useStreamingDictation } from "@/tmux-mobile/use-streaming-dictation";
import { CardActionBar, CardActionIcon } from "@/tmux-mobile/card-action-bar";
import { TextSelectionSurface, TextSelectionModal, type TextSelectionTarget } from "@/tmux-mobile/text-selection";
import { useAppDialog } from "@/tmux-mobile/app-dialog";
import { temporaryTerminalsPath } from "@/tmux-mobile/temporary-terminal-navigation";
import { TerminalShareModal } from "@/tmux-mobile/terminal-share-modal";
import { canShareTerminal } from "@/tmux-mobile/terminal-share";
import { sessionDraftsPath } from "@/tmux-mobile/drafts-navigation";
import { DraftsModal } from "@/tmux-mobile/drafts-modal";
import { FpsModal as Modal, FpsMenuToggle } from "@/tmux-mobile/fps-monitor";
import { NotificationSettings } from "@/tmux-mobile/notification-settings";
import { conversationPath } from "@/tmux-mobile/conversation-link";
import * as React from "react";
import {
  ActivityIndicator,
  AppState,
  Animated,
  FlatList,
  Image,
  Keyboard,
  Linking,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
  useWindowDimensions,
  useColorScheme,
} from "react-native";
import type { StyleProp, TextInputProps, TextStyle } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { MEDIA_LIBRARY_OPTIONS, mediaUploadAsset } from "@/tmux-mobile/media-upload";
import * as SecureStore from "expo-secure-store";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { StatusBar } from "expo-status-bar";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Markdown, { type RenderRules } from "react-native-markdown-display";
import { MermaidBlock } from "@/tmux-mobile/mermaid-block";
import { toByteArray } from "base64-js";
import { NATIVE_VISION_CONTROLS_STATUS, NATIVE_VISION_CONTROLS_DETECTED } from "@/tmux-mobile/vision-device";
import {
  CJMUXBlinkTerminal,
  hasNativeCJMUXBlinkTerminal,
  type BlinkTerminalHandle,
  type BlinkTerminalState,
} from "../../../modules/cjmux-blink-terminal";
import {
  CJMUXKeyboardShortcutSurface,
  hasNativeCJMUXKeyboardShortcuts,
  type CJMUXKeyboardShortcutMode,
} from "../../../modules/cjmux-keyboard-shortcuts";
import { darkTheme, lightTheme } from "@/theme";
import type { AppTheme } from "@/theme";
import {
  TextSelect,
  SquareTerminal,
  Check,
  AlertCircle,
  BookOpen,
  ArrowDown,
  ArrowUp,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CloudDownload,
  Copy,
  Edit3,
  Eye,
  ExternalLink,
  File,
  FileText,
  Folder,
  Image as ImageIcon,
  AudioLines,
  ImagePlus,
  Info,
  KeyRound,
  Link2,
  List,
  ListPlus,
  Laptop,
  LogOut,
  Maximize,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Minus,
  MoreVertical,
  Pin,
  Play,
  Plus,
  RefreshCcw,
  Send,
  Square,
  Star,
  Settings2,
  Smartphone,
  Terminal,
  Trash2,
  Type,
  Upload,
  Volume2,
  X,
} from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import type { TmuxMobileApi } from "@/tmux-mobile/api";
import { useTmuxMobileApi, useTmuxMobileAuth } from "@/tmux-mobile/auth";
import { sshDeviceIdentityManager } from "@/tmux-mobile/ssh-device-identity-storage";
import { terminalSelectionText, transcriptSelectionText } from "@/tmux-mobile/text-selection-content";
import { renderAnsiText, stripUnsupportedAnsi } from "@/tmux-mobile/ansi";
import {
  cardStarsKey,
  commandCenterKey,
  useCardStars,
  useCommandCenter,
  useDeletePin,
  useDeleteWindow,
  usePinFileArtifact,
  usePinInlineArtifact,
  usePins,
  useRenameWindow,
  useRenamePin,
  useResetSnippets,
  useSendKey,
  useSendText,
  useSnippets,
  useStartAgent,
  useToggleCardStar,
  useUpdateSnippets,
  useUploadFile,
} from "@/tmux-mobile/hooks";
import {
  agentCardKey,
  agentMachineKey,
  agentStarKey,
  agentStarKeys,
  agentSubtitle,
  agentTitle,
  compareMachinesByOwnerAndName,
  isAgentStarred,
  machineKey,
  machineLabel,
} from "@/tmux-mobile/types";
import {
  filePathFromLocalHref,
  fileViewerEndpoint,
  resolveLinkedFilePath,
  splitFilePathText,
  splitLinkableText,
} from "@/tmux-mobile/file-links";
import {
  artifactOpenMode,
  controllerArtifactRawUrl,
} from "@/tmux-mobile/artifact-viewer";
import {
  composerSnippetLabel,
  FALLBACK_SNIPPETS,
  prioritizeGoalSnippet,
} from "@/tmux-mobile/composer-snippets";
import {
  resolveCommandCenterShortcut,
  type CommandCenterShortcutEvent,
} from "@/tmux-mobile/command-center-shortcuts";
import { LegacyIPadShortcutCapture } from "@/tmux-mobile/legacy-ipad-shortcut-capture";
import { isRecentActivity, relativeTimeLabel } from "@/tmux-mobile/relative-time";
import {
  agentSessionDisplayLabel,
  sessionCardSummary,
  sessionModelLabel,
} from "@/tmux-mobile/session-card";
import {
  CARD_SORT_KEY,
  normalizeCardSort,
  latestActivityTime,
  compareRecentActivity,
  type CardSort,
  groupAgentSessions,
  groupIndexForAgent,
  nextExpandedAgentKey,
  type AgentSessionGroup,
} from "@/tmux-mobile/session-groups";
import { nextTerminalFollowState } from "@/tmux-mobile/terminal-follow";
import {
  sessionCardFoldState,
  shouldFoldSessionCards,
} from "@/tmux-mobile/card-folding";
import {
  fileBrowserLocationLabel,
  isFileBrowserImage,
  isFileBrowserMarkdown,
  joinFileBrowserPath,
  parentFileBrowserPath,
} from "@/tmux-mobile/file-browser";
import {
  quantizeLiveTerminalTextScale,
  readTerminalTextScale,
  snapTerminalTextScale,
  TERMINAL_TEXT_SCALE_STORAGE_KEY,
} from "@/tmux-mobile/terminal-zoom";
import {
  FONT_SCALE_LABELS,
  FONT_SCALE_LEVELS,
  FONT_SCALE_STORAGE_KEY,
  FONT_SCALE_VALUES,
  readFontScaleLevel,
  scaleTextMetrics,
  stepFontScale,
  type FontScaleLevel,
} from "@/tmux-mobile/font-scale";
import { useOtaUpdates, type OtaUpdateController, type OtaUpdateNotice } from "@/tmux-mobile/updates";
import {
  normalizeSpokenControllerUrl,
  resolveFieldPresentation,
  resolvePaneComposerPresentation,
  resolveVisionControls,
  type VisionFieldId,
} from "@/tmux-mobile/vision-controls";
import type {
  AgentFileResponse,
  AgentSession,
  AgentTranscriptResponse,
  ArtifactPin,
  FileBrowserResponse,
  Machine,
  UserSnippetItem,
  WindowViewResponse,
} from "@/tmux-mobile/types";

const APP_LOGO = require("../../../logo.png");

const EMPTY_MACHINES: Machine[] = [];
const EMPTY_AGENTS: AgentSession[] = [];
const THEME_MODE_KEY = "tmux-mobile.theme-mode";
const MACHINE_CHIP_READ_AT_KEY = "tmux-mobile.machine-chip-read-at";
const MACHINE_CHIP_READ_GRACE_MS = 5_000;
const RELATIVE_TIME_REFRESH_MS = 60_000;
const CONTROLLER_BROWSER_HANDOFF_PATHS = new Set([
  "/conversation",
  "/pin",
  "/api/pin",
  "/api/file-view",
  "/api/file-page",
  "/api/file-raw",
]);
const FOLD_SESSION_CARDS = shouldFoldSessionCards({
  os: Platform.OS,
  isPad: Platform.OS === "ios" && Platform.isPad,
  isVision: Platform.OS === "ios" && Platform.isVision,
  visionDeviceDetected: NATIVE_VISION_CONTROLS_DETECTED,
});
type ThemeMode = "auto" | "light" | "dark";
type MachineChipStats = {
  workingCount: number;
  unreadCount: number;
};

type SshAuthMethod = "password" | "private-key";

type StoredSshProfile = {
  version: 1;
  host: string;
  user: string;
  port: number;
  authMethod: SshAuthMethod;
  password?: string;
  privateKey?: string;
};

type ManagedSshProfile = {
  version: 1;
  host: string;
  user: string;
  port: number;
  authMethod: "managed-key";
  identityId: string;
};

type ActiveSshProfile = StoredSshProfile | ManagedSshProfile;

const SSH_PROFILE_KEY_PREFIX = "tmux-mobile.ssh-profile.v1";

function stableStorageKeyPart(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function sshProfileStorageKey(controllerUrl: string, machineId: string): string {
  return `${SSH_PROFILE_KEY_PREFIX}.${stableStorageKeyPart(
    controllerUrl.trim().toLowerCase(),
  )}.${stableStorageKeyPart(machineId)}`;
}

function readStoredSshProfile(value: string | null): StoredSshProfile | null {
  if (!value) return null;
  try {
    const profile = JSON.parse(value) as Partial<StoredSshProfile>;
    const port = Number(profile.port);
    if (
      profile.version !== 1 ||
      !String(profile.host || "").trim() ||
      !String(profile.user || "").trim() ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535 ||
      (profile.authMethod !== "password" && profile.authMethod !== "private-key")
    ) {
      return null;
    }
    if (profile.authMethod === "password" && !String(profile.password || "")) return null;
    if (profile.authMethod === "private-key" && !String(profile.privateKey || "")) return null;
    return {
      version: 1,
      host: String(profile.host).trim(),
      user: String(profile.user).trim(),
      port,
      authMethod: profile.authMethod,
      password: profile.authMethod === "password" ? String(profile.password) : undefined,
      privateKey: profile.authMethod === "private-key" ? String(profile.privateKey) : undefined,
    };
  } catch {
    return null;
  }
}

type ResponsiveLayout = {
  width: number;
  height: number;
  isWide: boolean;
  listColumns: number;
  gutter: number;
  contentMaxWidth: number;
  sheetMaxWidth: number;
  menuWidth: number;
  cardPadding: number;
  sessionPillMaxWidth: number;
};

function createResponsiveLayout(width = 390, height = 844, fontScale = 1): ResponsiveLayout {
  const effectiveWidth = width / fontScale;
  const isWide = effectiveWidth >= 760;
  const listColumns = 1;
  const gutter = isWide ? 20 : 16;
  const contentMaxWidth = isWide ? Math.min(width - gutter * 2, 820) : width;
  return {
    width,
    height,
    isWide,
    listColumns,
    gutter,
    contentMaxWidth,
    sheetMaxWidth: isWide ? Math.min(width - gutter * 2, 820) : width,
    menuWidth: Math.min(width - gutter * 2, (isWide ? 300 : 226) * fontScale),
    cardPadding: 16,
    sessionPillMaxWidth: isWide ? 176 : 132,
  };
}

const DEFAULT_LAYOUT = createResponsiveLayout();
type AppStyles = ReturnType<typeof createStyles>;

const ThemeContext = React.createContext<AppTheme>(lightTheme);
const StylesContext = React.createContext<AppStyles>(createStyles(lightTheme));
const FontScaleContext = React.createContext(1);

const PROMPT_SHORTCUTS = [
  { label: "Yes", text: "yes" },
  { label: "Slash", text: "/" },
] as const;

function cleanSnippetItems(items: Array<UserSnippetItem | string> | undefined | null): UserSnippetItem[] {
  if (!Array.isArray(items)) return [];
  const clean: UserSnippetItem[] = [];
  for (const item of items.slice(0, 100)) {
    const text = String(typeof item === "string" ? item : item?.text || "").slice(0, 2000);
    if (text.trim()) clean.push({ text });
  }
  return clean;
}

const VOICE_CONTEXTUAL_STRINGS = [
  "T-MAX",
  "Codex",
  "Claude",
  "tmux",
  "terminal",
  "session",
  "agent",
] as const;

type TerminalKeyEntry =
  | { label: string; key: string; danger?: boolean }
  | { label: string; command: string; danger?: boolean };

const TERMINAL_KEYBOARD_KEYS: readonly TerminalKeyEntry[] = [
  { label: "Ent", key: "Enter" },
  { label: "Esc", key: "Escape" },
  { label: "Tab", key: "Tab" },
  { label: "⇧Tab", key: "BTab" },
  { label: "↑", key: "Up" },
  { label: "↓", key: "Down" },
  { label: "←", key: "Left" },
  { label: "→", key: "Right" },
  { label: "⌫", key: "BSpace" },
  { label: "⌫line", key: "C-u" },
  { label: "^C", key: "C-c", danger: true },
  { label: "^D", key: "C-d", danger: true },
  { label: "^Z", key: "C-z", danger: true },
  { label: "q", key: "q" },
  { label: "fg", command: "fg" },
] as const;
const VISION_QUICK_KEYS: readonly TerminalKeyEntry[] = [
  { label: "Enter", key: "Enter" },
  { label: "Esc", key: "Escape" },
  { label: "Tab", key: "Tab" },
  { label: "↑", key: "Up" },
  { label: "↓", key: "Down" },
  { label: "^C", key: "C-c", danger: true },
] as const;
const TERMINAL_INITIAL_LINES = 260;
const TERMINAL_REFRESH_LINES = 320;
const TERMINAL_ACTIVE_REFRESH_MS = 700;
const TERMINAL_IDLE_REFRESH_MS = 1400;

function terminalKeyFromNativeKey(rawKey: string): string {
  switch (rawKey) {
    case "ArrowUp":
    case "Up":
      return "Up";
    case "ArrowDown":
    case "Down":
      return "Down";
    case "ArrowLeft":
    case "Left":
      return "Left";
    case "ArrowRight":
    case "Right":
      return "Right";
    case "Enter":
    case "Return":
    case "\n":
    case "\r":
      return "Enter";
    case "Backspace":
    case "Delete":
    case "\b":
    case "\u007f":
      return "BSpace";
    case "Tab":
    case "\t":
      return "Tab";
    case "Escape":
    case "Esc":
    case "\u001b":
      return "Escape";
    case "\u0003":
      return "C-c";
    case "\u0004":
      return "C-d";
    case "\u001a":
      return "C-z";
    default:
      return "";
  }
}

type SendRetryAction =
  | { kind: "text"; label: string }
  | { kind: "terminal"; label: string; entry: TerminalKeyEntry };

type PaneComposerVariant = "compact" | "expanded";

type AgentFileTarget = {
  agent: AgentSession;
  path: string;
};
type FilePreviewOrigin =
  | { kind: "response"; agent: AgentSession }
  | { kind: "transcript"; agent: AgentSession }
  | { kind: "terminal"; agent: AgentSession };
type MarkdownPathRuleOptions = {
  agent?: AgentSession | null;
  basePath?: string;
  onOpenUrl?: (url: string) => void;
  selectable?: boolean;
};

function useAppTheme() {
  return React.useContext(ThemeContext);
}

function useAppStyles() {
  return React.useContext(StylesContext);
}

function useFontScale() {
  return React.useContext(FontScaleContext);
}

function useFieldPresentation(field: VisionFieldId) {
  return resolveFieldPresentation(field, useVisionControls());
}

function agentIsWorking(agent: AgentSession): boolean {
  const status = agent.waitingForInput ? "waiting" : agent.status || agent.turn || "";
  return String(status).toLowerCase() === "running";
}

function agentUnreadMessageTime(agent: AgentSession): number {
  const assistantTime = parseDateMs(agent.lastAssistantAt);
  return assistantTime || 0;
}

function formatUnreadCount(count: number): string {
  if (count > 99) return "99+";
  return String(count);
}

function parseDateMs(value: string | null | undefined): number {
  const ms = Date.parse(value || "");
  return Number.isFinite(ms) ? ms : 0;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function exactTimeLabel(value: string | null | undefined): string {
  const ms = parseDateMs(value);
  if (!ms) return "";
  const date = new Date(ms);
  const now = new Date();
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (sameDay(date, now)) return `Today ${time}`;
  return `${date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  })} ${time}`;
}

const PIN_SCOPE_LABELS: Record<string, string> = {
  private: "Only me",
  users: "Specific people",
  org: "My organization",
  all: "All logged-in users",
};

function formatPinAge(value: number | undefined): string {
  if (!value) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - value) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatPinSize(bytes: number | undefined): string {
  if (!Number.isFinite(bytes) || !bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function artifactSlugPart(value: string | null | undefined, fallback = "response"): string {
  const slug = String(value || "")
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || fallback;
}

function decodeBase64Utf8(base64: string): string {
  const bytes = toByteArray(String(base64 || ""));
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder("utf-8").decode(bytes);
  }
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  try {
    return decodeURIComponent(escape(binary));
  } catch {
    return binary;
  }
}

function agentFileBrowserUrl(
  api: { url: (pathname: string) => URL },
  agent: AgentSession,
  filePath: string,
): string {
  const params = new URLSearchParams({
    paneId: agent.paneId || "",
    path: filePath,
  });
  const machineId = agentMachineKey(agent);
  if (machineId) params.set("machineId", machineId);
  if (agent.mux) params.set("mux", agent.mux);
  return api.url(`${fileViewerEndpoint(filePath)}?${params.toString()}`).toString();
}

async function openAuthenticatedControllerUrl(api: TmuxMobileApi, targetUrl: string): Promise<void> {
  const target = new URL(targetUrl, api.baseUrl);
  if (
    target.origin !== new URL(api.baseUrl).origin ||
    !CONTROLLER_BROWSER_HANDOFF_PATHS.has(target.pathname)
  ) {
    await Linking.openURL(target.toString());
    return;
  }
  const returnTo = `${target.pathname}${target.search}${target.hash}`;
  const handoff = await api.browserHandoff(returnTo);
  if (!handoff.handoffUrl) throw new Error("Controller did not return a browser handoff URL");
  await Linking.openURL(api.url(handoff.handoffUrl).toString());
}

function createMarkdownPathRules(
  onOpenPath: (path: string) => void,
  options: MarkdownPathRuleOptions = {},
): RenderRules {
  const selectable = options.selectable === true;
  const trimCodeContent = (value: string) =>
    value.endsWith("\n") ? value.slice(0, -1) : value;
  return {
    strong: (node, children, _parentNodes, styles) => (
      <Text key={node.key} selectable={selectable} style={styles.strong}>
        {children}
      </Text>
    ),
    em: (node, children, _parentNodes, styles) => (
      <Text key={node.key} selectable={selectable} style={styles.em}>
        {children}
      </Text>
    ),
    s: (node, children, _parentNodes, styles) => (
      <Text key={node.key} selectable={selectable} style={styles.s}>
        {children}
      </Text>
    ),
    code_inline: (node, _children, _parentNodes, styles, inheritedStyles = {}) => (
      <Text key={node.key} selectable={selectable} style={[inheritedStyles, styles.code_inline]}>
        {node.content}
      </Text>
    ),
    code_block: (node, _children, _parentNodes, styles, inheritedStyles = {}) => (
      <Text key={node.key} selectable={selectable} style={[inheritedStyles, styles.code_block]}>
        {trimCodeContent(String(node.content || ""))}
      </Text>
    ),
    fence: (node, _children, _parentNodes, styles, inheritedStyles = {}) =>
      String((node as typeof node & { sourceInfo?: string }).sourceInfo || "").trim().toLowerCase().split(/\s+/)[0] === "mermaid" ? (
        <MermaidBlock key={node.key} source={String(node.content || "")} textStyle={[inheritedStyles, styles.fence]} />
      ) : (
        <Text key={node.key} selectable={selectable} style={[inheritedStyles, styles.fence]}>
          {trimCodeContent(String(node.content || ""))}
        </Text>
      ),
    link: (node, children, _parentNodes, styles, onLinkPress) => (
      <Text
        key={node.key}
        selectable={selectable}
        style={styles.link}
        onPress={() => {
          onLinkPress?.(String(node.attributes?.href || ""));
        }}
      >
        {children}
      </Text>
    ),
    text: (node, _children, parentNodes, styles, inheritedStyles = {}) => {
      const content = String(node.content || "");
      const insideLink = parentNodes.some((parent) => parent?.type === "link" || parent?.type === "blocklink");
      const parts = insideLink
        ? [{ kind: "text" as const, text: content }]
        : options.onOpenUrl
          ? splitLinkableText(content)
          : splitFilePathText(content);
      const hasInteractivePart = parts.some((part) => part.kind !== "text");
      if (!hasInteractivePart) {
        return (
          <Text key={node.key} selectable={selectable} style={[inheritedStyles, styles.text]}>
            {content}
          </Text>
        );
      }
      return (
        <Text key={node.key} selectable={selectable} style={[inheritedStyles, styles.text]}>
          {parts.map((part, index) =>
            part.kind === "file" ? (
              <Text
                key={`${node.key}-file-${index}`}
                accessibilityRole="link"
                selectable={selectable}
                style={styles.filePathLink || styles.link}
                onPress={() => onOpenPath(resolveLinkedFilePath(part.path, options.basePath))}
              >
                {part.text}
              </Text>
            ) : part.kind === "url" ? (
              <Text
                key={`${node.key}-url-${index}`}
                accessibilityRole="link"
                selectable={selectable}
                style={styles.link}
                onPress={() => options.onOpenUrl?.(part.href)}
              >
                {part.text}
              </Text>
            ) : (
              <Text key={`${node.key}-text-${index}`}>{part.text}</Text>
            ),
          )}
        </Text>
      );
    },
    textgroup: (node, children, _parentNodes, styles) => (
      <Text key={node.key} selectable={selectable} style={styles.textgroup}>
        {children}
      </Text>
    ),
    hardbreak: (node, _children, _parentNodes, styles) => (
      <Text key={node.key} selectable={selectable} style={styles.hardbreak}>
        {"\n"}
      </Text>
    ),
    softbreak: (node, _children, _parentNodes, styles) => (
      <Text key={node.key} selectable={selectable} style={styles.softbreak}>
        {"\n"}
      </Text>
    ),
    inline: (node, children, _parentNodes, styles) => (
      <Text key={node.key} selectable={selectable} style={styles.inline}>
        {children}
      </Text>
    ),
    span: (node, children, _parentNodes, styles) => (
      <Text key={node.key} selectable={selectable} style={styles.span}>
        {children}
      </Text>
    ),
    image: (node) => {
      const src = String(node.attributes?.src || "");
      const alt = String(node.attributes?.alt || "");
      const filePath = filePathFromLocalHref(src, options.basePath);
      return (
        <MarkdownImageBlock
          key={node.key}
          src={src}
          alt={alt}
          agent={options.agent || null}
          filePath={filePath}
          onOpenPath={onOpenPath}
        />
      );
    },
  };
}

export default function CommandCenterRoute() {
  return <CommandCenterScreen />;
}

function CommandCenterScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const auth = useTmuxMobileAuth();
  const api = useTmuxMobileApi();
  const queryClient = useQueryClient();
  const commandCenter = useCommandCenter();
  const cardStars = useCardStars();
  const toggleCardStar = useToggleCardStar();
  const deleteWindow = useDeleteWindow();
  const pinCardResponse = usePinInlineArtifact();
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = React.useState<ThemeMode>("auto");
  const themeModeTouched = React.useRef(false);
  const themeWrite = React.useRef(Promise.resolve());
  const [fontScaleLevel, setFontScaleLevel] = React.useState<FontScaleLevel>("standard");
  const [fontScaleLoaded, setFontScaleLoaded] = React.useState(false);
  const [machineFilter, setMachineFilter] = React.useState("all");
  const [sendTarget, setSendTarget] = React.useState<AgentSession | null>(null);
  const [renameTarget, setRenameTarget] = React.useState<AgentSession | null>(null);
  const [viewTarget, setViewTarget] = React.useState<AgentSession | null>(null);
  const [sshTarget, setSshTarget] = React.useState<AgentSession | null>(null);
  const [textSelection, setTextSelection] = React.useState<TextSelectionTarget | null>(null);
  const [responseTarget, setResponseTarget] = React.useState<AgentSession | null>(null);
  const [fileTarget, setFileTarget] = React.useState<AgentFileTarget | null>(null);
  const [transcriptTarget, setTranscriptTarget] = React.useState<AgentSession | null>(null);
  const pendingFileTarget = React.useRef<AgentFileTarget | null>(null);
  const filePreviewOrigin = React.useRef<FilePreviewOrigin | null>(null);
  const agentListRef = React.useRef<FlatList<AgentSessionGroup>>(null);
  const listViewportRef = React.useRef<View>(null);
  const cardViews = React.useRef(new Map<string, View>());
  const listScrollOffset = React.useRef(0);
  const jumpGeneration = React.useRef(0);
  const jumpTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [startVisible, setStartVisible] = React.useState(false);
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [cardSort, setCardSort] = React.useState<CardSort>("current");
  const cardSortTouched = React.useRef(false);
  React.useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(CARD_SORT_KEY).then((value) => {
      if (mounted && !cardSortTouched.current) setCardSort(normalizeCardSort(value));
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);
  const sortWrite = React.useRef(Promise.resolve());
  const updateCardSort = React.useCallback((next: CardSort) => {
    cardSortTouched.current = true;
    setCardSort(next);
    sortWrite.current = sortWrite.current.then(() => AsyncStorage.setItem(CARD_SORT_KEY, next)).catch(() => {});
    void Haptics.selectionAsync();
  }, []);
  const [cardSearchVisible, setCardSearchVisible] = React.useState(false);
  const [cardSearchAutoFocus, setCardSearchAutoFocus] = React.useState(false);
  const [pinsVisible, setPinsVisible] = React.useState(false);
  const [shareTarget, setShareTarget] = React.useState<AgentSession | null>(null);
  const pendingTemporaryPath = React.useRef<string | null>(null);
  const [temporaryPath, setTemporaryPath] = React.useState<string | null>(null);
  const [draftsPath, setDraftsPath] = React.useState<string | null>(null);
  const [settingsVisible, setSettingsVisible] = React.useState(false);
  const [selectedAgent, setSelectedAgent] = React.useState<AgentSession | null>(null);
  const [expandedAgentKey, setExpandedAgentKey] = React.useState("");
  const [machineChipReadLoaded, setMachineChipReadLoaded] = React.useState(false);
  const [machineChipReadAt, setMachineChipReadAt] = React.useState<number | null>(null);
  const [relativeTimeTick, setRelativeTimeTick] = React.useState(0);
  const appState = React.useRef(AppState.currentState);
  const copyResetTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const promptCopyResetTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copiedResponseKey, setCopiedResponseKey] = React.useState("");
  const [copiedPromptKey, setCopiedPromptKey] = React.useState("");
  const [pinningResponseKey, setPinningResponseKey] = React.useState("");
  const effectiveThemeMode = themeMode === "auto" ? systemColorScheme : themeMode;
  const theme = effectiveThemeMode === "dark" ? darkTheme : lightTheme;
  const appDialog = useAppDialog(theme);
  const fontScale = FONT_SCALE_VALUES[fontScaleLevel];
  const layout = React.useMemo(
    () => createResponsiveLayout(windowWidth, windowHeight, fontScale),
    [fontScale, windowHeight, windowWidth],
  );
  const styles = React.useMemo(
    () => createStyles(theme, layout, fontScale, NATIVE_VISION_CONTROLS_DETECTED),
    [fontScale, layout, theme],
  );
  const relativeTimeNow = Date.now();
  const otaUpdates = useOtaUpdates();
  const visionControlsEnabled = resolveVisionControls(
    "auto",
    NATIVE_VISION_CONTROLS_DETECTED,
  );
  const embeddedSshAvailable =
    Platform.OS === "ios" &&
    hasNativeCJMUXBlinkTerminal &&
    !NATIVE_VISION_CONTROLS_DETECTED;

  React.useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(THEME_MODE_KEY)
      .then((value) => {
        if (mounted && !themeModeTouched.current && (value === "auto" || value === "light" || value === "dark")) setThemeMode(value);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(FONT_SCALE_STORAGE_KEY)
      .then((value) => {
        if (mounted) setFontScaleLevel(readFontScaleLevel(value));
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setFontScaleLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const updateFontScaleLevel = React.useCallback((next: FontScaleLevel) => {
    setFontScaleLevel(next);
    AsyncStorage.setItem(FONT_SCALE_STORAGE_KEY, next).catch(() => {});
    void Haptics.selectionAsync();
  }, []);

  const rawMachines = commandCenter.data?.machines || EMPTY_MACHINES;
  const machines = React.useMemo(
    () => rawMachines.slice().sort(compareMachinesByOwnerAndName),
    [rawMachines],
  );
  const rawAgents = commandCenter.data?.agents || EMPTY_AGENTS;
  const stars = React.useMemo(() => new Set(cardStars.data?.keys || []), [cardStars.data?.keys]);
  const latestUnreadMessageAt = React.useMemo(
    () => rawAgents.reduce((latest, agent) => Math.max(latest, agentUnreadMessageTime(agent)), 0),
    [rawAgents],
  );
  const machineReadThreshold = machineChipReadAt ?? Number.POSITIVE_INFINITY;
  const machineChipStats = React.useMemo(() => {
    const byMachine = new Map<string, MachineChipStats>();
    const all: MachineChipStats = { workingCount: 0, unreadCount: 0 };
    rawAgents.forEach((agent) => {
      const key = agentMachineKey(agent);
      const stats = byMachine.get(key) || { workingCount: 0, unreadCount: 0 };
      if (agentIsWorking(agent)) {
        stats.workingCount += 1;
        all.workingCount += 1;
      }
      const messageTime = agentUnreadMessageTime(agent);
      if (messageTime > machineReadThreshold) {
        stats.unreadCount += 1;
        all.unreadCount += 1;
      }
      byMachine.set(key, stats);
    });
    return { all, byMachine };
  }, [machineReadThreshold, rawAgents]);
  const groupedAgents = React.useMemo(() => {
    const filtered =
      machineFilter === "all"
        ? rawAgents
        : rawAgents.filter((agent) => agentMachineKey(agent) === machineFilter);
    return groupAgentSessions(
      filtered,
      stars,
      machines.map((machine) => machineKey(machine)),
      cardSort,
    );
  }, [machineFilter, machines, rawAgents, stars, cardSort]);
  const sessionGroups = groupedAgents.groups;
  const agents = groupedAgents.agents;

  const toggleStar = React.useCallback(
    (agent: AgentSession) => {
      const current = new Set(cardStars.data?.keys || []);
      const keys = agentStarKeys(agent);
      const starred = keys.some((key) => current.has(key));
      if (starred) keys.forEach((key) => current.delete(key));
      else current.add(agentStarKey(agent));
      toggleCardStar.mutate({ agent, keys: [...current] });
      void Haptics.selectionAsync();
    },
    [cardStars.data?.keys, toggleCardStar],
  );

  React.useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(MACHINE_CHIP_READ_AT_KEY)
      .then((value) => {
        if (!mounted) return;
        const parsed = Number(value || "");
        setMachineChipReadAt(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
        setMachineChipReadLoaded(true);
      })
      .catch(() => {
        if (mounted) setMachineChipReadLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (!machineChipReadLoaded || machineChipReadAt !== null) return;
    const initialReadAt = Math.max(Date.now() + MACHINE_CHIP_READ_GRACE_MS, latestUnreadMessageAt);
    setMachineChipReadAt(initialReadAt);
    AsyncStorage.setItem(MACHINE_CHIP_READ_AT_KEY, String(initialReadAt)).catch(() => {});
  }, [latestUnreadMessageAt, machineChipReadAt, machineChipReadLoaded]);

  const markMachineChipsRead = React.useCallback(() => {
    const nextReadAt = Math.max(Date.now() + MACHINE_CHIP_READ_GRACE_MS, latestUnreadMessageAt);
    setMachineChipReadAt(nextReadAt);
    AsyncStorage.setItem(MACHINE_CHIP_READ_AT_KEY, String(nextReadAt)).catch(() => {});
  }, [latestUnreadMessageAt]);

  const selectMachineFilter = React.useCallback(
    (nextFilter: string) => {
      setMachineFilter(nextFilter);
      markMachineChipsRead();
      void Haptics.selectionAsync();
    },
    [markMachineChipsRead],
  );

  const openStartAgent = React.useCallback(() => {
    setMenuVisible(false);
    setStartVisible(true);
    void Haptics.selectionAsync();
  }, []);

  const refreshCommandCenter = React.useCallback(() => {
    setMenuVisible(false);
    void Promise.all([commandCenter.refetch(), cardStars.refetch()]);
    void Haptics.selectionAsync();
  }, [cardStars, commandCenter]);

  const openPinnedArtifacts = React.useCallback(() => {
    setMenuVisible(false);
    setPinsVisible(true);
    void Haptics.selectionAsync();
  }, []);

  const openSettings = React.useCallback(() => {
    setMenuVisible(false);
    setSettingsVisible(true);
    void Haptics.selectionAsync();
  }, []);

  const openAgentFile = React.useCallback(
    (agent: AgentSession, path: string) => {
      const nextTarget = { agent, path };
      setSelectedAgent(agent);

      // UIKit cannot reliably present a second React Native Modal while the
      // response/transcript sheet is still being dismissed. Queue the file and
      // let that sheet's onDismiss present it, keeping exactly one native modal
      // on screen at a time.
      if (responseTarget) {
        pendingFileTarget.current = nextTarget;
        filePreviewOrigin.current = { kind: "response", agent: responseTarget };
        setResponseTarget(null);
      } else if (transcriptTarget) {
        pendingFileTarget.current = nextTarget;
        filePreviewOrigin.current = { kind: "transcript", agent: transcriptTarget };
        setTranscriptTarget(null);
      } else if (viewTarget) {
        pendingFileTarget.current = nextTarget;
        filePreviewOrigin.current = { kind: "terminal", agent: viewTarget };
        setViewTarget(null);
      } else {
        filePreviewOrigin.current = null;
        setFileTarget(nextTarget);
      }
      void Haptics.selectionAsync();
    },
    [responseTarget, transcriptTarget, viewTarget],
  );

  const presentPendingFile = React.useCallback(() => {
    const pending = pendingFileTarget.current;
    if (!pending) return;
    pendingFileTarget.current = null;
    setFileTarget(pending);
  }, []);

  const restoreFilePreviewOrigin = React.useCallback(() => {
    const origin = filePreviewOrigin.current;
    filePreviewOrigin.current = null;
    if (!origin) return;
    if (origin.kind === "response") setResponseTarget(origin.agent);
    else if (origin.kind === "transcript") setTranscriptTarget(origin.agent);
    else setViewTarget(origin.agent);
  }, []);

  const signOut = React.useCallback(() => {
    setMenuVisible(false);
    void auth.signOut();
  }, [auth]);

  const updateThemeMode = React.useCallback((next: ThemeMode) => {
    themeModeTouched.current = true;
    setThemeMode(next);
    themeWrite.current = themeWrite.current
      .then(() => AsyncStorage.setItem(THEME_MODE_KEY, next)).catch(() => {});
    void Haptics.selectionAsync();
  }, []);

  const confirmDeleteAgent = React.useCallback(
    (agent: AgentSession) => {
      const title = agentTitle(agent);
      appDialog.show("Delete session", `Kill "${title}" on ${agent.machineHostname || agentMachineKey(agent)}?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteWindow.mutate({ agent });
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]);
    },
    [deleteWindow],
  );

  const copyAssistantResponse = React.useCallback(async (agent: AgentSession) => {
    if (agent.fullTextError) return;
    const text = agent.lastAssistantText || "";
    if (!text) return;
    await Clipboard.setStringAsync(text);
    const key = agentCardKey(agent);
    setCopiedResponseKey(key);
    if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    copyResetTimer.current = setTimeout(() => {
      setCopiedResponseKey((current) => (current === key ? "" : current));
    }, 1200);
    void Haptics.selectionAsync();
  }, []);

  const copyUserPrompt = React.useCallback(async (agent: AgentSession) => {
    if (agent.fullTextError) return;
    const text = agent.lastUserText || "";
    if (!text) return;
    await Clipboard.setStringAsync(text);
    const key = agentCardKey(agent);
    setCopiedPromptKey(key);
    if (promptCopyResetTimer.current) clearTimeout(promptCopyResetTimer.current);
    promptCopyResetTimer.current = setTimeout(() => {
      setCopiedPromptKey((current) => (current === key ? "" : current));
    }, 1200);
    void Haptics.selectionAsync();
  }, []);

  const pinAssistantResponse = React.useCallback(
    (agent: AgentSession) => {
      const text = agent.lastAssistantText || "";
      if (!api || !text.trim() || agent.fullTextError || pinCardResponse.isPending) return;
      const key = agentCardKey(agent);
      const machineId = agentMachineKey(agent);
      const base = artifactSlugPart(agent.windowName || agent.kind || "response").slice(0, 60);
      const name = /\.[a-z0-9]+$/i.test(base) ? base : `${base}.md`;
      const sourceBase = artifactSlugPart(agent.windowId || agent.paneId || base, "window");
      setPinningResponseKey(key);
      pinCardResponse.mutate(
        {
          agent,
          text,
          name,
          sourcePath: `agent-response/${machineId}/${sourceBase}`,
        },
        {
          onSuccess: async (data) => {
            const link = api.url(data.pin.shareUrl).toString();
            try {
              await Clipboard.setStringAsync(link);
            } catch {
              // The artifact is still pinned even if the clipboard is unavailable.
            }
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
          onError: (error) => {
            appDialog.show("Pin failed", error instanceof Error ? error.message : String(error));
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          },
          onSettled: () => {
            setPinningResponseKey((current) => (current === key ? "" : current));
          },
        },
      );
    },
    [api, pinCardResponse],
  );

  const replyToResponse = React.useCallback((agent: AgentSession) => {
    setSelectedAgent(agent);
    setResponseTarget(null);
    setSendTarget(agent);
    void Haptics.selectionAsync();
  }, []);

  const activeShortcutAgent = React.useMemo(() => {
    if (agents.length === 0) return null;
    const selectedKey = selectedAgent ? agentCardKey(selectedAgent) : "";
    return agents.find((agent) => agentCardKey(agent) === selectedKey) || agents[0] || null;
  }, [agents, selectedAgent]);

  const jumpToAgent = React.useCallback((agent: AgentSession) => {
    const key = agentCardKey(agent);
    if (!agents.some((candidate) => agentCardKey(candidate) === key)) return;
    const index = groupIndexForAgent(sessionGroups, agent);
    const generation = ++jumpGeneration.current;
    if (jumpTimer.current) clearTimeout(jumpTimer.current);
    setSelectedAgent(agent);
    setExpandedAgentKey(key);
    setCardSearchVisible(false);
    // FlatList virtualizes session groups, not individual cards. First mount
    // the group, then measure the actual card so long groups land precisely.
    const locate = (attempt: number) => {
      if (generation !== jumpGeneration.current || attempt > 12) return;
      jumpTimer.current = setTimeout(() => locate(attempt + 1), 120);
      const card = cardViews.current.get(key);
      if (!card) {
        agentListRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0 });
        return;
      }
      listViewportRef.current?.measureInWindow((_x, listY) => {
        card.measureInWindow((_cardX, cardY, _width, height) => {
          if (!height || generation !== jumpGeneration.current) return;
          if (jumpTimer.current) clearTimeout(jumpTimer.current);
          agentListRef.current?.scrollToOffset({
            offset: Math.max(0, listScrollOffset.current + cardY - listY - 8),
            animated: false,
          });
        });
      });
    };
    // Let the selected card expand before measuring its final position.
    jumpTimer.current = setTimeout(() => locate(0), 80);
    void Haptics.selectionAsync();
  }, [agents, sessionGroups]);

  React.useEffect(() => () => {
    jumpGeneration.current++;
    if (jumpTimer.current) clearTimeout(jumpTimer.current);
  }, []);

  const moveSelectedAgent = React.useCallback(
    (direction: "left" | "right" | "up" | "down") => {
      if (agents.length === 0) return;
      const selectedKey = activeShortcutAgent ? agentCardKey(activeShortcutAgent) : "";
      const currentIndex = Math.max(0, agents.findIndex((agent) => agentCardKey(agent) === selectedKey));
      const columns = Math.max(1, layout.listColumns);
      const delta =
        direction === "left"
          ? -1
          : direction === "right"
            ? 1
            : direction === "up"
              ? -columns
              : columns;
      const nextIndex = Math.max(0, Math.min(agents.length - 1, currentIndex + delta));
      setSelectedAgent(agents[nextIndex] || null);
      agentListRef.current?.scrollToIndex({
        index: groupIndexForAgent(sessionGroups, agents[nextIndex] || agents[0]),
        animated: true,
        viewPosition: 0.5,
      });
      void Haptics.selectionAsync();
    },
    [activeShortcutAgent, agents, layout.listColumns, sessionGroups],
  );

  const modalOpen = Boolean(
    textSelection || appDialog.visible ||
    sendTarget ||
      renameTarget ||
      viewTarget ||
      sshTarget ||
      responseTarget ||
      fileTarget ||
      transcriptTarget ||
      startVisible ||
      menuVisible ||
      cardSearchVisible ||
      pinsVisible ||
      shareTarget ||
      temporaryPath ||
      draftsPath ||
      settingsVisible,
  );

  const handleCommandCenterKeyDown = React.useCallback(
    (event: unknown) => {
      const e = event as {
        preventDefault?: () => void;
        defaultPrevented?: boolean;
        target?: {
          closest?: (selector: string) => unknown;
        };
        nativeEvent?: {
          key?: string;
          ctrlKey?: boolean;
          metaKey?: boolean;
          altKey?: boolean;
          shiftKey?: boolean;
          repeat?: boolean;
          isComposing?: boolean;
        };
      };
      const native = e.nativeEvent || {};
      const shortcut = resolveCommandCenterShortcut({
        ...native,
        defaultPrevented: e.defaultPrevented,
        editableTarget: Boolean(
          e.target?.closest?.(
            "input, textarea, select, button, a, summary, [contenteditable='true']",
          ),
        ),
      } as CommandCenterShortcutEvent);
      if (!shortcut) return;

      if (shortcut.type === "escape") {
        if (appDialog.visible) { appDialog.dismiss(); e.preventDefault?.(); return; }
        // A hardware Escape key belongs to the embedded terminal while it is
        // active. The terminal sheet has an explicit close button.
        if (sshTarget) return;
        if (textSelection) setTextSelection(null);
        else if (shareTarget) setShareTarget(null);
        else if (fileTarget) setFileTarget(null);
        else if (transcriptTarget) setTranscriptTarget(null);
        else if (responseTarget) setResponseTarget(null);
        else if (viewTarget) setViewTarget(null);
        else if (sendTarget) setSendTarget(null);
        else if (renameTarget) setRenameTarget(null);
        else if (startVisible) setStartVisible(false);
        else if (menuVisible) setMenuVisible(false);
        else if (cardSearchVisible) setCardSearchVisible(false);
        else if (pinsVisible) setPinsVisible(false);
        else if (temporaryPath) setTemporaryPath(null);
        else if (draftsPath) setDraftsPath(null);
        else if (settingsVisible) setSettingsVisible(false);
        else return;
        e.preventDefault?.();
        return;
      }

      if (modalOpen) return;

      if (shortcut.type === "move") {
        e.preventDefault?.();
        moveSelectedAgent(shortcut.direction);
        return;
      }

      if (shortcut.type === "refresh") {
        e.preventDefault?.();
        refreshCommandCenter();
        return;
      }

      if (shortcut.type === "search") {
        e.preventDefault?.();
        setCardSearchAutoFocus(true);
        setCardSearchVisible(true);
        return;
      }

      const agent = activeShortcutAgent;
      if (!agent) return;
      if (shortcut.type === "view") {
        e.preventDefault?.();
        setSelectedAgent(agent);
        setViewTarget(agent);
      } else if (shortcut.type === "reply") {
        e.preventDefault?.();
        setSelectedAgent(agent);
        setSendTarget(agent);
      } else if (shortcut.type === "response") {
        e.preventDefault?.();
        if (agent.lastAssistantText) {
          setSelectedAgent(agent);
          setResponseTarget(agent);
        }
      } else if (shortcut.type === "transcript") {
        e.preventDefault?.();
        setSelectedAgent(agent);
        setTranscriptTarget(agent);
      }
    },
    [
      activeShortcutAgent,
      cardSearchVisible,
      fileTarget,
      menuVisible,
      modalOpen,
      moveSelectedAgent,
      pinsVisible,
      shareTarget,
      draftsPath,
      temporaryPath,
      renameTarget,
      refreshCommandCenter,
      responseTarget,
      textSelection,
      sendTarget,
      settingsVisible,
      sshTarget,
      startVisible,
      transcriptTarget,
      viewTarget,
    ],
  );

  const ipadShortcutEnabled =
    Platform.OS === "ios" && Platform.isPad && !NATIVE_VISION_CONTROLS_DETECTED;
  const ipadShortcutMode: CJMUXKeyboardShortcutMode = !ipadShortcutEnabled
    ? "none"
    : sshTarget
      ? "none"
    : modalOpen
      ? "escape"
      : "all";

  const commandCenterKeyboardProps = React.useMemo(
    () => {
      if (Platform.OS === "web") {
        return {
          focusable: true,
          tabIndex: 0,
          onKeyDownCapture: handleCommandCenterKeyDown,
        } as Record<string, unknown>;
      }
      if (Platform.OS === "android") {
        return {
          focusable: true,
          onKeyDown: handleCommandCenterKeyDown,
        } as Record<string, unknown>;
      }
      return {};
    },
    [handleCommandCenterKeyDown],
  );
  React.useEffect(() => {
    return () => {
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
      if (promptCopyResetTimer.current) clearTimeout(promptCopyResetTimer.current);
    };
  }, []);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setRelativeTimeTick((tick) => tick + 1);
    }, RELATIVE_TIME_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appState.current;
      appState.current = nextState;
      if (nextState !== "active") {
        void queryClient.cancelQueries({ queryKey: commandCenterKey });
      }
      if ((previousState === "background" || previousState === "inactive") && nextState === "active") {
        setRelativeTimeTick((tick) => tick + 1);
        queryClient.invalidateQueries({ queryKey: commandCenterKey }).catch(() => {});
        queryClient.invalidateQueries({ queryKey: cardStarsKey }).catch(() => {});
      }
    });
    return () => subscription.remove();
  }, [queryClient]);

  const withTheme = React.useCallback(
    (node: React.ReactNode) => (
      <ThemeContext.Provider value={theme}>
        <StylesContext.Provider value={styles}>
          <FontScaleContext.Provider value={fontScale}>
            <VisionControlsContext.Provider value={visionControlsEnabled}>
              {node}
            </VisionControlsContext.Provider>
          </FontScaleContext.Provider>
        </StylesContext.Provider>
      </ThemeContext.Provider>
    ),
    [fontScale, styles, theme, visionControlsEnabled],
  );

  if (auth.loading || !fontScaleLoaded) {
    return withTheme(
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>,
    );
  }

  if (!auth.session) {
    return withTheme(<LoginScreen />);
  }

  return withTheme(
    <CJMUXKeyboardShortcutSurface
      {...commandCenterKeyboardProps}
      mode={ipadShortcutMode}
      onShortcutKeyDown={handleCommandCenterKeyDown}
      style={[styles.screen, { paddingTop: insets.top + 8 }]}
    >
      <StatusBar style={theme.dark ? "light" : "dark"} />
      <LegacyIPadShortcutCapture
        enabled={
          !visionControlsEnabled &&
          ipadShortcutEnabled &&
          !hasNativeCJMUXKeyboardShortcuts &&
          !modalOpen
        }
        onKeyDown={handleCommandCenterKeyDown}
      />
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <View style={styles.headerMark}>
            <Terminal size={18} color={theme.colors.text} strokeWidth={2.2} />
          </View>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>Sessions</Text>
            <Text style={styles.headerMeta} numberOfLines={1}>
              {groupedAgents.sessionCount} sessions · {agents.length} windows
            </Text>
          </View>
        </View>
        <View style={styles.headerButtons}>
          <IconButton
            label="Drafts"
            icon={<FileText size={19} color={theme.colors.text} />}
            onPress={() => setDraftsPath("/drafts?embedded=1")}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Jump to card"
            accessibilityState={{ disabled: agents.length === 0, expanded: cardSearchVisible }}
            disabled={agents.length === 0}
            style={styles.iconButton}
            onPress={() => {
              setCardSearchAutoFocus(false);
              setCardSearchVisible(true);
            }}
          >
            <List size={19} color={agents.length ? theme.colors.text : theme.colors.textMuted} />
          </Pressable>
          <IconButton
            label="Refresh"
            icon={<RefreshCcw size={19} color={theme.colors.text} />}
            onPress={refreshCommandCenter}
          />
          <IconButton
            label="Command menu"
            icon={<MoreVertical size={19} color={theme.colors.text} />}
            onPress={() => setMenuVisible(true)}
          />
        </View>
      </View>

      <UpdateNoticeBanner
        notice={otaUpdates.notice}
        onDismiss={otaUpdates.dismissNotice}
        onAction={() => {
          if (otaUpdates.notice?.action === "apply") {
            otaUpdates.applyUpdate().catch(() => {});
          } else if (otaUpdates.notice?.action === "check") {
            otaUpdates.checkForUpdate("manual").catch(() => {});
          }
        }}
      />

      <MachineStrip
        machines={machines}
        active={machineFilter}
        allStats={machineChipStats.all}
        statsByMachine={machineChipStats.byMachine}
        onChange={selectMachineFilter}
      />

      {commandCenter.error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{commandCenter.error.message}</Text>
        </View>
      ) : null}
      {deleteWindow.error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{deleteWindow.error.message}</Text>
        </View>
      ) : null}

      <View ref={listViewportRef} style={styles.listViewport} collapsable={false}>
      <FlatList
        ref={agentListRef}
        onScroll={(event) => { listScrollOffset.current = event.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
        data={sessionGroups}
        keyExtractor={(group) => group.key}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          agentListRef.current?.scrollToOffset({
            offset: Math.max(0, index * averageItemLength),
            animated: true,
          });
        }}
        style={styles.listViewport}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 96 },
          agents.length === 0 ? styles.emptyList : null,
        ]}
        extraData={`${relativeTimeTick}:${selectedAgent ? agentCardKey(selectedAgent) : ""}:${expandedAgentKey}`}
        refreshControl={
          <RefreshControl
            refreshing={commandCenter.isFetching}
            onRefresh={() => commandCenter.refetch()}
            tintColor={theme.colors.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Terminal size={28} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>No agent sessions</Text>
            <Text style={styles.emptyText}>
              Start Codex, Claude or Pi on one of the connected machines.
            </Text>
          </View>
        }
        renderItem={({ item: group }) => (
          <View style={styles.sessionGroup}>
            <View style={styles.sessionGroupHeader}>
              <View style={styles.sessionGroupTitleBlock}>
                <Text style={styles.sessionGroupTitle} numberOfLines={1}>
                  {group.title}
                </Text>
              </View>
              <Text style={styles.sessionGroupCount}>
                {group.agents.length} window{group.agents.length === 1 ? "" : "s"}
              </Text>
            </View>
            <View style={styles.sessionCardGrid}>
              {group.agents.map((item, index) => {
                const key = agentCardKey(item);
                const starred = isAgentStarred(item, stars);
                const recentActivity = isRecentActivity(
                  sessionCardSummary(item).lastActivityAt,
                  relativeTimeNow,
                );
                const foldState = sessionCardFoldState({
                  foldSessionCards: FOLD_SESSION_CARDS,
                  recentActivity,
                  manuallyExpanded: expandedAgentKey === key,
                });
                const selectAgent = () => setSelectedAgent(item);
                const toggleExpanded = () => {
                  selectAgent();
                  if (foldState.collapsible) {
                    setExpandedAgentKey((current) => nextExpandedAgentKey(current, key));
                  }
                };
                return (
                  <React.Fragment key={key}>
                    <View
                      style={styles.cardGridItem}
                      collapsable={false}
                      ref={(view) => {
                        if (view) cardViews.current.set(key, view);
                        else cardViews.current.delete(key);
                      }}
                    >
                      <AgentCard
                        agent={item}
                        nowMs={relativeTimeNow}
                        starred={starred}
                        selected={selectedAgent ? agentCardKey(selectedAgent) === key : false}
                        collapsible={foldState.collapsible}
                        expanded={foldState.expanded}
                        onToggleStar={() => toggleStar(item)}
                        onToggleExpanded={toggleExpanded}
                        onSend={() => {
                          selectAgent();
                          setSendTarget(item);
                        }}
                        onRename={() => {
                          selectAgent();
                          setRenameTarget(item);
                        }}
                        onDelete={() => {
                          selectAgent();
                          confirmDeleteAgent(item);
                        }}
                        onView={() => {
                          selectAgent();
                          setViewTarget(item);
                        }}
                        onSelectText={setTextSelection}
                        onViewResponse={() => {
                          selectAgent();
                          setResponseTarget(item);
                        }}
                        onCopyPrompt={() => {
                          selectAgent();
                          copyUserPrompt(item).catch(() => {});
                        }}
                        onCopyResponse={() => {
                          selectAgent();
                          copyAssistantResponse(item).catch(() => {});
                        }}
                        onPinResponse={() => {
                          selectAgent();
                          pinAssistantResponse(item);
                        }}
                        onOpenFile={(path) => openAgentFile(item, path)}
                        promptCopied={copiedPromptKey === key}
                        responseCopied={copiedResponseKey === key}
                        responsePinning={pinningResponseKey === key}
                        onShareTerminal={() => setShareTarget(item)}
                        onDrafts={() => {
                          const path = sessionDraftsPath(item);
                          if (path) setDraftsPath(path);
                        }}
                        onConversation={() => {
                          const path = conversationPath(item);
                          if (api && path) openAuthenticatedControllerUrl(api, api.url(path).toString())
                            .catch(error => appDialog.show("Could not open conversation", error.message));
                        }}
                        onCopyConversation={() => {
                          const path = conversationPath(item);
                          if (api && path) Clipboard.setStringAsync(api.url(path).toString())
                            .then(() => appDialog.show("Link copied", "Only people with session access can open this conversation."))
                            .catch(error => appDialog.show("Could not copy link", error.message));
                        }}
                        onTranscript={() => {
                          selectAgent();
                          setTranscriptTarget(item);
                        }}
                      />
                    </View>
                    {index < group.agents.length - 1 ? (
                      <View style={styles.sessionCardDivider} />
                    ) : null}
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        )}
      />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sessions"
        accessibilityHint="Open the session list and jump to a card"
        accessibilityState={{ disabled: agents.length === 0, expanded: cardSearchVisible }}
        disabled={agents.length === 0}
        style={({ pressed }) => [
          styles.sessionListFab,
          { bottom: insets.bottom + 18 },
          agents.length === 0 ? { opacity: 0.5 } : null,
          pressed ? styles.sessionListFabPressed : null,
        ]}
        onPress={() => {
          setCardSearchAutoFocus(false);
          setCardSearchVisible(true);
        }}
      >
        <List size={22} color={theme.dark ? theme.colors.background : theme.colors.surface} strokeWidth={2.4} />
      </Pressable>

      <TextSelectionModal target={textSelection} theme={theme} onClose={() => setTextSelection(null)} />
      <SendModal target={sendTarget} onClose={() => setSendTarget(null)} />
      <RenameModal target={renameTarget} onClose={() => setRenameTarget(null)} />
      <WindowViewModal
        target={viewTarget}
        onOpenFile={openAgentFile}
        onOpenSsh={
          embeddedSshAvailable
            ? (agent) => {
                setViewTarget(null);
                setSshTarget(agent);
              }
            : undefined
        }
        onClose={() => setViewTarget(null)}
        onDismiss={presentPendingFile}
      />
      <EmbeddedSshModal
        target={sshTarget}
        controllerUrl={auth.session.baseUrl || auth.baseUrl}
        onClose={() => setSshTarget(null)}
      />
      <ResponseModal
        target={responseTarget}
        copied={responseTarget ? copiedResponseKey === agentCardKey(responseTarget) : false}
        onReply={replyToResponse}
        onCopy={(agent) => {
          copyAssistantResponse(agent).catch(() => {});
        }}
        onOpenFile={openAgentFile}
        onClose={() => setResponseTarget(null)}
        onDismiss={presentPendingFile}
      />
      <FilePreviewModal
        target={fileTarget}
        onOpenPath={(path) => {
          if (fileTarget) setFileTarget({ agent: fileTarget.agent, path });
        }}
        onClose={() => setFileTarget(null)}
        onDismiss={restoreFilePreviewOrigin}
      />
      <TranscriptModal
        target={transcriptTarget}
        onOpenFile={openAgentFile}
        onClose={() => setTranscriptTarget(null)}
        onDismiss={presentPendingFile}
      />
      <CardSearchModal
        visible={cardSearchVisible}
        autoFocusSearch={cardSearchAutoFocus}
        agents={agents}
        nowMs={relativeTimeNow}
        selectedAgent={selectedAgent}
        onSelect={jumpToAgent}
        onClose={() => setCardSearchVisible(false)}
      />
      {shareTarget && api ? <TerminalShareModal key={agentCardKey(shareTarget)} api={api} target={shareTarget} theme={theme} onClose={() => setShareTarget(null)} /> : null}
      {appDialog.node}
      {temporaryPath && api ? <DraftsModal api={api} initialPath={temporaryPath} page="terminal" theme={theme} onClose={() => setTemporaryPath(null)} /> : null}
      {draftsPath && api ? <DraftsModal api={api} initialPath={draftsPath} theme={theme} onClose={() => setDraftsPath(null)} /> : null}
      <PinnedArtifactsModal visible={pinsVisible} onClose={() => setPinsVisible(false)} />
      <SettingsModal
        visible={settingsVisible}
        ota={otaUpdates}
        fontScaleLevel={fontScaleLevel}
        onFontScaleLevelChange={updateFontScaleLevel}
        onClose={() => setSettingsVisible(false)}
      />
      <CommandMenu
        visible={menuVisible}
        cardSort={cardSort}
        onCardSortChange={updateCardSort}
        topOffset={insets.top + 54}
        onClose={() => setMenuVisible(false)}
        onTemporaryTerminal={() => {
          const path = temporaryTerminalsPath(machineFilter);
          if (Platform.OS === "ios") pendingTemporaryPath.current = path;
          else setTemporaryPath(path);
          setMenuVisible(false);
        }}
        onDismiss={() => {
          const path = pendingTemporaryPath.current;
          pendingTemporaryPath.current = null;
          if (path) setTemporaryPath(path);
        }}
        onStartAgent={openStartAgent}
        onPinnedArtifacts={openPinnedArtifacts}
        onRefresh={refreshCommandCenter}
        onSettings={openSettings}
        onThemeModeChange={updateThemeMode}
        themeMode={themeMode}
        onSignOut={signOut}
      />
      <StartAgentModal
        visible={startVisible}
        machines={machines}
        selectedAgent={selectedAgent}
        onClose={() => setStartVisible(false)}
      />
    </CJMUXKeyboardShortcutSurface>,
  );
}

function LoginScreen() {
  const theme = useAppTheme();
  const styles = useAppStyles();
  const insets = useSafeAreaInsets();
  const visionControls = useVisionControls();
  const controllerPresentation = useFieldPresentation("controller-url");
  const auth = useTmuxMobileAuth();
  const [url, setUrl] = React.useState(auth.baseUrl);
  const [voiceStatus, setVoiceStatus] = React.useState("");
  const controllerVoice = useLocalVoiceInput({
    scopeKey: "login:controller-url",
    onText: (transcript) => setUrl(normalizeSpokenControllerUrl(transcript)),
    onStatus: setVoiceStatus,
    contextualStrings: ["https", "eng.xyznot.com", "production", "localhost"],
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.loginScreen, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
    >
      <StatusBar style={theme.dark ? "light" : "dark"} />
      <View style={styles.loginPanel}>
        <Image source={APP_LOGO} style={styles.loginLogo} resizeMode="contain" accessible={false} />
        <Text style={styles.loginTitle}>T-MAX</Text>
        <Text style={styles.loginText}>
          Native command center for Codex, Claude and Pi sessions running through tmux-mobile.
        </Text>
        {controllerPresentation === "voice" ? (
          <VoiceValueField
            label="Controller"
            value={url}
            emptyLabel="Say “production” for eng.xyznot.com"
            active={controllerVoice.active}
            status={voiceStatus}
            onToggle={() => {
              controllerVoice.toggle().catch((error) => {
                setVoiceStatus(error instanceof Error ? error.message : String(error));
              });
            }}
            onClear={() => setUrl("")}
          />
        ) : (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Controller</Text>
            <KeyboardTextInput
              value={url}
              onChangeText={setUrl}
              onBlur={() => auth.setBaseUrl(url)}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={styles.textInput}
              placeholder="https://eng.xyznot.com"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
        )}
        <Pressable
          style={[
            styles.primaryButton,
            styles.loginButton,

          ]}
          disabled={auth.signingIn}
          onPress={() => {
            auth.setBaseUrl(url);
            void auth.signIn(url);
          }}
        >
          {auth.signingIn ? (
            <ActivityIndicator color={theme.colors.surfaceRaised} />
          ) : (
            <Text style={styles.primaryButtonText}>Sign in with Google</Text>
          )}
        </Pressable>
        {auth.challenge ? (
          <View style={styles.challengeBox}>
            <Text style={styles.challengeLabel}>{auth.codeCopied ? "Device code copied" : "Device code"}</Text>
            <Text style={styles.challengeCode}>{auth.challenge.userCode || "Browser opened"}</Text>
          </View>
        ) : null}
        {auth.error ? <Text style={styles.errorText}>{auth.error}</Text> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

function MachineStrip({
  machines,
  active,
  allStats,
  statsByMachine,
  onChange,
}: {
  machines: Machine[];
  active: string;
  allStats: MachineChipStats;
  statsByMachine: Map<string, MachineChipStats>;
  onChange: (value: string) => void;
}) {
  const theme = useAppTheme();
  const styles = useAppStyles();
  const renderChipStatus = (stats: MachineChipStats) => (
    <>
      {stats.workingCount > 0 ? <View style={styles.machineChipWorkingDot} /> : null}
      {stats.unreadCount > 0 ? (
        <View style={styles.chipUnreadBadge}>
          <Text style={styles.chipUnreadText}>{formatUnreadCount(stats.unreadCount)}</Text>
        </View>
      ) : null}
    </>
  );
  return (
    <ScrollView
      horizontal
      style={styles.machineStripViewport}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.machineStrip}
    >
      <Chip active={active === "all"} onPress={() => onChange("all")}>
        <View style={styles.machineChipContent}>
          <Text style={[styles.chipText, active === "all" ? styles.chipTextActive : null]} numberOfLines={1}>
            All
          </Text>
          {renderChipStatus(allStats)}
        </View>
      </Chip>
      {machines.map((machine) => {
        const key = machineKey(machine);
        const stats = statsByMachine.get(key) || { workingCount: 0, unreadCount: 0 };
        return (
          <Chip key={key} active={active === key} onPress={() => onChange(key)}>
            <View style={styles.machineChipContent}>
              <Laptop size={14} color={active === key ? theme.colors.text : theme.colors.textMuted} />
              <Text
                style={[
                  styles.chipText,
                  active === key ? styles.chipTextActive : null,
                ]}
                numberOfLines={1}
              >
                {machineLabel(machine)}
              </Text>
              {renderChipStatus(stats)}
            </View>
          </Chip>
        );
      })}
    </ScrollView>
  );
}

function Chip({
  active,
  onPress,
  children,
}: {
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const styles = useAppStyles();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.chip, active ? styles.chipActive : null]} onPress={onPress}>
      {typeof children === "string" ? (
        <Text style={[styles.chipText, active ? styles.chipTextActive : null]} numberOfLines={1}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

function LinkedPathText({
  text,
  style,
  numberOfLines,
  selectable,
  onOpenPath,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  selectable?: boolean;
  onOpenPath: (path: string) => void;
}) {
  const styles = useAppStyles();
  const parts = React.useMemo(() => splitFilePathText(text), [text]);
  const hasFile = parts.some((part) => part.kind === "file");
  if (!hasFile) {
    return (
      <Text selectable={selectable} style={style} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }
  return (
    <Text selectable={selectable} style={style} numberOfLines={numberOfLines}>
      {parts.map((part, index) =>
        part.kind === "file" ? (
          <Text
            key={`file-${index}`}
            accessibilityRole="link"
            style={styles.inlineFileLink}
            onPress={() => onOpenPath(part.path)}
          >
            {part.text}
          </Text>
        ) : (
          <Text key={`text-${index}`}>{part.text}</Text>
        ),
      )}
    </Text>
  );
}

function RunningCardEdge({ active }: { active: boolean }) {
  const styles = useAppStyles();
  const progress = React.useRef(new Animated.Value(0)).current;
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    if (!active) {
      progress.stopAnimation();
      progress.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 2600,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => {
      animation.stop();
    };
  }, [active, progress]);

  if (!active) return null;

  const width = Math.max(size.width, 1);
  const height = Math.max(size.height, 1);
  const segment = Math.max(42, Math.min(96, width * 0.34));
  const segmentY = Math.max(42, Math.min(96, height * 0.46));
  const phaseOpacity = (start: number, end: number) =>
    progress.interpolate({
      inputRange: [0, start, start + 0.02, end - 0.02, end, 1],
      outputRange: [0, 0, 1, 1, 0, 0],
      extrapolate: "clamp",
    });

  return (
    <View
      pointerEvents="none"
      style={styles.runningEdge}
      onLayout={(event) => {
        const next = event.nativeEvent.layout;
        if (next.width !== size.width || next.height !== size.height) {
          setSize({ width: next.width, height: next.height });
        }
      }}
    >
      <Animated.View
        style={[
          styles.runningEdgeSegment,
          styles.runningEdgeHorizontal,
          {
            width: segment,
            top: 0,
            opacity: phaseOpacity(0, 0.25),
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0, 0.25],
                  outputRange: [-segment, width],
                  extrapolate: "clamp",
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.runningEdgeSegment,
          styles.runningEdgeVertical,
          {
            height: segmentY,
            right: 0,
            opacity: phaseOpacity(0.25, 0.5),
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0.25, 0.5],
                  outputRange: [-segmentY, height],
                  extrapolate: "clamp",
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.runningEdgeSegment,
          styles.runningEdgeHorizontal,
          {
            width: segment,
            bottom: 0,
            opacity: phaseOpacity(0.5, 0.75),
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0.5, 0.75],
                  outputRange: [width, -segment],
                  extrapolate: "clamp",
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.runningEdgeSegment,
          styles.runningEdgeVertical,
          {
            height: segmentY,
            left: 0,
            opacity: phaseOpacity(0.75, 1),
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0.75, 1],
                  outputRange: [height, -segmentY],
                  extrapolate: "clamp",
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

function MarkdownImageBlock({
  src,
  alt,
  agent,
  filePath,
  onOpenPath,
}: {
  src: string;
  alt: string;
  agent: AgentSession | null;
  filePath: string;
  onOpenPath: (path: string) => void;
}) {
  const api = useTmuxMobileApi();
  const theme = useAppTheme();
  const styles = useAppStyles();
  const remoteUri = /^(?:https?:\/\/|data:image\/)/i.test(src) ? src : "";
  const [imageUri, setImageUri] = React.useState(remoteUri);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    setError("");
    if (remoteUri) {
      setImageUri(remoteUri);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setImageUri("");
    if (!api || !agent?.paneId || !filePath) return;
    setLoading(true);
    api
      .file(agentMachineKey(agent), agent.paneId, filePath)
      .then((result) => {
        if (cancelled) return;
        if (result.kind === "image" || /^image\//i.test(result.contentType || "")) {
          setImageUri(`data:${result.contentType};base64,${result.base64}`);
        } else {
          setError("Not an image");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agent, api, filePath, remoteUri]);

  const label = alt || filePath || src || "image";
  const openImage = React.useCallback(() => {
    if (filePath) {
      onOpenPath(filePath);
      return;
    }
    if (remoteUri) {
      Linking.openURL(remoteUri).catch(() => {});
    }
  }, [filePath, onOpenPath, remoteUri]);

  return (
    <Pressable style={styles.markdownImageBlock} onPress={openImage}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.markdownImage} resizeMode="contain" />
      ) : (
        <View style={styles.markdownImagePlaceholder}>
          {loading ? (
            <ActivityIndicator color={theme.colors.accent} />
          ) : (
            <ImagePlus size={18} color={theme.colors.textMuted} />
          )}
          <Text style={styles.markdownImageLabel} numberOfLines={2}>
            {loading ? "Loading image..." : label}
          </Text>
          {error ? (
            <Text style={styles.markdownImageError} numberOfLines={2}>
              {error}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

function AgentCard({
  agent,
  nowMs,
  starred,
  selected,
  collapsible,
  expanded,
  onToggleStar,
  onToggleExpanded,
  onSend,
  onRename,
  onDelete,
  onView,
  onViewResponse,
  onSelectText,
  onCopyPrompt,
  onCopyResponse,
  onPinResponse,
  onOpenFile,
  promptCopied,
  responseCopied,
  responsePinning,
  onTranscript,
  onDrafts,
  onConversation,
  onCopyConversation,
  onShareTerminal,
}: {
  agent: AgentSession;
  nowMs: number;
  starred: boolean;
  selected: boolean;
  collapsible: boolean;
  expanded: boolean;
  onToggleStar: () => void;
  onToggleExpanded: () => void;
  onSend: () => void;
  onRename: () => void;
  onDelete: () => void;
  onView: () => void;
  onViewResponse: () => void;
  onSelectText: (target: TextSelectionTarget) => void;
  onCopyPrompt: () => void;
  onCopyResponse: () => void;
  onPinResponse: () => void;
  onOpenFile: (path: string) => void;
  promptCopied: boolean;
  responseCopied: boolean;
  responsePinning: boolean;
  onTranscript: () => void;
  onDrafts: () => void;
  onConversation: () => void;
  onCopyConversation: () => void;
  onShareTerminal: () => void;
}) {
  const theme = useAppTheme();
  const styles = useAppStyles();
  const fontScale = useFontScale();
  const queryClient = useQueryClient();
  const markdownStyle = React.useMemo(() => createMarkdownStyles(theme, fontScale), [theme, fontScale]);
  const markdownRules = React.useMemo(() => createMarkdownPathRules(onOpenFile, { agent, selectable: false }), [onOpenFile, agent]);
  const status = agent.waitingForInput ? "waiting" : agent.status || agent.turn || "unverified";
  const running = status === "running";
  const summary = sessionCardSummary(agent);
  const agentSessionLabel = agentSessionDisplayLabel(agent);
  const modelLabel = sessionModelLabel(agent);
  const activityLabel = relativeTimeLabel(summary.lastActivityAt, nowMs) || "No activity";
  const recentActivity = isRecentActivity(summary.lastActivityAt, nowMs);
  const mutedActivity = !recentActivity;
  const statusStyle =
    running
      ? styles.statusRunning
      : status === "waiting"
        ? styles.statusWaiting
        : status === "idle"
          ? styles.statusIdle
          : styles.statusUnknown;

  return (
    <View
      style={[
        styles.card,
        mutedActivity ? styles.cardMuted : null,
        selected ? styles.cardSelected : null,
      ]}
    >
      <View style={styles.sessionRowTop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open window ${summary.windowName}. ${
            agentSessionLabel ? `Agent session ${agentSessionLabel}. ` : ""
          }Directory ${summary.directory || "unknown"}. ${
            modelLabel ? `Model and reasoning effort ${modelLabel}. ` : ""
          }Status ${status}. Last activity ${activityLabel}.`}
          accessibilityHint="Open the session terminal"
          accessibilityState={{ selected }}
          style={({ pressed }) => [
            styles.sessionRowMain,
            pressed ? styles.cardSummaryPressed : null,
          ]}
          onPress={onView}
        >
          <View style={styles.sessionIndicatorColumn}>
            <View style={[styles.statusDot, statusStyle]} />
          </View>
          <View style={styles.cardTitleBlock}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardWindowTitle} numberOfLines={1}>
                {summary.windowName}
              </Text>
              {agentSessionLabel ? (
                <Text style={styles.cardAgentSessionTitle} numberOfLines={1}>
                  {agentSessionLabel}
                </Text>
              ) : null}
            </View>
            <View style={styles.sessionContextRow}>
              <Text style={styles.sessionDirectory} numberOfLines={1}>
                {summary.directory || "No directory"}
              </Text>
              <Text
                style={[
                  styles.cardActivityTime,
                  recentActivity ? styles.cardActivityTimeRecent : null,
                ]}
                accessibilityLabel={`${
                  recentActivity ? "Recent activity" : "Last activity"
                }, ${exactTimeLabel(summary.lastActivityAt) || activityLabel}`}
                numberOfLines={1}
              >
                {activityLabel}
              </Text>
            </View>
          </View>
        </Pressable>
        <View style={styles.sessionRowControls}>
          <Pressable
            accessibilityLabel={starred ? "Unstar session" : "Star session"}
            accessibilityState={{ selected: starred }}
            style={styles.sessionRowIconButton}
            hitSlop={4}
            onPress={onToggleStar}
          >
            <Star
              size={16}
              color={starred ? theme.colors.warning : theme.colors.textMuted}
              fill={starred ? theme.colors.warning : "transparent"}
            />
          </Pressable>
          {collapsible ? (
            <Pressable
              accessibilityLabel={expanded ? "Hide session actions" : "Show session actions"}
              accessibilityState={{ expanded }}
              style={styles.sessionRowIconButton}
              hitSlop={4}
              onPress={onToggleExpanded}
            >
              {expanded ? (
                <ChevronUp size={16} color={theme.colors.textMuted} />
              ) : (
                <ChevronDown size={16} color={theme.colors.textMuted} />
              )}
            </Pressable>
          ) : null}
        </View>
      </View>
      {expanded ? (
        <View style={styles.cardBody}>
          {agent.fullTextError ? (
            <Pressable accessibilityRole="button" onPress={() => {
              void queryClient.invalidateQueries({ queryKey: commandCenterKey });
            }}>
              <Text style={styles.errorText}>Complete response unavailable · Tap to retry</Text>
            </Pressable>
          ) : null}
          {agent.lastUserText ? (
            <View>
              <CardSectionHeader
                label="Last prompt"
                timestamp={agent.lastUserAt}
                nowMs={nowMs}
                actions={<>
                  <SectionActionButton icon={<TextSelect size={13} color={theme.colors.textMuted} />} label="Select prompt text" onPress={() => onSelectText({ title: "Last prompt", text: agent.lastUserText || "" })} />
                  <SectionActionButton
                    icon={
                      promptCopied ? (
                        <Check size={13} color={theme.colors.success} />
                      ) : (
                        <Copy size={13} color={theme.colors.textMuted} />
                      )
                    }
                    label="Copy prompt"
                    disabled={Boolean(agent.fullTextError)}
                    onPress={onCopyPrompt}
                  />
                </>}
              />
              <Text style={styles.promptText} numberOfLines={2} onLongPress={() => onSelectText({ title: "Last prompt", text: agent.lastUserText || "" })}>
                {agent.lastUserText}
              </Text>
            </View>
          ) : null}
          {agent.lastAssistantText ? (
            <View style={styles.responseBlock}>
              <CardSectionHeader
                label="Last response"
                timestamp={agent.lastAssistantAt}
                nowMs={nowMs}
                actions={
                  <>
                    <SectionActionButton icon={<TextSelect size={13} color={theme.colors.textMuted} />} label="Select response text" onPress={() => onSelectText({ title: "Last response", text: agent.lastAssistantText || "" })} />
                    <SectionActionButton
                      icon={<Maximize size={13} color={theme.colors.textMuted} />}
                      label="Open response"
                      disabled={Boolean(agent.fullTextError)}
                      onPress={onViewResponse}
                    />
                    <SectionActionButton
                      icon={
                        responsePinning ? (
                          <ActivityIndicator size="small" color={theme.colors.accent} />
                        ) : (
                          <Pin size={13} color={theme.colors.textMuted} />
                        )
                      }
                      label="Pin response"
                      onPress={onPinResponse}
                      disabled={responsePinning || Boolean(agent.fullTextError)}
                    />
                    <SectionActionButton
                      icon={
                        responseCopied ? (
                          <Check size={13} color={theme.colors.success} />
                        ) : (
                          <Copy size={13} color={theme.colors.textMuted} />
                        )
                      }
                      label="Copy response"
                      disabled={Boolean(agent.fullTextError)}
                      onPress={onCopyResponse}
                    />
                  </>
                }
              />
              <Pressable onLongPress={() => onSelectText({ title: "Last response", text: agent.lastAssistantText || "" })} delayLongPress={500} accessibilityHint="Long-press to select text in a separate page">
                <Markdown style={markdownStyle} rules={markdownRules}>
                  {agent.lastAssistantText}
                </Markdown>
              </Pressable>
            </View>
          ) : null}
          <CardActionBar
            agent={agent}
            theme={theme}
            handlers={{
              interact: onSend,
              conversation: onConversation,
              drafts: onDrafts,
              transcript: onTranscript,
              terminal: onView,
              share: onShareTerminal,
              copyLink: onCopyConversation,
              rename: onRename,
              delete: onDelete,
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

function CardSectionHeader({
  label,
  timestamp,
  nowMs,
  actions,
}: {
  label: string;
  timestamp?: string | null;
  nowMs: number;
  actions?: React.ReactNode;
}) {
  const styles = useAppStyles();
  const relative = relativeTimeLabel(timestamp, nowMs);
  return (
    <View style={styles.cardSectionHeader}>
      <View style={styles.cardSectionHeadingText}>
        <Text style={styles.cardSectionLabel}>{label}</Text>
        {relative ? (
          <Text style={styles.cardSectionTime} accessibilityLabel={exactTimeLabel(timestamp)}>
            {relative}
          </Text>
        ) : null}
      </View>
      {actions ? <View style={styles.cardSectionActions}>{actions}</View> : null}
    </View>
  );
}

function SectionActionButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const styles = useAppStyles();
  const vision = useVisionControls();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={10}
      style={({ pressed }) => [
        styles.sectionActionButton,
        pressed ? styles.actionButtonPressed : null,
        disabled ? styles.disabledButton : null,
      ]}
      onPress={onPress}
    >
      {controlIcon(icon, vision)}
    </Pressable>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  disabled,
  active,
  stopPropagation,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
  stopPropagation?: boolean;
}) {
  const styles = useAppStyles();
  const vision = useVisionControls();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={5}
      style={({ pressed }) => [
        styles.actionButton,
        active ? styles.actionButtonActive : null,
        pressed ? styles.actionButtonPressed : null,
        disabled ? styles.disabledButton : null,
      ]}
      onPress={(event) => {
        if (stopPropagation) event.stopPropagation();
        onPress();
      }}
    >
      {controlIcon(icon, vision)}
    </Pressable>
  );
}

function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  const styles = useAppStyles();
  const vision = useVisionControls();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} style={styles.iconButton} onPress={onPress}>
      {controlIcon(icon, vision)}
    </Pressable>
  );
}

function CardSearchModal({
  visible,
  autoFocusSearch,
  agents,
  nowMs,
  selectedAgent,
  onSelect,
  onClose,
}: {
  visible: boolean;
  autoFocusSearch: boolean;
  agents: AgentSession[];
  nowMs: number;
  selectedAgent: AgentSession | null;
  onSelect: (agent: AgentSession) => void;
  onClose: () => void;
}) {
  const theme = useAppTheme();
  const styles = useAppStyles();
  const [query, setQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const selectedKey = selectedAgent ? agentCardKey(selectedAgent) : "";
  const recentAgents = React.useMemo(() => [...agents].sort(compareRecentActivity), [agents]);
  const results = React.useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return recentAgents;
    return recentAgents.filter((agent) =>
      [
        agentTitle(agent),
        agent.machineHostname,
        agent.sessionName,
        agent.windowName,
        agent.cwd,
        agent.kind,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle),
    );
  }, [recentAgents, query]);

  React.useEffect(() => {
    if (!visible) return;
    setQuery("");
    const index = recentAgents.findIndex(
      (agent) => agentCardKey(agent) === selectedKey,
    );
    setSelectedIndex(index >= 0 ? index : 0);
  }, [recentAgents, selectedKey, visible]);

  React.useEffect(() => {
    setSelectedIndex((current) =>
      Math.max(0, Math.min(results.length - 1, current)),
    );
  }, [results.length]);

  const submit = React.useCallback(() => {
    const agent = results[selectedIndex];
    if (agent) onSelect(agent);
  }, [onSelect, results, selectedIndex]);

  return (
    <SheetModal
      visible={visible}
      title="Jump to card"
      tall
      wide
      onClose={onClose}
    >
      <KeyboardTextInput
        autoFocus={visible && autoFocusSearch}
        value={query}
        onChangeText={(value) => {
          setQuery(value);
          setSelectedIndex(0);
        }}
        onKeyPress={(event) => {
          const key = event.nativeEvent.key;
          if (key === "ArrowDown") {
            event.preventDefault();
            setSelectedIndex((current) =>
              Math.min(results.length - 1, current + 1),
            );
          } else if (key === "ArrowUp") {
            event.preventDefault();
            setSelectedIndex((current) => Math.max(0, current - 1));
          } else if (key === "Enter") {
            event.preventDefault();
            submit();
          } else if (key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="done"
        onSubmitEditing={submit}
        placeholder="Name, machine, session, or directory"
        placeholderTextColor={theme.colors.textMuted}
        style={styles.textInput}
      />
      <Text style={styles.cardSearchHint}>
        ↑↓ choose · Return select · Esc close
      </Text>
      <FlatList
        data={results}
        extraData={nowMs}
        keyExtractor={agentCardKey}
        keyboardShouldPersistTaps="handled"
        style={styles.cardSearchList}
        contentContainerStyle={styles.cardSearchListContent}
        ListEmptyComponent={
          <Text style={styles.cardSearchEmpty}>No matching sessions</Text>
        }
        renderItem={({ item, index }) => {
          const active = index === selectedIndex;
          const activityTime = latestActivityTime(item);
          const age = relativeTimeLabel(activityTime ? new Date(activityTime).toISOString() : null, nowMs) || "No activity";
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.cardSearchResult,
                active ? styles.cardSearchResultActive : null,
              ]}
              onPress={() => onSelect(item)}
            >
              <View style={styles.cardSearchResultHeading}>
                <Text style={styles.cardSearchResultTitle} numberOfLines={1}>
                  {agentTitle(item)}
                </Text>
                <Text style={styles.cardSearchResultAge}>{age}</Text>
              </View>
              <Text style={styles.cardSearchResultMeta} numberOfLines={1}>
                {[
                  item.machineHostname || agentMachineKey(item),
                  item.sessionName,
                  item.windowName,
                  item.windowId,
                  item.cwd,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </Pressable>
          );
        }}
      />
    </SheetModal>
  );
}

function CommandMenu({
  cardSort,
  onCardSortChange,
  visible,
  topOffset,
  onClose,
  onDismiss,
  onStartAgent,
  onTemporaryTerminal,
  onPinnedArtifacts,
  onRefresh,
  onSettings,
  onThemeModeChange,
  themeMode,
  onSignOut,
}: {
  cardSort: CardSort;
  onCardSortChange: (next: CardSort) => void;
  visible: boolean;
  topOffset: number;
  onClose: () => void;
  onDismiss: () => void;
  onStartAgent: () => void;
  onTemporaryTerminal: () => void;
  onPinnedArtifacts: () => void;
  onRefresh: () => void;
  onSettings: () => void;
  onThemeModeChange: (next: ThemeMode) => void;
  themeMode: ThemeMode;
  onSignOut: () => void;
}) {
  const theme = useAppTheme();
  const styles = useAppStyles();
  const vision = useVisionControls();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onDismiss={onDismiss}>
      <View style={styles.menuLayer}>
        <Pressable accessibilityLabel="Close command menu" style={styles.menuBackdrop} onPress={onClose} />
        <View style={[styles.menuPanel, { marginTop: topOffset, maxHeight: Math.max(140, height - topOffset - insets.bottom - 12) }]} >
          {vision ? <View style={{ padding: 12, alignItems: "flex-end" }}><CloseButton theme={theme} accessibilityLabel="Close command menu" onPress={onClose} /></View> : null}
          <ScrollView bounces={false} style={{ flexGrow: 0 }}>
          <MenuAction
            icon={<Play size={18} color={theme.colors.accent} />}
            label="Start agent"
            onPress={onStartAgent}
          />
          <MenuAction
            icon={<SquareTerminal size={18} color={theme.colors.text} />}
            label="Temporary terminal"
            onPress={onTemporaryTerminal}
          />
          <MenuAction
            icon={<RefreshCcw size={18} color={theme.colors.text} />}
            label="Refresh"
            onPress={onRefresh}
          />
          <MenuAction
            icon={<FileText size={18} color={theme.colors.text} />}
            label="Pinned artifacts"
            onPress={onPinnedArtifacts}
          />
          <MenuAction
            icon={<Settings2 size={18} color={theme.colors.text} />}
            label="Settings & updates"
            onPress={onSettings}
          />
          <FpsMenuToggle theme={theme} />
          <View style={{ paddingHorizontal: 12, paddingVertical: 6, gap: 8 }}>
            <Text style={[styles.menuActionText, { color: theme.colors.textMuted }]}>Theme</Text>
            <View style={styles.segmentRow}>
              {(["auto", "light", "dark"] as const).map((mode) => (
                <Pressable key={mode} accessibilityRole="radio"
                  accessibilityLabel={mode === "auto" ? "Follow system theme" : `${mode} theme`}
                  accessibilityState={{ checked: themeMode === mode }}
                  style={[styles.segment, themeMode === mode ? styles.segmentActive : null]}
                  onPress={() => onThemeModeChange(mode)}>
                  <Text style={[styles.segmentText, themeMode === mode ? styles.segmentTextActive : null]}>
                    {mode === "auto" ? "Auto" : mode === "light" ? "Light" : "Dark"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.menuDivider} />
          <Text style={[styles.menuActionText, { paddingHorizontal: 12, color: theme.colors.textMuted }]}>Sort cards · Starred first</Text>
          {(["current", "recent"] as const).map((option) => (
            <Pressable key={option} style={styles.menuAction}
              accessibilityRole="radio" accessibilityState={{ checked: cardSort === option }}
              onPress={() => onCardSortChange(option)}>
              <View style={styles.menuActionIcon}>
                {cardSort === option ? <Check size={18} color={theme.colors.accent} /> : null}
              </View>
              <Text style={styles.menuActionText}>{option === "recent" ? "Recent activity" : "Current order"}</Text>
            </Pressable>
          ))}
          <View style={styles.menuDivider} />
          <MenuAction
            icon={<LogOut size={18} color={theme.colors.danger} />}
            label="Sign out"
            danger
            onPress={onSignOut}
          />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function MenuAction({
  icon,
  label,
  danger,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const styles = useAppStyles();
  return (
    <Pressable style={styles.menuAction} onPress={onPress}>
      <View style={styles.menuActionIcon}>{icon}</View>
      <Text style={[styles.menuActionText, danger ? styles.menuActionTextDanger : null]}>{label}</Text>
    </Pressable>
  );
}

function UpdateNoticeBanner({
  notice,
  onAction,
  onDismiss,
}: {
  notice: OtaUpdateNotice | null;
  onAction: () => void;
  onDismiss: () => void;
}) {
  const theme = useAppTheme();
  const styles = useAppStyles();
  if (!notice) return null;

  const toneColor =
    notice.tone === "danger"
      ? theme.colors.danger
      : notice.tone === "warning"
        ? theme.colors.warning
        : notice.tone === "success"
          ? theme.colors.success
          : theme.colors.accent;
  const backgroundColor =
    notice.tone === "danger"
      ? theme.colors.dangerSoft
      : notice.tone === "success"
        ? theme.colors.successSoft
        : notice.tone === "warning"
          ? theme.colors.warningSoft
          : theme.colors.surfaceRaised;
  const icon =
    notice.tone === "danger" ? (
      <AlertCircle size={18} color={toneColor} />
    ) : notice.tone === "success" ? (
      <CheckCircle size={18} color={toneColor} />
    ) : (
      <CloudDownload size={18} color={toneColor} />
    );

  return (
    <View style={styles.updateBannerWrap}>
      <View style={[styles.updateBanner, { borderColor: toneColor, backgroundColor }]}>
        <View style={styles.updateBannerIcon}>{icon}</View>
        <View style={styles.updateBannerTextBlock}>
          <Text style={styles.updateBannerTitle} numberOfLines={1}>
            {notice.title}
          </Text>
          <Text style={styles.updateBannerMessage} numberOfLines={2}>
            {notice.message}
          </Text>
        </View>
        {notice.action ? (
          <Pressable style={styles.updateBannerAction} onPress={onAction}>
            <Text style={[styles.updateBannerActionText, { color: toneColor }]}>
              {notice.actionLabel || "Open"}
            </Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityLabel="Dismiss update notice" style={styles.updateBannerClose} onPress={onDismiss}>
          <X size={16} color={theme.colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

function SettingsModal({
  visible,
  ota,
  fontScaleLevel,
  onFontScaleLevelChange,
  onClose,
}: {
  visible: boolean;
  ota: OtaUpdateController;
  fontScaleLevel: FontScaleLevel;
  onFontScaleLevelChange: (value: FontScaleLevel) => void;
  onClose: () => void;
}) {
  const theme = useAppTheme();
  const styles = useAppStyles();
  const fontScaleLevelIndex = FONT_SCALE_LEVELS.indexOf(fontScaleLevel);
  const canDecreaseFontScale = fontScaleLevelIndex > 0;
  const canIncreaseFontScale = fontScaleLevelIndex < FONT_SCALE_LEVELS.length - 1;
  const statusIcon = ota.isReady ? (
    <CheckCircle size={20} color={theme.colors.success} />
  ) : ota.phase === "error" ? (
    <AlertCircle size={20} color={theme.colors.danger} />
  ) : ota.isBusy ? (
    <ActivityIndicator color={theme.colors.accent} />
  ) : (
    <CloudDownload size={20} color={theme.colors.accent} />
  );

  return (
    <SheetModal visible={visible} title="Settings & updates" onClose={onClose}>
      <SpeechSettings visible={visible} theme={theme} />
      <NotificationSettings visible={visible} theme={theme} InputComponent={KeyboardTextInput} />
      <View style={styles.settingsSection}>
        <View style={styles.updateStatusCard}>
          <View style={styles.updateStatusIcon}>{statusIcon}</View>
          <View style={styles.updateStatusTextBlock}>
            <Text style={styles.updateStatusTitle}>{ota.statusLabel}</Text>
            <Text style={styles.updateStatusMeta} numberOfLines={2}>
              JS {ota.info.jsVersion} · {ota.info.channel} · {ota.info.launchType}
            </Text>
          </View>
        </View>
        <View style={styles.settingsButtonRow}>
          <Pressable
            style={[styles.settingsSecondaryButton, ota.isBusy ? styles.disabledButton : null]}
            disabled={ota.isBusy}
            onPress={() => ota.checkForUpdate("manual").catch(() => {})}
          >
            {ota.isBusy && !ota.isReady ? (
              <ActivityIndicator color={theme.colors.text} />
            ) : (
              <RefreshCcw size={15} color={theme.colors.text} />
            )}
            <Text style={styles.secondaryButtonText}>Check</Text>
          </Pressable>
          <Pressable
            style={[styles.settingsPrimaryButton, !ota.isReady || ota.phase === "restarting" ? styles.disabledButton : null]}
            disabled={!ota.isReady || ota.phase === "restarting"}
            onPress={() => ota.applyUpdate().catch(() => {})}
          >
            {ota.phase === "restarting" ? (
              <ActivityIndicator color={theme.colors.surfaceRaised} />
            ) : (
              <DownloadIcon color={theme.colors.surfaceRaised} />
            )}
            <Text style={styles.primaryButtonText}>{ota.applyLabel}</Text>
          </Pressable>
        </View>
      </View>

      {Platform.OS === "ios" ? (
        <View style={styles.settingsSection}>
          <View style={styles.settingsSectionHeader}>
            <Type size={16} color={theme.colors.textMuted} />
            <Text style={styles.settingsSectionTitle}>Text size</Text>
          </View>
          <Text style={styles.settingsSectionDescription}>
            Changes text throughout cards, controls, transcripts, composers, and terminals.
          </Text>
          <View style={styles.fontScaleRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Decrease text size"
              accessibilityState={{ disabled: !canDecreaseFontScale }}
              disabled={!canDecreaseFontScale}
              style={[
                styles.fontScaleButton,
                !canDecreaseFontScale ? styles.disabledButton : null,
              ]}
              onPress={() => onFontScaleLevelChange(stepFontScale(fontScaleLevel, -1))}
            >
              <Type size={15} color={theme.colors.text} />
              <Minus size={14} color={theme.colors.text} />
            </Pressable>
            <View
              accessibilityRole="text"
              accessibilityLabel={`Text size ${FONT_SCALE_LABELS[fontScaleLevel]}`}
              style={styles.fontScaleValue}
            >
              <Text style={styles.fontScaleValueTitle}>
                {FONT_SCALE_LABELS[fontScaleLevel]}
              </Text>
              <Text style={styles.fontScaleValueMeta}>
                {Math.round(FONT_SCALE_VALUES[fontScaleLevel] * 100)}%
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Increase text size"
              accessibilityState={{ disabled: !canIncreaseFontScale }}
              disabled={!canIncreaseFontScale}
              style={[
                styles.fontScaleButton,
                !canIncreaseFontScale ? styles.disabledButton : null,
              ]}
              onPress={() => onFontScaleLevelChange(stepFontScale(fontScaleLevel, 1))}
            >
              <Type size={20} color={theme.colors.text} />
              <Plus size={14} color={theme.colors.text} />
            </Pressable>
          </View>
        </View>
      ) : null}



      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeader}>
          <Info size={16} color={theme.colors.textMuted} />
          <Text style={styles.settingsSectionTitle}>Version</Text>
        </View>
        <UpdateInfoRow label="App version" value={ota.info.appVersion} />
        <UpdateInfoRow label="Native build" value={ota.info.nativeBuild} />
        <UpdateInfoRow label="JS version" value={ota.info.jsVersion} />
        <UpdateInfoRow label="Update ID" value={ota.info.updateLabel} />
        <UpdateInfoRow label="Runtime" value={ota.info.runtimeVersion} />
        <UpdateInfoRow label="Channel" value={ota.info.channel} />
        <UpdateInfoRow label="Created" value={ota.info.createdAt} />
        <UpdateInfoRow label="Launch" value={ota.info.launchType} />
        <UpdateInfoRow label="Check on launch" value={ota.info.checkOnLaunch} />
      </View>
    </SheetModal>
  );
}

function DownloadIcon({ color }: { color: string }) {
  return <CloudDownload size={15} color={color} />;
}

function UpdateInfoRow({ label, value }: { label: string; value: string }) {
  const styles = useAppStyles();
  return (
    <View style={styles.settingsInfoRow}>
      <Text style={styles.settingsInfoLabel}>{label}</Text>
      <Text style={styles.settingsInfoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function VoiceWaveform({
  prominent = false,
  color,
}: {
  prominent?: boolean;
  color?: string;
}) {
  const theme = useAppTheme();
  const styles = useAppStyles();
  const bars = React.useRef([0, 1, 2, 3, 4, 5, 6].map(() => new Animated.Value(0.18))).current;
  const barShape = React.useRef([0.52, 0.78, 0.92, 1, 0.88, 0.7, 0.48]).current;

  useSpeechRecognitionEvent("volumechange", (event) => {
    const rawLevel = Number(event.value);
    const level = Number.isFinite(rawLevel) && rawLevel > 0
      ? Math.min(rawLevel / 10, 1)
      : 0;
    Animated.parallel(
      bars.map((bar, index) =>
        Animated.timing(bar, {
          toValue: 0.18 + level * 0.82 * barShape[index],
          duration: 90,
          useNativeDriver: true,
        }),
      ),
    ).start();
  });

  React.useEffect(() => {
    return () => {
      bars.forEach((bar) => {
        bar.stopAnimation();
        bar.setValue(0.18);
      });
    };
  }, [bars]);

  return (
    <View
      style={[styles.voiceWaveform, prominent ? styles.voiceWaveformProminent : null]}
      pointerEvents="none"
    >
      {bars.map((bar, index) => (
        <Animated.View
          key={index}
          style={[
            styles.voiceWaveformBar,
            prominent ? styles.voiceWaveformBarProminent : null,
            {
              backgroundColor: color || theme.colors.accent,
              transform: [{ scaleY: bar }],
            },
          ]}
        />
      ))}
    </View>
  );
}

type ServerVoiceMode = "idle" | "recording" | "transcribing";

function voiceAudioContentType(uri: string): string {
  const path = uri.split("?")[0]?.toLowerCase() || "";
  if (path.endsWith(".wav")) return "audio/wav";
  if (path.endsWith(".m4a") || path.endsWith(".mp4")) return "audio/mp4";
  if (path.endsWith(".mp3") || path.endsWith(".mpeg") || path.endsWith(".mpga")) return "audio/mpeg";
  if (path.endsWith(".webm")) return "audio/webm";
  return "audio/wav";
}

function safelyAbortVoiceRecognition() {
  try {
    ExpoSpeechRecognitionModule.abort();
  } catch {
    // The native module can reject abort when recognition already ended.
  }
}

function safelyStopVoiceRecognition() {
  try {
    ExpoSpeechRecognitionModule.stop();
  } catch {
    // The native module can reject stop when recognition already ended.
  }
}

function useServerVoiceInput({
  scopeKey,
  machineId,
  onText,
  onStatus,
  contextualStrings,
}: {
  scopeKey: string;
  machineId: string;
  onText: (value: string) => void;
  onStatus: (value: string) => void;
  contextualStrings: readonly string[];
}) {
  const api = useTmuxMobileApi();
  const [mode, setModeState] = React.useState<ServerVoiceMode>("idle");
  const activeRef = React.useRef(false);
  const modeRef = React.useRef<ServerVoiceMode>("idle");
  const audioUriRef = React.useRef("");
  const lastTranscribedUriRef = React.useRef("");
  const heardSpeechRef = React.useRef(false);
  const audibleFrameCountRef = React.useRef(0);
  const scopeKeyRef = React.useRef(scopeKey);
  const requestGenerationRef = React.useRef(0);

  const setMode = React.useCallback((next: ServerVoiceMode) => {
    modeRef.current = next;
    setModeState(next);
  }, []);

  React.useEffect(() => {
    if (scopeKeyRef.current !== scopeKey) {
      requestGenerationRef.current += 1;
      if (activeRef.current) {
        activeRef.current = false;
        audioUriRef.current = "";
        lastTranscribedUriRef.current = "";
        heardSpeechRef.current = false;
        audibleFrameCountRef.current = 0;
        setMode("idle");
        safelyAbortVoiceRecognition();
      }
    }
    scopeKeyRef.current = scopeKey;
  }, [scopeKey, setMode]);

  React.useEffect(() => {
    return () => {
      requestGenerationRef.current += 1;
      if (!activeRef.current) return;
      activeRef.current = false;
      safelyAbortVoiceRecognition();
    };
  }, []);

  const finishRecording = React.useCallback(async (uri: string | null | undefined) => {
    if (!activeRef.current) return;
    const requestGeneration = requestGenerationRef.current;
    const requestScope = scopeKeyRef.current;
    const audioUri = uri || audioUriRef.current;
    audioUriRef.current = audioUri || "";
    setMode("transcribing");
    if (!api) {
      activeRef.current = false;
      setMode("idle");
      onStatus("Voice input is not connected");
      return;
    }
    if (!machineId) {
      activeRef.current = false;
      setMode("idle");
      onStatus("Voice target is missing");
      return;
    }
    if (!audioUri) {
      activeRef.current = false;
      setMode("idle");
      onStatus("Voice recording was not saved");
      return;
    }
    if (!heardSpeechRef.current) {
      activeRef.current = false;
      audioUriRef.current = "";
      audibleFrameCountRef.current = 0;
      setMode("idle");
      onStatus("No speech detected");
      return;
    }
    if (lastTranscribedUriRef.current === audioUri) return;
    lastTranscribedUriRef.current = audioUri;
    onStatus("Transcribing...");
    try {
      const result = await api.transcribeAudio(machineId, {
        uri: audioUri,
        type: voiceAudioContentType(audioUri),
      });
      if (
        requestGeneration !== requestGenerationRef.current ||
        requestScope !== scopeKeyRef.current
      ) {
        return;
      }
      const transcript = String(result.text || "").trim();
      if (!transcript) {
        onStatus("No speech detected");
        return;
      }
      onText(transcript);
      onStatus("Voice added");
      void Haptics.selectionAsync();
    } catch (error) {
      if (
        requestGeneration !== requestGenerationRef.current ||
        requestScope !== scopeKeyRef.current
      ) {
        return;
      }
      onStatus(error instanceof Error ? `Voice failed: ${error.message}` : `Voice failed: ${String(error)}`);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      if (
        requestGeneration === requestGenerationRef.current &&
        requestScope === scopeKeyRef.current
      ) {
        activeRef.current = false;
        audioUriRef.current = "";
        heardSpeechRef.current = false;
        audibleFrameCountRef.current = 0;
        setMode("idle");
      }
    }
  }, [api, machineId, onStatus, onText, setMode]);

  useSpeechRecognitionEvent("start", () => {
    if (!activeRef.current) return;
    setMode("recording");
    onStatus("Listening...");
  });

  useSpeechRecognitionEvent("audiostart", (event) => {
    if (!activeRef.current) return;
    audioUriRef.current = event.uri || "";
  });

  useSpeechRecognitionEvent("volumechange", (event) => {
    if (!activeRef.current) return;
    const volume = Number(event.value);
    if (Number.isFinite(volume) && volume > 0) {
      audibleFrameCountRef.current += 1;
      if (audibleFrameCountRef.current >= 3) heardSpeechRef.current = true;
      return;
    }
    audibleFrameCountRef.current = 0;
  });

  useSpeechRecognitionEvent("audioend", (event) => {
    if (!activeRef.current) return;
    void finishRecording(event.uri);
  });

  useSpeechRecognitionEvent("end", () => {
    if (!activeRef.current) return;
    if (modeRef.current === "recording") {
      setMode("transcribing");
      onStatus("Transcribing...");
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    if (!activeRef.current) return;
    activeRef.current = false;
    audioUriRef.current = "";
    heardSpeechRef.current = false;
    audibleFrameCountRef.current = 0;
    setMode("idle");
    onStatus(event.message || `Voice input failed: ${event.error}`);
  });

  const toggle = React.useCallback(async () => {
    if (modeRef.current === "recording") {
      safelyStopVoiceRecognition();
      setMode("transcribing");
      onStatus("Transcribing...");
      return;
    }
    if (modeRef.current === "transcribing") return;
    const requestGeneration = ++requestGenerationRef.current;
    onStatus("");
    if (!api) {
      onStatus("Voice input is not connected");
      return;
    }
    if (!machineId || !scopeKey) {
      onStatus("Voice target is missing");
      return;
    }
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      onStatus("Voice input is not available on this device");
      return;
    }
    if (!ExpoSpeechRecognitionModule.supportsRecording()) {
      onStatus("Voice recording is not available on this device");
      return;
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (
      requestGeneration !== requestGenerationRef.current ||
      scopeKeyRef.current !== scopeKey
    ) {
      return;
    }
    if (!permission.granted) {
      onStatus("Voice permission denied");
      return;
    }
    activeRef.current = true;
    audioUriRef.current = "";
    lastTranscribedUriRef.current = "";
    heardSpeechRef.current = false;
    audibleFrameCountRef.current = 0;
    setMode("recording");
    try {
      ExpoSpeechRecognitionModule.start({
        lang: "zh-CN",
        interimResults: false,
        maxAlternatives: 1,
        continuous: true,
        addsPunctuation: true,
        iosTaskHint: "dictation",
        contextualStrings: [...contextualStrings],
        volumeChangeEventOptions: {
          enabled: true,
          intervalMillis: 100,
        },
        recordingOptions: {
          persist: true,
          outputFileName: `cjmux-voice-${Date.now()}.wav`,
          outputSampleRate: 16000,
          outputEncoding: "pcmFormatInt16",
        },
      });
    } catch (error) {
      activeRef.current = false;
      audioUriRef.current = "";
      setMode("idle");
      onStatus(error instanceof Error ? `Voice failed: ${error.message}` : `Voice failed: ${String(error)}`);
    }
  }, [api, contextualStrings, machineId, onStatus, scopeKey, setMode]);

  return {
    active: mode !== "idle",
    recording: mode === "recording",
    transcribing: mode === "transcribing",
    toggle,
  };
}

function useLocalVoiceInput({
  scopeKey,
  onText,
  onStatus,
  contextualStrings,
}: {
  scopeKey: string;
  onText: (value: string) => void;
  onStatus: (value: string) => void;
  contextualStrings: readonly string[];
}) {
  const [active, setActiveState] = React.useState(false);
  const activeRef = React.useRef(false);
  const receivedResultRef = React.useRef(false);
  const transcriptRef = React.useRef("");
  const scopeKeyRef = React.useRef(scopeKey);
  const requestGenerationRef = React.useRef(0);

  const setActive = React.useCallback((next: boolean) => {
    activeRef.current = next;
    setActiveState(next);
  }, []);

  React.useEffect(() => {
    if (scopeKeyRef.current !== scopeKey) {
      requestGenerationRef.current += 1;
      if (activeRef.current) {
        setActive(false);
        safelyAbortVoiceRecognition();
      }
    }
    scopeKeyRef.current = scopeKey;
  }, [scopeKey, setActive]);

  React.useEffect(() => {
    return () => {
      requestGenerationRef.current += 1;
      if (!activeRef.current) return;
      activeRef.current = false;
      safelyAbortVoiceRecognition();
    };
  }, []);

  useSpeechRecognitionEvent("start", () => {
    if (!activeRef.current) return;
    onStatus("Listening...");
  });

  useSpeechRecognitionEvent("result", (event) => {
    if (!activeRef.current || !event.isFinal) return;
    const rawTranscript = String(event.results[0]?.transcript || "");
    const transcript = rawTranscript.trim();
    if (!transcript) return;
    transcriptRef.current =
      transcriptRef.current && /^\s/.test(rawTranscript)
        ? `${transcriptRef.current} ${transcript}`
        : transcript;
    receivedResultRef.current = true;
    onText(transcriptRef.current);
    onStatus("Voice added");
    void Haptics.selectionAsync();
  });

  useSpeechRecognitionEvent("end", () => {
    if (!activeRef.current) return;
    setActive(false);
    if (!receivedResultRef.current) onStatus("No speech detected");
  });

  useSpeechRecognitionEvent("error", (event) => {
    if (!activeRef.current) return;
    setActive(false);
    onStatus(event.message || `Voice input failed: ${event.error}`);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  });

  const toggle = React.useCallback(async () => {
    if (activeRef.current) {
      safelyStopVoiceRecognition();
      onStatus("Finishing...");
      return;
    }
    const requestGeneration = ++requestGenerationRef.current;
    onStatus("");
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      onStatus("Voice input is not available on this device");
      return;
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (
      requestGeneration !== requestGenerationRef.current ||
      scopeKeyRef.current !== scopeKey
    ) {
      return;
    }
    if (!permission.granted) {
      onStatus("Voice permission denied");
      return;
    }
    receivedResultRef.current = false;
    transcriptRef.current = "";
    setActive(true);
    try {
      ExpoSpeechRecognitionModule.start({
        lang: "zh-CN",
        interimResults: false,
        maxAlternatives: 1,
        continuous: true,
        addsPunctuation: true,
        iosTaskHint: "dictation",
        contextualStrings: [...contextualStrings],
        volumeChangeEventOptions: {
          enabled: true,
          intervalMillis: 100,
        },
      });
    } catch (error) {
      setActive(false);
      onStatus(error instanceof Error ? `Voice failed: ${error.message}` : `Voice failed: ${String(error)}`);
    }
  }, [contextualStrings, onStatus, scopeKey, setActive]);

  return { active, toggle };
}

function KeyboardTextInput(props: TextInputProps) {
  if (useVisionControls()) return <VisionTextField {...props} />;
  return <TextInput {...props} />;
}

// Forms that do not have a specialized voice field still never mount a native
// input on Vision Pro. Explicit voice/clear buttons keep those fields usable.
function VisionTextField(props: TextInputProps) {
  const id = React.useId();
  const [status, setStatus] = React.useState("");
  const voice = useLocalVoiceInput({
    scopeKey: id,
    onText: text => props.onChangeText?.(props.maxLength ? text.slice(0, props.maxLength) : text),
    onStatus: setStatus,
    contextualStrings: [],
  });
  return <VoiceValueField
    label={props.accessibilityLabel || props.placeholder || "Text"}
    value={props.secureTextEntry && props.value ? "••••••" : props.value || ""}
    emptyLabel={props.placeholder || "Speak to enter text"}
    active={voice.active}
    status={status}
    disabled={props.editable === false}
    onToggle={() => { void voice.toggle().catch(error => setStatus(String(error))); }}
    onClear={() => props.onChangeText?.("")}
  />;
}

function VoiceValueField({
  label,
  value,
  emptyLabel,
  active,
  status,
  disabled,
  onToggle,
  onClear,
}: {
  label: string;
  value: string;
  emptyLabel: string;
  active: boolean;
  status?: string;
  disabled?: boolean;
  onToggle: () => void;
  onClear?: () => void;
}) {
  const theme = useAppTheme();
  const styles = useAppStyles();
  const clearDisabled = disabled || active || !value;

  return (
    <View style={styles.visionVoiceField}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.visionVoiceValue}>
        <Text
          selectable
          style={[styles.visionVoiceValueText, !value ? styles.visionVoiceValuePlaceholder : null]}
        >
          {value || emptyLabel}
        </Text>
      </View>
      <View style={styles.visionVoiceActionRow}>
        <Pressable
          accessibilityLabel={active ? `Stop ${label} voice input` : `Speak ${label}`}
          style={[
            styles.visionVoiceButton,
            active ? styles.visionVoiceButtonActive : null,
            disabled ? styles.disabledButton : null,
          ]}
          disabled={disabled}
          onPress={onToggle}
        >
          {active ? (
            <>
              <MicOff size={20} color={theme.colors.accent} />
              <VoiceWaveform />
            </>
          ) : (
            <Mic size={22} color={theme.colors.text} />
          )}
          <Text
            style={[
              styles.visionVoiceButtonText,
              active ? styles.visionVoiceButtonTextActive : null,
            ]}
          >
            {active ? "Stop" : value ? "Replace by voice" : "Speak"}
          </Text>
        </Pressable>
        {onClear ? (
          <Pressable
            accessibilityLabel={`Clear ${label}`}
            style={[
              styles.visionVoiceClearButton,
              clearDisabled ? styles.disabledButton : null,
            ]}
            disabled={clearDisabled}
            onPress={onClear}
          >
            <X size={26} color={clearDisabled ? theme.colors.textMuted : theme.colors.text} />
            <Text style={styles.visionVoiceButtonText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      {status ? (
        <Text style={styles.paneComposerStatus} numberOfLines={2}>
          {status}
        </Text>
      ) : null}
    </View>
  );
}

function TerminalKeyboardSheet({
  visible,
  disabled,
  onClose,
  onKey,
  onShortcut,
}: {
  visible: boolean;
  disabled?: boolean;
  onClose: () => void;
  onKey: (entry: TerminalKeyEntry) => void;
  onShortcut?: (text: string) => void;
}) {
  const styles = useAppStyles();
  const visionControls = useVisionControls();

  return (
    <SheetModal visible={visible} title="Terminal keys" onClose={onClose}>
      {onShortcut ? (
        <View style={styles.shortcutRow}>
          {PROMPT_SHORTCUTS.map((shortcut) => (
            <Pressable
              key={shortcut.label}
              style={styles.shortcutChip}
              disabled={disabled}
              onPress={() => {
                onShortcut(shortcut.text);
                void Haptics.selectionAsync();
              }}
            >
              <Text style={styles.shortcutText}>{shortcut.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.keyGrid}>
        {TERMINAL_KEYBOARD_KEYS.map((entry) => (
          <Pressable
            key={entry.label}
            accessibilityLabel={`Send ${entry.label} terminal key`}
            style={[
              styles.keyButton,

              entry.danger ? styles.keyButtonDanger : null,
            ]}
            disabled={disabled}
            onPress={() => {
              onKey(entry);
              onClose();
            }}
          >
            <Text
              style={[
                styles.keyButtonText,

                entry.danger ? styles.keyButtonTextDanger : null,
              ]}
            >
              {entry.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </SheetModal>
  );
}

function PaneComposer({
  variant,
  value,
  onChangeText,
  onSend,
  onToggleVoice,
  onToggleStreaming,
  streamingActive = false,
  streamingMode = "idle",
  onOpenKeys,
  onQuickKey,
  onOpenUpload,
  onShortcut,
  onClear,
  clearInline = false,
  singleShell = false,
  onRetry,
  recognizing = false,
  voiceRecording,
  voiceTranscribing = false,
  disabled = false,
  sendDisabled = false,
  sendBusy = false,
  keyBusy = false,
  uploadBusy = false,
  showUpload = false,
  showShortcuts = false,
  autoFocus = false,
  multiline,
  placeholder,
  status,
  error,
  retryLabel = "Retry",
  retryDisabled = false,
  reserveStatusSpace = true,
  onKeyPress,
}: {
  variant: PaneComposerVariant;
  value: string;
  onChangeText: (value: string) => void;
  onSend: () => void;
  onToggleVoice: () => void;
  onToggleStreaming?: () => void;
  streamingActive?: boolean;
  streamingMode?: StreamingDictationMode;
  onOpenKeys: () => void;
  onQuickKey?: (entry: TerminalKeyEntry) => void;
  onOpenUpload?: () => void;
  onShortcut?: (value: string) => void;
  onClear?: () => void;
  clearInline?: boolean;
  singleShell?: boolean;
  onRetry?: () => void;
  recognizing?: boolean;
  voiceRecording?: boolean;
  voiceTranscribing?: boolean;
  disabled?: boolean;
  sendDisabled?: boolean;
  sendBusy?: boolean;
  keyBusy?: boolean;
  uploadBusy?: boolean;
  showUpload?: boolean;
  showShortcuts?: boolean;
  autoFocus?: boolean;
  multiline?: boolean;
  placeholder?: string;
  status?: string;
  error?: string;
  retryLabel?: string;
  retryDisabled?: boolean;
  reserveStatusSpace?: boolean;
  onKeyPress?: TextInputProps["onKeyPress"];
}) {
  const theme = useAppTheme();
  const styles = useAppStyles();
  const { height: viewportHeight } = useWindowDimensions();
  const visionControls = useVisionControls();
  const expanded = variant === "expanded";
  const usesSingleShell = expanded && singleShell;
  const busy = sendBusy || keyBusy || uploadBusy;
  const controlDisabled = disabled || busy;
  const sendIsDisabled = disabled || sendDisabled || sendBusy || keyBusy;
  const standardVoiceRecording = voiceRecording ?? recognizing;
  const standardVoiceActive = standardVoiceRecording || voiceTranscribing || streamingActive;
  const standardActionDisabled = controlDisabled || standardVoiceActive;
  const standardSendIsDisabled = sendIsDisabled || standardVoiceRecording || voiceTranscribing || streamingMode === "connecting";
  const standardStatus = (standardVoiceRecording || voiceTranscribing) ? "" : status;
  const iconColor = controlDisabled ? theme.colors.textMuted : theme.colors.text;
  const activeIconColor = theme.colors.accent;
  const showClear = expanded && Boolean(onClear);
  const presentation = resolvePaneComposerPresentation({
    visionControls,
    showShortcuts,
    showUpload,
  });
  const snippets = useSnippets(presentation.showShortcuts);
  const updateSnippets = useUpdateSnippets();
  const resetSnippets = useResetSnippets();
  const [snippetSheetVisible, setSnippetSheetVisible] = React.useState(false);
  const [snippetDraftItems, setSnippetDraftItems] = React.useState<UserSnippetItem[]>([]);
  const [snippetNewText, setSnippetNewText] = React.useState("");
  const [singleShellPromptsExpanded, setSingleShellPromptsExpanded] = React.useState(false);
  const singleShellPromptsVisible = usesSingleShell && singleShellPromptsExpanded;
  const singleShellExpandedHeight = Math.max(visionControls ? 280 : 180, Math.round(viewportHeight * 0.5));
  const snippetItems = React.useMemo(() => {
    const loaded = cleanSnippetItems(snippets.data?.items);
    return prioritizeGoalSnippet(
      loaded.length > 0 ? loaded : FALLBACK_SNIPPETS,
    );
  }, [snippets.data?.items]);

  React.useEffect(() => {
    if (!usesSingleShell || disabled) setSingleShellPromptsExpanded(false);
  }, [disabled, usesSingleShell]);

  const openSnippetManager = React.useCallback(() => {
    setSnippetDraftItems(snippetItems);
    setSnippetNewText("");
    setSnippetSheetVisible(true);
  }, [snippetItems]);

  const saveSnippetDraft = React.useCallback(async () => {
    const next = cleanSnippetItems(snippetDraftItems);
    await updateSnippets.mutateAsync(next);
    setSnippetSheetVisible(false);
  }, [snippetDraftItems, updateSnippets]);

  const addSnippetDraft = React.useCallback(() => {
    const text = snippetNewText.trim();
    if (!text) return;
    setSnippetDraftItems((current) => cleanSnippetItems([...current, { text }]));
    setSnippetNewText("");
  }, [snippetNewText]);

  const resetSnippetDraft = React.useCallback(async () => {
    const result = await resetSnippets.mutateAsync();
    setSnippetDraftItems(cleanSnippetItems(result.items));
    setSnippetNewText("");
  }, [resetSnippets]);

  const streamingControl = streamingDictationControl(streamingMode);
  const streamingDisabled = controlDisabled || recognizing || streamingControl.disabled;
  const streamingColor = streamingMode === "recording" ? "#fff" : theme.colors.surfaceRaised;
  const streamingButton = onToggleStreaming ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={streamingControl.hint}
      accessibilityHint="Tap Start to dictate. Tap Stop to keep the text, or Send to stop and send it."
      accessibilityState={{ selected: streamingMode === "recording", disabled: streamingDisabled }}
      style={[
        styles.streamingDictationButton,
        streamingMode === "recording" ? styles.streamingDictationRecording : null,
        streamingDisabled ? styles.disabledButton : null,
      ]}
      disabled={streamingDisabled}
      onPress={onToggleStreaming}
    >
      {streamingControl.icon === "spinner" ? <ActivityIndicator size="small" color={streamingColor} />
        : streamingControl.icon === "stop" ? <Square size={visionControls ? 26 : 22} color={streamingColor} fill={streamingColor} />
        : streamingControl.icon === "cancel" ? <X size={visionControls ? 26 : 22} color={streamingColor} />
        : <AudioLines size={visionControls ? 28 : 24} color={streamingColor} />}
      <Text style={[styles.streamingDictationLabel, { color: streamingColor }]}>{streamingControl.label}</Text>
    </Pressable>
  ) : null;

  const keysButton = (
    <Pressable
      accessibilityLabel="Open terminal keys"
      style={[
        expanded ? styles.paneComposerInlineButton : styles.paneComposerIconButton,
        standardActionDisabled ? styles.disabledButton : null,
      ]}
      disabled={standardActionDisabled}
      onPress={onOpenKeys}
    >
      <Terminal
        size={visionControls ? 26 : 16}
        color={standardActionDisabled ? theme.colors.textMuted : theme.colors.text}
      />
    </Pressable>
  );

  const uploadButton =
    expanded && presentation.showUpload ? (
      <Pressable
        accessibilityLabel="Upload image or file"
        style={[
          styles.paneComposerInlineButton,
          disabled || uploadBusy || standardVoiceActive ? styles.disabledButton : null,
        ]}
        disabled={disabled || uploadBusy || standardVoiceActive}
        onPress={onOpenUpload}
      >
        {uploadBusy ? (
          <ActivityIndicator color={theme.colors.text} />
        ) : (
          <Upload
            size={visionControls ? 26 : 16}
            color={disabled || standardVoiceActive ? theme.colors.textMuted : theme.colors.text}
          />
        )}
      </Pressable>
    ) : null;

  const input = presentation.mountTextInput ? (
    <KeyboardTextInput
      value={value}
      editable={!streamingActive && !disabled}
      onChangeText={onChangeText}
      multiline={multiline ?? expanded}
      autoFocus={autoFocus && !onToggleStreaming}
      autoCapitalize="none"
      autoCorrect={false}
      returnKeyType="send"
      showSoftInputOnFocus
      submitBehavior="submit"
      onSubmitEditing={streamingActive ? undefined : onSend}
      onKeyPress={streamingActive ? undefined : onKeyPress}
      style={[
        styles.paneComposerInput,
        expanded ? styles.paneComposerInputExpanded : styles.paneComposerInputCompact,
        expanded ? styles.paneComposerInputEmbedded : null,
        usesSingleShell ? styles.paneComposerInputSingleShell : null,
        usesSingleShell && !singleShellPromptsVisible
          ? styles.paneComposerInputSingleShellCollapsed
          : null,
      ]}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.textMuted}
    />
  ) : (
    <View style={[
      styles.paneComposerInput,
      expanded ? styles.paneComposerInputExpanded : styles.paneComposerInputCompact,
      expanded ? styles.paneComposerInputEmbedded : null,
      usesSingleShell ? styles.paneComposerInputSingleShell : null,
      usesSingleShell && !singleShellPromptsVisible ? styles.paneComposerInputSingleShellCollapsed : null,
    ]}>
      <ScrollView><Text selectable accessibilityLabel="Dictation draft" style={[styles.visionDraftPreviewText, { color: value ? theme.colors.text : theme.colors.textMuted }]}>
        {value || "Tap Start to dictate"}
      </Text></ScrollView>
    </View>
  );

  const sendButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={streamingActive ? "Stop dictation and send terminal input" : "Send terminal input"}
      style={[
        expanded ? styles.paneComposerInlineSendButton : styles.paneComposerSendButton,
        standardSendIsDisabled ? styles.disabledButton : null,
      ]}
      disabled={standardSendIsDisabled}
      onPress={onSend}
    >
      {sendBusy || keyBusy ? (
        <ActivityIndicator color={theme.colors.surfaceRaised} />
      ) : expanded ? (
        <Send size={visionControls ? 26 : 18} color={theme.colors.surfaceRaised} />
      ) : (
        <Send size={visionControls ? 26 : 18} color={theme.colors.surfaceRaised} />
      )}
      {visionControls ? <Text style={styles.visionComposerSendText}>Send</Text> : null}
    </Pressable>
  );

  const clearButton =
    expanded && clearInline && showClear ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Clear terminal input"
        style={[
          styles.paneComposerInlineButton,
          value.length === 0 || standardVoiceActive ? styles.disabledButton : null,
        ]}
        disabled={disabled || value.length === 0 || standardVoiceActive}
        onPress={() => {
          onClear?.();
          void Haptics.selectionAsync();
        }}
      >
        <X
          size={visionControls ? 26 : 16}
          color={value.length === 0 ? theme.colors.textMuted : theme.colors.text}
        />
      </Pressable>
    ) : null;

  const shortcutsBar = presentation.showShortcuts ? (
    <View style={[styles.snippetBar, usesSingleShell ? styles.snippetBarEmbedded : null]}>
      <ScrollView
        horizontal
        style={styles.snippetScroll}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.snippetScrollContent}
      >
        {snippetItems.map((shortcut, index) => (
          <Pressable
            key={`${shortcut.text}-${index}`}
            style={[
              styles.shortcutChip,
              standardVoiceActive ? styles.disabledButton : null,
            ]}
            disabled={disabled || standardVoiceActive}
            onPress={() => {
              onShortcut?.(shortcut.text);
              void Haptics.selectionAsync();
            }}
          >
            <Text style={styles.shortcutText} numberOfLines={1}>
              {composerSnippetLabel(shortcut.text)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {showClear && !clearInline ? (
        <Pressable
          accessibilityLabel="Clear terminal input"
          style={[
            styles.snippetIconButton,
            value.length === 0 || standardVoiceActive ? styles.disabledButton : null,
          ]}
          disabled={disabled || value.length === 0 || standardVoiceActive}
          onPress={() => {
            onClear?.();
            void Haptics.selectionAsync();
          }}
        >
          <X size={15} color={value.length === 0 ? theme.colors.textMuted : theme.colors.text} />
        </Pressable>
      ) : null}
      <Pressable
        accessibilityLabel="Manage shortcuts"
        style={[
          styles.snippetIconButton,
          snippets.isFetching || standardVoiceActive ? styles.disabledButton : null,
        ]}
        disabled={disabled || standardVoiceActive}
        onPress={openSnippetManager}
      >
        <ListPlus size={visionControls ? 26 : 16} color={theme.colors.text} />
      </Pressable>
    </View>
  ) : null;

  const promptToggleButton = usesSingleShell && presentation.showShortcuts ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        singleShellPromptsVisible
          ? "Collapse terminal composer"
          : "Expand terminal composer and show prompt shortcuts"
      }
      accessibilityState={{ expanded: singleShellPromptsVisible }}
      style={[
        styles.paneComposerInlineButton,
        singleShellPromptsVisible ? styles.paneComposerInlineButtonActive : null,
        standardVoiceActive ? styles.disabledButton : null,
      ]}
      disabled={disabled || standardVoiceActive}
      onPress={() => {
        setSingleShellPromptsExpanded((current) => !current);
        void Haptics.selectionAsync();
      }}
    >
      {singleShellPromptsVisible ? (
        <Minimize2 size={visionControls ? 26 : 17} color={activeIconColor} />
      ) : (
        <Maximize2 size={visionControls ? 26 : 17} color={theme.colors.text} />
      )}
    </Pressable>
  ) : null;

  return (
    <View style={[styles.paneComposer, usesSingleShell ? styles.paneComposerSingleShell : null]}>
      {streamingButton}
      {!usesSingleShell ? shortcutsBar : null}
      {expanded ? (
        <>
          <View
            style={[
              styles.paneComposerInputShell,
              usesSingleShell ? styles.paneComposerInputShellSingle : null,
              usesSingleShell
                ? singleShellPromptsVisible
                  ? { height: singleShellExpandedHeight }
                  : styles.paneComposerInputShellSingleCollapsed
                : null,
            ]}
          >
            {singleShellPromptsVisible ? shortcutsBar : null}
            {input}
            {usesSingleShell && (standardStatus || error) ? (
              <Text style={styles.paneComposerEmbeddedStatus} numberOfLines={visionControls ? 3 : 2}>
                {standardStatus || error}
              </Text>
            ) : null}
            <View
              style={[
                styles.paneComposerInlineActions,
                usesSingleShell ? styles.paneComposerInlineActionsSingle : null,
              ]}
            >
              {uploadButton}
              {keysButton}
              {promptToggleButton}
              {clearButton}
              {sendButton}
            </View>
          </View>
          {!usesSingleShell && (reserveStatusSpace || standardStatus || error) ? (
            <Text style={styles.paneComposerStatus} numberOfLines={visionControls ? 3 : 2}>
              {standardStatus || error || ""}
            </Text>
          ) : null}
          {error ? (
            <View style={styles.retryRow}>
              <Text style={styles.retryErrorText} numberOfLines={2}>
                {error}
              </Text>
              <Pressable
                style={[styles.retryButton, retryDisabled || streamingActive ? styles.disabledButton : null]}
                disabled={retryDisabled || streamingActive}
                onPress={onRetry}
              >
                <RefreshCcw size={14} color={theme.colors.surfaceRaised} />
                <Text style={styles.retryButtonText}>{retryLabel}</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : (
        <View style={styles.paneComposerCompactRow}>
          {keysButton}
          {input}
          {sendButton}
        </View>
      )}
      <SheetModal visible={snippetSheetVisible} title="Shortcuts" onClose={() => setSnippetSheetVisible(false)}>
        {snippetDraftItems.map((item, index) => (
          <View key={`snippet-${index}`} style={styles.snippetEditRow}>
            <Pressable
              accessibilityLabel="Insert shortcut"
              style={styles.snippetRowIconButton}
              disabled={!item.text.trim()}
              onPress={() => {
                onShortcut?.(item.text);
                setSnippetSheetVisible(false);
              }}
            >
              <Send size={14} color={theme.colors.text} />
            </Pressable>
            <KeyboardTextInput
              value={item.text}
              onChangeText={(text) => {
                setSnippetDraftItems((current) =>
                  current.map((entry, entryIndex) => (entryIndex === index ? { text } : entry)),
                );
              }}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.snippetRowInput}
            />
            <Pressable
              accessibilityLabel="Move shortcut up"
              style={[styles.snippetRowIconButton, index === 0 ? styles.disabledButton : null]}
              disabled={index === 0}
              onPress={() => {
                setSnippetDraftItems((current) => {
                  const next = current.slice();
                  [next[index - 1], next[index]] = [next[index], next[index - 1]];
                  return next;
                });
              }}
            >
              <ArrowUp size={14} color={index === 0 ? theme.colors.textMuted : theme.colors.text} />
            </Pressable>
            <Pressable
              accessibilityLabel="Move shortcut down"
              style={[styles.snippetRowIconButton, index === snippetDraftItems.length - 1 ? styles.disabledButton : null]}
              disabled={index === snippetDraftItems.length - 1}
              onPress={() => {
                setSnippetDraftItems((current) => {
                  const next = current.slice();
                  [next[index], next[index + 1]] = [next[index + 1], next[index]];
                  return next;
                });
              }}
            >
              <ArrowDown size={14} color={index === snippetDraftItems.length - 1 ? theme.colors.textMuted : theme.colors.text} />
            </Pressable>
            <Pressable
              accessibilityLabel="Delete shortcut"
              style={styles.snippetRowIconButton}
              onPress={() => {
                setSnippetDraftItems((current) => current.filter((_entry, entryIndex) => entryIndex !== index));
              }}
            >
              <Trash2 size={14} color={theme.colors.danger} />
            </Pressable>
          </View>
        ))}
        <View style={styles.snippetAddRow}>
          <KeyboardTextInput
            value={snippetNewText}
            onChangeText={setSnippetNewText}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={addSnippetDraft}
            style={styles.snippetAddInput}
            placeholder="New shortcut"
            placeholderTextColor={theme.colors.textMuted}
          />
          <Pressable
            accessibilityLabel="Add shortcut"
            style={[styles.snippetRowIconButton, !snippetNewText.trim() ? styles.disabledButton : null]}
            disabled={!snippetNewText.trim()}
            onPress={addSnippetDraft}
          >
            <Plus size={15} color={snippetNewText.trim() ? theme.colors.text : theme.colors.textMuted} />
          </Pressable>
        </View>
        <View style={styles.snippetSheetActions}>
          <Pressable
            style={[styles.settingsSecondaryButton, resetSnippets.isPending ? styles.disabledButton : null]}
            disabled={resetSnippets.isPending || updateSnippets.isPending}
            onPress={() => {
              resetSnippetDraft().catch(() => {});
            }}
          >
            <RefreshCcw size={14} color={theme.colors.text} />
            <Text style={styles.secondaryButtonText}>Reset</Text>
          </Pressable>
          <Pressable
            style={[styles.settingsPrimaryButton, updateSnippets.isPending ? styles.disabledButton : null]}
            disabled={updateSnippets.isPending || resetSnippets.isPending}
            onPress={() => {
              saveSnippetDraft().catch(() => {});
            }}
          >
            {updateSnippets.isPending ? (
              <ActivityIndicator color={theme.colors.surfaceRaised} />
            ) : (
              <Check size={14} color={theme.colors.surfaceRaised} />
            )}
            <Text style={styles.primaryButtonText}>Save</Text>
          </Pressable>
        </View>
        {snippets.error || updateSnippets.error || resetSnippets.error ? (
          <Text style={styles.errorText} numberOfLines={2}>
            {snippets.error?.message || updateSnippets.error?.message || resetSnippets.error?.message}
          </Text>
        ) : null}
      </SheetModal>
    </View>
  );
}

function SendModal({ target, onClose }: { target: AgentSession | null; onClose: () => void }) {
  const api = useTmuxMobileApi();
  const theme = useAppTheme();
  const styles = useAppStyles();
  const sendText = useSendText();
  const sendKey = useSendKey();
  const uploadFile = useUploadFile();
  const [text, setText] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [uploadPickerVisible, setUploadPickerVisible] = React.useState(false);
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [sendError, setSendError] = React.useState("");
  const [retryAction, setRetryAction] = React.useState<SendRetryAction | null>(null);
  const targetScopeKey = target ? agentCardKey(target) : "";
  const targetMachineId = target ? agentMachineKey(target) : "";
  const targetWindowName = target?.windowName?.trim() || "";
  const targetSessionName = target?.sessionName?.trim() || "";
  const sendSheetTitle = targetWindowName || targetSessionName || "Send to pane";
  const sendSheetMeta = target
    ? [
        "Send to pane",
        targetSessionName && targetSessionName !== sendSheetTitle ? targetSessionName : "",
        target.machineHostname || agentMachineKey(target),
        target.cwd || "",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  React.useEffect(() => {
    if (target) {
      setText("");
      setStatus("");
      setSendError("");
      setRetryAction(null);
      setUploadPickerVisible(false);
      setKeyboardVisible(false);
    }
  }, [target]);

  const clearSendFailure = React.useCallback(() => {
    setSendError("");
    setRetryAction(null);
  }, []);

  const appendText = React.useCallback((value: string) => {
    clearSendFailure();
    setText((current) => {
      if (!current) return value;
      return /\s$/.test(current) ? `${current}${value}` : `${current} ${value}`;
    });
  }, [clearSendFailure]);

  const voiceInput = useServerVoiceInput({
    scopeKey: targetScopeKey,
    machineId: targetMachineId,
    onText: appendText,
    onStatus: setStatus,
    contextualStrings: VOICE_CONTEXTUAL_STRINGS,
  });

  const streamingInput = useStreamingDictation({ api, scopeKey: targetScopeKey, value: text, onChangeText: setText, onStatus: setStatus });

  const uploadAssets = React.useCallback(async (
    assets: Array<{ uri: string; name?: string | null; mimeType?: string | null }>,
    label: string,
  ) => {
    if (!target) return;
    if (assets.length === 0) return;
    setUploading(true);
    setUploadPickerVisible(false);
    setStatus(assets.length === 1 ? `Uploading ${label}...` : `Uploading ${assets.length} ${label}s...`);
    try {
      let count = 0;
      for (const asset of assets) {
        const fallbackName = asset.uri.split("/").pop() || `upload-${Date.now()}`;
        const uploaded = await uploadFile.mutateAsync({
          agent: target,
          file: {
            uri: asset.uri,
            name: asset.name || fallbackName,
            type: asset.mimeType || "application/octet-stream",
          },
        });
        if (uploaded.url || uploaded.path) {
          appendText((uploaded.url || uploaded.path)!);
          count += 1;
        }
      }
      setStatus(count === 1 ? `${label[0].toUpperCase()}${label.slice(1)} uploaded` : `${count} ${label}s uploaded`);
      void Haptics.selectionAsync();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setUploading(false);
    }
  }, [appendText, target, uploadFile]);

  const pickMedia = React.useCallback(async () => {
    setStatus("");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setStatus("Photos permission denied");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync(MEDIA_LIBRARY_OPTIONS);
    if (result.canceled || result.assets.length === 0) return;
    await uploadAssets(
      result.assets.map(mediaUploadAsset),
      "file",
    );
  }, [uploadAssets]);

  const pickFiles = React.useCallback(async () => {
    setStatus("");
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: true,
      type: "*/*",
    });
    if (result.canceled || result.assets.length === 0) return;
    await uploadAssets(
      result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name || asset.uri.split("/").pop() || `upload-${Date.now()}`,
        mimeType: asset.mimeType || "application/octet-stream",
      })),
      "file",
    );
  }, [uploadAssets]);

  const sendTerminalKey = React.useCallback(
    (entry: TerminalKeyEntry) => {
      if (!target) return;
      const label = entry.label;
      clearSendFailure();
      setStatus(`Sending ${label}...`);
      if ("command" in entry) {
        sendText.mutate(
          { agent: target, text: entry.command, enter: true },
          {
            onSuccess: () => setStatus(`Sent ${label}`),
            onError: (error) => {
              setStatus(`Failed ${label}`);
              setSendError(error.message);
              setRetryAction({ kind: "terminal", label: `Retry ${label}`, entry });
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            },
          },
        );
      } else {
        sendKey.mutate(
          { agent: target, key: entry.key },
          {
            onSuccess: () => setStatus(`Sent ${label}`),
            onError: (error) => {
              setStatus(`Failed ${label}`);
              setSendError(error.message);
              setRetryAction({ kind: "terminal", label: `Retry ${label}`, entry });
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            },
          },
        );
      }
      void Haptics.selectionAsync();
    },
    [clearSendFailure, sendKey, sendText, target],
  );

  const sendCurrentText = React.useCallback(() => {
    if (!target || sendText.isPending) return;
    void streamingInput.submit(async (value) => {
      clearSendFailure();
      setStatus("Sending...");
      try {
        await sendText.mutateAsync({ agent: target, text: value, enter: true });
        onClose();
      } catch (error) {
        setStatus("Send failed");
        setSendError(error instanceof Error ? error.message : String(error));
        setRetryAction({ kind: "text", label: "Retry send" });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    });
  }, [clearSendFailure, onClose, sendText, target, streamingInput.submit]);

  const retrySend = React.useCallback(() => {
    if (!retryAction) return;
    if (retryAction.kind === "terminal") {
      sendTerminalKey(retryAction.entry);
      return;
    }
    sendCurrentText();
  }, [retryAction, sendCurrentText, sendTerminalKey]);

  return (
    <SheetModal visible={Boolean(target)} title={sendSheetTitle} onClose={onClose}>
      <Text style={styles.sheetMeta} numberOfLines={2}>
        {sendSheetMeta}
      </Text>
      <PaneComposer
        variant="expanded"
        value={text}
        onChangeText={(value) => {
          setText(value);
          clearSendFailure();
        }}
        onSend={sendCurrentText}
        onToggleVoice={() => {
          voiceInput.toggle().catch((error) => {
            setStatus(error instanceof Error ? error.message : String(error));
          });
        }}
        onOpenKeys={() => setKeyboardVisible(true)}
        onQuickKey={sendTerminalKey}
        onOpenUpload={() => setUploadPickerVisible(true)}
        onShortcut={appendText}
        onClear={() => {
          setText("");
          setStatus("");
          clearSendFailure();
        }}
        onRetry={retrySend}
        onToggleStreaming={() => { void streamingInput.toggle(); }}
        streamingActive={streamingInput.active}
        streamingMode={streamingInput.mode}
        recognizing={voiceInput.active}
        voiceRecording={voiceInput.recording}
        voiceTranscribing={voiceInput.transcribing}
        disabled={!target}
        sendDisabled={!text.trim() && !streamingInput.active}
        sendBusy={sendText.isPending || streamingInput.sending}
        keyBusy={sendKey.isPending}
        uploadBusy={uploading}
        showUpload
        showShortcuts
        autoFocus
        placeholder="Type a prompt, command, or note..."
        status={status || sendKey.error?.message || uploadFile.error?.message || ""}
        error={sendError}
        retryLabel={retryAction?.label || "Retry"}
        retryDisabled={
          !retryAction ||
          sendText.isPending ||
          sendKey.isPending ||
          (retryAction.kind === "text" && !text.trim())
        }
      />
      <SheetModal visible={uploadPickerVisible} title="Upload" onClose={() => setUploadPickerVisible(false)}>
        <Pressable
          style={[styles.uploadChoiceButton, uploading ? styles.disabledButton : null]}
          disabled={uploading || !target}
          onPress={() => {
            pickMedia().catch((error) => {
              setUploadPickerVisible(false);
              setStatus(error instanceof Error ? error.message : String(error));
            });
          }}
        >
          <View style={styles.uploadChoiceIcon}>
            <ImagePlus size={20} color={theme.colors.text} />
          </View>
          <View style={styles.uploadChoiceTextBlock}>
            <Text style={styles.uploadChoiceTitle}>Photos & videos</Text>
            <Text style={styles.uploadChoiceSubtitle}>Choose from your library</Text>
          </View>
        </Pressable>
        <Pressable
          style={[styles.uploadChoiceButton, uploading ? styles.disabledButton : null]}
          disabled={uploading || !target}
          onPress={() => {
            pickFiles().catch((error) => {
              setUploadPickerVisible(false);
              setStatus(error instanceof Error ? error.message : String(error));
            });
          }}
        >
          <View style={styles.uploadChoiceIcon}>
            <FileText size={20} color={theme.colors.text} />
          </View>
          <View style={styles.uploadChoiceTextBlock}>
            <Text style={styles.uploadChoiceTitle}>File</Text>
            <Text style={styles.uploadChoiceSubtitle}>Choose documents or other files</Text>
          </View>
        </Pressable>
      </SheetModal>
      <TerminalKeyboardSheet
        visible={keyboardVisible && Boolean(target)}
        disabled={!target || sendText.isPending || sendKey.isPending}
        onClose={() => setKeyboardVisible(false)}
        onKey={sendTerminalKey}
        onShortcut={appendText}
      />
    </SheetModal>
  );
}

function RenameModal({ target, onClose }: { target: AgentSession | null; onClose: () => void }) {
  const styles = useAppStyles();
  const visionControls = useVisionControls();
  const fieldPresentation = useFieldPresentation("window-name");
  const rename = useRenameWindow();
  const [name, setName] = React.useState("");
  const [voiceStatus, setVoiceStatus] = React.useState("");
  const renameVoice = useLocalVoiceInput({
    scopeKey: target ? `rename-window:${agentCardKey(target)}` : "",
    onText: setName,
    onStatus: setVoiceStatus,
    contextualStrings: [target?.windowName || "", target?.sessionName || "", "Codex", "Claude"].filter(Boolean),
  });

  React.useEffect(() => {
    if (target) {
      setName(target.windowName || "");
      setVoiceStatus("");
    }
  }, [target]);

  return (
    <SheetModal visible={Boolean(target)} title="Rename window" onClose={onClose}>
      <Text style={styles.sheetMeta} numberOfLines={2}>
        {target ? agentSubtitle(target) : ""}
      </Text>
      {fieldPresentation === "voice" ? (
        <VoiceValueField
          label="Window name"
          value={name}
          emptyLabel="Speak a window name"
          active={renameVoice.active}
          status={voiceStatus}
          onToggle={() => {
            renameVoice.toggle().catch((error) => {
              setVoiceStatus(error instanceof Error ? error.message : String(error));
            });
          }}
          onClear={() => setName("")}
        />
      ) : (
        <KeyboardTextInput
          value={name}
          onChangeText={setName}
          autoFocus
          selectTextOnFocus
          autoCapitalize="none"
          autoCorrect={false}
          numberOfLines={1}
          style={styles.textInput}
        />
      )}
      <Pressable
        style={[
          styles.primaryButton,

          rename.isPending ? styles.disabledButton : null,
        ]}
        disabled={!target || rename.isPending || !name.trim()}
        onPress={() => {
          if (!target) return;
          rename.mutate(
            { agent: target, name: name.trim() },
            {
              onSuccess: () => onClose(),
            },
          );
        }}
      >
        <Text style={styles.primaryButtonText}>Rename</Text>
      </Pressable>
      {rename.error ? <Text style={styles.errorText}>{rename.error.message}</Text> : null}
    </SheetModal>
  );
}

function EmbeddedSshModal({
  target,
  controllerUrl,
  onClose,
}: {
  target: AgentSession | null;
  controllerUrl: string;
  onClose: () => void;
}) {
  const theme = useAppTheme();
  const appDialog = useAppDialog(theme, Boolean(target));
  const styles = useAppStyles();
  const fontScale = useFontScale();
  const visionControls = useVisionControls();
  const api = useTmuxMobileApi();
  const { width: windowWidth } = useWindowDimensions();
  const terminalRef = React.useRef<BlinkTerminalHandle | null>(null);
  const [profileLoading, setProfileLoading] = React.useState(false);
  const [profile, setProfile] = React.useState<ActiveSshProfile | null>(null);
  const [manualProfile, setManualProfile] = React.useState<StoredSshProfile | null>(null);
  const [profileSource, setProfileSource] = React.useState<"managed" | "manual" | null>(null);
  const [managedHostCandidates, setManagedHostCandidates] = React.useState<string[]>([]);
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [profileError, setProfileError] = React.useState("");
  const [host, setHost] = React.useState("");
  const [user, setUser] = React.useState("");
  const [port, setPort] = React.useState("22");
  const [authMethod, setAuthMethod] = React.useState<SshAuthMethod>("password");
  const [password, setPassword] = React.useState("");
  const [privateKey, setPrivateKey] = React.useState("");
  const [connectionState, setConnectionState] = React.useState<BlinkTerminalState>("idle");
  const [connectionMessage, setConnectionMessage] = React.useState("");
  const [connectionGeneration, setConnectionGeneration] = React.useState(0);
  const machineId = target ? agentMachineKey(target) : "";
  const routedMachineId = String(target?.machineId || "");
  const targetHost = target?.machineHostname || "";
  const profileKey = target ? sshProfileStorageKey(controllerUrl, machineId) : "";
  const isWide = windowWidth / fontScale >= 760;
  const deviceLabel =
    Constants.deviceName ||
    (Platform.OS === "ios" && Platform.isPad ? "T-MAX on iPad" : "T-MAX on iPhone");

  const loadDraft = React.useCallback((nextProfile: StoredSshProfile | null, nextHost: string) => {
    setHost(nextProfile?.host || nextHost);
    setUser(nextProfile?.user || "");
    setPort(String(nextProfile?.port || 22));
    setAuthMethod(nextProfile?.authMethod || "password");
    setPassword(nextProfile?.password || "");
    setPrivateKey(nextProfile?.privateKey || "");
  }, []);

  const requestManagedProfile = React.useCallback(async (preferredHost = "") => {
    if (!api || !routedMachineId) {
      throw new Error("The Controller is unavailable.");
    }

    const identity = await sshDeviceIdentityManager.ensure();
    const authorization = await api.authorizeSsh(routedMachineId, {
      publicKey: identity.publicKey,
      deviceId: identity.deviceId,
      deviceLabel,
    });
    const reportedHost = String(authorization.host || "").trim();
    const authorizedHosts = [
      ...(Array.isArray(authorization.sshHosts) ? authorization.sshHosts : []),
      reportedHost,
    ]
      .map((value) => String(value || "").trim())
      .filter((value, index, values) => value && values.indexOf(value) === index);
    const authorizedHost =
      (preferredHost && authorizedHosts.includes(preferredHost) ? preferredHost : "") ||
      authorizedHosts.find((candidate) => candidate.toLowerCase().endsWith(".local")) ||
      reportedHost ||
      authorizedHosts[0] ||
      "";
    const authorizedUser = String(authorization.user || "").trim();
    const authorizedPort = Number(authorization.port);
    const authorizedFingerprint = String(authorization.fingerprint || "").trim();
    if (
      authorization.ok !== true ||
      authorization.authorized !== true ||
      !authorizedHost ||
      !authorizedUser ||
      !authorizedFingerprint ||
      !Number.isInteger(authorizedPort) ||
      authorizedPort < 1 ||
      authorizedPort > 65_535
    ) {
      throw new Error("The Controller returned an incomplete SSH endpoint.");
    }
    if (authorizedFingerprint !== identity.fingerprint) {
      throw new Error("The machine authorized a different SSH key fingerprint.");
    }

    return {
      profile: {
        version: 1,
        host: authorizedHost,
        user: authorizedUser,
        port: authorizedPort,
        authMethod: "managed-key",
        identityId: identity.identityId,
      } satisfies ManagedSshProfile,
      installed: authorization.installed,
      hosts: authorizedHosts,
    };
  }, [api, deviceLabel, routedMachineId]);

  React.useEffect(() => {
    let cancelled = false;
    terminalRef.current = null;
    setProfile(null);
    setManualProfile(null);
    setProfileSource(null);
    setManagedHostCandidates([]);
    setConnectionState("idle");
    setConnectionMessage("");
    setProfileError("");
    setSaving(false);
    setEditing(false);
    loadDraft(null, targetHost);
    if (!profileKey || visionControls) {
      setProfileLoading(false);
      setEditing(true);
      return () => {
        cancelled = true;
      };
    }

    setProfileLoading(true);
    setConnectionState("connecting");
    setConnectionMessage("Creating this installation’s secure SSH identity…");
    void (async () => {
      let stored: StoredSshProfile | null = null;
      let manualLoadError = "";
      try {
        const value = await SecureStore.getItemAsync(profileKey);
        stored = readStoredSshProfile(value);
        if (value && !stored) {
          manualLoadError = "The saved manual SSH profile could not be read.";
        }
      } catch (error) {
        manualLoadError =
          error instanceof Error ? error.message : "Could not read the saved manual SSH profile.";
      }
      if (cancelled) return;
      setManualProfile(stored);

      try {
        setConnectionMessage("Authorizing this installation on the selected machine…");
        const managed = await requestManagedProfile();
        if (cancelled) return;
        // The Controller endpoint is authoritative. In particular, it replaces
        // old profiles whose host was only a display alias such as "MacBook".
        setProfile(managed.profile);
        setProfileSource("managed");
        setManagedHostCandidates(managed.hosts);
        setEditing(false);
        setConnectionState("connecting");
        setConnectionMessage(
          managed.installed
            ? "Device key installed. Connecting with Blink SSH…"
            : "Device key authorized. Connecting with Blink SSH…",
        );
        setConnectionGeneration((generation) => generation + 1);
      } catch (error) {
        if (cancelled) return;
        const reason = error instanceof Error ? error.message : String(error);
        setProfile(null);
        setProfileSource(null);
        setEditing(true);
        setConnectionState("failed");
        setConnectionMessage(reason);
        loadDraft(stored, targetHost);
        setProfileError(
          [
            `Automatic SSH setup failed: ${reason}`,
            manualLoadError,
            "You can use a manual SSH profile below.",
          ]
            .filter(Boolean)
            .join(" "),
        );
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    loadDraft,
    profileKey,
    requestManagedProfile,
    targetHost,
    visionControls,
  ]);

  const saveProfile = React.useCallback(async () => {
    const nextPort = Number(port);
    const nextHost = host.trim();
    const nextUser = user.trim();
    const credential = authMethod === "password" ? password : privateKey;
    if (!nextHost) {
      setProfileError("Host is required.");
      return;
    }
    if (!nextUser) {
      setProfileError("Username is required.");
      return;
    }
    if (!Number.isInteger(nextPort) || nextPort < 1 || nextPort > 65535) {
      setProfileError("Port must be a number between 1 and 65535.");
      return;
    }
    if (!credential.trim()) {
      setProfileError(
        authMethod === "password" ? "Password is required." : "Private key is required.",
      );
      return;
    }
    if (!profileKey) return;

    const nextProfile: StoredSshProfile = {
      version: 1,
      host: nextHost,
      user: nextUser,
      port: nextPort,
      authMethod,
      password: authMethod === "password" ? password : undefined,
      privateKey: authMethod === "private-key" ? privateKey : undefined,
    };
    setSaving(true);
    setProfileError("");
    try {
      await SecureStore.setItemAsync(profileKey, JSON.stringify(nextProfile));
      setManualProfile(nextProfile);
      setProfile(nextProfile);
      setProfileSource("manual");
      setEditing(false);
      setConnectionState("connecting");
      setConnectionMessage("Opening a native Blink SSH session…");
      setConnectionGeneration((generation) => generation + 1);
      void Haptics.selectionAsync();
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : "Could not save the SSH profile.",
      );
    } finally {
      setSaving(false);
    }
  }, [authMethod, host, password, port, privateKey, profileKey, user]);

  const beginEditing = React.useCallback(() => {
    void terminalRef.current?.disconnect().catch(() => {});
    loadDraft(manualProfile, targetHost);
    setProfileError("");
    setEditing(true);
  }, [loadDraft, manualProfile, targetHost]);

  const forgetProfile = React.useCallback(() => {
    if (!profileKey) return;
    appDialog.show(
      "Forget SSH profile?",
      "This removes the saved host, username, and credential from this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Forget",
          style: "destructive",
          onPress: () => {
            if (profileSource === "manual") {
              void terminalRef.current?.disconnect().catch(() => {});
            }
            void SecureStore.deleteItemAsync(profileKey)
              .catch(() => {})
              .finally(() => {
                setManualProfile(null);
                loadDraft(null, targetHost);
                if (profileSource === "manual") {
                  setProfile(null);
                  setProfileSource(null);
                  setEditing(true);
                  setConnectionState("idle");
                  setConnectionMessage("");
                }
              });
          },
        },
      ],
    );
  }, [loadDraft, profileKey, profileSource, targetHost]);

  const close = React.useCallback(() => {
    void terminalRef.current?.disconnect().catch(() => {});
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const handleHostKeyPrompt = React.useCallback(
    (event: { nativeEvent: { fingerprint: string; changed: boolean } }) => {
      const { fingerprint, changed } = event.nativeEvent;
      const title = changed ? "SECURITY WARNING: Host key changed" : "Trust this SSH host?";
      const body = changed
        ? `The identity of ${profile?.host || "this host"} no longer matches the previous key. This can indicate a man-in-the-middle attack or a rebuilt machine.\n\nFingerprint\n${fingerprint}`
        : `Verify this fingerprint for ${profile?.host || "this host"} before connecting.\n\n${fingerprint}`;
      appDialog.show(title, body, [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            void terminalRef.current?.approveHostKey(false).catch(() => {});
          },
        },
        {
          text: changed ? "Trust changed key" : "Trust host",
          style: changed ? "destructive" : "default",
          onPress: () => {
            void terminalRef.current?.approveHostKey(true).catch(() => {});
          },
        },
      ]);
    },
    [profile?.host],
  );

  const reconnectManaged = React.useCallback((preferredHost = "") => {
    setConnectionState("connecting");
    setConnectionMessage("Re-authorizing this installation…");
    void terminalRef.current?.disconnect().catch(() => {});
    void requestManagedProfile(preferredHost)
      .then((managed) => {
        setProfile(managed.profile);
        setProfileSource("managed");
        setManagedHostCandidates(managed.hosts);
        setConnectionState("connecting");
        setConnectionMessage("Device key authorized. Reconnecting with Blink SSH…");
        setConnectionGeneration((generation) => generation + 1);
      })
      .catch((error) => {
        setConnectionState("failed");
        setConnectionMessage(error instanceof Error ? error.message : String(error));
      });
  }, [requestManagedProfile]);

  const reconnect = React.useCallback(() => {
    setConnectionState("connecting");
    if (profileSource === "manual") {
      setConnectionMessage("Reconnecting with the manual profile…");
      void terminalRef.current?.reconnect().catch((error) => {
        setConnectionState("failed");
        setConnectionMessage(error instanceof Error ? error.message : String(error));
      });
      return;
    }

    reconnectManaged(profile?.host || "");
  }, [profile?.host, profileSource, reconnectManaged]);

  const resumeManagedConnection = React.useCallback(() => {
    setProfileLoading(true);
    setProfileError("");
    setConnectionState("connecting");
    setConnectionMessage("Re-authorizing this installation…");
    void requestManagedProfile(profile?.host || "")
      .then((managed) => {
        setProfile(managed.profile);
        setProfileSource("managed");
        setManagedHostCandidates(managed.hosts);
        setConnectionGeneration((generation) => generation + 1);
        setEditing(false);
      })
      .catch((error) => {
        const reason = error instanceof Error ? error.message : String(error);
        setConnectionState("failed");
        setConnectionMessage(reason);
        setProfileError(
          `Automatic SSH setup failed: ${reason} You can use the manual fallback below.`,
        );
      })
      .finally(() => {
        setProfileLoading(false);
      });
  }, [profile?.host, requestManagedProfile]);

  const disconnect = React.useCallback(() => {
    void terminalRef.current?.disconnect()
      .then(() => {
        setConnectionState("disconnected");
        setConnectionMessage("Disconnected");
      })
      .catch((error) => {
        setConnectionState("failed");
        setConnectionMessage(error instanceof Error ? error.message : String(error));
      });
  }, []);

  const setup = profileLoading ? (
    <View style={styles.sshLoading}>
      <ActivityIndicator color={theme.colors.accent} />
      <Text style={styles.sshMutedText}>
        Authorizing this installation for passwordless SSH…
      </Text>
    </View>
  ) : (
    <ScrollView
      style={styles.sshSetupScroll}
      contentContainerStyle={styles.sshSetupContent}
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.sshSetupIntro}>
        <Text style={styles.sshSetupTitle}>Manual SSH fallback</Text>
        <Text style={styles.sshMutedText}>
          T-MAX normally installs this app installation’s public key automatically. Use this form
          only when the Controller or Connector cannot authorize it.
        </Text>
      </View>
      <View style={[styles.sshSetupRow, isWide ? null : styles.sshSetupRowNarrow]}>
        <View style={[styles.inputGroup, styles.sshSetupGrow]}>
          <Text style={styles.inputLabel}>Host</Text>
          <KeyboardTextInput
            value={host}
            onChangeText={setHost}
            autoFocus={false}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder={target?.machineHostname || "mini.example.com"}
            placeholderTextColor={theme.colors.textMuted}
            style={styles.textInput}
          />
        </View>
        <View style={styles.sshPortGroup}>
          <Text style={styles.inputLabel}>Port</Text>
          <KeyboardTextInput
            value={port}
            onChangeText={setPort}
            autoFocus={false}
            keyboardType="number-pad"
            placeholder="22"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.textInput}
          />
        </View>
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Username</Text>
        <KeyboardTextInput
          value={user}
          onChangeText={setUser}
          autoFocus={false}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          placeholder="Remote account"
          placeholderTextColor={theme.colors.textMuted}
          style={styles.textInput}
        />
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Authentication</Text>
        <View style={styles.segmentRow}>
          <Segment
            active={authMethod === "password"}
            label="Password"
            onPress={() => setAuthMethod("password")}
          />
          <Segment
            active={authMethod === "private-key"}
            label="Private key"
            onPress={() => setAuthMethod("private-key")}
          />
        </View>
      </View>
      {authMethod === "password" ? (
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Password</Text>
          <KeyboardTextInput
            value={password}
            onChangeText={setPassword}
            autoFocus={false}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            textContentType="password"
            placeholder="SSH password"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.textInput}
          />
        </View>
      ) : (
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>OpenSSH private key</Text>
          <KeyboardTextInput
            value={privateKey}
            onChangeText={setPrivateKey}
            autoFocus={false}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            numberOfLines={5}
            placeholder="Paste the private key"
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.textInput, styles.sshPrivateKeyInput]}
          />
          <Text style={styles.inputLabel}>
            The key is visible while editing and encrypted by iOS Secure Store after saving.
          </Text>
        </View>
      )}
      {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}
      <View style={styles.sshSetupActions}>
        {profile ? (
          <Pressable
            accessibilityRole="button"
            style={styles.sshSecondaryButton}
            onPress={() => {
              if (profileSource === "managed") {
                resumeManagedConnection();
              } else {
                setEditing(false);
                setProfileError("");
              }
            }}
          >
            <Text style={styles.sshSecondaryButtonText}>
              {profileSource === "managed" ? "Use automatic SSH" : "Cancel"}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          style={[styles.primaryButton, styles.sshConnectButton, saving ? styles.disabledButton : null]}
          disabled={saving}
          onPress={() => {
            void saveProfile();
          }}
        >
          {saving ? (
            <ActivityIndicator color={theme.colors.surfaceRaised} />
          ) : (
            <Text style={styles.primaryButtonText}>Save & connect</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );

  const statusLabel = connectionState.replace("-", " ");
  const terminal = profile ? (
    <View style={[styles.sshWorkspace, isWide ? styles.sshWorkspaceWide : null]}>
      <View style={[styles.sshRail, isWide ? styles.sshRailWide : null]}>
        <View style={styles.sshRailHeading}>
          <View style={styles.sshMachineIcon}>
            <Laptop size={18} color={theme.colors.text} />
          </View>
          <View style={styles.sshRailTitleBlock}>
            <Text style={styles.sshRailTitle} numberOfLines={1}>
              {target ? agentTitle(target) : "SSH"}
            </Text>
            <Text style={styles.sshRailEndpoint} numberOfLines={1}>
              {profile.user}@{profile.host}:{profile.port}
            </Text>
            <Text style={styles.sshRailEndpoint} numberOfLines={1}>
              {profileSource === "managed"
                ? "Per-install managed key"
                : "Manual fallback profile"}
            </Text>
          </View>
        </View>
        <View style={styles.sshStatusRow}>
          <View
            style={[
              styles.sshStatusDot,
              connectionState === "connected"
                ? styles.sshStatusConnected
                : connectionState === "failed"
                  ? styles.sshStatusFailed
                  : styles.sshStatusPending,
            ]}
          />
          <Text style={styles.sshStatusLabel}>{statusLabel}</Text>
        </View>
        {connectionMessage ? (
          <Text style={styles.sshConnectionMessage} numberOfLines={isWide ? 4 : 1}>
            {connectionMessage}
          </Text>
        ) : null}
        {profileSource === "managed" && managedHostCandidates.length > 1 ? (
          <View style={styles.sshRailActions}>
            <Text style={styles.inputLabel}>SSH address</Text>
            {managedHostCandidates.map((candidate) => {
              const selected = candidate === profile.host;
              return (
                <Pressable
                  key={candidate}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={styles.sshRailButton}
                  onPress={() => reconnectManaged(candidate)}
                >
                  {selected ? (
                    <Check size={15} color={theme.colors.success} />
                  ) : (
                    <Link2 size={15} color={theme.colors.text} />
                  )}
                  <Text style={styles.sshRailButtonText} numberOfLines={1}>
                    {candidate}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <View style={styles.sshRailActions}>
          <Pressable accessibilityRole="button" style={styles.sshRailButton} onPress={reconnect}>
            <RefreshCcw size={15} color={theme.colors.text} />
            <Text style={styles.sshRailButtonText}>Reconnect</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.sshRailButton} onPress={disconnect}>
            <X size={15} color={theme.colors.text} />
            <Text style={styles.sshRailButtonText}>Disconnect</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.sshRailButton} onPress={beginEditing}>
            <Settings2 size={15} color={theme.colors.text} />
            <Text style={styles.sshRailButtonText}>Manual setup</Text>
          </Pressable>
          {manualProfile ? (
            <Pressable
              accessibilityRole="button"
              style={[styles.sshRailButton, styles.sshRailButtonDanger]}
              onPress={forgetProfile}
            >
              <Trash2 size={15} color={theme.colors.danger} />
              <Text style={[styles.sshRailButtonText, styles.sshRailButtonTextDanger]}>
                Forget manual profile
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <View style={styles.sshTerminalFrame}>
        <CJMUXBlinkTerminal
          key={`${profileKey}:${connectionGeneration}`}
          ref={terminalRef}
          style={styles.sshTerminal}
          host={profile.host}
          user={profile.user}
          port={profile.port}
          password={profile.authMethod === "password" ? profile.password : undefined}
          privateKey={profile.authMethod === "private-key" ? profile.privateKey : undefined}
          identityId={
            profile.authMethod === "managed-key" ? profile.identityId : undefined
          }
          connectionKey={`${profileKey}:${connectionGeneration}`}
          autoFocus={Platform.OS === "ios" && Platform.isPad && !visionControls}
          colorScheme={theme.dark ? "dark" : "light"}
          fontSize={(isWide ? 14 : 13) * fontScale}
          onStateChange={({ nativeEvent }) => {
            setConnectionState(nativeEvent.state);
            setConnectionMessage(nativeEvent.message || "");
          }}
          onHostKeyPrompt={handleHostKeyPrompt}
          onExit={({ nativeEvent }) => {
            setConnectionState((state) => (state === "failed" ? state : "disconnected"));
            setConnectionMessage(nativeEvent.reason || "SSH session ended");
          }}
        />
      </View>
    </View>
  ) : null;

  return (
    <SheetModal
      visible={Boolean(target) && !visionControls}
      title={target ? `SSH · ${agentTitle(target)}` : "SSH"}
      onClose={close}
      tall
      wide
      fullscreenOnWide
      captureShortcuts={false}
    >
      {appDialog.node}
      {profileLoading || editing || !profile ? setup : terminal}
    </SheetModal>
  );
}

function WindowViewModal({
  target,
  onOpenFile,
  onOpenSsh,
  onClose,
  onDismiss,
}: {
  target: AgentSession | null;
  onOpenFile: (agent: AgentSession, path: string) => void;
  onOpenSsh?: (agent: AgentSession) => void;
  onClose: () => void;
  onDismiss?: () => void;
}) {
  const theme = useAppTheme();
  const styles = useAppStyles();
  const appFontScale = useFontScale();
  const visionControls = useVisionControls();
  const { width: windowWidth } = useWindowDimensions();
  const api = useTmuxMobileApi();
  const sendText = useSendText();
  const sendKey = useSendKey();
  const uploadFile = useUploadFile();
  const paneTailScrollRef = React.useRef<ScrollView | null>(null);
  const terminalUserScrollingRef = React.useRef(false);
  const pollingRef = React.useRef(false);
  const terminalInputRef = React.useRef("");
  const terminalDirectSendQueueRef = React.useRef<Promise<unknown>>(Promise.resolve());
  const terminalRefreshTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const terminalSuppressChangeRef = React.useRef(false);
  const terminalSuppressChangeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [data, setData] = React.useState<WindowViewResponse | null>(null);
  const [terminalText, setTerminalText] = React.useState("");
  const [selection, setSelection] = React.useState<TextSelectionTarget | null>(null);
  const [terminalInput, setTerminalInput] = React.useState("");
  const [terminalKeyboardVisible, setTerminalKeyboardVisible] = React.useState(false);
  const [terminalShareTarget, setTerminalShareTarget] = React.useState<AgentSession | null>(null);
  const [terminalUploadPickerVisible, setTerminalUploadPickerVisible] = React.useState(false);
  const [terminalUploading, setTerminalUploading] = React.useState(false);
  const [terminalFollow, setTerminalFollow] = React.useState(true);
  const [terminalTextScale, setTerminalTextScale] = React.useState(1);
  const [fileBrowserVisible, setFileBrowserVisible] = React.useState(false);
  const [fileBrowserData, setFileBrowserData] = React.useState<FileBrowserResponse | null>(null);
  const [fileBrowserLoading, setFileBrowserLoading] = React.useState(false);
  const [fileBrowserError, setFileBrowserError] = React.useState("");
  const [error, setError] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const terminalAutoFocus = windowWidth >= 760;
  const terminalTargetKey = target ? agentCardKey(target) : "";
  React.useEffect(() => { setTerminalShareTarget(null); setSelection(null); }, [terminalTargetKey]);
  const selectTerminalText = React.useCallback(() => {
    Keyboard.dismiss();
    setSelection({ title: "Terminal output", text: terminalSelectionText(terminalText), monospace: true });
  }, [terminalText]);
  const previousTerminalTargetKeyRef = React.useRef("");
  const terminalTextScaleRef = React.useRef(1);
  const terminalPinchBaseRef = React.useRef(1);
  const fileBrowserRequestRef = React.useRef(0);
  const fileBrowserTargetKeyRef = React.useRef("");

  React.useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(TERMINAL_TEXT_SCALE_STORAGE_KEY)
      .then((value) => {
        if (!mounted) return;
        const next = readTerminalTextScale(value);
        terminalTextScaleRef.current = next;
        setTerminalTextScale(next);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const terminalPinchGesture = React.useMemo(
    () =>
      Gesture.Simultaneous(
        Gesture.Native(),
        Gesture.Pinch()
          .runOnJS(true)
          .onStart(() => {
            terminalPinchBaseRef.current = terminalTextScaleRef.current;
          })
          .onUpdate((event) => {
            const next = quantizeLiveTerminalTextScale(
              terminalPinchBaseRef.current * event.scale,
            );
            if (next === terminalTextScaleRef.current) return;
            terminalTextScaleRef.current = next;
            setTerminalTextScale(next);
          })
          .onEnd(() => {
            const next = snapTerminalTextScale(terminalTextScaleRef.current);
            const changed = next !== terminalPinchBaseRef.current;
            terminalTextScaleRef.current = next;
            setTerminalTextScale(next);
            AsyncStorage.setItem(TERMINAL_TEXT_SCALE_STORAGE_KEY, String(next)).catch(() => {});
            if (changed) void Haptics.selectionAsync();
          }),
      ),
    [],
  );

  const terminalTextZoomStyle = React.useMemo(
    () => ({
      fontSize: Math.round(12 * appFontScale * terminalTextScale * 2) / 2,
      lineHeight: Math.round(18 * appFontScale * terminalTextScale * 2) / 2,
    }),
    [appFontScale, terminalTextScale],
  );

  React.useEffect(() => {
    terminalInputRef.current = terminalInput;
  }, [terminalInput]);

  React.useEffect(() => {
    let cancelled = false;
    setData(null);
    setTerminalText("");
    setTerminalInput("");
    setTerminalKeyboardVisible(false);
    setTerminalUploadPickerVisible(false);
    terminalInputRef.current = "";
    terminalSuppressChangeRef.current = false;
    setError("");
    setStatus("");
    if (!api || (!target?.windowId && !target?.paneId)) return;
    setLoading(true);
    const machine = agentMachineKey(target);
    const load = target.windowId
      ? api.windowView(machine, target.windowId, TERMINAL_INITIAL_LINES).then((result) => {
          if (cancelled) return;
          setData(result);
          setTerminalText(result.capture?.text || "");
        })
      : api.capture(machine, target.paneId || "", "tail", TERMINAL_INITIAL_LINES).then((result) => {
          if (cancelled) return;
          setData(null);
          setTerminalText(result.text || "");
        });
    load
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, target]);

  React.useEffect(() => {
    const previousTargetKey = previousTerminalTargetKeyRef.current;
    previousTerminalTargetKeyRef.current = terminalTargetKey;
    if (terminalTargetKey && terminalTargetKey !== previousTargetKey) {
      setTerminalFollow(true);
    }
  }, [terminalTargetKey]);

  React.useEffect(() => {
    return () => {
      if (terminalRefreshTimerRef.current) clearTimeout(terminalRefreshTimerRef.current);
      if (terminalSuppressChangeTimerRef.current) clearTimeout(terminalSuppressChangeTimerRef.current);
    };
  }, []);

  const machineId = target ? agentMachineKey(target) : "";
  const terminalScopeKey = terminalTargetKey;
  const activePaneId = data?.capture?.paneId || data?.activePaneId || target?.paneId || "";

  React.useEffect(() => {
    if (!terminalTargetKey || terminalTargetKey === fileBrowserTargetKeyRef.current) return;
    fileBrowserTargetKeyRef.current = terminalTargetKey;
    fileBrowserRequestRef.current += 1;
    setFileBrowserVisible(false);
    setFileBrowserData(null);
    setFileBrowserLoading(false);
    setFileBrowserError("");
  }, [terminalTargetKey]);

  const loadFileBrowser = React.useCallback(
    async (relativePath = "", root?: string) => {
      if (!api || !target || !activePaneId) return;
      const requestId = ++fileBrowserRequestRef.current;
      setFileBrowserLoading(true);
      setFileBrowserError("");
      try {
        const result = await api.files(machineId, activePaneId, { root, path: relativePath });
        if (requestId !== fileBrowserRequestRef.current) return;
        setFileBrowserData(result);
      } catch (err) {
        if (requestId !== fileBrowserRequestRef.current) return;
        setFileBrowserError(err instanceof Error ? err.message : String(err));
      } finally {
        if (requestId === fileBrowserRequestRef.current) setFileBrowserLoading(false);
      }
    },
    [activePaneId, api, machineId, target],
  );

  const openFileBrowser = React.useCallback(() => {
    if (!activePaneId) return;
    Keyboard.dismiss();
    setFileBrowserVisible(true);
    void Haptics.selectionAsync();
    if (fileBrowserData?.root) {
      void loadFileBrowser(fileBrowserData.relativePath, fileBrowserData.root);
    } else {
      void loadFileBrowser();
    }
  }, [activePaneId, fileBrowserData, loadFileBrowser]);

  const leaveFileBrowser = React.useCallback(() => {
    if (fileBrowserData?.relativePath) {
      void loadFileBrowser(
        parentFileBrowserPath(fileBrowserData.relativePath),
        fileBrowserData.root,
      );
      return;
    }
    setFileBrowserVisible(false);
    void Haptics.selectionAsync();
  }, [fileBrowserData, loadFileBrowser]);
  const refreshCapture = React.useCallback(
    async (silent = false) => {
      if (!api || !target || !activePaneId) return;
      if (!silent) {
        setStatus("Refreshing...");
      }
      try {
        const result = await api.capture(machineId, activePaneId, "tail", TERMINAL_REFRESH_LINES);
        setTerminalText(result.text || "");
        setError("");
        if (!silent) setStatus("Refreshed");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        if (!silent) setStatus("Refresh failed");
      }
    },
    [activePaneId, api, machineId, target],
  );

  const scheduleTerminalRefresh = React.useCallback(
    (delay = 160) => {
      if (terminalRefreshTimerRef.current) return;
      terminalRefreshTimerRef.current = setTimeout(() => {
        terminalRefreshTimerRef.current = null;
        refreshCapture(true).catch(() => {});
      }, delay);
    },
    [refreshCapture],
  );

  const enqueueTerminalDirectAction = React.useCallback(
    (label: string, action: () => Promise<unknown>) => {
      if (!target) return;
      terminalDirectSendQueueRef.current = terminalDirectSendQueueRef.current
        .catch(() => {})
        .then(action)
        .then(() => {
          setTerminalFollow(true);
          setError("");
          scheduleTerminalRefresh();
        })
        .catch((err) => {
          setStatus(`${label} failed`);
          setError(err instanceof Error ? err.message : String(err));
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        });
    },
    [scheduleTerminalRefresh, target],
  );

  const sendTerminalDirectKey = React.useCallback(
    (key: string) => {
      if (!api || !target || !activePaneId || !key) return;
      const machine = machineId;
      const pane = activePaneId;
      enqueueTerminalDirectAction("Keyboard shortcut", () => api.sendKey(machine, pane, key));
    },
    [activePaneId, api, enqueueTerminalDirectAction, machineId, target],
  );

  const suppressNextTerminalTextChange = React.useCallback(() => {
    terminalSuppressChangeRef.current = true;
    if (terminalSuppressChangeTimerRef.current) clearTimeout(terminalSuppressChangeTimerRef.current);
    terminalSuppressChangeTimerRef.current = setTimeout(() => {
      terminalSuppressChangeRef.current = false;
      terminalSuppressChangeTimerRef.current = null;
    }, 80);
  }, []);

  const handleTerminalInputChange = React.useCallback((value: string) => {
    if (terminalSuppressChangeRef.current) {
      terminalSuppressChangeRef.current = false;
      if (terminalSuppressChangeTimerRef.current) {
        clearTimeout(terminalSuppressChangeTimerRef.current);
        terminalSuppressChangeTimerRef.current = null;
      }
    }
    setTerminalInput(value);
  }, []);

  const handleTerminalKeyPress = React.useCallback(
    (event: { nativeEvent: { key: string } }) => {
      const key = terminalKeyFromNativeKey(event.nativeEvent.key);
      if (!key || key === "Enter") return;
      if (key === "BSpace" && terminalInputRef.current) return;
      suppressNextTerminalTextChange();
      sendTerminalDirectKey(key);
    },
    [sendTerminalDirectKey, suppressNextTerminalTextChange],
  );

  React.useEffect(() => {
    if (!api || !target || !activePaneId || selection) return;
    const intervalMs = target.status === "running" || target.waitingForInput
      ? TERMINAL_ACTIVE_REFRESH_MS
      : TERMINAL_IDLE_REFRESH_MS;
    const timer = setInterval(() => {
      if (pollingRef.current) return;
      pollingRef.current = true;
      refreshCapture(true)
        .catch(() => {})
        .finally(() => {
          pollingRef.current = false;
        });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [activePaneId, api, refreshCapture, target, selection]);

  const terminalNodes = React.useMemo(() => renderAnsiText(terminalText), [terminalText]);
  const terminalShouldFollow = terminalFollow && !selection;
  const updateTerminalFollowFromScroll = React.useCallback((metrics: {
    offsetY: number;
    viewportHeight: number;
    contentHeight: number;
  }) => {
    setTerminalFollow((following) =>
      nextTerminalFollowState(following, metrics, terminalUserScrollingRef.current),
    );
  }, []);
  const scrollPaneTailToEnd = React.useCallback((animated = false) => {
    requestAnimationFrame(() => {
      paneTailScrollRef.current?.scrollToEnd({ animated });
    });
  }, []);

  React.useEffect(() => {
    if (terminalShouldFollow && terminalText) scrollPaneTailToEnd(false);
  }, [scrollPaneTailToEnd, terminalShouldFollow, terminalText]);

  const toggleTerminalFollow = React.useCallback(() => {
    if (terminalFollow) {
      setTerminalFollow(false);
      return;
    }
    setTerminalFollow(true);
    refreshCapture(true).catch(() => {});
    scrollPaneTailToEnd(false);
  }, [refreshCapture, scrollPaneTailToEnd, terminalFollow]);

  const appendTerminalInput = React.useCallback((value: string) => {
    const next = String(value || "").trim();
    if (!next) return;
    setTerminalInput((current) => {
      if (!current) return next;
      return /\s$/.test(current) ? `${current}${next}` : `${current} ${next}`;
    });
  }, []);

  const terminalVoiceInput = useServerVoiceInput({
    scopeKey: terminalScopeKey,
    machineId,
    onText: appendTerminalInput,
    onStatus: setStatus,
    contextualStrings: VOICE_CONTEXTUAL_STRINGS,
  });

  const terminalStreamingInput = useStreamingDictation({ api, scopeKey: terminalScopeKey, value: terminalInput, onChangeText: setTerminalInput, onStatus: setStatus });

  const uploadTerminalAssets = React.useCallback(async (
    assets: Array<{ uri: string; name?: string | null; mimeType?: string | null }>,
    label: string,
  ) => {
    if (!target || assets.length === 0) return;
    setTerminalUploading(true);
    setTerminalUploadPickerVisible(false);
    setError("");
    setStatus(assets.length === 1 ? `Uploading ${label}...` : `Uploading ${assets.length} ${label}s...`);
    try {
      let count = 0;
      for (const asset of assets) {
        const fallbackName = asset.uri.split("/").pop() || `upload-${Date.now()}`;
        const uploaded = await uploadFile.mutateAsync({
          agent: target,
          file: {
            uri: asset.uri,
            name: asset.name || fallbackName,
            type: asset.mimeType || "application/octet-stream",
          },
        });
        if (uploaded.url || uploaded.path) {
          appendTerminalInput((uploaded.url || uploaded.path)!);
          count += 1;
        }
      }
      setStatus(count === 1 ? `${label[0].toUpperCase()}${label.slice(1)} uploaded` : `${count} ${label}s uploaded`);
      void Haptics.selectionAsync();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus("Upload failed");
      setError(message);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setTerminalUploading(false);
    }
  }, [appendTerminalInput, target, uploadFile]);

  const pickTerminalMedia = React.useCallback(async () => {
    setStatus("");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setStatus("Photos permission denied");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync(MEDIA_LIBRARY_OPTIONS);
    if (result.canceled || result.assets.length === 0) return;
    await uploadTerminalAssets(
      result.assets.map(mediaUploadAsset),
      "file",
    );
  }, [uploadTerminalAssets]);

  const pickTerminalFiles = React.useCallback(async () => {
    setStatus("");
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: true,
      type: "*/*",
    });
    if (result.canceled || result.assets.length === 0) return;
    await uploadTerminalAssets(
      result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name || asset.uri.split("/").pop() || `upload-${Date.now()}`,
        mimeType: asset.mimeType || "application/octet-stream",
      })),
      "file",
    );
  }, [uploadTerminalAssets]);

  const afterTerminalSend = React.useCallback(() => {
    setTerminalFollow(true);
    setError("");
    setStatus("Sent");
    setTimeout(() => {
      refreshCapture(true).catch(() => {});
    }, 220);
  }, [refreshCapture]);

  const sendTerminalInput = React.useCallback((options?: { submit?: boolean }) => {
    if (!target || sendText.isPending || sendKey.isPending) return;
    const submit = options?.submit ?? true;
    void terminalStreamingInput.submit(async (value) => {
      if (!value && !submit) return;
      setStatus("Sending...");
      try {
        if (!value) await sendKey.mutateAsync({ agent: target, key: "Enter" });
        else {
          await sendText.mutateAsync({ agent: target, text: value, enter: submit });
          setTerminalInput("");
        }
        afterTerminalSend();
      } catch (err) {
        setStatus("Send failed");
        setError(err instanceof Error ? err.message : String(err));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }, true);
  }, [afterTerminalSend, sendKey, sendText, target, terminalStreamingInput.submit]);

  const sendTerminalKey = React.useCallback(
    (entry: TerminalKeyEntry) => {
      if (!target || sendText.isPending || sendKey.isPending) return;
      if ("key" in entry && entry.key === "Enter" && terminalInput) {
        sendTerminalInput({ submit: true });
        return;
      }
      setStatus(`Sending ${entry.label}...`);
      if ("command" in entry) {
        sendText.mutate(
          { agent: target, text: entry.command, enter: true },
          {
            onSuccess: afterTerminalSend,
            onError: (err) => {
              setStatus(`${entry.label} failed`);
              setError(err.message);
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            },
          },
        );
        return;
      }
      sendKey.mutate(
        { agent: target, key: entry.key },
        {
          onSuccess: afterTerminalSend,
          onError: (err) => {
            setStatus(`${entry.label} failed`);
            setError(err.message);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          },
        },
      );
    },
    [afterTerminalSend, sendKey, sendText, sendTerminalInput, target, terminalInput],
  );

  const closeTerminalModal = React.useCallback(() => {
    if (selection) {
      setSelection(null);
      return;
    }
    Keyboard.dismiss();
    onClose();
  }, [onClose, selection]);

  const fileBrowserLocation = fileBrowserLocationLabel(
    fileBrowserData?.root || data?.directories?.cwd || target?.cwd || "",
    fileBrowserData?.relativePath || "",
  );
  const fileBrowserScreen = (
    <View style={styles.fileBrowserScreen}>
      <View style={styles.fileBrowserHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={fileBrowserData?.relativePath ? "Go to parent folder" : "Back to terminal"}
          style={({ pressed }) => [
            styles.fileBrowserIconButton,
            pressed ? styles.fileBrowserRowPressed : null,
          ]}
          onPress={leaveFileBrowser}
        >
          <ChevronLeft size={20} color={theme.colors.text} />
        </Pressable>
        <View style={styles.fileBrowserTitleBlock}>
          <Text style={styles.fileBrowserTitle}>Files</Text>
          <Text style={styles.fileBrowserPath} numberOfLines={1}>
            {fileBrowserLocation || "Current terminal directory"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh files"
          disabled={fileBrowserLoading || !activePaneId}
          style={({ pressed }) => [
            styles.fileBrowserIconButton,
            pressed ? styles.fileBrowserRowPressed : null,
            fileBrowserLoading || !activePaneId ? styles.disabledButton : null,
          ]}
          onPress={() => {
            void loadFileBrowser(
              fileBrowserData?.relativePath || "",
              fileBrowserData?.root,
            );
          }}
        >
          {fileBrowserLoading ? (
            <ActivityIndicator size="small" color={theme.colors.accent} />
          ) : (
            <RefreshCcw size={18} color={theme.colors.textMuted} />
          )}
        </Pressable>
      </View>

      {fileBrowserError ? (
        <View style={styles.fileBrowserState}>
          <AlertCircle size={22} color={theme.colors.danger} />
          <Text style={styles.errorText}>{fileBrowserError}</Text>
          <Pressable
            style={({ pressed }) => [
              styles.fileBrowserRetryButton,
              pressed ? styles.fileBrowserRowPressed : null,
            ]}
            onPress={() => {
              void loadFileBrowser(
                fileBrowserData?.relativePath || "",
                fileBrowserData?.root,
              );
            }}
          >
            <Text style={styles.fileBrowserRetryText}>Retry</Text>
          </Pressable>
        </View>
      ) : !fileBrowserData && fileBrowserLoading ? (
        <View style={styles.fileBrowserState}>
          <ActivityIndicator color={theme.colors.accent} />
          <Text style={styles.emptyText}>Reading terminal directory…</Text>
        </View>
      ) : (
        <FlatList
          data={fileBrowserData?.entries || []}
          keyExtractor={(entry) => `${entry.isDirectory ? "directory" : "file"}:${entry.path}`}
          style={styles.fileBrowserList}
          contentContainerStyle={
            fileBrowserData?.entries.length
              ? styles.fileBrowserListContent
              : styles.fileBrowserEmptyContent
          }
          ListHeaderComponent={
            fileBrowserData?.truncated ? (
              <Text style={styles.fileBrowserTruncated}>Showing the first 500 entries</Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.fileBrowserState}>
              <Folder size={24} color={theme.colors.textMuted} />
              <Text style={styles.emptyTitle}>Empty folder</Text>
              <Text style={styles.emptyText}>There are no visible files here.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const disabled = !item.isDirectory && item.previewable === false;
            const icon = item.isDirectory ? (
              <Folder size={18} color={theme.colors.textMuted} />
            ) : isFileBrowserImage(item.name) ? (
              <ImageIcon size={18} color={theme.colors.textMuted} />
            ) : isFileBrowserMarkdown(item.name) ? (
              <FileText size={18} color={theme.colors.textMuted} />
            ) : (
              <File size={18} color={theme.colors.textMuted} />
            );
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  item.isDirectory
                    ? `Open folder ${item.name}`
                    : disabled
                      ? `${item.name}, preview unavailable`
                      : `Preview file ${item.name}`
                }
                disabled={disabled}
                style={({ pressed }) => [
                  styles.fileBrowserRow,
                  disabled ? styles.fileBrowserRowDisabled : null,
                  pressed ? styles.fileBrowserRowPressed : null,
                ]}
                onPress={() => {
                  if (item.isDirectory) {
                    void Haptics.selectionAsync();
                    void loadFileBrowser(
                      joinFileBrowserPath(fileBrowserData?.relativePath || "", item.name),
                      fileBrowserData?.root,
                    );
                    return;
                  }
                  if (target) onOpenFile(target, item.path);
                }}
              >
                <View style={styles.fileBrowserRowIcon}>{icon}</View>
                <View style={styles.fileBrowserRowTextBlock}>
                  <Text
                    style={[
                      styles.fileBrowserRowTitle,
                      disabled ? styles.fileBrowserRowTitleDisabled : null,
                    ]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  {disabled ? (
                    <Text style={styles.fileBrowserRowMeta}>Preview unavailable</Text>
                  ) : null}
                </View>
                {item.isDirectory ? (
                  <ChevronRight size={17} color={theme.colors.textMuted} />
                ) : null}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );

  return (
    <SheetModal
      visible={Boolean(target)}
      title={target ? agentTitle(target) : "Session"}
      onClose={closeTerminalModal}
      onDismiss={onDismiss}
      tall
      wide
      fullscreen
    >
      <TextSelectionSurface target={selection} theme={theme} onClose={() => setSelection(null)}>
      {terminalShareTarget && api ? <TerminalShareModal key={agentCardKey(terminalShareTarget)} api={api} target={terminalShareTarget} theme={theme} onClose={() => setTerminalShareTarget(null)} /> : null}
      {fileBrowserVisible ? fileBrowserScreen : (
        <>
      <View style={styles.sessionScreenMetaBar}>
        <View style={styles.sessionScreenMetaTextBlock}>
          <Text style={styles.sessionScreenEyebrow} numberOfLines={1}>
            {target ? `${target.machineHostname || agentMachineKey(target)} · ${target.mux || "tmux"}` : "Session"}
          </Text>
          <Text style={styles.sessionScreenStatus} numberOfLines={1}>
            {target?.waitingForInput ? "Waiting for input" : target?.status || target?.turn || "Unverified"}
          </Text>
        </View>
        <View style={styles.sessionScreenActions}>
          <ActionButton
            icon={<TextSelect size={16} color={theme.colors.textMuted} />}
            label="Select terminal text"
            disabled={!terminalText}
            onPress={selectTerminalText}
          />
          {target && canShareTerminal(target) ? <ActionButton
            icon={<CardActionIcon id="share" color={theme.colors.textMuted} />}
            label="Share terminal"
            onPress={() => { Keyboard.dismiss(); setTerminalShareTarget(target); }}
          /> : null}
          {target && onOpenSsh ? (
            <ActionButton
              icon={<KeyRound size={16} color={theme.colors.textMuted} />}
              label="Open SSH terminal"
              onPress={() => onOpenSsh(target)}
            />
          ) : null}
          <Text accessibilityLabel={`Terminal text size ${Math.round(terminalTextScale * 100)} percent`} style={styles.sessionZoomLabel}>
            {Math.round(terminalTextScale * 100)}%
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open files"
            disabled={!activePaneId}
            style={({ pressed }) => [
              styles.sessionFilesButton,
              pressed ? styles.fileBrowserRowPressed : null,
              !activePaneId ? styles.disabledButton : null,
            ]}
            onPress={openFileBrowser}
          >
            <Folder size={17} color={theme.colors.textMuted} />
          </Pressable>
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel={terminalFollow ? "Stop following terminal output" : "Follow terminal output"}
            accessibilityState={{ checked: terminalFollow }}
            style={[
              styles.sessionFollowButton,
              terminalFollow ? styles.sessionFollowButtonActive : null,
            ]}
            onPress={toggleTerminalFollow}
          >
            <ArrowDown size={15} color={terminalFollow ? theme.colors.accent : theme.colors.textMuted} />
            <Text style={[styles.sessionFollowText, terminalFollow ? styles.sessionFollowTextActive : null]}>
              Follow
            </Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.terminalFrame}>
        {loading ? (
          <ActivityIndicator
            pointerEvents="none"
            style={styles.terminalLoadingIndicator}
            color={theme.colors.accent}
          />
        ) : null}
        <GestureDetector gesture={terminalPinchGesture}>
          <ScrollView
            ref={paneTailScrollRef}
            style={styles.terminalBox}
            contentContainerStyle={styles.terminalBoxContent}
            onContentSizeChange={() => {
              if (terminalShouldFollow) scrollPaneTailToEnd(false);
            }}
            onScrollBeginDrag={() => {
              terminalUserScrollingRef.current = true;
            }}
            onScroll={({ nativeEvent }) => {
              updateTerminalFollowFromScroll({
                offsetY: nativeEvent.contentOffset.y,
                viewportHeight: nativeEvent.layoutMeasurement.height,
                contentHeight: nativeEvent.contentSize.height,
              });
            }}
            onScrollEndDrag={({ nativeEvent }) => {
              updateTerminalFollowFromScroll({
                offsetY: nativeEvent.contentOffset.y,
                viewportHeight: nativeEvent.layoutMeasurement.height,
                contentHeight: nativeEvent.contentSize.height,
              });
              terminalUserScrollingRef.current = false;
            }}
            onMomentumScrollBegin={() => {
              terminalUserScrollingRef.current = true;
            }}
            onMomentumScrollEnd={({ nativeEvent }) => {
              updateTerminalFollowFromScroll({
                offsetY: nativeEvent.contentOffset.y,
                viewportHeight: nativeEvent.layoutMeasurement.height,
                contentHeight: nativeEvent.contentSize.height,
              });
              terminalUserScrollingRef.current = false;
            }}
            scrollEventThrottle={16}
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            keyboardShouldPersistTaps="handled"
          >
            <Text accessibilityLabel="Terminal output" accessibilityHint="Long-press to open text selection" onLongPress={selectTerminalText} style={[styles.terminalText, terminalTextZoomStyle]}>
              {terminalText ? terminalNodes : "No output."}
            </Text>
          </ScrollView>
        </GestureDetector>
      </View>
      <PaneComposer
        variant="expanded"
        value={terminalInput}
        onChangeText={(value) => {
          handleTerminalInputChange(value);
          setError("");
        }}
        onKeyPress={handleTerminalKeyPress}
        onSend={() => sendTerminalInput({ submit: true })}
        onToggleVoice={() => {
          terminalVoiceInput.toggle().catch((err) => {
            setStatus(err instanceof Error ? err.message : String(err));
          });
        }}
        onOpenKeys={() => setTerminalKeyboardVisible(true)}
        onQuickKey={sendTerminalKey}
        onOpenUpload={() => setTerminalUploadPickerVisible(true)}
        onShortcut={appendTerminalInput}
        onClear={() => {
          setTerminalInput("");
          setStatus("");
          setError("");
          terminalInputRef.current = "";
        }}
        clearInline
        singleShell={windowWidth < 760}
        onRetry={() => sendTerminalInput({ submit: true })}
        onToggleStreaming={() => { void terminalStreamingInput.toggle(); }}
        streamingActive={terminalStreamingInput.active}
        streamingMode={terminalStreamingInput.mode}
        recognizing={terminalVoiceInput.active}
        voiceRecording={terminalVoiceInput.recording}
        voiceTranscribing={terminalVoiceInput.transcribing}
        disabled={!target}
        sendBusy={sendText.isPending || terminalStreamingInput.sending}
        keyBusy={sendKey.isPending}
        uploadBusy={terminalUploading}
        showUpload
        showShortcuts
        autoFocus={terminalAutoFocus}
        status={status || uploadFile.error?.message || ""}
        error={error}
        retryLabel="Retry send"
        retryDisabled={!target || sendText.isPending || sendKey.isPending}
        reserveStatusSpace={false}
      />
      <TerminalKeyboardSheet
        visible={terminalKeyboardVisible && Boolean(target)}
        disabled={!target || sendText.isPending || sendKey.isPending}
        onClose={() => setTerminalKeyboardVisible(false)}
        onKey={sendTerminalKey}
        onShortcut={appendTerminalInput}
      />
      <SheetModal visible={terminalUploadPickerVisible} title="Upload" onClose={() => setTerminalUploadPickerVisible(false)}>
        <Pressable
          style={[styles.uploadChoiceButton, terminalUploading ? styles.disabledButton : null]}
          disabled={terminalUploading || !target}
          onPress={() => {
            pickTerminalMedia().catch((err) => {
              setTerminalUploadPickerVisible(false);
              setStatus(err instanceof Error ? err.message : String(err));
            });
          }}
        >
          <View style={styles.uploadChoiceIcon}>
            <ImagePlus size={20} color={theme.colors.text} />
          </View>
          <View style={styles.uploadChoiceTextBlock}>
            <Text style={styles.uploadChoiceTitle}>Photos & videos</Text>
            <Text style={styles.uploadChoiceSubtitle}>Choose from your library</Text>
          </View>
        </Pressable>
        <Pressable
          style={[styles.uploadChoiceButton, terminalUploading ? styles.disabledButton : null]}
          disabled={terminalUploading || !target}
          onPress={() => {
            pickTerminalFiles().catch((err) => {
              setTerminalUploadPickerVisible(false);
              setStatus(err instanceof Error ? err.message : String(err));
            });
          }}
        >
          <View style={styles.uploadChoiceIcon}>
            <FileText size={20} color={theme.colors.text} />
          </View>
          <View style={styles.uploadChoiceTextBlock}>
            <Text style={styles.uploadChoiceTitle}>File</Text>
            <Text style={styles.uploadChoiceSubtitle}>Choose documents or other files</Text>
          </View>
        </Pressable>
      </SheetModal>
        </>
      )}
      </TextSelectionSurface>
    </SheetModal>
  );
}

function ResponseModal({
  target,
  copied,
  onReply,
  onCopy,
  onOpenFile,
  onClose,
  onDismiss,
}: {
  target: AgentSession | null;
  copied: boolean;
  onReply: (agent: AgentSession) => void;
  onCopy: (agent: AgentSession) => void;
  onOpenFile: (agent: AgentSession, path: string) => void;
  onClose: () => void;
  onDismiss?: () => void;
}) {
  const api = useTmuxMobileApi();
  const theme = useAppTheme();
  const styles = useAppStyles();
  const fontScale = useFontScale();
  const pinArtifact = usePinInlineArtifact();
  const [selection, setSelection] = React.useState<TextSelectionTarget | null>(null);
  const [pinStatus, setPinStatus] = React.useState("");
  const text = target?.lastAssistantText || "";
  const markdownStyle = React.useMemo(
    () => createMarkdownStyles(theme, fontScale),
    [fontScale, theme],
  );
  const openAgentFile = React.useCallback(
    (path: string) => {
      if (!target) return;
      onOpenFile(target, path);
    },
    [onOpenFile, target],
  );
  const handleMarkdownLinkPress = React.useCallback(
    (url: string) => {
      const filePath = filePathFromLocalHref(url);
      if (filePath) {
        openAgentFile(filePath);
        return false;
      }
      if (api) openAuthenticatedControllerUrl(api, url).catch(() => {});
      else Linking.openURL(url).catch(() => {});
      return false;
    },
    [api, openAgentFile],
  );
  const markdownRules = React.useMemo(
    () => createMarkdownPathRules(openAgentFile, {
      agent: target,
      onOpenUrl: handleMarkdownLinkPress,
      selectable: false,
    }),
    [handleMarkdownLinkPress, openAgentFile, target],
  );
  React.useEffect(() => {
    setPinStatus("");
    setSelection(null);
  }, [target]);

  const pinResponse = React.useCallback(() => {
    if (!api || !target || !text.trim() || pinArtifact.isPending) return;
    const machineId = agentMachineKey(target);
    const base = artifactSlugPart(target.windowName || target.kind || "response").slice(0, 60);
    const name = /\.[a-z0-9]+$/i.test(base) ? base : `${base}.md`;
    const sourceBase = artifactSlugPart(target.windowId || target.paneId || base, "window");
    setPinStatus("Pinning...");
    pinArtifact.mutate(
      {
        agent: target,
        text,
        name,
        sourcePath: `agent-response/${machineId}/${sourceBase}`,
      },
      {
        onSuccess: async (data) => {
          const link = api.url(data.pin.shareUrl).toString();
          try {
            await Clipboard.setStringAsync(link);
            setPinStatus("Pinned. Link copied.");
          } catch {
            setPinStatus(link);
          }
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
        onError: (error) => {
          setPinStatus(error instanceof Error ? error.message : String(error));
        },
      },
    );
  }, [api, pinArtifact, target, text]);

  return (
    <SheetModal
      visible={Boolean(target)}
      title="Last response"
      onClose={() => selection ? setSelection(null) : onClose()}
      onDismiss={onDismiss}
      tall
      wide
    >
      <TextSelectionSurface target={selection} theme={theme} onClose={() => setSelection(null)}>
      <View style={styles.responseSheetMetaRow}>
        <Text style={styles.sheetMeta} numberOfLines={1}>
          {target ? agentTitle(target) : ""}
        </Text>
        <View style={styles.responseHeaderActions}>
          <ActionButton icon={<TextSelect size={15} color={theme.colors.text} />} label="Select response text" onPress={() => setSelection({ title: "Last response", text })} />
          <ActionButton
            icon={<Send size={15} color={theme.colors.accent} />}
            label="Reply to session"
            disabled={!target}
            onPress={() => {
              if (target) onReply(target);
            }}
          />
          <ActionButton
            icon={
              pinArtifact.isPending ? (
                <ActivityIndicator color={theme.colors.text} />
              ) : (
                <Pin size={15} color={theme.colors.text} />
              )
            }
            label="Pin response as artifact"
            disabled={!target || !text.trim() || pinArtifact.isPending}
            onPress={pinResponse}
          />
          <ActionButton
            icon={
              copied ? (
                <Check size={15} color={theme.colors.success} />
              ) : (
                <Copy size={15} color={theme.colors.text} />
              )
            }
            label="Copy response"
            onPress={() => {
              if (target) onCopy(target);
            }}
          />
        </View>
      </View>
      {pinStatus ? <Text style={styles.sheetMeta} numberOfLines={1}>{pinStatus}</Text> : null}
      <ScrollView style={styles.responseFullBox}>
        <Pressable accessible={false} onLongPress={() => setSelection({ title: "Last response", text })} delayLongPress={550}>
        <Markdown
          style={markdownStyle}
          rules={markdownRules}
          onLinkPress={handleMarkdownLinkPress}
        >
          {text || "No response."}
        </Markdown>
        </Pressable>
      </ScrollView>
      </TextSelectionSurface>
    </SheetModal>
  );
}

function FilePreviewModal({
  target,
  onOpenPath,
  onClose,
  onDismiss,
}: {
  target: AgentFileTarget | null;
  onOpenPath: (path: string) => void;
  onClose: () => void;
  onDismiss?: () => void;
}) {
  const api = useTmuxMobileApi();
  const theme = useAppTheme();
  const styles = useAppStyles();
  const fontScale = useFontScale();
  const pinFile = usePinFileArtifact();
  const [data, setData] = React.useState<AgentFileResponse | null>(null);
  const [error, setError] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const markdownStyle = React.useMemo(
    () => createMarkdownStyles(theme, fontScale),
    [fontScale, theme],
  );
  const markdownRules = React.useMemo(
    () =>
      createMarkdownPathRules((path) => {
        setStatus("");
        onOpenPath(path);
      }, { agent: target?.agent || null, basePath: target?.path || "", selectable: true }),
    [onOpenPath, target],
  );
  const handleMarkdownLinkPress = React.useCallback(
    (url: string) => {
      const filePath = filePathFromLocalHref(url, target?.path || "");
      if (filePath) {
        setStatus("");
        onOpenPath(filePath);
        return false;
      }
      if (api) {
        openAuthenticatedControllerUrl(api, url).catch((err) => {
          setStatus(err instanceof Error ? err.message : String(err));
        });
      } else {
        Linking.openURL(url).catch(() => {});
      }
      return false;
    },
    [api, onOpenPath, target],
  );

  React.useEffect(() => {
    let cancelled = false;
    setData(null);
    setError("");
    setStatus("");
    if (!api || !target?.agent.paneId) return;
    setLoading(true);
    api
      .file(agentMachineKey(target.agent), target.agent.paneId, target.path)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, target]);

  const canRenderText =
    Boolean(data) &&
    data?.kind !== "image" &&
    (/^text\//i.test(data?.contentType || "") || data?.kind === "markdown") &&
    Number(data?.size || 0) <= 5 * 1024 * 1024;
  const textContent = React.useMemo(() => {
    if (!data || !canRenderText) return "";
    return decodeBase64Utf8(data.base64);
  }, [canRenderText, data]);

  const copyPath = React.useCallback(async () => {
    if (!target) return;
    await Clipboard.setStringAsync(target.path);
    setStatus("Path copied.");
    void Haptics.selectionAsync();
  }, [target]);

  const openInBrowser = React.useCallback(() => {
    if (!api || !target) return;
    setStatus("Opening browser...");
    openAuthenticatedControllerUrl(api, agentFileBrowserUrl(api, target.agent, target.path))
      .then(() => setStatus(""))
      .catch((err) => {
        setStatus(err instanceof Error ? err.message : String(err));
      });
  }, [api, target]);

  const pinCurrentFile = React.useCallback(() => {
    if (!api || !target || pinFile.isPending) return;
    setStatus("Pinning...");
    pinFile.mutate(
      { agent: target.agent, path: target.path },
      {
        onSuccess: async (result) => {
          const link = api.url(result.pin.shareUrl).toString();
          try {
            await Clipboard.setStringAsync(link);
            setStatus("Pinned. Link copied.");
          } catch {
            setStatus(link);
          }
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
        onError: (err) => {
          setStatus(err instanceof Error ? err.message : String(err));
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        },
      },
    );
  }, [api, pinFile, target]);

  const meta = [
    data?.name || target?.path || "",
    data?.contentType || "",
    formatPinSize(data?.size),
    data?.truncated ? "truncated" : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <SheetModal
      visible={Boolean(target)}
      title="File"
      onClose={onClose}
      onDismiss={onDismiss}
      tall
      wide
    >
      <View style={styles.responseSheetMetaRow}>
        <Text style={styles.sheetMeta} numberOfLines={1}>
          {meta || target?.path || ""}
        </Text>
        <View style={styles.responseHeaderActions}>
          <ActionButton
            icon={
              pinFile.isPending ? (
                <ActivityIndicator color={theme.colors.text} />
              ) : (
                <Pin size={15} color={theme.colors.text} />
              )
            }
            label="Pin file as artifact"
            disabled={!target || !data || data.truncated || pinFile.isPending}
            onPress={pinCurrentFile}
          />
          <ActionButton
            icon={<ExternalLink size={15} color={theme.colors.text} />}
            label="Open in browser"
            disabled={!target}
            onPress={openInBrowser}
          />
          <ActionButton
            icon={<Copy size={15} color={theme.colors.text} />}
            label="Copy path"
            disabled={!target}
            onPress={() => {
              copyPath().catch(() => {});
            }}
          />
        </View>
      </View>
      {target?.path ? (
        <Text style={styles.filePathMeta} numberOfLines={2}>
          {target.path}
        </Text>
      ) : null}
      {status ? <Text style={styles.sheetMeta} numberOfLines={2}>{status}</Text> : null}
      {loading ? <ActivityIndicator color={theme.colors.accent} /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {data?.kind === "image" ? (
        <View style={styles.fileImageFrame}>
          <Image
            source={{ uri: `data:${data.contentType};base64,${data.base64}` }}
            style={styles.fileImage}
            resizeMode="contain"
          />
        </View>
      ) : canRenderText ? (
        <ScrollView style={styles.responseFullBox}>
          {data?.kind === "markdown" ? (
            <Markdown
              style={markdownStyle}
              rules={markdownRules}
              onLinkPress={handleMarkdownLinkPress}
            >
              {textContent || "(empty file)"}
            </Markdown>
          ) : (
            <Text selectable style={styles.terminalText}>{textContent || "(empty file)"}</Text>
          )}
        </ScrollView>
      ) : !loading && !error ? (
        <View style={styles.fileUnsupportedBox}>
          <Text style={styles.emptyTitle}>Preview unavailable</Text>
          <Text style={styles.emptyText}>
            Open it in the browser, or pin it as a shareable artifact.
          </Text>
        </View>
      ) : null}
    </SheetModal>
  );
}

function TranscriptModal({
  target,
  onOpenFile,
  onClose,
  onDismiss,
}: {
  target: AgentSession | null;
  onOpenFile: (agent: AgentSession, path: string) => void;
  onClose: () => void;
  onDismiss?: () => void;
}) {
  const theme = useAppTheme();
  const styles = useAppStyles();
  const fontScale = useFontScale();
  const api = useTmuxMobileApi();
  const pinArtifact = usePinInlineArtifact();
  const transcriptScrollRef = React.useRef<ScrollView | null>(null);
  const [selection, setSelection] = React.useState<TextSelectionTarget | null>(null);
  const [data, setData] = React.useState<AgentTranscriptResponse | null>(null);
  const [error, setError] = React.useState("");
  const [pinStatus, setPinStatus] = React.useState("");
  const [pinningTurn, setPinningTurn] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);
  const markdownStyle = React.useMemo(
    () => createMarkdownStyles(theme, fontScale),
    [fontScale, theme],
  );
  const scrollTranscriptToBottom = React.useCallback(() => {
    requestAnimationFrame(() => {
      transcriptScrollRef.current?.scrollToEnd({ animated: false });
    });
  }, []);
  const openTranscriptFile = React.useCallback(
    (path: string) => {
      if (target) onOpenFile(target, path);
    },
    [onOpenFile, target],
  );
  const markdownRules = React.useMemo(
    () => createMarkdownPathRules(openTranscriptFile, { agent: target, selectable: false }),
    [openTranscriptFile, target],
  );
  const handleMarkdownLinkPress = React.useCallback(
    (url: string) => {
      const filePath = filePathFromLocalHref(url);
      if (filePath) {
        openTranscriptFile(filePath);
        return false;
      }
      if (api) {
        openAuthenticatedControllerUrl(api, url).catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
        });
      } else {
        Linking.openURL(url).catch(() => {});
      }
      return false;
    },
    [api, openTranscriptFile],
  );

  React.useEffect(() => {
    let cancelled = false;
    setData(null);
    setSelection(null);
    setError("");
    setPinStatus("");
    setPinningTurn(null);
    if (!api || !target?.paneId) return;
    setLoading(true);
    api
      .transcript(agentMachineKey(target), target.paneId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, target]);

  const pinTranscriptTurn = React.useCallback(
    (turn: { role?: string; text?: string }, index: number) => {
      const text = String(turn.text || "");
      if (!api || !target || !text.trim() || pinArtifact.isPending) return;
      const machineId = agentMachineKey(target);
      const role = turn.role === "assistant" ? "assistant" : "user";
      const suffix = `transcript-${String(index + 1).padStart(3, "0")}-${role}`;
      const base = artifactSlugPart(target.windowName || target.kind || "response").slice(0, 60);
      const nameBase = `${base}-${suffix}`;
      const name = /\.[a-z0-9]+$/i.test(nameBase) ? nameBase : `${nameBase}.md`;
      const sourceBase = artifactSlugPart(target.windowId || target.paneId || base, "window");
      setPinningTurn(index);
      setPinStatus(`Pinning ${role} turn ${index + 1}...`);
      pinArtifact.mutate(
        {
          agent: target,
          text,
          name,
          sourcePath: `agent-response/${machineId}/${sourceBase}/${suffix}`,
        },
        {
          onSuccess: async (result) => {
            const link = api.url(result.pin.shareUrl).toString();
            try {
              await Clipboard.setStringAsync(link);
              setPinStatus(`Pinned turn ${index + 1}. Link copied.`);
            } catch {
              setPinStatus(link);
            }
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
          onError: (err) => {
            setPinStatus(err instanceof Error ? err.message : String(err));
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          },
          onSettled: () => setPinningTurn(null),
        },
      );
    },
    [api, pinArtifact, target],
  );

  const turns = data?.result?.turns || [];
  return (
    <SheetModal
      visible={Boolean(target)}
      title="Transcript"
      onClose={() => selection ? setSelection(null) : onClose()}
      onDismiss={onDismiss}
      onShow={scrollTranscriptToBottom}
      tall
      wide
    >
      <TextSelectionSurface target={selection} theme={theme} onClose={() => setSelection(null)}>
      <View style={styles.responseSheetMetaRow}>
        <Text style={[styles.sheetMeta, { flex: 1 }]}>Long-press a message to select text.</Text>
        <ActionButton
          icon={<TextSelect size={16} color={theme.colors.text} />}
          label="Select entire transcript"
          disabled={!turns.length}
          onPress={() => setSelection({ title: "Transcript", text: transcriptSelectionText(turns) })}
        />
      </View>
      {loading ? <ActivityIndicator /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {pinStatus ? <Text style={styles.sheetMeta} numberOfLines={2}>{pinStatus}</Text> : null}
      <ScrollView
        ref={transcriptScrollRef}
        style={styles.transcriptBox}
        onLayout={scrollTranscriptToBottom}
        onContentSizeChange={scrollTranscriptToBottom}
      >
        {turns.length === 0 ? <Text style={styles.sheetMeta}>No structured transcript.</Text> : null}
        {turns.map((turn, index) => (
          <View key={`${index}-${turn.role}`} style={styles.turnRow}>
            <View style={styles.turnHeaderRow}>
              <Text style={styles.turnRole}>{turn.role || "turn"}</Text>
              <ActionButton
                icon={
                  pinningTurn === index ? (
                    <ActivityIndicator color={theme.colors.text} />
                  ) : (
                    <Pin size={15} color={theme.colors.text} />
                  )
                }
                label={`Pin ${turn.role || "transcript"} turn ${index + 1} as artifact`}
                disabled={!String(turn.text || "").trim() || pinArtifact.isPending}
                onPress={() => pinTranscriptTurn(turn, index)}
              />
            </View>
            <Pressable
              accessible={false}
              onLongPress={() => setSelection({ title: `${turn.role || "turn"} · ${index + 1}`, text: turn.text || "" })}
              delayLongPress={550}
            >
            {turn.role === "assistant" ? (
              <Markdown
                style={markdownStyle}
                rules={markdownRules}
                onLinkPress={handleMarkdownLinkPress}
              >
                {turn.text || ""}
              </Markdown>
            ) : (
              <LinkedPathText
                text={turn.text || ""}
                style={styles.turnText}
                selectable={false}
                onOpenPath={openTranscriptFile}
              />
            )}
            </Pressable>
          </View>
        ))}
      </ScrollView>
      </TextSelectionSurface>
    </SheetModal>
  );
}

function PinnedArtifactsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const api = useTmuxMobileApi();
  const theme = useAppTheme();
  const appDialog = useAppDialog(theme, visible);
  const styles = useAppStyles();
  const visionControls = useVisionControls();
  const fieldPresentation = useFieldPresentation("artifact-name");
  const pins = usePins(visible);
  const renamePin = useRenamePin();
  const deletePin = useDeletePin();
  const [status, setStatus] = React.useState("");
  const [renameTarget, setRenameTarget] = React.useState<ArtifactPin | null>(null);
  const [viewerPin, setViewerPin] = React.useState<ArtifactPin | null>(null);
  const [renameName, setRenameName] = React.useState("");
  const [renameVoiceStatus, setRenameVoiceStatus] = React.useState("");
  const renameVoice = useLocalVoiceInput({
    scopeKey: visible && renameTarget ? `rename-pin:${renameTarget.id}` : "",
    onText: setRenameName,
    onStatus: setRenameVoiceStatus,
    contextualStrings: [renameTarget?.name || "", "artifact", "pin"].filter(Boolean),
  });
  const data = pins.data?.pins || [];
  const refetchPins = pins.refetch;

  React.useEffect(() => {
    if (visible) {
      setStatus("");
      setRenameTarget(null);
      setRenameName("");
      setRenameVoiceStatus("");
      void refetchPins();
    } else {
      setViewerPin(null);
    }
  }, [refetchPins, visible]);

  const absolutePinUrl = React.useCallback(
    (pin: ArtifactPin) => (api ? api.url(pin.shareUrl).toString() : pin.shareUrl),
    [api],
  );

  const openPinInBrowser = React.useCallback(
    (pin: ArtifactPin) => {
      const url = absolutePinUrl(pin);
      if (!api) return;
      setStatus("Opening artifact...");
      openAuthenticatedControllerUrl(api, url)
        .then(() => setStatus(""))
        .catch((error) => {
          setStatus(error instanceof Error ? error.message : String(error));
        });
    },
    [absolutePinUrl, api],
  );

  const openPin = React.useCallback(
    (pin: ArtifactPin) => {
      if (artifactOpenMode(pin) === "browser") {
        openPinInBrowser(pin);
        return;
      }
      setStatus("");
      setViewerPin(pin);
    },
    [openPinInBrowser],
  );

  const copyPinLink = React.useCallback(
    async (pin: ArtifactPin) => {
      const url = absolutePinUrl(pin);
      await Clipboard.setStringAsync(url);
      setStatus("Link copied");
      void Haptics.selectionAsync();
    },
    [absolutePinUrl],
  );

  const requestRenamePin = React.useCallback(
    (pin: ArtifactPin) => {
      if (!pin.owned) return;
      renamePin.reset();
      setRenameTarget(pin);
      setRenameName(pin.name || "");
      setRenameVoiceStatus("");
      setStatus("");
    },
    [renamePin],
  );

  const submitRenamePin = React.useCallback(() => {
    if (!renameTarget || renamePin.isPending) return;
    const name = renameName.trim();
    if (!name || name === renameTarget.name) return;
    renamePin.mutate(
      { id: renameTarget.id, name },
      {
        onSuccess: () => {
          setRenameTarget(null);
          setRenameName("");
          setStatus("Renamed");
          void Haptics.selectionAsync();
        },
        onError: (error) => setStatus(error instanceof Error ? error.message : String(error)),
      },
    );
  }, [renameName, renamePin, renameTarget]);

  const confirmDeletePin = React.useCallback(
    (pin: ArtifactPin) => {
      if (!pin.owned) return;
      appDialog.show("Unpin artifact", `Remove "${pin.name || "this artifact"}" and its shared link?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unpin",
          style: "destructive",
          onPress: () => {
            deletePin.mutate(
              { id: pin.id },
              {
                onSuccess: () => setStatus("Unpinned"),
                onError: (error) => setStatus(error instanceof Error ? error.message : String(error)),
              },
            );
          },
        },
      ]);
    },
    [deletePin],
  );

  return (
    <SheetModal visible={visible} title="Pinned artifacts" onClose={onClose} tall wide>
      {appDialog.node}
      <View style={styles.responseSheetMetaRow}>
        <Text style={styles.sheetMeta} numberOfLines={1}>
          {pins.isLoading ? "Loading..." : `${data.length} pin${data.length === 1 ? "" : "s"}`}
        </Text>
        <ActionButton
          icon={<RefreshCcw size={15} color={theme.colors.text} />}
          label="Refresh artifacts"
          disabled={pins.isFetching}
          onPress={() => {
            void pins.refetch();
          }}
        />
      </View>
      {status || pins.error || renamePin.error || deletePin.error ? (
        <Text style={pins.error || renamePin.error || deletePin.error ? styles.errorText : styles.sheetMeta} numberOfLines={2}>
          {status ||
            pins.error?.message ||
            renamePin.error?.message ||
            deletePin.error?.message ||
            ""}
        </Text>
      ) : null}
      {renameTarget ? (
        <View style={styles.pinRenameEditor}>
          {fieldPresentation === "voice" ? (
            <VoiceValueField
              label="Artifact name"
              value={renameName}
              emptyLabel="Speak an artifact name"
              active={renameVoice.active}
              status={renameVoiceStatus}
              disabled={renamePin.isPending}
              onToggle={() => {
                renameVoice.toggle().catch((error) => {
                  setRenameVoiceStatus(error instanceof Error ? error.message : String(error));
                });
              }}
              onClear={() => setRenameName("")}
            />
          ) : (
            <>
              <Text style={styles.inputLabel} numberOfLines={1}>
                Rename artifact
              </Text>
              <KeyboardTextInput
                accessibilityLabel="Artifact name"
                value={renameName}
                onChangeText={setRenameName}
                editable={!renamePin.isPending}
                autoFocus
                autoCapitalize="sentences"
                autoCorrect={false}
                returnKeyType="done"
                selectTextOnFocus
                onSubmitEditing={submitRenamePin}
                style={styles.textInput}
              />
            </>
          )}
          <View style={styles.settingsButtonRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: renamePin.isPending }}
              style={[
                styles.settingsSecondaryButton,
                styles.pinRenameButton,

                renamePin.isPending ? styles.disabledButton : null,
              ]}
              disabled={renamePin.isPending}
              onPress={() => {
                renamePin.reset();
                setRenameTarget(null);
                setRenameName("");
              }}
            >
              <X size={15} color={theme.colors.text} />
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                disabled: renamePin.isPending || !renameName.trim() || renameName.trim() === renameTarget.name,
              }}
              style={[
                styles.settingsPrimaryButton,
                styles.pinRenameButton,

                renamePin.isPending || !renameName.trim() || renameName.trim() === renameTarget.name
                  ? styles.disabledButton
                  : null,
              ]}
              disabled={renamePin.isPending || !renameName.trim() || renameName.trim() === renameTarget.name}
              onPress={submitRenamePin}
            >
              {renamePin.isPending ? (
                <ActivityIndicator color={theme.colors.surfaceRaised} />
              ) : (
                <Check size={15} color={theme.colors.surfaceRaised} />
              )}
              <Text style={styles.primaryButtonText}>Rename</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <FlatList
        data={data}
        style={styles.pinsViewport}
        keyExtractor={(pin) => pin.id}
        contentContainerStyle={[styles.pinsList, data.length === 0 ? styles.emptyList : null]}
        refreshControl={
          <RefreshControl
            refreshing={pins.isFetching}
            onRefresh={() => {
              void pins.refetch();
            }}
            tintColor={theme.colors.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <FileText size={28} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>No pinned artifacts</Text>
            <Text style={styles.emptyText}>Pin a response to create a shareable artifact.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ArtifactPinRow
            pin={item}
            busy={Boolean(renameTarget) || renamePin.isPending || deletePin.isPending}
            onOpen={() => openPin(item)}
            onCopy={() => {
              copyPinLink(item).catch((error) => {
                setStatus(error instanceof Error ? error.message : String(error));
              });
            }}
            onRename={() => requestRenamePin(item)}
            onDelete={() => confirmDeletePin(item)}
          />
        )}
      />
      <ArtifactViewerModal
        pin={viewerPin}
        onClose={() => setViewerPin(null)}
        onOpenBrowser={openPinInBrowser}
      />
    </SheetModal>
  );
}

function ArtifactViewerModal({
  pin,
  onClose,
  onOpenBrowser,
}: {
  pin: ArtifactPin | null;
  onClose: () => void;
  onOpenBrowser: (pin: ArtifactPin) => void;
}) {
  const api = useTmuxMobileApi();
  const theme = useAppTheme();
  const styles = useAppStyles();
  const fontScale = useFontScale();
  const mode = pin ? artifactOpenMode(pin) : "browser";
  const rawUrl = api && pin ? controllerArtifactRawUrl(api.baseUrl, pin.shareUrl) : "";
  const [text, setText] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const markdownStyle = React.useMemo(
    () => createMarkdownStyles(theme, fontScale),
    [fontScale, theme],
  );

  React.useEffect(() => {
    setText("");
    setError("");
    if (!pin || !api || (mode !== "markdown" && mode !== "text")) {
      setLoading(false);
      return;
    }
    if (!rawUrl) {
      setError("This artifact URL cannot be opened inside the app.");
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    api
      .artifactText(rawUrl, controller.signal)
      .then(setText)
      .catch((caught) => {
        if (!controller.signal.aborted) {
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, mode, pin, rawUrl]);

  React.useEffect(() => {
    if (!pin || mode !== "image") return;
    setLoading(true);
    setError(rawUrl ? "" : "This artifact URL cannot be opened inside the app.");
  }, [mode, pin, rawUrl]);

  const handleLinkPress = React.useCallback((url: string) => {
    Linking.openURL(url).catch((caught) => {
      setError(caught instanceof Error ? caught.message : String(caught));
    });
    return false;
  }, []);

  const meta = pin
    ? [pin.contentType || pin.kind || "", formatPinSize(pin.size)].filter(Boolean).join(" · ")
    : "";

  return (
    <SheetModal
      visible={Boolean(pin)}
      title={pin?.name || "Artifact"}
      onClose={onClose}
      tall
      wide
    >
      {pin ? (
        <View style={styles.responseSheetMetaRow}>
          <Text style={styles.sheetMeta} numberOfLines={1}>{meta}</Text>
          <ActionButton
            icon={<ExternalLink size={15} color={theme.colors.text} />}
            label="Open artifact in browser"
            onPress={() => onOpenBrowser(pin)}
          />
        </View>
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {mode === "image" && rawUrl && api ? (
        <View style={styles.artifactImageFrame}>
          <Image
            accessibilityLabel={pin?.name || "Artifact image"}
            source={{
              uri: rawUrl,
              headers: api.token ? { Authorization: `Bearer ${api.token}` } : undefined,
            }}
            style={styles.artifactImage}
            resizeMode="contain"
            onLoadStart={() => {
              setLoading(true);
              setError("");
            }}
            onLoadEnd={() => setLoading(false)}
            onError={(event) => {
              setLoading(false);
              setError(event.nativeEvent.error || "Could not load this image.");
            }}
          />
          {loading ? (
            <ActivityIndicator
              pointerEvents="none"
              style={styles.artifactLoadingOverlay}
              color={theme.colors.accent}
            />
          ) : null}
        </View>
      ) : mode === "markdown" ? (
        <ScrollView style={styles.responseFullBox}>
          {loading ? <ActivityIndicator color={theme.colors.accent} /> : null}
          {!loading && !error ? (
            <Markdown style={markdownStyle} onLinkPress={handleLinkPress}>
              {text || "(empty artifact)"}
            </Markdown>
          ) : null}
        </ScrollView>
      ) : mode === "text" ? (
        <ScrollView style={styles.responseFullBox}>
          {loading ? <ActivityIndicator color={theme.colors.accent} /> : null}
          {!loading && !error ? (
            <Text selectable style={styles.responseFullText}>{text || "(empty artifact)"}</Text>
          ) : null}
        </ScrollView>
      ) : null}
    </SheetModal>
  );
}

function ArtifactPinRow({
  pin,
  busy,
  onOpen,
  onCopy,
  onRename,
  onDelete,
}: {
  pin: ArtifactPin;
  busy: boolean;
  onOpen: () => void;
  onCopy: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const theme = useAppTheme();
  const styles = useAppStyles();
  const meta = [
    pin.version && pin.version > 1 ? `v${pin.version}` : "",
    formatPinSize(pin.size),
    formatPinAge(pin.createdAt),
    PIN_SCOPE_LABELS[pin.share?.scope || ""] || pin.share?.scope || "",
    !pin.owned && pin.ownerEmail ? `by ${pin.ownerEmail}` : "",
  ].filter(Boolean);
  const source =
    pin.preview ||
    (pin.sourcePath && !pin.sourcePath.startsWith("agent-response/") ? pin.sourcePath : "");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open artifact ${pin.name || "unnamed"}`}
      style={({ pressed }) => [styles.pinRow, pressed ? styles.pinRowPressed : null]}
      onPress={onOpen}
    >
      <View style={styles.pinTitleRow}>
        <Text style={styles.pinName} numberOfLines={2}>
          {pin.name || "(unnamed)"}
        </Text>
        <Eye size={16} color={theme.colors.textMuted} />
      </View>
      {meta.length ? (
        <Text style={styles.pinMeta} numberOfLines={1}>
          {meta.join(" · ")}
        </Text>
      ) : null}
      {source ? (
        <Text style={styles.pinSource} numberOfLines={2}>
          {source}
        </Text>
      ) : null}
      <View style={styles.pinActions}>
        <ActionButton
          icon={<Link2 size={15} color={theme.colors.text} />}
          label="Copy artifact link"
          stopPropagation
          onPress={onCopy}
        />
        {pin.owned ? (
          <>
            <ActionButton
              icon={<Edit3 size={15} color={theme.colors.text} />}
              label="Rename artifact"
              disabled={busy}
              stopPropagation
              onPress={onRename}
            />
            <ActionButton
              icon={<Trash2 size={15} color={theme.colors.danger} />}
              label="Unpin artifact"
              disabled={busy}
              stopPropagation
              onPress={onDelete}
            />
          </>
        ) : null}
      </View>
    </Pressable>
  );
}

function StartAgentModal({
  visible,
  machines,
  selectedAgent,
  onClose,
}: {
  visible: boolean;
  machines: Machine[];
  selectedAgent: AgentSession | null;
  onClose: () => void;
}) {
  const theme = useAppTheme();
  const styles = useAppStyles();
  const visionControls = useVisionControls();
  const cwdPresentation = useFieldPresentation("agent-cwd");
  const muxPresentation = useFieldPresentation("agent-mux");
  const sessionNamePresentation = useFieldPresentation("agent-session-name");
  const startAgent = useStartAgent();
  const [machineId, setMachineId] = React.useState("");
  const [kind, setKind] = React.useState<"claude" | "codex" | "pi">("codex");
  const [cwd, setCwd] = React.useState("~");
  const [mux, setMux] = React.useState("tmux");
  const [sessionName, setSessionName] = React.useState("");
  const initializedForOpen = React.useRef(false);
  const [activeVoiceField, setActiveVoiceField] = React.useState<"cwd" | "mux" | "session" | null>(null);
  const activeVoiceFieldRef = React.useRef<"cwd" | "mux" | "session" | null>(null);
  const [voiceStatus, setVoiceStatus] = React.useState("");
  const selectedMachine = machines.find((machine) => machineKey(machine) === machineId) || null;
  const muxOptions = React.useMemo(
    () =>
      Array.from(
        new Set(
          [
            selectedMachine?.mux,
            ...(selectedMachine?.muxes || []).map((entry) => entry.mux),
            "tmux",
          ].filter((value): value is string => Boolean(value?.trim())),
        ),
      ),
    [selectedMachine],
  );
  const formVoice = useLocalVoiceInput({
    scopeKey: visible ? `start-agent:${machineId}` : "",
    onText: (transcript) => {
      if (activeVoiceFieldRef.current === "cwd") setCwd(transcript);
      else if (activeVoiceFieldRef.current === "mux") setMux(transcript);
      else if (activeVoiceFieldRef.current === "session") setSessionName(transcript);
    },
    onStatus: setVoiceStatus,
    contextualStrings: [
      "tmux",
      "rmux",
      "Codex",
      "Claude",
      selectedMachine?.agentCwd || "",
      selectedMachine?.homeDir || "",
      ...muxOptions,
    ].filter(Boolean),
  });

  const toggleFormVoice = React.useCallback(
    (field: "cwd" | "mux" | "session") => {
      if (formVoice.active && activeVoiceFieldRef.current !== field) return;
      activeVoiceFieldRef.current = field;
      setActiveVoiceField(field);
      setVoiceStatus("");
      formVoice.toggle().catch((error) => {
        setVoiceStatus(error instanceof Error ? error.message : String(error));
      });
    },
    [formVoice],
  );

  React.useEffect(() => {
    if (!visible) {
      initializedForOpen.current = false;
      return;
    }
    // Refreshes replace machines/selectedAgent while the user is editing.
    // Seed defaults once per opening, never over an in-progress draft.
    if (initializedForOpen.current) return;
    initializedForOpen.current = true;
    const selectedMachineId = selectedAgent ? agentMachineKey(selectedAgent) : machineKey(machines[0]);
    const machine = machines.find((item) => machineKey(item) === selectedMachineId) || machines[0];
    setMachineId(machine ? machineKey(machine) : "local");
    setKind(selectedAgent?.kind === "pi" ? "pi" : selectedAgent?.kind === "claude" ? "claude" : "codex");
    setCwd(selectedAgent?.cwd || machine?.agentCwd || machine?.homeDir || "~");
    setMux(selectedAgent?.mux || machine?.mux || machine?.muxes?.[0]?.mux || "tmux");
    setSessionName("");
    activeVoiceFieldRef.current = null;
    setActiveVoiceField(null);
    setVoiceStatus("");
  }, [machines, selectedAgent, visible]);

  return (
    <SheetModal visible={visible} title="Start agent" onClose={onClose}>
      <Text style={styles.inputLabel}>Agent</Text>
      <View style={styles.segmentRow}>
        <Segment active={kind === "codex"} label="Codex" onPress={() => setKind("codex")} />
        <Segment active={kind === "claude"} label="Claude" onPress={() => setKind("claude")} />
        <Segment active={kind === "pi"} label="Pi" onPress={() => setKind("pi")} />
      </View>
      <Text style={styles.inputLabel}>Machine</Text>
      <ScrollView
        horizontal
        style={styles.machineStripViewport}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.machineStrip}
      >
        {machines.map((machine) => {
          const key = machineKey(machine);
          return (
            <Chip key={key} active={machineId === key} onPress={() => setMachineId(key)}>
              {machineLabel(machine)}
            </Chip>
          );
        })}
      </ScrollView>
      {cwdPresentation === "voice" ? (
        <VoiceValueField
          label="Directory"
          value={cwd}
          emptyLabel="Speak a directory"
          active={formVoice.active && activeVoiceField === "cwd"}
          status={activeVoiceField === "cwd" ? voiceStatus : ""}
          disabled={formVoice.active && activeVoiceField !== "cwd"}
          onToggle={() => toggleFormVoice("cwd")}
          onClear={() => setCwd("")}
        />
      ) : (
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Directory</Text>
          <KeyboardTextInput value={cwd} onChangeText={setCwd} autoCapitalize="none" style={styles.textInput} />
        </View>
      )}
      <View style={visionControls ? styles.visionFieldStack : styles.twoCol}>
        <View style={visionControls ? styles.visionFieldStackItem : styles.twoColItem}>
          {muxPresentation === "voice" ? (
            <>
              <VoiceValueField
                label="Mux"
                value={mux}
                emptyLabel="Choose or speak a mux"
                active={formVoice.active && activeVoiceField === "mux"}
                status={activeVoiceField === "mux" ? voiceStatus : ""}
                disabled={formVoice.active && activeVoiceField !== "mux"}
                onToggle={() => toggleFormVoice("mux")}
                onClear={() => setMux("")}
              />
              <View style={styles.visionMuxRow}>
                {muxOptions.map((option) => (
                  <Pressable
                    key={option}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: mux === option }}
                    style={[
                      styles.visionMuxButton,
                      mux === option ? styles.visionPreferenceButtonActive : null,
                    ]}
                    onPress={() => setMux(option)}
                  >
                    <Text
                      style={[
                        styles.visionPreferenceButtonText,
                        mux === option ? styles.visionPreferenceButtonTextActive : null,
                      ]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.inputLabel}>Mux</Text>
              <KeyboardTextInput value={mux} onChangeText={setMux} autoCapitalize="none" style={styles.textInput} />
            </>
          )}
        </View>
        <View style={visionControls ? styles.visionFieldStackItem : styles.twoColItem}>
          {sessionNamePresentation === "voice" ? (
            <VoiceValueField
              label="Session name"
              value={sessionName}
              emptyLabel="Optional"
              active={formVoice.active && activeVoiceField === "session"}
              status={activeVoiceField === "session" ? voiceStatus : ""}
              disabled={formVoice.active && activeVoiceField !== "session"}
              onToggle={() => toggleFormVoice("session")}
              onClear={() => setSessionName("")}
            />
          ) : (
            <>
              <Text style={styles.inputLabel}>Session name</Text>
              <KeyboardTextInput
                value={sessionName}
                onChangeText={setSessionName}
                autoCapitalize="none"
                style={styles.textInput}
              />
            </>
          )}
        </View>
      </View>
      <Pressable
        style={[
          styles.primaryButton,

          startAgent.isPending ? styles.disabledButton : null,
        ]}
        disabled={startAgent.isPending || !machineId || !cwd.trim()}
        onPress={() => {
          startAgent.mutate(
            {
              machineId,
              kind,
              cwd: cwd.trim(),
              mux: mux.trim() || "tmux",
              sessionName: sessionName.trim(),
            },
            {
              onSuccess: () => onClose(),
            },
          );
        }}
      >
        {startAgent.isPending ? (
          <ActivityIndicator color={theme.colors.surfaceRaised} />
        ) : (
          <Text style={styles.primaryButtonText}>Start</Text>
        )}
      </Pressable>
      {startAgent.error ? <Text style={styles.errorText}>{startAgent.error.message}</Text> : null}
    </SheetModal>
  );
}

function Segment({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const styles = useAppStyles();
  return (
    <Pressable style={[styles.segment, active ? styles.segmentActive : null]} onPress={onPress}>
      <Text style={[styles.segmentText, active ? styles.segmentTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function SheetModal({
  visible,
  title,
  children,
  onClose,
  onDismiss,
  onShow,
  tall,
  wide,
  fullscreen,
  fullscreenOnWide,
  hideHeader,
  captureShortcuts = true,
}: {
  visible: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onDismiss?: () => void;
  onShow?: () => void;
  tall?: boolean;
  wide?: boolean;
  fullscreen?: boolean;
  fullscreenOnWide?: boolean;
  hideHeader?: boolean;
  captureShortcuts?: boolean;
}) {
  const theme = useAppTheme();
  const styles = useAppStyles();
  const fontScale = useFontScale();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);
  const dragY = React.useRef(new Animated.Value(0)).current;
  const wasVisible = React.useRef(visible);

  React.useEffect(() => {
    if (Platform.OS !== "ios" && wasVisible.current && !visible) onDismiss?.();
    wasVisible.current = visible;
  }, [onDismiss, visible]);

  React.useEffect(() => {
    if (visible) dragY.setValue(0);
    else setKeyboardHeight(0);
  }, [dragY, visible]);

  React.useEffect(() => {
    if (!visible) return;
    const updateKeyboardHeight = (event: { endCoordinates?: { screenY?: number; height?: number } }) => {
      const screenY = Number(event.endCoordinates?.screenY ?? windowHeight);
      const frameHeight = Number(event.endCoordinates?.height ?? 0);
      const overlapHeight = Math.max(0, Math.min(windowHeight, windowHeight - screenY));
      const reportedHeight = Math.max(0, Math.min(windowHeight, frameHeight));
      const nextHeight = overlapHeight || reportedHeight;
      const implausibleWideFrame =
        windowWidth / fontScale >= 760 &&
        (screenY <= 0 || nextHeight > windowHeight * 0.58);
      setKeyboardHeight(implausibleWideFrame ? 0 : nextHeight);
    };
    const clearKeyboardHeight = () => setKeyboardHeight(0);
    const subscriptions =
      Platform.OS === "ios"
        ? [
            Keyboard.addListener("keyboardWillChangeFrame", updateKeyboardHeight),
            Keyboard.addListener("keyboardWillHide", clearKeyboardHeight),
          ]
        : [
            Keyboard.addListener("keyboardDidShow", updateKeyboardHeight),
            Keyboard.addListener("keyboardDidHide", clearKeyboardHeight),
          ];
    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [fontScale, visible, windowHeight, windowWidth]);

  const sheetGestureStyle = React.useMemo(
    () => ({
      transform: [
        {
          translateY: dragY.interpolate({
            inputRange: [0, 620],
            outputRange: [0, 620],
            extrapolate: "clamp",
          }),
        },
      ],
    }),
    [dragY],
  );

  const closeSheet = React.useCallback(() => {
    dragY.stopAnimation();
    dragY.setValue(0);
    onClose();
  }, [dragY, onClose]);

  const resetDrag = React.useCallback(() => {
    Animated.spring(dragY, {
      toValue: 0,
      damping: 18,
      stiffness: 190,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [dragY]);

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_event, gestureState) =>
          gestureState.dy > 10 && Math.abs(gestureState.dx) < 36,
        onMoveShouldSetPanResponder: (_event, gestureState) =>
          gestureState.dy > 10 && Math.abs(gestureState.dx) < 36,
        onPanResponderGrant: () => {
          dragY.stopAnimation();
        },
        onPanResponderMove: (_event, gestureState) => {
          dragY.setValue(Math.max(0, gestureState.dy));
        },
        onPanResponderRelease: (_event, gestureState) => {
          const shouldDismiss = gestureState.dy > 86 || gestureState.vy > 0.76;
          if (shouldDismiss) {
            closeSheet();
            return;
          }
          resetDrag();
        },
        onPanResponderTerminate: resetDrag,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => false,
      }),
    [closeSheet, dragY, resetDrag],
  );

  const sheetIsWide = windowWidth / fontScale >= 760;
  const fullscreenActive = Boolean(fullscreen || (fullscreenOnWide && sheetIsWide));
  const keyboardAffectsSheet = fullscreenActive || !sheetIsWide || !tall;
  const keyboardOffset = visible && keyboardAffectsSheet ? keyboardHeight : 0;
  const keyboardGap = 0;
  const availableSheetHeight = Math.max(
    220,
    windowHeight - keyboardOffset - keyboardGap - (fullscreenActive ? 0 : insets.top + 14),
  );
  const heightRatio = tall ? (wide && sheetIsWide ? 0.96 : sheetIsWide ? 0.9 : 0.94) : sheetIsWide ? 0.76 : 0.82;
  const maxSheetHeight = fullscreenActive ? availableSheetHeight : Math.min(windowHeight * heightRatio, availableSheetHeight);
  const sheetFrameStyle = {
    height: fullscreenActive || tall ? maxSheetHeight : undefined,
    maxHeight: maxSheetHeight,
    marginBottom: fullscreenActive ? keyboardOffset + keyboardGap : keyboardOffset + keyboardGap,
    paddingTop: fullscreenActive ? insets.top + (hideHeader ? 0 : 12) : undefined,
    paddingLeft: fullscreenActive && hideHeader ? insets.left + 12 : undefined,
    paddingRight: fullscreenActive && hideHeader ? insets.right + 12 : undefined,
    paddingBottom: keyboardOffset > 0 ? 16 : insets.bottom + 16,
    borderTopLeftRadius: fullscreenActive ? 0 : undefined,
    borderTopRightRadius: fullscreenActive ? 0 : undefined,
    borderBottomLeftRadius: fullscreenActive ? 0 : keyboardOffset > 0 ? 18 : 0,
    borderBottomRightRadius: fullscreenActive ? 0 : keyboardOffset > 0 ? 18 : 0,
    backgroundColor: theme.colors.surface,
  };

  const body = tall ? (
    <View
      style={[
        styles.sheetBody,
        hideHeader ? styles.sheetBodyHeaderless : null,
        styles.sheetBodyTall,
        styles.sheetContent,
        styles.sheetContentTall,
      ]}
    >
      {children}
    </View>
  ) : (
    <ScrollView
      style={styles.sheetBody}
      contentContainerStyle={[styles.sheetContent, styles.sheetContentKeyboard]}
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onDismiss={onDismiss}
      onShow={onShow}
      onRequestClose={closeSheet}
    >
      <CJMUXKeyboardShortcutSurface
        mode={
          captureShortcuts && Platform.OS === "ios" && Platform.isPad
            ? "escape"
            : "none"
        }
        onShortcutKeyDown={({ nativeEvent }) => {
          if (nativeEvent.key === "Escape") closeSheet();
        }}
        style={styles.modalRoot}
      >
        <View style={styles.modalBackdrop}>
          <Pressable accessibilityLabel="Dismiss sheet" style={styles.modalBackdropTouch} onPress={closeSheet} />
          <View
            pointerEvents="box-none"
            style={[styles.modalKeyboard, fullscreenActive ? styles.modalKeyboardFullscreen : null]}
          >
            <Animated.View
              style={[
                styles.sheet,
                wide ? styles.sheetWide : null,
                tall ? styles.sheetTall : null,
                fullscreenActive ? styles.sheetFullscreen : null,
                sheetFrameStyle,
                sheetGestureStyle,
              ]}
            >
              {hideHeader ? null : (
                <View {...panResponder.panHandlers} style={styles.sheetGestureZone}>
                  {fullscreenActive ? null : (
                    <View style={styles.sheetDragArea}>
                      <View style={styles.sheetGrabber} />
                    </View>
                  )}
                  <View style={styles.sheetHeader}>
                    <Text style={styles.sheetTitle} numberOfLines={1}>
                      {title}
                    </Text>
                    <CloseButton accessibilityLabel={`Close ${title}`} theme={theme} onPress={closeSheet} />
                  </View>
                </View>
              )}
              {body}
            </Animated.View>
          </View>
        </View>
      </CJMUXKeyboardShortcutSurface>
    </Modal>
  );
}

function createMarkdownStyles(theme: AppTheme, fontScale = 1) {
  const codeSurface = theme.colors.surfaceRaised;
  const blockquoteSurface = theme.colors.surfaceMuted;
  const definitions = {
    body: {
      minWidth: 0,
      ...theme.typography.body,
      color: theme.colors.text,
    },
    text: {
      ...theme.typography.body,
      color: theme.colors.text,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 10,
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "flex-start",
      width: "100%",
    },
    heading1: {
      ...theme.typography.title,
      color: theme.colors.text,
      marginTop: 2,
      marginBottom: 12,
    },
    heading2: {
      ...theme.typography.section,
      color: theme.colors.text,
      fontSize: 18,
      lineHeight: 24,
      marginTop: 10,
      marginBottom: 8,
    },
    heading3: {
      ...theme.typography.section,
      color: theme.colors.text,
      marginTop: 8,
      marginBottom: 6,
    },
    heading4: {
      ...theme.typography.section,
      color: theme.colors.text,
      marginTop: 6,
      marginBottom: 4,
    },
    heading5: {
      ...theme.typography.meta,
      color: theme.colors.text,
      marginTop: 6,
      marginBottom: 4,
    },
    heading6: {
      ...theme.typography.meta,
      color: theme.colors.textMuted,
      marginTop: 6,
      marginBottom: 4,
    },
    strong: {
      fontFamily: "Lato_700Bold",
      color: theme.colors.text,
    },
    em: {
      fontStyle: "italic",
      color: theme.colors.text,
    },
    link: {
      color: theme.colors.accent,
      textDecorationLine: "underline",
    },
    filePathLink: {
      color: theme.colors.accent,
      textDecorationLine: "underline",
    },
    blockquote: {
      width: "100%",
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.accent,
      backgroundColor: blockquoteSurface,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginVertical: 8,
      borderRadius: theme.radii.md,
    },
    bullet_list: {
      marginBottom: 8,
    },
    ordered_list: {
      marginBottom: 8,
    },
    list_item: {
      flexDirection: "row",
      justifyContent: "flex-start",
      marginBottom: 4,
    },
    bullet_list_icon: {
      marginLeft: 4,
      marginRight: 8,
      color: theme.colors.textMuted,
    },
    ordered_list_icon: {
      marginLeft: 4,
      marginRight: 8,
      color: theme.colors.textMuted,
    },
    bullet_list_content: {
      flex: 1,
      minWidth: 0,
    },
    ordered_list_content: {
      flex: 1,
      minWidth: 0,
    },
    code_inline: {
      ...theme.typography.mono,
      color: theme.colors.text,
      backgroundColor: codeSurface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.sm,
      paddingHorizontal: 4,
      paddingVertical: 1,
    },
    code_block: {
      ...theme.typography.mono,
      width: "100%",
      color: theme.colors.text,
      backgroundColor: codeSurface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      padding: 10,
      marginVertical: 8,
    },
    fence: {
      ...theme.typography.mono,
      width: "100%",
      color: theme.colors.text,
      backgroundColor: codeSurface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      padding: 10,
      marginVertical: 8,
    },
    hr: {
      width: "100%",
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: 12,
    },
    table: {
      width: "100%",
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      marginVertical: 8,
    },
    tr: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    th: {
      flex: 1,
      padding: 6,
      backgroundColor: blockquoteSurface,
    },
    td: {
      flex: 1,
      padding: 6,
    },
  } as const;
  return scaleTextMetrics(definitions, fontScale);
}

function createStyles(
  theme: AppTheme,
  layout: ResponsiveLayout = DEFAULT_LAYOUT,
  fontScale = 1,
  visionControls = false,
) {
  const target = VISION_TARGET_SIZE;
  const definitions = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
	  header: {
	    width: "100%",
	    maxWidth: layout.contentMaxWidth,
	    alignSelf: "center",
	    paddingHorizontal: layout.gutter,
	    paddingTop: 2,
	    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: visionControls ? "wrap" : "nowrap",
    rowGap: 12,
  },
  headerBrand: {
    flex: 1,
    minWidth: visionControls ? 180 : 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  headerMark: {
    width: 32,
    height: 32,
    flexShrink: 0,
    borderRadius: theme.radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
  },
  headerLogo: {
    width: 38,
    height: 38,
    flexShrink: 0,
    borderRadius: theme.radii.md,
  },
  headerTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
    fontSize: 24,
    lineHeight: 30,
  },
  headerMeta: {
    ...theme.typography.meta,
    color: theme.colors.textMuted,
    marginTop: 0,
    fontSize: 11,
    lineHeight: 14,
  },
  headerButtons: {
    flexDirection: "row",
    gap: visionControls ? 12 : 8,
    marginLeft: visionControls ? 0 : 12,
  },
  iconButton: {
    flexShrink: 0,
    width: visionControls ? target : 38,
    height: visionControls ? target : 38,
    borderRadius: visionControls ? 16 : theme.radii.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: visionControls ? theme.colors.surfaceRaised : "transparent",
  },
	  machineStripViewport: {
	    width: "100%",
	    maxWidth: layout.contentMaxWidth,
	    alignSelf: "center",
	    flexGrow: 0,
	    flexShrink: 0,
	    maxHeight: visionControls ? 92 : 50,
	  },
	  machineStrip: {
	    gap: visionControls ? 12 : 4,
	    paddingHorizontal: layout.gutter,
	    paddingVertical: visionControls ? 12 : 6,
    alignItems: "center",
    flexGrow: 0,
  },
	  chip: {
	    height: visionControls ? target : 32,
	    maxWidth: visionControls ? 300 : 220,
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: "center",
    paddingHorizontal: visionControls ? 20 : 10,
    borderRadius: theme.radii.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: visionControls ? theme.colors.surfaceRaised : "transparent",
    alignItems: "center",
    justifyContent: "center",
    minWidth: visionControls ? 96 : 0,
  },
  chipActive: {
    backgroundColor: visionControls ? theme.colors.accentSoft : theme.colors.surfaceRaised,
    borderColor: visionControls ? theme.colors.accent : theme.colors.border,
  },
  chipText: {
    ...theme.typography.meta,
    color: theme.colors.textMuted,
    flexShrink: 1,
    minWidth: 0,
    fontSize: visionControls ? 18 : theme.typography.meta.fontSize,
    lineHeight: visionControls ? 24 : theme.typography.meta.lineHeight,
  },
	  chipTextActive: {
	    color: theme.colors.text,
	    fontFamily: "Lato_700Bold",
	  },
	  machineChipContent: {
	    flexDirection: "row",
	    alignItems: "center",
	    gap: visionControls ? 12 : 6,
	    maxWidth: visionControls ? 260 : 196,
	    minWidth: 0,
	  },
	  machineChipWorkingDot: {
	    width: 7,
	    height: 7,
	    borderRadius: theme.radii.full,
	    backgroundColor: theme.colors.warning,
	    flexShrink: 0,
	  },
	  chipUnreadBadge: {
	    minWidth: 18,
	    height: 18,
	    paddingHorizontal: 5,
	    borderRadius: theme.radii.full,
	    backgroundColor: theme.colors.danger,
	    alignItems: "center",
	    justifyContent: "center",
	    flexShrink: 0,
	  },
	  chipUnreadText: {
	    fontFamily: "Lato_700Bold",
	    fontSize: 10,
	    lineHeight: 12,
	    color: theme.colors.surfaceRaised,
	  },
  primaryButton: {
    width: "100%",
    minWidth: 0,
    minHeight: visionControls ? target : 42,
    paddingHorizontal: 14,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.accent,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    ...theme.typography.section,
    color: theme.colors.surfaceRaised,
  },
  disabledButton: {
    opacity: 0.55,
  },
  updateBannerWrap: {
    width: "100%",
    maxWidth: layout.contentMaxWidth,
    alignSelf: "center",
    paddingHorizontal: layout.gutter,
    paddingBottom: 8,
  },
  updateBanner: {
    width: "100%",
    minWidth: 0,
    minHeight: 54,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  updateBannerIcon: {
    width: 28,
    height: 28,
    borderRadius: theme.radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
  },
  updateBannerTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  updateBannerTitle: {
    minWidth: 0,
    ...theme.typography.section,
    color: theme.colors.text,
  },
  updateBannerMessage: {
    minWidth: 0,
    ...theme.typography.meta,
    color: theme.colors.textMuted,
  },
  updateBannerAction: {
    minHeight: visionControls ? target : 34,
    paddingHorizontal: 10,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  updateBannerActionText: {
    ...theme.typography.meta,
    fontFamily: "Lato_700Bold",
  },
  updateBannerClose: {
    width: visionControls ? target : 32,
    height: visionControls ? target : 32,
    borderRadius: visionControls ? 16 : theme.radii.lg,
    alignItems: "center",
    justifyContent: "center",
  },
	  errorBox: {
	    width: "100%",
	    maxWidth: layout.contentMaxWidth - layout.gutter * 2,
	    alignSelf: "center",
	    marginVertical: 8,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.danger,
    padding: 12,
    backgroundColor: theme.colors.surface,
  },
  errorText: {
    minWidth: 0,
    ...theme.typography.meta,
    color: theme.colors.danger,
    marginTop: 8,
  },
	  listViewport: {
	    flex: 1,
	    width: "100%",
	    alignSelf: "stretch",
	  },
	  listContent: {
	    width: "100%",
	    maxWidth: layout.contentMaxWidth,
	    alignSelf: "center",
	    paddingHorizontal: layout.gutter,
	    paddingTop: 6,
	    gap: 18,
	  },
	  sessionGroup: {
	    width: "100%",
	    minWidth: 0,
	    gap: 7,
	  },
	  sessionGroupHeader: {
	    minWidth: 0,
	    minHeight: 26,
	    flexDirection: "row",
	    alignItems: "center",
	    justifyContent: "space-between",
	    gap: 8,
	    paddingHorizontal: 4,
	  },
	  sessionGroupTitleBlock: {
	    flex: 1,
	    minWidth: 0,
	    flexDirection: "row",
	    alignItems: "baseline",
	    gap: 8,
	  },
	  sessionGroupTitle: {
	    ...theme.typography.meta,
	    color: theme.colors.textMuted,
	    fontFamily: theme.typography.title.fontFamily,
	    fontSize: 16,
	    lineHeight: 21,
	    letterSpacing: 0,
	    flexShrink: 1,
	  },
	  sessionGroupSubtitle: {
	    ...theme.typography.meta,
	    color: theme.colors.textMuted,
	    flexShrink: 1,
	    fontSize: 11,
	  },
	  sessionGroupCount: {
	    ...theme.typography.meta,
	    color: theme.colors.textMuted,
	    flexShrink: 0,
	    fontSize: 11,
	  },
	  sessionCardGrid: {
	    width: "100%",
	    minWidth: 0,
	    backgroundColor: theme.colors.surface,
	    borderRadius: theme.radii.lg,
	    borderWidth: 1,
	    borderColor: theme.colors.border,
	    overflow: "hidden",
	  },
	  cardGridItem: {
	    width: "100%",
	    minWidth: 0,
	  },
	  sessionCardDivider: {
	    height: 0,
	    marginHorizontal: 14,
	    marginVertical: 4,
	    borderTopWidth: 1,
	    borderStyle: "dashed",
	    borderColor: theme.colors.border,
	    opacity: 0.72,
	  },
  emptyList: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    ...theme.typography.section,
    color: theme.colors.text,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
	  card: {
	    position: "relative",
	    minWidth: 0,
	    backgroundColor: "transparent",
	  },
	  cardCollapsed: {
	    borderRadius: theme.radii.lg,
	    paddingHorizontal: 8,
	    paddingVertical: 0,
	    gap: 0,
	  },
	  cardMuted: {
	    opacity: theme.dark ? 0.86 : 0.62,
	  },
	  cardRunning: {
	    borderColor: theme.colors.orange,
	  },
	  cardSelected: {
	    backgroundColor: theme.colors.surfaceRaised,
	    borderLeftWidth: 2,
	    borderLeftColor: theme.colors.textMuted,
	  },
	  sessionRowTop: {
	    minWidth: 0,
	    flexDirection: "row",
	    alignItems: "stretch",
	  },
	  sessionRowMain: {
	    flex: 1,
	    minWidth: 0,
	    minHeight: 78,
	    paddingLeft: 12,
	    paddingVertical: 10,
	    flexDirection: "row",
	    alignItems: "center",
	    gap: 8,
	  },
	  sessionIndicatorColumn: {
	    width: 12,
	    flexShrink: 0,
	    alignItems: "center",
	    alignSelf: "stretch",
	    paddingTop: 8,
	  },
	  sessionAgentGlyph: {
	    width: 26,
	    height: 26,
	    flexShrink: 0,
	    borderRadius: 6,
	    alignItems: "center",
	    justifyContent: "center",
	    backgroundColor: theme.colors.surfaceRaised,
	  },
	  sessionAgentIcon: {
	    width: 16,
	    height: 16,
	  },
	  sessionPreview: {
	    ...theme.typography.meta,
	    color: theme.colors.textMuted,
	    marginTop: 2,
	  },
	  sessionMetaRow: {
	    minWidth: 0,
	    flexDirection: "row",
	    alignItems: "center",
	    gap: 4,
	    marginTop: 3,
	  },
	  sessionStatusText: {
	    ...theme.typography.meta,
	    color: theme.colors.text,
	    fontSize: 10,
	    lineHeight: 13,
	    textTransform: "capitalize",
	  },
	  sessionMetaText: {
	    ...theme.typography.meta,
	    color: theme.colors.textMuted,
	    flex: 1,
	    minWidth: 0,
	    fontSize: 10,
	    lineHeight: 13,
	  },
	  sessionRowTrailing: {
	    width: 54,
	    flexShrink: 0,
	    alignSelf: "stretch",
	    alignItems: "flex-end",
	    justifyContent: "space-between",
	    paddingVertical: 3,
	    flexDirection: "row",
	  },
	  sessionRowControls: {
	    minWidth: 38,
	    flexShrink: 0,
	    flexDirection: "row",
	    alignItems: "center",
	    justifyContent: "flex-end",
	    paddingVertical: 4,
	  },
	  sessionRowIconButton: {
	    width: visionControls ? target : 34,
	    height: visionControls ? target : 34,
	    borderRadius: visionControls ? 16 : theme.radii.md,
	    alignItems: "center",
	    justifyContent: "center",
	  },
	  runningEdge: {
	    ...StyleSheet.absoluteFill,
	    borderRadius: theme.radii.xl,
	    overflow: "hidden",
	    zIndex: 1,
	  },
	  runningEdgeSegment: {
	    position: "absolute",
	    backgroundColor: theme.colors.accent,
	    opacity: 0.86,
	  },
	  runningEdgeHorizontal: {
	    left: 0,
	    height: 2,
	  },
	  runningEdgeVertical: {
	    top: 0,
	    width: 2,
	  },
	  starButton: {
	    position: "absolute",
	    left: layout.cardPadding,
	    top: layout.cardPadding,
    zIndex: 2,
    width: 38,
    height: 38,
    borderRadius: theme.radii.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  starButtonActive: {
    backgroundColor: theme.colors.warningSoft,
    borderColor: theme.colors.warning,
  },
	starButtonCollapsed: {
	  left: 8,
	  top: 4,
	},
  cardSummary: {
    minWidth: 0,
    minHeight: 44,
    justifyContent: "center",
  },
	cardSummaryCollapsed: {
	  minHeight: 46,
	},
  cardSummaryPressed: {
    opacity: 0.68,
  },
  cardHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    minHeight: 38,
    paddingLeft: 48,
    paddingRight: 2,
  },
	cardHeaderCollapsed: {
	  minHeight: 46,
	  gap: 8,
	  paddingLeft: 46,
	  paddingRight: 0,
	},
  agentAvatar: {
    width: 38,
    height: 38,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
	agentAvatarCollapsed: {
	  width: 30,
	  height: 30,
	  borderRadius: theme.radii.md,
	},
  agentIcon: {
    width: 22,
    height: 22,
  },
	agentIconCollapsed: {
	  width: 18,
	  height: 18,
	},
  cardTitleBlock: {
    flex: 1,
    minWidth: 0,
    paddingTop: 1,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  cardWindowTitle: {
    ...theme.typography.section,
    color: theme.colors.text,
    flexShrink: 1,
    flexBasis: "34%",
    maxWidth: "34%",
    minWidth: 54,
  },
  cardAgentSessionTitle: {
    ...theme.typography.section,
    color: theme.colors.textMuted,
    flex: 1,
    minWidth: 0,
  },
	  sessionContextRow: {
	    minWidth: 0,
	    flexDirection: "row",
	    alignItems: "baseline",
	    gap: 8,
	    marginTop: 4,
	  },
	  sessionDirectory: {
	    ...theme.typography.meta,
	    color: theme.colors.textMuted,
	    flex: 1,
	    minWidth: 0,
	  },
	  sessionPill: {
	    ...theme.typography.meta,
	    color: theme.colors.textMuted,
	    maxWidth: layout.sessionPillMaxWidth,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  cardMeta: {
    ...theme.typography.meta,
    color: theme.colors.textMuted,
    flex: 1,
    minWidth: 0,
  },
  cardMetaRow: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginTop: 2,
  },
  cardModelMeta: {
    ...theme.typography.meta,
    color: theme.colors.textMuted,
    fontSize: 10,
    lineHeight: 12,
    marginTop: 1,
  },
	collapsedMetaRow: {
	  minWidth: 0,
	  flexDirection: "row",
	  alignItems: "center",
	  gap: 4,
	  marginTop: 1,
	},
	collapsedMetaText: {
	  ...theme.typography.meta,
	  color: theme.colors.textMuted,
	  flexShrink: 1,
	},
  cardActivityTime: {
    ...theme.typography.meta,
    color: theme.colors.textMuted,
    flexShrink: 0,
    fontSize: 10,
    lineHeight: 13,
    fontVariant: ["tabular-nums"],
  },
  cardActivityTimeRecent: {
    color: theme.colors.accent,
    fontFamily: "Lato_700Bold",
  },
  cardBody: {
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: theme.colors.surfaceRaised,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusRunning: {
    backgroundColor: theme.colors.warning,
  },
  statusWaiting: {
    backgroundColor: theme.colors.danger,
  },
  statusIdle: {
    backgroundColor: theme.colors.success,
  },
  statusUnknown: {
    backgroundColor: theme.colors.textMuted,
  },
  statusText: {
    ...theme.typography.meta,
    color: theme.colors.textMuted,
  },
  statusDivider: {
    ...theme.typography.meta,
    color: theme.colors.border,
  },
  cwdText: {
    ...theme.typography.meta,
    color: theme.colors.textMuted,
    flex: 1,
    minWidth: 0,
  },
  cardSectionHeader: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 3,
    flexWrap: "wrap",
    rowGap: 12,
  },
  cardSectionHeadingText: {
    minWidth: 0,
    flex: 1,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 7,
  },
  cardSectionActions: {
    flexShrink: visionControls ? 1 : 0,
    flexDirection: "row",
    alignItems: "center",
    gap: visionControls ? 12 : 5,
    flexWrap: "wrap",
  },
  cardSectionLabel: {
    ...theme.typography.meta,
    color: theme.colors.textMuted,
    fontFamily: "Lato_700Bold",
    textTransform: "uppercase",
  },
  cardSectionTime: {
    ...theme.typography.meta,
    color: theme.colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  promptText: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  responseBlock: {
    paddingTop: 2,
    gap: 8,
  },
	  answerText: {
	    ...theme.typography.body,
	    color: theme.colors.textMuted,
	  },
	  inlineFileLink: {
	    color: theme.colors.accent,
	    textDecorationLine: "underline",
	  },
  sectionActionButton: {
    width: visionControls ? target : 24,
    height: visionControls ? target : 24,
    borderRadius: visionControls ? 16 : theme.radii.md,
    backgroundColor: visionControls ? theme.colors.surfaceRaised : "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButton: {
    width: visionControls ? target : 32,
    height: visionControls ? target : 32,
    borderRadius: visionControls ? 16 : theme.radii.md,
    backgroundColor: visionControls ? theme.colors.surfaceRaised : "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonPressed: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  actionButtonActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
	  sessionListFab: {
	    position: "absolute",
	    right: Math.max(layout.gutter, (layout.width - layout.contentMaxWidth) / 2 + layout.gutter),
	    width: visionControls ? target : 52,
	    height: visionControls ? target : 52,
	    borderRadius: visionControls ? 16 : 26,
	    alignItems: "center",
	    justifyContent: "center",
	    backgroundColor: theme.colors.accent,
	    shadowColor: "#000000",
	    shadowOpacity: 0.24,
	    shadowRadius: 14,
	    shadowOffset: { width: 0, height: 7 },
	    elevation: 8,
	  },
	  sessionListFabPressed: {
	    opacity: 0.72,
	    transform: [{ scale: 0.96 }],
	  },
  menuLayer: {
    flex: 1,
    alignItems: "flex-end",
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.08)",
  },
	  menuPanel: {
	    width: visionControls ? Math.min(layout.width - layout.gutter * 2, 360) : layout.menuWidth,
	    marginRight: layout.gutter,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    paddingVertical: visionControls ? 12 : 6,
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  menuAction: {
    minHeight: visionControls ? target : 44,
    paddingHorizontal: 12,
    flexDirection: "row",
    gap: visionControls ? 16 : 10,
    alignItems: "center",
  },
  menuActionIcon: {
    width: 28,
    height: 28,
    borderRadius: theme.radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
  },
  menuActionText: {
    ...theme.typography.section,
    color: theme.colors.text,
  },
  menuActionTextDanger: {
    color: theme.colors.danger,
  },
  menuDivider: {
    height: 1,
    marginVertical: 4,
    backgroundColor: theme.colors.border,
  },
  cardSearchHint: {
    ...theme.typography.meta,
    color: theme.colors.textMuted,
  },
  cardSearchList: {
    flex: 1,
    minHeight: 0,
    width: "100%",
  },
  cardSearchListContent: {
    gap: visionControls ? 12 : 8,
    paddingBottom: 12,
  },
  cardSearchResult: {
    minHeight: visionControls ? 80 : 58,
    width: "100%",
    minWidth: 0,
    paddingHorizontal: visionControls ? 20 : 12,
    paddingVertical: visionControls ? 16 : 9,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    justifyContent: "center",
    gap: 3,
  },
  cardSearchResultActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  cardSearchResultHeading: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  cardSearchResultTitle: {
    ...theme.typography.section,
    color: theme.colors.text,
    flex: 1,
    minWidth: 0,
  },
  cardSearchResultAge: {
    ...theme.typography.meta,
    color: theme.colors.textMuted,
    flexShrink: 0,
  },
  cardSearchResultMeta: {
    ...theme.typography.meta,
    color: theme.colors.textMuted,
  },
  cardSearchEmpty: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: "center",
    paddingVertical: 28,
  },
  settingsSection: {
    width: "100%",
    minWidth: 0,
    gap: 10,
  },
  settingsSectionHeader: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  settingsSectionTitle: {
    ...theme.typography.section,
    color: theme.colors.text,
  },
  settingsSectionDescription: {
    minWidth: 0,
    ...theme.typography.meta,
    color: theme.colors.textMuted,
  },
  fontScaleRow: {
    width: "100%",
    minWidth: 0,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },
  fontScaleButton: {
    width: 64,
    minHeight: visionControls ? target : 56,
    flexShrink: 0,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  fontScaleValue: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  fontScaleValueTitle: {
    ...theme.typography.section,
    color: theme.colors.accent,
    textAlign: "center",
  },
  fontScaleValueMeta: {
    ...theme.typography.meta,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
  visionPreferenceRow: {
    width: "100%",
    minWidth: 0,
    flexDirection: "row",
    gap: 10,
  },
  visionPreferenceButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 60,
    paddingHorizontal: 12,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  visionPreferenceButtonActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  visionPreferenceButtonText: {
    ...theme.typography.section,
    color: theme.colors.text,
  },
  visionPreferenceButtonTextActive: {
    color: theme.colors.accent,
  },
  updateStatusCard: {
    width: "100%",
    minWidth: 0,
    minHeight: 64,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  updateStatusIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
  },
  updateStatusTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  updateStatusTitle: {
    minWidth: 0,
    ...theme.typography.section,
    color: theme.colors.text,
  },
  updateStatusMeta: {
    minWidth: 0,
    ...theme.typography.meta,
    color: theme.colors.textMuted,
  },
  settingsButtonRow: {
    width: "100%",
    minWidth: 0,
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  settingsPrimaryButton: {
    flex: 1,
    minWidth: 0,
    minHeight: visionControls ? target : 42,
    paddingHorizontal: 14,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.accent,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsSecondaryButton: {
    flex: 1,
    minWidth: 0,
    minHeight: visionControls ? target : 42,
    paddingHorizontal: 14,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    ...theme.typography.section,
    color: theme.colors.text,
  },
  settingsInfoRow: {
    width: "100%",
    minWidth: 0,
    minHeight: 34,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  settingsInfoLabel: {
    width: 112,
    flexShrink: 0,
    ...theme.typography.meta,
    color: theme.colors.textMuted,
  },
  settingsInfoValue: {
    flex: 1,
    minWidth: 0,
    textAlign: "right",
    ...theme.typography.meta,
    color: theme.colors.text,
  },
	  loginScreen: {
	    flex: 1,
	    backgroundColor: theme.colors.background,
	    justifyContent: "center",
	    alignItems: "center",
	    paddingHorizontal: layout.gutter,
	  },
	  loginPanel: {
	    width: "100%",
	    maxWidth: 440,
	    borderRadius: theme.radii.xl,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18,
    gap: 14,
  },
  loginLogo: {
    width: 64,
    height: 64,
    flexShrink: 0,
    borderRadius: theme.radii.lg,
  },
  loginTitle: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  loginText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  loginButton: {
    width: "100%",
  },
  visionModeActions: {
    width: "100%",
    minWidth: 0,
    gap: 12,
  },
  visionModeChoiceButton: {
    width: "100%",
    minWidth: 0,
    minHeight: 76,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  visionModeChoiceButtonPrimary: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent,
  },
  visionModeChoiceTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  visionModeChoiceText: {
    ...theme.typography.section,
    fontSize: 18,
    color: theme.colors.text,
  },
  visionModeChoiceMeta: {
    ...theme.typography.meta,
    color: theme.colors.textMuted,
  },
  visionModeChoicePrimaryText: {
    ...theme.typography.section,
    fontSize: 18,
    color: theme.colors.surfaceRaised,
  },
  visionModeChoicePrimaryMeta: {
    ...theme.typography.meta,
    color: theme.colors.surfaceRaised,
  },
  challengeBox: {
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 12,
  },
  challengeLabel: {
    ...theme.typography.meta,
    color: theme.colors.textMuted,
  },
  challengeCode: {
    ...theme.typography.title,
    color: theme.colors.text,
    marginTop: 2,
  },
  inputGroup: {
    width: "100%",
    minWidth: 0,
    gap: 6,
  },
  inputLabel: {
    minWidth: 0,
    ...theme.typography.meta,
    color: theme.colors.textMuted,
  },
  textInput: {
    width: "100%",
    minWidth: 0,
    minHeight: 42,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    color: theme.colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...theme.typography.body,
  },
  sshLoading: {
    flex: 1,
    minHeight: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  sshMutedText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  sshSetupScroll: {
    flex: 1,
    minHeight: 0,
    width: "100%",
  },
  sshSetupContent: {
    width: "100%",
    maxWidth: 620,
    alignSelf: "center",
    gap: 14,
    paddingBottom: 24,
  },
  sshSetupIntro: {
    gap: 5,
  },
  sshSetupTitle: {
    ...theme.typography.section,
    fontSize: 18,
    lineHeight: 24,
    color: theme.colors.text,
  },
  sshSetupRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  sshSetupRowNarrow: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  sshSetupGrow: {
    flex: 1,
  },
  sshPortGroup: {
    width: layout.isWide ? 116 : "100%",
    minWidth: 0,
    gap: 6,
  },
  sshSetupActions: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    marginTop: 2,
  },
  sshPrivateKeyInput: {
    minHeight: 116,
    textAlignVertical: "top",
    fontFamily: "JetBrainsMono_400Regular",
    fontSize: 12,
    lineHeight: 18,
  },
  sshConnectButton: {
    width: "auto",
    minWidth: 160,
    flexGrow: 1,
  },
  sshSecondaryButton: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  sshSecondaryButtonText: {
    ...theme.typography.section,
    color: theme.colors.text,
  },
  sshWorkspace: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    gap: 12,
  },
  sshWorkspaceWide: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  sshRail: {
    width: "100%",
    flexShrink: 0,
    gap: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sshRailWide: {
    width: 248,
    paddingBottom: 0,
    paddingRight: 12,
    borderBottomWidth: 0,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },
  sshRailHeading: {
    width: "100%",
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  sshMachineIcon: {
    width: 34,
    height: 34,
    flexShrink: 0,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  sshRailTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  sshRailTitle: {
    ...theme.typography.section,
    color: theme.colors.text,
  },
  sshRailEndpoint: {
    ...theme.typography.meta,
    color: theme.colors.textMuted,
    fontFamily: "JetBrainsMono_400Regular",
  },
  sshStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  sshStatusDot: {
    width: 8,
    height: 8,
    borderRadius: theme.radii.full,
  },
  sshStatusConnected: {
    backgroundColor: theme.colors.success,
  },
  sshStatusFailed: {
    backgroundColor: theme.colors.danger,
  },
  sshStatusPending: {
    backgroundColor: theme.colors.warning,
  },
  sshStatusLabel: {
    ...theme.typography.meta,
    color: theme.colors.text,
    fontFamily: "Lato_700Bold",
    textTransform: "capitalize",
  },
  sshConnectionMessage: {
    ...theme.typography.meta,
    color: theme.colors.textMuted,
  },
  sshRailActions: {
    flexDirection: layout.isWide ? "column" : "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: layout.isWide ? 4 : 0,
  },
  sshRailButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: layout.isWide ? "flex-start" : "center",
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
  },
  sshRailButtonDanger: {
    borderColor: theme.colors.danger,
  },
  sshRailButtonText: {
    ...theme.typography.meta,
    color: theme.colors.text,
    fontFamily: "Lato_700Bold",
  },
  sshRailButtonTextDanger: {
    color: theme.colors.danger,
  },
  sshTerminalFrame: {
    flex: 1,
    minWidth: 0,
    minHeight: 180,
    overflow: "hidden",
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  sshTerminal: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  visionVoiceField: {
    width: "100%",
    minWidth: 0,
    gap: 10,
  },
  visionVoiceValue: {
    width: "100%",
    minWidth: 0,
    minHeight: 64,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: "center",
  },
  visionVoiceValueText: {
    minWidth: 0,
    ...theme.typography.body,
    fontSize: 17,
    lineHeight: 24,
    color: theme.colors.text,
  },
  visionVoiceValuePlaceholder: {
    color: theme.colors.textMuted,
  },
  visionVoiceActionRow: {
    width: "100%",
    minWidth: 0,
    flexDirection: "column",
    alignItems: "stretch",
    gap: 12,
  },
  visionVoiceButton: {
    flex: 0,
    minWidth: 0,
    minHeight: 80,
    paddingHorizontal: 12,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
  },
  visionVoiceButtonActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  visionVoiceButtonText: {
    ...theme.typography.section,
    color: theme.colors.text,
  },
  visionVoiceButtonTextActive: {
    color: theme.colors.accent,
  },
  visionVoiceClearButton: {
    flexDirection: "row",
    gap: 10,
    width: 132,
    height: target,
    flexShrink: 0,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
  },
  paneComposer: {
    width: "100%",
    minWidth: 0,
    gap: visionControls ? 12 : 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  paneComposerSingleShell: {
    gap: visionControls ? 12 : 10,
  },
  visionPaneComposer: {
    width: "100%",
    minWidth: 0,
    gap: 8,
  },
  visionDraftPreview: {
    width: "100%",
    minWidth: 0,
    minHeight: 56,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
  },
  visionDraftPreviewText: {
    minWidth: 0,
    ...theme.typography.body,
    fontSize: 17,
    lineHeight: 24,
    color: theme.colors.text,
  },
  visionComposerPrimaryRow: {
    width: "100%",
    minWidth: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  visionComposerSquareButton: {
    width: 52,
    height: 52,
    flexShrink: 0,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  visionComposerVoiceButton: {
    flexGrow: 1,
    flexBasis: 130,
    minWidth: 112,
    minHeight: 52,
    paddingHorizontal: 12,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  visionComposerSendButton: {
    minWidth: 96,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  visionComposerButtonText: {
    ...theme.typography.section,
    fontSize: 16,
    color: theme.colors.text,
  },
  visionComposerSendText: {
    ...theme.typography.section,
    fontSize: 16,
    color: theme.colors.surfaceRaised,
  },
  visionComposerMoreButton: {
    minWidth: 76,
    minHeight: 52,
    paddingHorizontal: 10,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  visionComposerMoreButtonText: {
    ...theme.typography.meta,
    fontFamily: "Lato_700Bold",
    color: theme.colors.text,
  },
  visionMorePanel: {
    width: "100%",
    minWidth: 0,
    gap: 8,
  },
  visionMoreActionRow: {
    width: "100%",
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  visionQuickKeyGrid: {
    width: "100%",
    minWidth: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  visionQuickKeyButton: {
    flexGrow: 1,
    flexBasis: "22%",
    minWidth: 72,
    minHeight: 50,
    paddingHorizontal: 10,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  visionQuickKeyText: {
    ...theme.typography.section,
    fontSize: 16,
    color: theme.colors.text,
  },
  visionFollowButton: {
    flexGrow: 1,
    minWidth: 120,
    minHeight: 52,
    paddingHorizontal: 12,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  visionFollowButtonText: {
    ...theme.typography.section,
    fontSize: 16,
    color: theme.colors.text,
  },
  visionRetryButton: {
    minHeight: 48,
    paddingHorizontal: 14,
  },
  visionSubmitButton: {
    minHeight: 54,
  },
  paneComposerCompactRow: {
    width: "100%",
    minWidth: 0,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  paneComposerToolRow: {
    width: "100%",
    minWidth: 0,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  paneComposerInputShell: {
    width: "100%",
    minWidth: 0,
    minHeight: 150,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    overflow: "hidden",
  },
  paneComposerInputShellSingle: {
    minHeight: 108,
  },
  paneComposerInputShellSingleCollapsed: {
    minHeight: visionControls ? 160 : 112,
  },
  paneComposerInput: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    color: theme.colors.text,
    paddingHorizontal: 12,
    ...theme.typography.mono,
  },
  paneComposerInputEmbedded: {
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: "transparent",
    paddingBottom: 12,
  },
  paneComposerInputCompact: {
    height: 44,
  },
  paneComposerInputExpanded: {
    width: "100%",
    minHeight: 132,
    paddingVertical: 10,
    textAlignVertical: "top",
  },
  paneComposerInputSingleShell: {
    minHeight: 108,
    paddingTop: 12,
    paddingBottom: 12,
  },
  paneComposerInputSingleShellCollapsed: {
    minHeight: visionControls ? 72 : 56,
    paddingTop: 10,
    paddingRight: 12,
    paddingBottom: 10,
  },
  paneComposerIconButton: {
    width: visionControls ? target : 44,
    height: visionControls ? target : 44,
    borderRadius: visionControls ? 16 : theme.radii.full,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  paneComposerIconButtonActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  paneComposerToolButton: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surfaceRaised,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  paneComposerToolButtonActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  paneComposerInlineActions: {
    position: "relative",
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: visionControls ? 12 : 8,
    padding: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  paneComposerInlineActionsSingle: {
    right: 0,
    bottom: 0,
    gap: visionControls ? 12 : 8,
  },
  paneComposerEmbeddedStatus: {
    position: "relative",
    left: 0,
    right: 0,
    bottom: 0,
    ...theme.typography.meta,
    color: theme.colors.textMuted,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  paneComposerInlineButton: {
    width: visionControls ? target : 44,
    height: visionControls ? target : 44,
    borderRadius: visionControls ? 16 : theme.radii.full,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  streamingDictationButton: {
    width: "100%",
    flexDirection: "row",
    gap: 12,
    minHeight: visionControls ? 80 : 64,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  streamingDictationRecording: {
    backgroundColor: "#b3261e",
  },
  streamingDictationLabel: {
    fontSize: visionControls ? 22 : 18,
    fontWeight: "700",
  },
  paneComposerInlineButtonActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  paneComposerToolButtonText: {
    ...theme.typography.meta,
    color: theme.colors.text,
  },
  paneComposerToolButtonTextActive: {
    color: theme.colors.accent,
  },
  paneComposerStatus: {
    flex: 0,
    minWidth: 0,
    ...theme.typography.meta,
    color: theme.colors.textMuted,
  },
  paneComposerSendButton: {
    width: visionControls ? 112 : 44,
    height: visionControls ? target : 44,
    borderRadius: visionControls ? 16 : theme.radii.full,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    marginLeft: "auto",
  },
  paneComposerInlineSendButton: {
    width: visionControls ? 112 : 44,
    height: visionControls ? target : 44,
    borderRadius: visionControls ? 16 : theme.radii.full,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    marginLeft: "auto",
  },
  paneComposerSubmitButton: {
    width: "100%",
    minWidth: 0,
    minHeight: visionControls ? target : 44,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  paneComposerSubmitText: {
    ...theme.typography.section,
    color: theme.colors.surfaceRaised,
  },
  shortcutRow: {
    width: "100%",
    minWidth: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: visionControls ? 12 : 8,
  },
  snippetBar: {
    width: "100%",
    minWidth: 0,
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  snippetBarEmbedded: {
    position: "relative",
    width: "100%",
    top: 0,
    right: 0,
    left: 0,
    zIndex: 1,
    minHeight: 34,
    gap: visionControls ? 12 : 8,
    padding: 8,
  },
  snippetScroll: {
    flex: 1,
    minWidth: 0,
  },
  snippetScrollContent: {
    gap: 8,
    alignItems: "center",
    paddingRight: 2,
  },
  shortcutChip: {
    minHeight: visionControls ? target : 34,
    maxWidth: 180,
    paddingHorizontal: 12,
    borderRadius: theme.radii.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    justifyContent: "center",
  },
  shortcutText: {
    ...theme.typography.meta,
    color: theme.colors.text,
    fontSize: visionControls ? 18 : theme.typography.meta.fontSize,
    lineHeight: visionControls ? 24 : theme.typography.meta.lineHeight,
  },
  snippetIconButton: {
    width: visionControls ? target : 34,
    height: visionControls ? target : 34,
    borderRadius: visionControls ? 16 : theme.radii.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  snippetEditRow: {
    width: "100%",
    minWidth: 0,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: visionControls ? 12 : 8,
    flexWrap: visionControls ? "wrap" : "nowrap",
  },
  snippetRowInput: {
    flex: 1,
    minWidth: 0,
    height: 42,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    color: theme.colors.text,
    paddingHorizontal: 10,
    ...theme.typography.body,
  },
  snippetRowIconButton: {
    width: visionControls ? target : 38,
    height: visionControls ? target : 38,
    borderRadius: visionControls ? 16 : theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  snippetAddRow: {
    width: "100%",
    minWidth: 0,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: visionControls ? 12 : 8,
    flexWrap: visionControls ? "wrap" : "nowrap",
  },
  snippetAddInput: {
    flex: 1,
    minWidth: 0,
    height: 42,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    color: theme.colors.text,
    paddingHorizontal: 10,
    ...theme.typography.body,
  },
  snippetSheetActions: {
    width: "100%",
    minWidth: 0,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  uploadChoiceButton: {
    width: "100%",
    minHeight: visionControls ? target : 62,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  uploadChoiceIcon: {
    width: 38,
    height: 38,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadChoiceTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  uploadChoiceTitle: {
    ...theme.typography.section,
    color: theme.colors.text,
  },
  uploadChoiceSubtitle: {
    ...theme.typography.meta,
    color: theme.colors.textMuted,
  },
  voiceWaveform: {
    height: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  voiceWaveformProminent: {
    height: 24,
    gap: 3,
  },
  voiceWaveformBar: {
    width: 3,
    height: 14,
    borderRadius: theme.radii.full,
  },
  voiceWaveformBarProminent: {
    width: 4,
    height: 21,
  },
  retryRow: {
    width: "100%",
    minWidth: 0,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.danger,
    backgroundColor: theme.colors.dangerSoft,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  retryErrorText: {
    flex: 1,
    minWidth: 0,
    ...theme.typography.meta,
    color: theme.colors.danger,
  },
  retryButton: {
    minHeight: visionControls ? target : 34,
    flexShrink: 0,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.danger,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  retryButtonText: {
    ...theme.typography.meta,
    fontFamily: "Lato_700Bold",
    color: theme.colors.surfaceRaised,
  },
  keyGrid: {
    width: "100%",
    minWidth: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: visionControls ? 12 : 8,
  },
  keyButton: {
    minWidth: visionControls ? target : 46,
    height: visionControls ? target : 36,
    paddingHorizontal: 10,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  visionKeyButton: {
    minWidth: 64,
    height: 52,
    paddingHorizontal: 12,
  },
  keyButtonDanger: {
    borderColor: theme.colors.danger,
  },
  keyButtonText: {
    ...theme.typography.meta,
    color: theme.colors.text,
    fontSize: visionControls ? 18 : theme.typography.meta.fontSize,
    lineHeight: visionControls ? 24 : theme.typography.meta.lineHeight,
  },
  visionKeyButtonText: {
    ...theme.typography.section,
    fontSize: 16,
  },
  keyButtonTextDanger: {
    color: theme.colors.danger,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.36)",
  },
  modalBackdropTouch: {
    ...StyleSheet.absoluteFill,
  },
  modalRoot: {
    flex: 1,
  },
	  modalKeyboard: {
	    flex: 1,
	    width: "100%",
	    paddingHorizontal: layout.isWide ? layout.gutter : 0,
	    justifyContent: "flex-end",
	  },
  modalKeyboardFullscreen: {
    paddingHorizontal: 0,
  },
	  sheet: {
	    width: "100%",
	    minWidth: 0,
	    maxWidth: layout.sheetMaxWidth,
    alignSelf: "center",
    maxHeight: "82%",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
  },
  sheetWide: {
    maxWidth: layout.contentMaxWidth,
  },
  sheetFullscreen: {
    maxWidth: "100%",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  sheetTall: {
    height: "92%",
    maxHeight: "94%",
  },
  sheetGestureZone: {
    width: "100%",
    minWidth: 0,
  },
  sheetDragArea: {
    width: "100%",
    minWidth: 0,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -6,
    marginBottom: 2,
  },
  sheetGrabber: {
    width: 42,
    height: 4,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.border,
  },
  sheetHeader: {
    width: "100%",
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: visionControls ? 80 : 44,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  sheetTitle: {
    flex: 1,
    minWidth: 0,
    ...theme.typography.section,
    color: theme.colors.text,
    fontSize: 17,
    lineHeight: 22,
  },
  sheetMeta: {
    width: "100%",
    minWidth: 0,
    flexShrink: 1,
    ...theme.typography.meta,
    color: theme.colors.textMuted,
  },
  sheetBody: {
    width: "100%",
    minWidth: 0,
    flexShrink: 1,
    marginTop: 10,
  },
  sheetBodyHeaderless: {
    marginTop: 0,
  },
  sheetBodyTall: {
    flex: 1,
    minHeight: 0,
  },
  sheetContent: {
    width: "100%",
    minWidth: 0,
    gap: 12,
    paddingBottom: 4,
  },
  sheetContentKeyboard: {
    paddingBottom: 28,
  },
  sheetContentTall: {
    flexGrow: 1,
    minHeight: 0,
  },
  responseSheetMetaRow: {
    width: "100%",
    minWidth: 0,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  responseHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  responseFullBox: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    padding: 12,
  },
	  responseFullText: {
	    minWidth: 0,
	    ...theme.typography.body,
	    color: theme.colors.text,
	  },
	  filePathMeta: {
	    minWidth: 0,
	    ...theme.typography.mono,
	    color: theme.colors.textMuted,
	  },
	  fileImageFrame: {
	    flex: 1,
	    minHeight: 0,
	    minWidth: 0,
	    borderRadius: theme.radii.lg,
	    borderWidth: 1,
	    borderColor: theme.colors.border,
	    backgroundColor: theme.colors.surfaceRaised,
	    overflow: "hidden",
	  },
	  fileImage: {
	    width: "100%",
	    height: "100%",
	  },
  fileUnsupportedBox: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
	    borderRadius: theme.radii.lg,
	    borderWidth: 1,
	    borderColor: theme.colors.border,
	    backgroundColor: theme.colors.surfaceRaised,
	    padding: 18,
	    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  markdownImageBlock: {
    width: "100%",
    minWidth: 0,
    minHeight: 180,
    maxHeight: 420,
    aspectRatio: 16 / 9,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    overflow: "hidden",
    marginVertical: 8,
  },
  markdownImage: {
    width: "100%",
    height: "100%",
    minHeight: 180,
  },
  markdownImagePlaceholder: {
    minHeight: 180,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  markdownImageLabel: {
    ...theme.typography.meta,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
  markdownImageError: {
    ...theme.typography.meta,
    color: theme.colors.danger,
    textAlign: "center",
  },
  sessionScreenMetaBar: {
    width: "100%",
    minWidth: 0,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sessionScreenMetaTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  sessionScreenEyebrow: {
    ...theme.typography.meta,
    color: theme.colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
  },
  sessionScreenStatus: {
    ...theme.typography.meta,
    color: theme.colors.text,
    marginTop: 1,
    textTransform: "capitalize",
  },
  sessionScreenActions: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: visionControls ? 12 : 8,
    flexWrap: "wrap",
  },
  sessionZoomLabel: {
    ...theme.typography.meta,
    color: theme.colors.textMuted,
    minWidth: 34,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  sessionFilesButton: {
    width: visionControls ? target : 44,
    height: visionControls ? target : 44,
    flexShrink: 0,
    borderRadius: visionControls ? 16 : theme.radii.md,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  sessionFollowButton: {
    minWidth: visionControls ? 108 : 74,
    height: visionControls ? target : 32,
    flexShrink: 0,
    paddingHorizontal: 10,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surfaceRaised,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  sessionFollowButtonActive: {
    backgroundColor: theme.colors.accentSoft,
  },
  sessionFollowText: {
    ...theme.typography.meta,
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  sessionFollowTextActive: {
    color: theme.colors.accent,
  },
  terminalFrame: {
    position: "relative",
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    overflow: "hidden",
  },
  terminalLoadingIndicator: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
  },
  terminalStatusLine: {
    width: "100%",
    minWidth: 0,
    ...theme.typography.meta,
    color: theme.colors.textMuted,
  },
  terminalBox: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
  },
  terminalBoxContent: {
    padding: 12,
    paddingTop: 12,
  },
  terminalText: {
    minWidth: 0,
    ...theme.typography.mono,
    color: theme.colors.text,
  },
  fileBrowserScreen: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  fileBrowserHeader: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  fileBrowserIconButton: {
    width: visionControls ? target : 44,
    height: visionControls ? target : 44,
    flexShrink: 0,
    borderRadius: visionControls ? 16 : theme.radii.md,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  fileBrowserTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  fileBrowserTitle: {
    ...theme.typography.section,
    color: theme.colors.text,
  },
  fileBrowserPath: {
    ...theme.typography.mono,
    color: theme.colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  fileBrowserList: {
    flex: 1,
    minHeight: 0,
  },
  fileBrowserListContent: {
    paddingVertical: 4,
  },
  fileBrowserEmptyContent: {
    flexGrow: 1,
  },
  fileBrowserRow: {
    minHeight: visionControls ? target : 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  fileBrowserRowPressed: {
    opacity: 0.62,
  },
  fileBrowserRowDisabled: {
    opacity: 0.5,
  },
  fileBrowserRowIcon: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  fileBrowserRowTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  fileBrowserRowTitle: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  fileBrowserRowTitleDisabled: {
    color: theme.colors.textMuted,
  },
  fileBrowserRowMeta: {
    ...theme.typography.meta,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  fileBrowserState: {
    flex: 1,
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    padding: 20,
  },
  fileBrowserRetryButton: {
    minWidth: 88,
    minHeight: visionControls ? target : 44,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  fileBrowserRetryText: {
    ...theme.typography.meta,
    color: theme.colors.text,
  },
  fileBrowserTruncated: {
    ...theme.typography.meta,
    color: theme.colors.textMuted,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  transcriptBox: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
  },
  pinRenameEditor: {
    width: "100%",
    minWidth: 0,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    padding: 12,
    gap: 10,
  },
  pinRenameButton: {
    minHeight: visionControls ? target : 48,
  },
  pinsViewport: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
  },
  pinsList: {
    flexGrow: 1,
    gap: 10,
    paddingBottom: 4,
  },
  pinRow: {
    width: "100%",
    minWidth: 0,
    minHeight: 44,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    padding: 12,
    gap: 5,
  },
  pinRowPressed: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  pinTitleRow: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  pinName: {
    flex: 1,
    minWidth: 0,
    ...theme.typography.section,
    color: theme.colors.text,
  },
  pinMeta: {
    minWidth: 0,
    ...theme.typography.meta,
    color: theme.colors.textMuted,
  },
  pinSource: {
    minWidth: 0,
    ...theme.typography.mono,
    color: theme.colors.textMuted,
  },
  pinActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 5,
  },
  artifactImageFrame: {
    position: "relative",
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    overflow: "hidden",
  },
  artifactImage: {
    width: "100%",
    height: "100%",
  },
  artifactLoadingOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  turnRow: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingVertical: 12,
    gap: 4,
  },
  turnHeaderRow: {
    minWidth: 0,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  turnRole: {
    flex: 1,
    minWidth: 0,
    ...theme.typography.meta,
    color: theme.colors.accent,
  },
  turnText: {
    minWidth: 0,
    ...theme.typography.body,
    color: theme.colors.text,
  },
  segmentRow: {
    width: "100%",
    minWidth: 0,
    flexDirection: "row",
    gap: 8,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    minHeight: visionControls ? target : 40,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceRaised,
  },
  segmentActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  segmentText: {
    minWidth: 0,
    ...theme.typography.section,
    color: theme.colors.text,
  },
  segmentTextActive: {
    color: theme.colors.surfaceRaised,
  },
  twoCol: {
    width: "100%",
    minWidth: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  twoColItem: {
    flex: 1,
    minWidth: 132,
    gap: 6,
  },
  visionFieldStack: {
    width: "100%",
    minWidth: 0,
    gap: 12,
  },
  visionFieldStackItem: {
    width: "100%",
    minWidth: 0,
    gap: 8,
  },
  visionMuxRow: {
    width: "100%",
    minWidth: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  visionMuxButton: {
    flexGrow: 1,
    minWidth: 96,
    minHeight: visionControls ? target : 60,
    paddingHorizontal: 16,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  });
  return scaleTextMetrics(definitions, fontScale);
}
