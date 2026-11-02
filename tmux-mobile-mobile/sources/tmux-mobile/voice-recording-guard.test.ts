import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(
  new URL("../app/(app)/index.tsx", import.meta.url),
  "utf8",
);

describe("Vision voice recording", () => {
  it("keeps both native recognition paths open until the user stops them", () => {
    expect(appSource).not.toContain("continuous: false");
    expect(appSource.match(/continuous:\s*true/g)).toHaveLength(2);
    expect(appSource.match(/iosTaskHint:\s*"dictation"/g)).toHaveLength(2);
    expect(appSource).not.toMatch(
      /useSpeechRecognitionEvent\("result",[\s\S]*?setActive\(false\);[\s\S]*?useSpeechRecognitionEvent\("end"/,
    );
  });

  it("enables real volume metering and rejects a silent server recording", () => {
    expect(appSource.match(/volumeChangeEventOptions:/g)).toHaveLength(2);
    expect(appSource).toContain('useSpeechRecognitionEvent("volumechange"');
    expect(appSource).toContain("if (!heardSpeechRef.current)");
    expect(appSource).toContain("audibleFrameCountRef.current >= 3");
    expect(appSource).toContain('onStatus("No speech detected")');
  });
});
