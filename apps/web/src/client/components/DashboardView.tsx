import type { DashboardRoute } from "../dashboard/navigation.js";
import type { DashboardData, DashboardSummary, SessionUser } from "../types.js";
import { Panel } from "./Panel.js";
import { SectionTabs } from "./SectionTabs.js";
import { ActionPanel } from "./ActionPanel.js";
import { MarketSection } from "../sections/MarketSection.js";
import { MlSection } from "../sections/MlSection.js";
import { OutreachSection } from "../sections/OutreachSection.js";
import { OverviewSection } from "../sections/OverviewSection.js";
import { ProjectsSection } from "../sections/ProjectsSection.js";

type DashboardViewProps = {
  user: SessionUser;
  data: DashboardData;
  summary: DashboardSummary;
  onLogout: () => void;
  route: DashboardRoute;
  onNavigate: (route: DashboardRoute) => void;
  onRefresh: () => Promise<void>;
  lastUpdated: string | null;
};

function renderSection(route: DashboardRoute, data: DashboardData, summary: DashboardSummary) {
  switch (route) {
    case "market":
      return <MarketSection data={data} />;
    case "outreach":
      return <OutreachSection data={data} />;
    case "projects":
      return <ProjectsSection data={data} />;
    case "ml":
      return <MlSection data={data} />;
    case "overview":
    default:
      return <OverviewSection data={data} summary={summary} />;
  }
}

export function DashboardView({ user, data, summary, onLogout, route, onNavigate, onRefresh, lastUpdated }: DashboardViewProps) {
  return (
    <>
      <div className="grid">
        <div className="span-12">
          <Panel className="session-strip">
            <div className="session-user">
              <span className="pill">Рабочее пространство</span>
              <strong>{user.fullName}</strong>
              <span className="muted">
                {user.role} · {user.email}
              </span>
            </div>
            <div className="button-row">
              <span className="badge">{summary.shortlisted} в shortlist</span>
              <span className="muted">
                {lastUpdated ? `Обновлено ${new Date(lastUpdated).toLocaleTimeString()}` : "Ещё не обновлялось"}
              </span>
              <button type="button" className="ghost-button" onClick={() => void onRefresh()}>
                Обновить
              </button>
              <button type="button" className="ghost-button" onClick={onLogout}>
                Выйти
              </button>
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid">
        <div className="span-12">
          <Panel>
            <div className="panel-header">
              <div>
                <h3>Демо-режим</h3>
                <p>
                  Доставка outreach-сообщений намеренно симулируется для защиты и демо-показов. Платформа
                  всё равно проходит полный бизнес-флоу: draft, approval, campaign, message events, replies,
                  agreement, brief, catalog и memory adaptation.
                </p>
              </div>
              <span className="badge">Симулированный outreach</span>
            </div>
          </Panel>
        </div>
      </div>

      <SectionTabs currentRoute={route} onNavigate={onNavigate} />

      <div className="grid">
        <ActionPanel data={data} onRefresh={onRefresh} />
        {renderSection(route, data, summary)}
      </div>
    </>
  );
}
