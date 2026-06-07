import type { IncomingMessage, ServerResponse } from "node:http";

export type RouteContext = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  pathname: string;
};
