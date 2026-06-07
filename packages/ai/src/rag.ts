import type { RagSearchHit } from "@edagent/domain";
import type { RetrievedContextSnippet } from "./types.js";

const DEFAULT_EMBEDDING_DIMENSIONS = 128;
const WORD_PATTERN = /[a-zа-я0-9+#./_-]{2,}/giu;

function normalizeToken(token: string): string {
  return token.trim().toLowerCase();
}

function hashToken(token: string, dimensions: number): number {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash) % dimensions;
}

export function tokenizeForEmbedding(text: string): string[] {
  return Array.from(text.matchAll(WORD_PATTERN), (match) => normalizeToken(match[0]));
}

export function chunkText(input: {
  text: string;
  maxChars?: number;
  overlapChars?: number;
}): Array<{ content: string; tokenCount: number }> {
  const text = input.text.replace(/\s+/g, " ").trim();
  if (!text) {
    return [];
  }

  const maxChars = input.maxChars ?? 420;
  const overlapChars = input.overlapChars ?? 90;
  const chunks: Array<{ content: string; tokenCount: number }> = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(text.length, start + maxChars);
    const slice = text.slice(start, end).trim();
    if (slice.length > 0) {
      chunks.push({
        content: slice,
        tokenCount: tokenizeForEmbedding(slice).length
      });
    }

    if (end >= text.length) {
      break;
    }

    start = Math.max(end - overlapChars, start + 1);
  }

  return chunks;
}

export function embedText(text: string, dimensions = DEFAULT_EMBEDDING_DIMENSIONS): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  const tokens = tokenizeForEmbedding(text);

  if (tokens.length === 0) {
    return vector;
  }

  for (const token of tokens) {
    const index = hashToken(token, dimensions);
    vector[index] = (vector[index] ?? 0) + 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) {
    return vector;
  }

  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export function toRetrievedContext(snippets: RagSearchHit[]): RetrievedContextSnippet[] {
  return snippets.map((item) => ({
    title: item.title,
    kind: item.documentKind,
    content: item.content,
    similarity: item.similarity
  }));
}
