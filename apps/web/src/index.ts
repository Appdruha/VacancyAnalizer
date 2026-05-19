import { createServer } from "node:http";
import { env } from "@edagent/config";
import { demoSnapshot } from "@edagent/domain";
import { htmlPage } from "@edagent/shared";

type DashboardModel = {
  databaseReady: boolean;
  summary: {
    industries: number;
    companies: number;
    contacts: number;
    jobs: number;
  };
  settingsCount: number;
  topCompanies: Array<{
    name: string;
    region: string;
    stage: string;
    score: number;
  }>;
};

async function loadDashboardModel(): Promise<DashboardModel> {
  try {
    const [healthResponse, bootstrapResponse] = await Promise.all([
      fetch(`${env.API_BASE_URL}/health`),
      fetch(`${env.API_BASE_URL}/platform/bootstrap`)
    ]);

    if (!healthResponse.ok || !bootstrapResponse.ok) {
      throw new Error("Dashboard upstream is unavailable.");
    }

    const health = (await healthResponse.json()) as {
      databaseReady?: boolean;
    };
    const bootstrap = (await bootstrapResponse.json()) as {
      summary: DashboardModel["summary"];
      data: {
        companies: Array<{
          id: string;
          name: string;
          region: string;
          stage: string;
        }>;
        scores: Array<{
          companyId: string;
          total: number;
        }>;
        settings: Array<{
          key: string;
          value: string;
        }>;
      };
    };

    return {
      databaseReady: health.databaseReady === true,
      summary: bootstrap.summary,
      settingsCount: bootstrap.data.settings.length,
      topCompanies: bootstrap.data.companies
        .map((company) => ({
          name: company.name,
          region: company.region,
          stage: company.stage,
          score: bootstrap.data.scores.find((score) => score.companyId === company.id)?.total ?? 0
        }))
        .sort((left, right) => right.score - left.score)
        .slice(0, 5)
    };
  } catch {
    return {
      databaseReady: false,
      summary: {
        industries: demoSnapshot.industries.length,
        companies: demoSnapshot.companies.length,
        contacts: demoSnapshot.contacts.length,
        jobs: demoSnapshot.jobs.length
      },
      settingsCount: demoSnapshot.settings.length,
      topCompanies: demoSnapshot.companies
        .map((company) => ({
          name: company.name,
          region: company.region,
          stage: company.stage,
          score: demoSnapshot.scores.find((score) => score.companyId === company.id)?.total ?? 0
        }))
        .sort((left, right) => right.score - left.score)
        .slice(0, 5)
    };
  }
}

function renderDashboard(model: DashboardModel): string {
  const statusBadge = model.databaseReady
    ? '<span class="pill">Database Connected</span>'
    : '<span class="pill" style="background:#f3dfd5;color:#9a4d1d;">Fallback Mode</span>';

  return htmlPage(
    "EdAgent Dashboard",
    `
      <section class="hero">
        ${statusBadge}
        <h1>RH AI memory and EdAgent</h1>
        <p>
          Admin shell for industry analysis, partner discovery, outreach ops, audit
          visibility and job orchestration.
        </p>
      </section>

      <section class="grid">
        <article class="card">
          <div class="kpi">${model.summary.industries}</div>
          <h2>Priority Industries</h2>
          <p>Approved areas ready for partner search.</p>
        </article>
        <article class="card">
          <div class="kpi">${model.summary.companies}</div>
          <h2>Company Pool</h2>
          <p>Companies currently tracked in the platform.</p>
        </article>
        <article class="card">
          <div class="kpi">${model.summary.jobs}</div>
          <h2>Background Jobs</h2>
          <p>Runtime queue footprint for ingestion and outreach tasks.</p>
        </article>
        <article class="card">
          <div class="kpi">${model.settingsCount}</div>
          <h2>System Settings</h2>
          <p>Editable operational controls already persisted.</p>
        </article>
      </section>

      <section class="card" style="margin-top: 18px;">
        <h2>Top Companies</h2>
        <p>Preview of shortlisted accounts and their current score.</p>
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Region</th>
              <th>Stage</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            ${model.topCompanies
              .map(
                (company) => `
                  <tr>
                    <td>${company.name}</td>
                    <td>${company.region}</td>
                    <td>${company.stage}</td>
                    <td>${company.score}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </section>

      <section class="card" style="margin-top: 18px;">
        <h2>Foundation Scope</h2>
        <p>
          Current shell exposes the platform shape for <code>auth</code>,
          <code>audit logs</code>, <code>system settings</code>,
          <code>company scoring</code> and <code>job tracking</code>.
        </p>
      </section>
    `
  );
}

function main(): void {
  const server = createServer((_, res) => {
    void (async () => {
      const model = await loadDashboardModel();
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderDashboard(model));
    })();
  });

  server.listen(env.PORT, () => {
    console.log(`[web] dashboard shell is listening on port ${env.PORT}`);
  });
}

main();
