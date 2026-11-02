import * as React from "react";
import { Text } from "react-native";
import type { TextStyle } from "react-native";

const ANSI_PALETTE_LIGHT = [
  "#26282a",
  "#b22222",
  "#2e7d32",
  "#9a6a00",
  "#1f5b8f",
  "#7b3fa0",
  "#0a7383",
  "#4a4f52",
  "#3c4042",
  "#a8201a",
  "#256921",
  "#7a5300",
  "#1a4d7a",
  "#6a2f8c",
  "#0a6370",
  "#1b1d1e",
];

const KAMI_LUM_CAP = 0.14;

interface AnsiState {
  fg: string | null;
  bg: string | null;
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  inverse: boolean;
  strike: boolean;
}

function srgbLin(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relLum(r: number, g: number, b: number): number {
  return 0.2126 * srgbLin(r) + 0.7152 * srgbLin(g) + 0.0722 * srgbLin(b);
}

function ansiRgb(r: number, g: number, b: number): string {
  const lum = relLum(r, g, b);
  if (lum > KAMI_LUM_CAP) {
    const k = Math.pow(KAMI_LUM_CAP / lum, 1 / 2.4);
    r *= k;
    g *= k;
    b *= k;
  }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

function ansi256(value: number): string {
  const n = Math.max(0, Math.min(255, value));
  if (n < 16) return ANSI_PALETTE_LIGHT[n] || ANSI_PALETTE_LIGHT[0];
  if (n >= 232) {
    const v = 8 + (n - 232) * 10;
    return ansiRgb(v, v, v);
  }
  const i = n - 16;
  const steps = [0, 95, 135, 175, 215, 255];
  return ansiRgb(steps[Math.floor(i / 36) % 6], steps[Math.floor(i / 6) % 6], steps[i % 6]);
}

function freshAnsiState(): AnsiState {
  return {
    fg: null,
    bg: null,
    bold: false,
    dim: false,
    italic: false,
    underline: false,
    inverse: false,
    strike: false,
  };
}

function applyAnsiSgr(state: AnsiState, paramStr: string): void {
  const codes = paramStr === "" ? [0] : paramStr.split(";").map((value) => Number(value) || 0);
  for (let i = 0; i < codes.length; i += 1) {
    const code = codes[i];
    if (code === 0) Object.assign(state, freshAnsiState());
    else if (code === 1) state.bold = true;
    else if (code === 2) state.dim = true;
    else if (code === 3) state.italic = true;
    else if (code === 4) state.underline = true;
    else if (code === 7) state.inverse = true;
    else if (code === 9) state.strike = true;
    else if (code === 22) {
      state.bold = false;
      state.dim = false;
    } else if (code === 23) state.italic = false;
    else if (code === 24) state.underline = false;
    else if (code === 27) state.inverse = false;
    else if (code === 29) state.strike = false;
    else if (code >= 30 && code <= 37) state.fg = ANSI_PALETTE_LIGHT[code - 30] || null;
    else if (code >= 40 && code <= 47) state.bg = ANSI_PALETTE_LIGHT[code - 40] || null;
    else if (code >= 90 && code <= 97) state.fg = ANSI_PALETTE_LIGHT[8 + code - 90] || null;
    else if (code >= 100 && code <= 107) state.bg = ANSI_PALETTE_LIGHT[8 + code - 100] || null;
    else if (code === 39) state.fg = null;
    else if (code === 49) state.bg = null;
    else if (code === 38 || code === 48) {
      const target = code === 38 ? "fg" : "bg";
      if (codes[i + 1] === 5) {
        state[target] = ansi256(codes[i + 2] || 0);
        i += 2;
      } else if (codes[i + 1] === 2) {
        state[target] = ansiRgb(codes[i + 2] || 0, codes[i + 3] || 0, codes[i + 4] || 0);
        i += 4;
      }
    }
  }
}

function ansiTextStyle(state: AnsiState): TextStyle | null {
  let color = state.fg;
  let backgroundColor = state.bg;
  if (state.inverse) {
    color = state.bg || "#faf9f5";
    backgroundColor = state.fg || "#272721";
  }

  const textDecorationLine =
    state.underline && state.strike
      ? "underline line-through"
      : state.underline
        ? "underline"
        : state.strike
          ? "line-through"
          : undefined;

  const style: TextStyle = {};
  if (color) style.color = color;
  if (backgroundColor) style.backgroundColor = backgroundColor;
  if (state.bold) style.fontWeight = "700";
  if (state.dim) style.opacity = 0.65;
  if (state.italic) style.fontStyle = "italic";
  if (textDecorationLine) style.textDecorationLine = textDecorationLine;
  return Object.keys(style).length > 0 ? style : null;
}

export function stripUnsupportedAnsi(text: string): string {
  return String(text || "")
    .replace(/\x1B\][^\x07]*?(?:\x07|\x1B\\)/g, "")
    .replace(/\x1B[@-Z\\-_]/g, "")
    .replace(/\x1B\[[0-?]*[ -/]*[@-ln-~]/g, "")
    .replace(/\r/g, "\n")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1A\x1C-\x1F\x7F]/g, "");
}

export function renderAnsiText(text: string, options: { selectable?: boolean } = {}): React.ReactNode[] {
  const input = String(text || "");
  const sgr = /\x1B\[([0-9;:]*)m/g;
  const state = freshAnsiState();
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let index = 0;
  let match: RegExpExecArray | null;

  const emit = (chunk: string) => {
    const clean = stripUnsupportedAnsi(chunk);
    if (!clean) return;
    const style = ansiTextStyle(state);
    nodes.push(style ? <Text key={`ansi-${index}`} selectable={options.selectable} style={style}>{clean}</Text> : clean);
    index += 1;
  };

  while ((match = sgr.exec(input)) !== null) {
    emit(input.slice(last, match.index));
    applyAnsiSgr(state, match[1].replace(/:/g, ";"));
    last = sgr.lastIndex;
  }
  emit(input.slice(last));
  return nodes;
}
