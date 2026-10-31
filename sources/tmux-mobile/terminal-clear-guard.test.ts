import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const appSource = fs.readFileSync(
  path.resolve(process.cwd(), "sources/app/(app)/index.tsx"),
  "utf8",
);

describe("terminal draft clear action", () => {
  it("puts the local clear action beside the existing inline terminal buttons", () => {
    expect(appSource).toContain("clearInline = false");
    expect(appSource).toContain("{clearButton}");
    expect(appSource).toContain('accessibilityLabel="Clear terminal input"');
    expect(appSource).toMatch(/terminalInputRef\.current = "";\s*}\}\s*clearInline/);
    expect(appSource).not.toContain("paneComposerBelowInputActions");
  });

  it("keeps clear local and available while a send request is pending", () => {
    const clearButton = appSource.match(
      /const clearButton =[\s\S]*?accessibilityLabel="Clear terminal input"[\s\S]*?<\/Pressable>/,
    )?.[0];
    expect(clearButton).toBeTruthy();
    expect(clearButton).not.toContain("sendBusy");
    expect(clearButton).not.toContain("onSend");
    expect(clearButton).not.toContain("api.");
  });

  it("keeps secondary controls in the input shell below the full-width voice action", () => {
    expect(appSource).toContain("singleShell={windowWidth < 760}");
    expect(appSource).toContain("{singleShellPromptsVisible ? shortcutsBar : null}");
    expect(appSource).toMatch(/paneComposerInputShellSingle:\s*\{\s*minHeight: 108,/);
    expect(appSource).toContain("usesSingleShell && (standardStatus || error)");
    expect(appSource).toMatch(/paneComposerInlineButton:\s*\{\s*width: visionControls \? target : 44,\s*height: visionControls \? target : 44,/);
  });

  it("keeps prompt chips collapsed until the phone user expands them", () => {
    expect(appSource).toContain(
      "const [singleShellPromptsExpanded, setSingleShellPromptsExpanded] = React.useState(false)",
    );
    expect(appSource).toContain('"Expand terminal composer and show prompt shortcuts"');
    expect(appSource).toContain('"Collapse terminal composer"');
    expect(appSource).toContain("accessibilityState={{ expanded: singleShellPromptsVisible }}");
    expect(appSource).not.toContain("if (usesSingleShell) setSingleShellPromptsExpanded(false)");
    expect(appSource).toMatch(
      /paneComposerInputShellSingleCollapsed:\s*\{\s*minHeight: visionControls \? 160 : 112,/,
    );
  });

  it("expands the composer to half the available screen for long drafts", () => {
    expect(appSource).toContain(
      "const singleShellExpandedHeight = Math.max(visionControls ? 280 : 180, Math.round(viewportHeight * 0.5))",
    );
    expect(appSource).toContain("? { height: singleShellExpandedHeight }");
    expect(appSource).toContain("<Maximize2 size={visionControls ? 26 : 17} color={theme.colors.text} />");
    expect(appSource).toContain("<Minimize2 size={visionControls ? 26 : 17} color={activeIconColor} />");
    expect(appSource).toContain(
      "showShortcuts\n        autoFocus={terminalAutoFocus}\n        status=",
    );
  });
});
