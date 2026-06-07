import type { IncomingMessage, ServerResponse } from "node:http";
import { jsonResponse } from "@edagent/shared";

export function send(res: ServerResponse, payload: ReturnType<typeof jsonResponse>): void {
  res.writeHead(payload.statusCode, payload.headers);
  res.end(payload.body);
}

export async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf-8");
}
