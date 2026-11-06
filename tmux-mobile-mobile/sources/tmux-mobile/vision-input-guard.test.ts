import { readFileSync } from "node:fs";
import * as ts from "typescript";
import { describe, expect, it } from "vitest";

const appSourceUrl = new URL("../app/(app)/index.tsx", import.meta.url);
const appSource = readFileSync(appSourceUrl, "utf8");
const appSourceFile = ts.createSourceFile(
  appSourceUrl.pathname,
  appSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

function tagName(node: ts.JsxOpeningLikeElement): string {
  return node.tagName.getText(appSourceFile);
}

function enclosingFunctionName(node: ts.Node): string | null {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isFunctionDeclaration(current)) {
      return current.name?.text ?? null;
    }
    current = current.parent;
  }
  return null;
}

function hasLiteralFalseEditable(node: ts.JsxOpeningLikeElement): boolean {
  return node.attributes.properties.some((attribute) => {
    if (!ts.isJsxAttribute(attribute) || attribute.name.getText(appSourceFile) !== "editable") {
      return false;
    }
    return (
      !!attribute.initializer &&
      ts.isJsxExpression(attribute.initializer) &&
      attribute.initializer.expression?.kind === ts.SyntaxKind.FalseKeyword
    );
  });
}

function lineOf(node: ts.Node): number {
  return appSourceFile.getLineAndCharacterOfPosition(node.getStart(appSourceFile)).line + 1;
}

describe("Shared text input", () => {
  it("keeps editable fields behind the shared wrapper without mounting them on Vision Pro", () => {
    const violations: string[] = [];
    let wrapperFound = false;
    let wrapperHasVisionGuard = false;

    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name?.text === "KeyboardTextInput") {
        wrapperFound = true;
        wrapperHasVisionGuard =
          !!node.body &&
          node.body.statements.some(
            (statement) =>
              ts.isIfStatement(statement) &&
              statement.expression.getText(appSourceFile) === "useVisionControls()" &&
              ts.isReturnStatement(statement.thenStatement) &&
              statement.thenStatement.expression?.getText(appSourceFile).includes("VisionTextField"),
          );
      }

      const opening = ts.isJsxSelfClosingElement(node)
        ? node
        : ts.isJsxElement(node)
          ? node.openingElement
          : null;
      if (opening && tagName(opening) === "TextInput") {
        const insideWrapper = enclosingFunctionName(opening) === "KeyboardTextInput";
        if (!insideWrapper && !hasLiteralFalseEditable(opening)) {
          violations.push(`raw editable TextInput at line ${lineOf(opening)}`);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(appSourceFile);

    expect(wrapperFound).toBe(true);
    expect(wrapperHasVisionGuard).toBe(true);
    expect(violations).toEqual([]);
  });
});

describe("Terminal ANSI rendering", () => {
  it("keeps terminal output on the styled ANSI renderer instead of a plain TextInput", () => {
    const terminalOutputs: Array<{ tag: string; contents: string }> = [];

    const visit = (node: ts.Node) => {
      const opening = ts.isJsxSelfClosingElement(node)
        ? node
        : ts.isJsxElement(node)
          ? node.openingElement
          : null;
      if (opening && tagName(opening) === "TerminalOutput") {
        terminalOutputs.push({
          tag: tagName(opening),
          contents: node.getText(appSourceFile),
        });
      }

      ts.forEachChild(node, visit);
    };

    visit(appSourceFile);

    expect(terminalOutputs).toHaveLength(1);
    expect(terminalOutputs[0].tag).toBe("TerminalOutput");
    expect(terminalOutputs[0].contents).toContain("text={terminalText}");
    expect(terminalOutputs[0].contents).toContain("onLongPress={selectTerminalText}");
    expect(terminalOutputs[0].contents).not.toContain("terminalPlainText");
    const outputSource = readFileSync(new URL("./terminal-output.tsx", import.meta.url), "utf8");
    expect(outputSource).not.toContain("TextInput");
    expect(outputSource).toContain("renderAnsiText(output)");
    expect(outputSource).toContain("parseAnsiLines(output)");
  });
});

describe("Terminal fullscreen behavior", () => {
  it("opens directly fullscreen with no windowed or fullscreen-toggle state", () => {
    expect(appSource).not.toContain("const [terminalFullscreen");
    expect(appSource).not.toContain("setTerminalFullscreen");
    expect(appSource).not.toContain('label="Fullscreen terminal"');
    expect(appSource).not.toContain('label="Exit fullscreen terminal"');
    expect(appSource).toMatch(/fullscreen\s*>/);
    expect(appSource).not.toContain("fullscreen\n      hideHeader");
  });

  it("keeps a stable session header and follow control above the terminal", () => {
    expect(appSource).toContain("<View style={styles.terminalFrame}>");
    expect(appSource).toContain("style={styles.sessionScreenMetaBar}");
    expect(appSource).toContain("contentContainerStyle={styles.terminalBoxContent}");
    expect(appSource).toContain('accessibilityLabel={terminalFollow ? "Stop following terminal output" : "Follow terminal output"}');
    expect(appSource).toContain('title={target ? agentTitle(target) : "Session"}');
    expect(appSource).toContain("accessibilityLabel={`Close ${title}`}");
    expect(appSource).not.toContain("styles.terminalFullscreenControls");
    expect(appSource).not.toContain("styles.terminalOverlayButton");
    expect(appSource).toContain("onClose={closeTerminalModal}");
    expect(appSource).not.toContain("onCloseTerminal");
    expect(appSource).not.toContain("onToggleFollow");
  });

  it("keeps prompt suggestions available in the fullscreen terminal", () => {
    expect(appSource).toContain("showUpload\n        showShortcuts");
  });

  it("keeps follow behavior and lifts fullscreen sheets above the keyboard", () => {
    expect(appSource).toContain("const terminalShouldFollow = terminalFollow && !selection;");
    expect(appSource).toContain(
      "const keyboardAffectsSheet = fullscreenActive || !sheetIsWide || !tall;",
    );
  });
});

describe("Voice input device presentation", () => {
  it("keeps one shared full-width streaming toggle before the draft, without a device chooser", () => {
    expect(appSource).not.toContain("function VisionModeGate(");
    expect(appSource).not.toContain("visionControlsPreference=");
    expect(appSource).not.toContain("style={styles.visionComposerPrimaryRow}");
    expect(appSource).not.toContain("{voiceButton}");
    expect(appSource.match(/\{streamingButton\}/g)).toHaveLength(1);
    expect(appSource).toContain("autoFocus={autoFocus && !onToggleStreaming}");
    expect(appSource).toContain("streamingMode={streamingInput.mode}");
    expect(appSource).toContain("streamingMode={terminalStreamingInput.mode}");
  });
});
