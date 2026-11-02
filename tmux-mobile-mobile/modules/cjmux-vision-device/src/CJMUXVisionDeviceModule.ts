import { requireOptionalNativeModule } from "expo";
import type { CJMUXVisionDeviceModule } from "./CJMUXVisionDevice.types";

const fallback: CJMUXVisionDeviceModule = {
  isIOSAppOnVision: null,
} as CJMUXVisionDeviceModule;

export default requireOptionalNativeModule<CJMUXVisionDeviceModule>("CJMUXVisionDevice") ?? fallback;
