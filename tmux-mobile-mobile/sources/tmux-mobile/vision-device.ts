import { Platform } from "react-native";
import CJMUXVisionDevice from "../../modules/cjmux-vision-device";

export const NATIVE_VISION_CONTROLS_STATUS: boolean | null =
  Platform.OS !== "ios" ? false : Platform.isVision ? true : CJMUXVisionDevice.isIOSAppOnVision;
export const NATIVE_VISION_CONTROLS_DETECTED = NATIVE_VISION_CONTROLS_STATUS === true;
