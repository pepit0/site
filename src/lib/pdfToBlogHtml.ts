import * as pdfjs from "pdfjs-dist";
import type { TextContent, TextItem } from "pdfjs-dist/types/src/display/api";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

type PdfStyle = {
  fontFamily: string;
  flags?: number;
};

type StyledPiece = {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  bold: boolean;
  italic: boolean;
};

type StyledRun = {
  text: string;
  bold: boolean;
  italic: boolean;
  fontSize: number;
};

type TextLine = {
  runs: StyledRun[];
  y: number;
  maxFontSize: number;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fontStyleFromName(fontFamily: string, flags = 0): { bold: boolean; italic: boolean } {
  const normalized = fontFamily.toLowerCase().replace(/\s+/g, "");
  const bold =
    (/bold|black|heavy|semibold|demi/.test(normalized) && !/bolditalic|semibolditalic/.test(normalized)) ||
    (flags & (1 << 18)) !== 0;
  const italic = /italic|oblique/.test(normalized) || (flags & 1) !== 0;
  return { bold, italic };
}

function itemFontSize(transform: number[]): number {
  return Math.hypot(transform[0], transform[1]) || Math.abs(transform[0]) || 12;
}

function isTextItem(item: TextContent["items"][number]): item is TextItem {
  return "str" in item;
}

function buildLines(items: TextItem[], styles: Record<string, PdfStyle>): TextLine[] {
  const enriched: StyledPiece[] = items
    .filter((item) => item.str.trim().length > 0)
    .map((item) => {
      const style = styles[item.fontName];
      const fontFamily = style?.fontFamily ?? item.fontName;
      const { bold, italic } = fontStyleFromName(fontFamily, style?.flags);
      return {
        text: item.str,
        x: item.transform[4],
        y: item.transform[5],
        fontSize: itemFontSize(item.transform),
        bold,
        italic
      };
    });

  enriched.sort((a, b) => {
    const dy = b.y - a.y;
    if (Math.abs(dy) > 2) return dy;
    return a.x - b.x;
  });

  const lines: TextLine[] = [];

  for (const piece of enriched) {
    const tolerance = Math.max(piece.fontSize * 0.45, 2);
    let line = lines.find((entry) => Math.abs(entry.y - piece.y) <= tolerance);
    if (!line) {
      line = { runs: [], y: piece.y, maxFontSize: piece.fontSize };
      lines.push(line);
    }
    line.maxFontSize = Math.max(line.maxFontSize, piece.fontSize);

    const lastRun = line.runs[line.runs.length - 1];
    const needsSpace =
      lastRun &&
      !lastRun.text.endsWith(" ") &&
      !lastRun.text.endsWith("-") &&
      !piece.text.startsWith(" ") &&
      piece.x > 0;

    if (
      lastRun &&
      lastRun.bold === piece.bold &&
      lastRun.italic === piece.italic &&
      Math.abs(lastRun.fontSize - piece.fontSize) < 0.75
    ) {
      lastRun.text += `${needsSpace ? " " : ""}${piece.text}`;
    } else {
      line.runs.push({
        text: `${needsSpace ? " " : ""}${piece.text}`,
        bold: piece.bold,
        italic: piece.italic,
        fontSize: piece.fontSize
      });
    }
  }

  lines.sort((a, b) => b.y - a.y);
  return lines;
}

function runsToHtml(runs: StyledRun[]): string {
  return runs
    .map((run) => {
      let text = escapeHtml(run.text);
      if (!text) return "";
      if (run.bold) text = `<strong>${text}</strong>`;
      if (run.italic) text = `<em>${text}</em>`;
      return text;
    })
    .join("");
}

function linesToHtml(lines: TextLine[]): string {
  if (lines.length === 0) return "";

  const fontSizes = lines.map((line) => line.maxFontSize).sort((a, b) => a - b);
  const median = fontSizes[Math.floor(fontSizes.length / 2)] ?? 12;

  const paragraphs: string[] = [];
  let currentLines: TextLine[] = [];

  const flushParagraph = () => {
    if (currentLines.length === 0) return;
    const html = currentLines.map((line) => runsToHtml(line.runs)).join(" ").replace(/\s+/g, " ").trim();
    if (!html) return;

    const maxSize = Math.max(...currentLines.map((line) => line.maxFontSize));
    const plainLen = currentLines.reduce(
      (count, line) => count + line.runs.reduce((sum, run) => sum + run.text.trim().length, 0),
      0
    );

    if (currentLines.length === 1 && maxSize >= median * 1.18 && plainLen > 0 && plainLen < 120) {
      paragraphs.push(`<h2>${html}</h2>`);
    } else {
      paragraphs.push(`<p>${html}</p>`);
    }
    currentLines = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const previous = lines[index - 1];
    if (previous) {
      const gap = Math.abs(previous.y - line.y);
      const threshold = Math.max(previous.maxFontSize, line.maxFontSize) * 1.35;
      if (gap > threshold) flushParagraph();
    }
    currentLines.push(line);
  }

  flushParagraph();
  return paragraphs.join("\n");
}

function textContentToHtml(content: TextContent): string {
  const items = content.items.filter(isTextItem);
  if (items.length === 0) return "";
  return linesToHtml(buildLines(items, content.styles as Record<string, PdfStyle>));
}

export async function pdfFileToBlogHtml(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const pageHtml: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const html = textContentToHtml(content);
    if (html) pageHtml.push(html);
  }

  return pageHtml.join("\n");
}

export function suggestTitleFromBlogHtml(html: string): string | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const heading = doc.body.querySelector("h2, h3, p");
  const text = heading?.textContent?.replace(/\s+/g, " ").trim() ?? "";
  if (!text) return null;
  return text.length > 120 ? `${text.slice(0, 117).trimEnd()}…` : text;
}
