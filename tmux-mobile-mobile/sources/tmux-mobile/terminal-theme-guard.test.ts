import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const appSource = fs.readFileSync(
  path.resolve(process.cwd(), "sources/app/(app)/index.tsx"),
  "utf8",
);

describe("terminal theme", () => {
  it("uses the light surface and themed text outside dark mode", () => {
    expect(appSource).toContain(
      'backgroundColor: theme.colors.surfaceRaised',
    );
    expect(appSource).toMatch(
      /terminalText:\s*\{[\s\S]*?color: theme\.colors\.text,[\s\S]*?\n\s*\},/,
    );
    expect(appSource).not.toContain(
      'backgroundColor: theme.dark ? "#1e1e1e" : "#272721"',
    );
  });

  it("keeps the terminal loading state visible in either theme", () => {
    expect(appSource).toContain("style={styles.terminalLoadingIndicator}");
    expect(appSource).toContain("color={theme.colors.accent}");
  });
});
