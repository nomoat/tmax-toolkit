const variant = process.env.APP_ENV || "development";
const updateChannel = process.env.EAS_UPDATE_CHANNEL || (variant === "production" ? "production" : variant);
const buildTime = process.env.BUILD_TIME || new Date().toISOString();
const jsVersion = process.env.JS_UPDATE_VERSION || buildTime.replace(/[-:T]/g, "").slice(0, 12);
// Native scene lifecycle and SDK 57 patches require a new binary, not an OTA to runtime 6.
const runtimeVersion = process.env.CJMUX_RUNTIME_VERSION || "7";

export default {
  expo: {
    name: "T-MAX",
    slug: "tmux-mobile-mobile",
    version: "0.1.0",
    runtimeVersion,
    updates: {
      url: "https://u.expo.dev/649f50ed-e509-4fbc-9d23-a8c9080ba635",
      requestHeaders: {
        "expo-channel-name": updateChannel,
      },
    },
    orientation: "default",
    icon: "./logo.png",
    scheme: "tmuxmobile",
    userInterfaceStyle: "automatic",
    ios: {
      supportsTablet: true,
      bundleIdentifier: "ai.impo.tmuxmobile",
      appleTeamId: "BN3369Y53F",
      config: {
        usesNonExemptEncryption: false,
      },
      infoPlist: {
        NSLocalNetworkUsageDescription:
          "T-MAX connects directly to machines you choose over SSH.",
        NSMicrophoneUsageDescription:
          "Allow T-MAX to access your microphone for voice commands.",
        NSSpeechRecognitionUsageDescription:
          "Allow T-MAX to transcribe your voice into prompts.",
      },
    },
    android: {
      package: "ai.impo.tmuxmobile",
      permissions: [
        "android.permission.RECORD_AUDIO",
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.POST_NOTIFICATIONS",
      ],
      adaptiveIcon: {
        foregroundImage: "./logo-mark.png",
        backgroundColor: "#f4eee3",
      },
    },
    web: {
      bundler: "metro",
      output: "single",
      favicon: "./logo.png",
    },
    plugins: [
      [
        "expo-router",
        {
          root: "./sources/app",
        },
      ],
      "expo-secure-store",
      "expo-font",
      "expo-asset",
      "expo-audio",
      "expo-web-browser",
      [
        "expo-speech-recognition",
        {
          microphonePermission:
            "Allow T-MAX to access your microphone for voice commands.",
          speechRecognitionPermission:
            "Allow T-MAX to transcribe your voice into prompts.",
        },
      ],
      "expo-system-ui",
      "expo-status-bar",
      "expo-updates",
      [
        "expo-image-picker",
        {
          photosPermission:
            "Allow T-MAX to pick images and send them to tmux panes.",
        },
      ],
      [
        "expo-splash-screen",
        {
          backgroundColor: "#f4eee3",
          image: "./logo-mark.png",
          imageWidth: 96,
          dark: {
            backgroundColor: "#17231d",
            image: "./logo-mark.png",
          },
        },
      ],
    ],
    extra: {
      appEnv: variant,
      jsVersion,
      buildTime,
      tmuxMobileControllerUrl:
        process.env.TMUX_MOBILE_CONTROLLER_URL || "https://eng.xyznot.com",
      eas: {
        projectId: "649f50ed-e509-4fbc-9d23-a8c9080ba635",
      },
    },
    owner: "meowoof",
  },
};
