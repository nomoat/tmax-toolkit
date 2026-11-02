import type { NativeModule } from "expo";

export type CJMUXVisionDeviceModule = NativeModule & {
  isIOSAppOnVision: boolean | null;
};
