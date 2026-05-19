export type ServiceStatus = {
  service: string;
  readyAt: string;
};

export function readinessProbe(service: string): ServiceStatus {
  return {
    service,
    readyAt: new Date().toISOString()
  };
}

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export function jsonResponse(data: JsonValue, statusCode = 200): {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
} {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(data, null, 2)
  };
}

export function notFoundResponse(pathname: string): {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
} {
  return jsonResponse(
    {
      error: "not_found",
      message: `Route ${pathname} was not found.`
    },
    404
  );
}

export function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function createId(prefix: string): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${suffix}`;
}

export function htmlPage(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f6f2ea;
        --card: #fffdf8;
        --ink: #1d2a37;
        --muted: #5f6b75;
        --accent: #0d6b5c;
        --accent-soft: #d5ece7;
        --line: #d9ddd7;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, #efe2d0 0, transparent 32%),
          linear-gradient(180deg, #fbf7ef 0%, var(--bg) 100%);
      }
      main {
        max-width: 1120px;
        margin: 0 auto;
        padding: 40px 20px 80px;
      }
      h1, h2 { margin: 0 0 12px; }
      p { color: var(--muted); line-height: 1.6; }
      .hero {
        padding: 28px;
        border: 1px solid var(--line);
        border-radius: 24px;
        background: rgba(255, 253, 248, 0.9);
        box-shadow: 0 18px 50px rgba(29, 42, 55, 0.08);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
        margin-top: 24px;
      }
      .card {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 18px;
      }
      .kpi {
        font-size: 30px;
        color: var(--accent);
        margin-bottom: 8px;
      }
      .pill {
        display: inline-block;
        padding: 6px 10px;
        background: var(--accent-soft);
        color: var(--accent);
        border-radius: 999px;
        font-size: 12px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      code {
        background: #f0ece3;
        padding: 2px 6px;
        border-radius: 6px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 18px;
      }
      th, td {
        text-align: left;
        padding: 12px 10px;
        border-bottom: 1px solid var(--line);
        vertical-align: top;
      }
    </style>
  </head>
  <body>
    <main>${body}</main>
  </body>
</html>`;
}
