export const appStyles = `
  @import url("https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Manrope:wght@400;500;600;700;800&display=swap");

  :root {
    color-scheme: light;
    --page: #f5efe4;
    --page-deep: #eadac1;
    --surface: rgba(255, 251, 244, 0.88);
    --surface-strong: #fffdf8;
    --ink: #1b2a36;
    --muted: #5f6f7f;
    --line: rgba(30, 40, 50, 0.12);
    --accent: #0f6d69;
    --accent-strong: #0c4f58;
    --accent-soft: rgba(15, 109, 105, 0.12);
    --warning: #b86423;
    --shadow: 0 24px 60px rgba(27, 42, 54, 0.12);
    --radius-xl: 28px;
    --radius-lg: 20px;
    --radius-md: 14px;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    min-height: 100vh;
    font-family: "Manrope", sans-serif;
    color: var(--ink);
    background:
      radial-gradient(circle at top left, rgba(15, 109, 105, 0.12), transparent 28%),
      radial-gradient(circle at top right, rgba(234, 218, 193, 0.95), transparent 30%),
      linear-gradient(180deg, #fcf8f1 0%, var(--page) 45%, #efe4d2 100%);
  }

  #root {
    min-height: 100vh;
  }

  button,
  input,
  textarea {
    font: inherit;
  }

  .app-shell {
    max-width: 1320px;
    margin: 0 auto;
    padding: 24px 18px 64px;
  }

  .hero {
    position: relative;
    overflow: hidden;
    padding: 32px;
    border: 1px solid var(--line);
    border-radius: var(--radius-xl);
    background:
      linear-gradient(145deg, rgba(255, 255, 255, 0.84), rgba(255, 250, 242, 0.82)),
      linear-gradient(135deg, rgba(15, 109, 105, 0.08), rgba(234, 218, 193, 0.24));
    box-shadow: var(--shadow);
  }

  .hero::after {
    content: "";
    position: absolute;
    inset: auto -80px -80px auto;
    width: 220px;
    height: 220px;
    border-radius: 999px;
    background: radial-gradient(circle, rgba(15, 109, 105, 0.18), transparent 70%);
  }

  .hero-grid,
  .grid {
    display: grid;
    gap: 18px;
  }

  .hero-grid {
    grid-template-columns: minmax(0, 1.5fr) minmax(280px, 0.9fr);
    align-items: end;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent-strong);
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 800;
  }

  .headline {
    margin: 16px 0 12px;
    font-family: "Fraunces", serif;
    font-size: clamp(34px, 5vw, 62px);
    line-height: 0.95;
    letter-spacing: -0.04em;
  }

  .lede {
    max-width: 58ch;
    margin: 0;
    color: var(--muted);
    line-height: 1.7;
    font-size: 15px;
  }

  .hero-meta {
    display: grid;
    gap: 12px;
    padding: 18px;
    border-radius: var(--radius-lg);
    background: rgba(13, 34, 42, 0.9);
    color: #f5f0e5;
  }

  .hero-meta-label {
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(245, 240, 229, 0.64);
  }

  .hero-meta-value {
    font-size: 15px;
    font-weight: 700;
  }

  .grid {
    grid-template-columns: repeat(12, minmax(0, 1fr));
    margin-top: 20px;
  }

  .span-12 { grid-column: span 12; }
  .span-8 { grid-column: span 8; }
  .span-6 { grid-column: span 6; }
  .span-4 { grid-column: span 4; }
  .span-3 { grid-column: span 3; }

  .panel {
    padding: 22px;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--surface);
    backdrop-filter: blur(20px);
    box-shadow: 0 18px 38px rgba(27, 42, 54, 0.08);
  }

  .panel-title {
    margin: 0;
    font-family: "Fraunces", serif;
    font-size: 28px;
    line-height: 1;
  }

  .panel-subtitle {
    margin: 10px 0 0;
    color: var(--muted);
    line-height: 1.6;
    font-size: 14px;
  }

  .auth-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
  }

  .field {
    display: grid;
    gap: 8px;
    margin-bottom: 14px;
  }

  .field label {
    font-size: 13px;
    font-weight: 700;
    color: var(--ink);
  }

  .field input {
    width: 100%;
    padding: 13px 14px;
    border-radius: 14px;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.84);
  }

  .button-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
  }

  .button,
  .ghost-button {
    border: none;
    border-radius: 999px;
    padding: 12px 18px;
    font-weight: 800;
    cursor: pointer;
    transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease;
  }

  .button {
    color: white;
    background: linear-gradient(135deg, var(--accent), var(--accent-strong));
    box-shadow: 0 14px 28px rgba(15, 109, 105, 0.22);
  }

  .ghost-button {
    color: var(--ink);
    background: rgba(255, 255, 255, 0.82);
    border: 1px solid var(--line);
  }

  .button:hover,
  .ghost-button:hover {
    transform: translateY(-1px);
  }

  .status-banner {
    margin-top: 18px;
    padding: 16px 18px;
    border-radius: 16px;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.72);
    color: var(--muted);
  }

  .status-banner[data-tone="error"] {
    color: #7d2f25;
    background: rgba(181, 72, 56, 0.08);
    border-color: rgba(181, 72, 56, 0.18);
  }

  .status-banner[data-tone="success"] {
    color: #1a5d34;
    background: rgba(55, 140, 82, 0.1);
    border-color: rgba(55, 140, 82, 0.18);
  }

  .section-tabs {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 12px;
    margin-top: 20px;
  }

  .section-tab {
    text-align: left;
    padding: 14px 16px;
    border-radius: 18px;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.72);
    cursor: pointer;
    transition: transform 120ms ease, background 120ms ease, border-color 120ms ease;
  }

  .section-tab span {
    display: block;
    font-weight: 800;
    color: var(--ink);
  }

  .section-tab small {
    display: block;
    margin-top: 6px;
    color: var(--muted);
    line-height: 1.4;
  }

  .section-tab.active {
    background: linear-gradient(135deg, rgba(15, 109, 105, 0.14), rgba(255, 255, 255, 0.92));
    border-color: rgba(15, 109, 105, 0.25);
    transform: translateY(-1px);
  }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
  }

  .kpi-card {
    padding: 18px;
    border-radius: 18px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(249, 244, 235, 0.96));
    border: 1px solid var(--line);
  }

  .kpi-value {
    font-size: clamp(32px, 4vw, 42px);
    font-weight: 800;
    letter-spacing: -0.04em;
    color: var(--accent-strong);
  }

  .kpi-label {
    margin-top: 8px;
    color: var(--muted);
    font-size: 13px;
  }

  .session-strip {
    display: flex;
    justify-content: space-between;
    gap: 18px;
    align-items: center;
    flex-wrap: wrap;
  }

  .session-user {
    display: grid;
    gap: 6px;
  }

  .session-user strong {
    font-size: 18px;
  }

  .table-wrap {
    overflow-x: auto;
    margin-top: 16px;
  }

  .action-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    margin-top: 18px;
  }

  .action-card {
    padding: 16px;
    border-radius: 18px;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.62);
  }

  .action-card h3 {
    margin: 0 0 8px;
    font-size: 18px;
  }

  .action-card textarea,
  .action-card select {
    width: 100%;
    padding: 13px 14px;
    border-radius: 14px;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.84);
  }

  .check-list {
    display: grid;
    gap: 8px;
    max-height: 160px;
    overflow: auto;
    padding: 8px;
    border-radius: 14px;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.62);
  }

  .check-item {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
  }

  .filter-bar {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    align-items: center;
    padding: 14px 16px;
    border-radius: 16px;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.56);
  }

  .filter-bar input,
  .filter-bar select {
    min-width: 220px;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.86);
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    padding: 12px 10px;
    text-align: left;
    border-bottom: 1px solid rgba(30, 40, 50, 0.08);
    vertical-align: top;
    font-size: 13px;
  }

  th {
    color: var(--muted);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 800;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(15, 109, 105, 0.09);
    color: var(--accent-strong);
    font-size: 12px;
    font-weight: 700;
  }

  .badge-success {
    background: rgba(55, 140, 82, 0.14);
    color: #1a5d34;
  }

  .badge-warning {
    background: rgba(184, 100, 35, 0.14);
    color: #8b4f17;
  }

  .badge-danger {
    background: rgba(181, 72, 56, 0.14);
    color: #8c3024;
  }

  .badge-neutral {
    background: rgba(95, 111, 127, 0.12);
    color: #44515c;
  }

  .muted {
    color: var(--muted);
  }

  .empty {
    padding: 12px 0;
    color: var(--muted);
  }

  @media (max-width: 1080px) {
    .hero-grid,
    .auth-grid,
    .kpi-grid,
    .section-tabs,
    .action-grid {
      grid-template-columns: 1fr;
    }

    .span-8,
    .span-6,
    .span-4,
    .span-3 {
      grid-column: span 12;
    }
  }

  @media (max-width: 720px) {
    .app-shell {
      padding-inline: 12px;
    }

    .hero,
    .panel {
      padding: 18px;
      border-radius: 20px;
    }

    .headline {
      font-size: 34px;
    }
  }
`;
