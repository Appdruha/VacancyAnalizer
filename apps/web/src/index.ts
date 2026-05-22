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
    vacancies: number;
    sources: number;
    ingestionRuns: number;
    shortlisted: number;
    drafts: number;
    approvedDrafts: number;
    campaigns: number;
    messages: number;
    replies: number;
    escalatedReplies: number;
    agreements: number;
    briefs: number;
    memoryEvents: number;
  };
  settingsCount: number;
  vacancyPreview: Array<{
    title: string;
    companyName: string;
    source: string;
    competencyCount: number;
  }>;
  sourcePreview: Array<{
    source: string;
    status: string;
    industryId: string;
    query: string;
  }>;
  ingestionPreview: Array<{
    sourceId: string;
    status: string;
    query: string;
    processedCount: number;
    competencyCount: number;
  }>;
  competencyGaps: Array<{
    competencyName: string;
    category: string;
    programCoverage: number;
    marketDemand: number;
    gapScore: number;
  }>;
  shortlistPreview: Array<{
    name: string;
    region: string;
    stage: string;
    total: number;
    competencyFit: number;
    reputation: number;
    educationReadiness: number;
    contactCount: number;
  }>;
  draftPreview: Array<{
    subject: string;
    tone: string;
    approved: boolean;
    updatedAt: string;
  }>;
  messagePreview: Array<{
    subject: string;
    status: string;
    kind: string;
    followUpDueAt: string;
  }>;
  replyPreview: Array<{
    category: string;
    positive: boolean;
    escalated: boolean;
    createdAt: string;
  }>;
  projectPreview: Array<{
    title: string;
    companyName: string;
    agreementStatus: string;
    roleCount: number;
  }>;
  memoryOverview: {
    eventCount: number;
    replyCount: number;
    recommendedTone: string;
    recommendedFollowUpDays: number;
    confidence: number;
    topEventTypes: string[];
  };
  mlOverview: {
    status: string;
    engine: string;
    itemsEvaluated: number;
    averageConfidence: number;
    recommendedChanges: number;
  };
};

async function loadDashboardModel(): Promise<DashboardModel> {
  try {
    const [
      healthResponse,
      bootstrapResponse,
      gapResponse,
      shortlistResponse,
      draftsResponse,
      campaignsResponse,
      messagesResponse,
      repliesResponse,
      projectCatalogResponse,
      memoryOverviewResponse,
      mlHealthResponse,
      mlEvaluationResponse
    ] = await Promise.all([
      fetch(`${env.API_BASE_URL}/health`),
      fetch(`${env.API_BASE_URL}/platform/bootstrap`),
      fetch(`${env.API_BASE_URL}/analytics/competency-gap`),
      fetch(`${env.API_BASE_URL}/companies/shortlist?limit=6`),
      fetch(`${env.API_BASE_URL}/drafts`),
      fetch(`${env.API_BASE_URL}/campaigns`),
      fetch(`${env.API_BASE_URL}/messages`),
      fetch(`${env.API_BASE_URL}/replies`),
      fetch(`${env.API_BASE_URL}/projects/catalog`),
      fetch(`${env.API_BASE_URL}/memory/overview`),
      fetch(`${env.API_BASE_URL}/ml/health`),
      fetch(`${env.API_BASE_URL}/ml/evaluations/run`, { method: "POST" })
    ]);

    if (
      !healthResponse.ok ||
      !bootstrapResponse.ok ||
      !gapResponse.ok ||
      !shortlistResponse.ok ||
      !draftsResponse.ok ||
      !campaignsResponse.ok ||
      !messagesResponse.ok ||
      !repliesResponse.ok ||
      !projectCatalogResponse.ok ||
      !memoryOverviewResponse.ok ||
      !mlHealthResponse.ok ||
      !mlEvaluationResponse.ok
    ) {
      throw new Error("Dashboard upstream is unavailable.");
    }

    const health = (await healthResponse.json()) as {
      databaseReady?: boolean;
    };
    const bootstrap = (await bootstrapResponse.json()) as {
      summary: {
        industries: number;
        companies: number;
        contacts: number;
        jobs: number;
      };
      data: {
        vacancies: Array<{
          title: string;
          companyName: string;
          source: string;
          competencyIds: string[];
        }>;
        sources: Array<{
          industryId: string;
          source: string;
          status: string;
          config?: Record<string, string | number | boolean | null>;
        }>;
        ingestionRuns: Array<{
          sourceId: string;
          status: string;
          query: string;
          processedCount: number;
          competencyCount: number;
        }>;
        settings: Array<{
          key: string;
          value: string;
        }>;
        agreements?: Array<unknown>;
        briefs?: Array<unknown>;
      };
    };
    const gaps = (await gapResponse.json()) as {
      items: DashboardModel["competencyGaps"];
    };
    const shortlist = (await shortlistResponse.json()) as {
      items: Array<{
        name: string;
        region: string;
        stage: string;
        contacts: Array<unknown>;
        score: {
          total: number;
          competencyFit: number;
          reputation: number;
          educationReadiness: number;
        } | null;
      }>;
    };
    const drafts = (await draftsResponse.json()) as {
      items: Array<{
        subject: string;
        tone: string;
        approved: boolean;
        updatedAt: string;
      }>;
    };
    const campaigns = (await campaignsResponse.json()) as {
      items: Array<{
        id: string;
      }>;
    };
    const messages = (await messagesResponse.json()) as {
      items: Array<{
        subject: string;
        status: string;
        kind: string;
        followUpDueAt?: string;
      }>;
    };
    const replies = (await repliesResponse.json()) as {
      items: Array<{
        category: string;
        positive: boolean;
        escalated: boolean;
        createdAt: string;
      }>;
    };
    const projectCatalog = (await projectCatalogResponse.json()) as {
      items: Array<{
        title: string;
        companyName: string;
        agreementStatus: string;
        roles: Array<unknown>;
      }>;
    };
    const memoryOverview = (await memoryOverviewResponse.json()) as {
      eventCount: number;
      replyCount: number;
      topEventTypes: Array<{
        eventType: string;
        count: number;
      }>;
      recommendation: {
        recommendedTone: string;
        recommendedFollowUpDays: number;
        confidence: number;
      };
    };
    const mlHealth = (await mlHealthResponse.json()) as {
      status: string;
      service: string;
      version: string;
    };
    const mlEvaluation = (await mlEvaluationResponse.json()) as {
      engine: string;
      itemsEvaluated: number;
      averageConfidence: number;
      recommendedChanges: number;
    };

    return {
      databaseReady: health.databaseReady === true,
      summary: {
        ...bootstrap.summary,
        vacancies: bootstrap.data.vacancies.length,
        sources: bootstrap.data.sources.length,
        ingestionRuns: bootstrap.data.ingestionRuns.length,
        shortlisted: shortlist.items.length,
        drafts: drafts.items.length,
        approvedDrafts: drafts.items.filter((item) => item.approved).length,
        campaigns: campaigns.items.length,
        messages: messages.items.length,
        replies: replies.items.length,
        escalatedReplies: replies.items.filter((item) => item.escalated).length,
        agreements: bootstrap.data.agreements?.length ?? 0,
        briefs: bootstrap.data.briefs?.length ?? 0,
        memoryEvents: memoryOverview.eventCount
      },
      settingsCount: bootstrap.data.settings.length,
      vacancyPreview: bootstrap.data.vacancies.slice(0, 6).map((vacancy) => ({
        title: vacancy.title,
        companyName: vacancy.companyName,
        source: vacancy.source,
        competencyCount: vacancy.competencyIds.length
      })),
      sourcePreview: bootstrap.data.sources.slice(0, 6).map((source) => ({
        source: source.source,
        status: source.status,
        industryId: source.industryId,
        query: String(source.config?.query ?? "not set")
      })),
      ingestionPreview: bootstrap.data.ingestionRuns.slice(0, 6).map((run) => ({
        sourceId: run.sourceId,
        status: run.status,
        query: run.query,
        processedCount: run.processedCount,
        competencyCount: run.competencyCount
      })),
      competencyGaps: [...gaps.items]
        .sort((left, right) => right.gapScore - left.gapScore || right.marketDemand - left.marketDemand)
        .slice(0, 6),
      shortlistPreview: shortlist.items.map((company) => ({
        name: company.name,
        region: company.region,
        stage: company.stage,
        total: company.score?.total ?? 0,
        competencyFit: company.score?.competencyFit ?? 0,
        reputation: company.score?.reputation ?? 0,
        educationReadiness: company.score?.educationReadiness ?? 0,
        contactCount: company.contacts.length
      })),
      draftPreview: drafts.items.slice(0, 6),
      messagePreview: messages.items.slice(0, 6).map((message) => ({
        subject: message.subject,
        status: message.status,
        kind: message.kind,
        followUpDueAt: message.followUpDueAt ?? "-"
      })),
      replyPreview: replies.items.slice(0, 6),
      projectPreview: projectCatalog.items.slice(0, 6).map((project) => ({
        title: project.title,
        companyName: project.companyName,
        agreementStatus: project.agreementStatus,
        roleCount: project.roles.length
      })),
      memoryOverview: {
        eventCount: memoryOverview.eventCount,
        replyCount: memoryOverview.replyCount,
        recommendedTone: memoryOverview.recommendation.recommendedTone,
        recommendedFollowUpDays: memoryOverview.recommendation.recommendedFollowUpDays,
        confidence: memoryOverview.recommendation.confidence,
        topEventTypes: memoryOverview.topEventTypes.map((item) => `${item.eventType} (${item.count})`)
      },
      mlOverview: {
        status: mlHealth.status,
        engine: mlEvaluation.engine,
        itemsEvaluated: mlEvaluation.itemsEvaluated,
        averageConfidence: mlEvaluation.averageConfidence,
        recommendedChanges: mlEvaluation.recommendedChanges
      }
    };
  } catch {
    return {
      databaseReady: false,
      summary: {
        industries: demoSnapshot.industries.length,
        companies: demoSnapshot.companies.length,
        contacts: demoSnapshot.contacts.length,
        jobs: demoSnapshot.jobs.length,
        vacancies: demoSnapshot.vacancies.length,
        sources: demoSnapshot.sources.length,
        ingestionRuns: demoSnapshot.ingestionRuns.length,
        shortlisted: demoSnapshot.companies.filter((company) => company.stage === "shortlisted").length,
        drafts: demoSnapshot.drafts.length,
        approvedDrafts: demoSnapshot.drafts.filter((draft) => draft.approved).length,
        campaigns: demoSnapshot.campaigns.length,
        messages: demoSnapshot.messages.length,
        replies: demoSnapshot.replies.length,
        escalatedReplies: demoSnapshot.replies.filter((reply) => reply.escalated).length,
        agreements: demoSnapshot.agreements.length,
        briefs: demoSnapshot.briefs.length,
        memoryEvents: demoSnapshot.memoryEvents.length
      },
      settingsCount: demoSnapshot.settings.length,
      vacancyPreview: demoSnapshot.vacancies.slice(0, 6).map((vacancy) => ({
        title: vacancy.title,
        companyName: vacancy.companyName,
        source: vacancy.source,
        competencyCount: vacancy.competencyIds.length
      })),
      sourcePreview: demoSnapshot.sources.slice(0, 6).map((source) => ({
        source: source.source,
        status: source.status,
        industryId: source.industryId,
        query: String(source.config?.query ?? "not set")
      })),
      ingestionPreview: demoSnapshot.ingestionRuns.slice(0, 6).map((run) => ({
        sourceId: run.sourceId,
        status: run.status,
        query: run.query,
        processedCount: run.processedCount,
        competencyCount: run.competencyCount
      })),
      competencyGaps: [
        {
          competencyName: "TypeScript",
          category: "engineering",
          programCoverage: 78,
          marketDemand: 1,
          gapScore: 0
        },
        {
          competencyName: "Prompt Engineering",
          category: "ai",
          programCoverage: 0,
          marketDemand: 1,
          gapScore: 10
        }
      ],
      shortlistPreview: demoSnapshot.companies
        .map((company) => ({
          name: company.name,
          region: company.region,
          stage: company.stage,
          total: demoSnapshot.scores.find((score) => score.companyId === company.id)?.total ?? 0,
          competencyFit: demoSnapshot.scores.find((score) => score.companyId === company.id)?.competencyFit ?? 0,
          reputation: demoSnapshot.scores.find((score) => score.companyId === company.id)?.reputation ?? 0,
          educationReadiness:
            demoSnapshot.scores.find((score) => score.companyId === company.id)?.educationReadiness ?? 0,
          contactCount: demoSnapshot.contacts.filter((contact) => contact.companyId === company.id).length
        }))
        .filter((company) => company.total >= 75)
        .slice(0, 6),
      draftPreview: demoSnapshot.drafts.slice(0, 6).map((draft) => ({
        subject: draft.subject,
        tone: draft.tone,
        approved: draft.approved,
        updatedAt: draft.updatedAt
      })),
      messagePreview: demoSnapshot.messages.slice(0, 6).map((message) => ({
        subject: message.subject,
        status: message.status,
        kind: message.kind,
        followUpDueAt: message.followUpDueAt ?? "-"
      })),
      replyPreview: demoSnapshot.replies.slice(0, 6).map((reply) => ({
        category: reply.category,
        positive: reply.positive,
        escalated: reply.escalated,
        createdAt: reply.createdAt
      })),
      projectPreview: demoSnapshot.briefs.slice(0, 6).map((brief) => ({
        title: brief.title,
        companyName: "Demo Partner",
        agreementStatus: "aligned",
        roleCount: brief.roles.length
      })),
      memoryOverview: {
        eventCount: demoSnapshot.memoryEvents.length,
        replyCount: demoSnapshot.replies.length,
        recommendedTone: "formal",
        recommendedFollowUpDays: 10,
        confidence: 0.25,
        topEventTypes: demoSnapshot.memoryEvents.map((item) => item.eventType)
      },
      mlOverview: {
        status: "fallback",
        engine: "ts-baseline-only",
        itemsEvaluated: 0,
        averageConfidence: 0,
        recommendedChanges: 0
      }
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
          Industry analysis workspace for vacancy ingestion, competency extraction,
          gap visibility and operator review.
        </p>
      </section>

      <section class="grid">
        <article class="card">
          <div class="kpi">${model.summary.industries}</div>
          <h2>Priority Industries</h2>
          <p>Approved domains ready for market analysis.</p>
        </article>
        <article class="card">
          <div class="kpi">${model.summary.vacancies}</div>
          <h2>Vacancies Ingested</h2>
          <p>Live vacancy set collected from HH ingestion.</p>
        </article>
        <article class="card">
          <div class="kpi">${model.summary.companies}</div>
          <h2>Company Pool</h2>
          <p>Discovered companies available for scoring and review.</p>
        </article>
        <article class="card">
          <div class="kpi">${model.summary.drafts}</div>
          <h2>Draft Versions</h2>
          <p>Stored communication drafts with review history.</p>
        </article>
        <article class="card">
          <div class="kpi">${model.summary.messages}</div>
          <h2>Messages Sent</h2>
          <p>Outreach runtime with delivery and follow-up visibility.</p>
        </article>
        <article class="card">
          <div class="kpi">${model.summary.replies}</div>
          <h2>Replies Captured</h2>
          <p>Incoming replies classified and routed in the pipeline.</p>
        </article>
        <article class="card">
          <div class="kpi">${model.summary.briefs}</div>
          <h2>Project Briefs</h2>
          <p>Generated partner-backed briefs ready for the student catalog.</p>
        </article>
        <article class="card">
          <div class="kpi">${model.summary.memoryEvents}</div>
          <h2>Memory Events</h2>
          <p>Agent action history available for retrieval and adaptive recommendations.</p>
        </article>
      </section>

      <section class="grid" style="margin-top: 18px;">
        <article class="card">
          <h2>HH Sources</h2>
          <p>LinkedIn is intentionally left as a placeholder in this phase.</p>
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Status</th>
                <th>Industry</th>
                <th>Query</th>
              </tr>
            </thead>
            <tbody>
              ${model.sourcePreview
                .map(
                  (source) => `
                    <tr>
                      <td>${source.source}</td>
                      <td>${source.status}</td>
                      <td>${source.industryId}</td>
                      <td>${source.query}</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </article>

        <article class="card">
          <h2>Latest Runs</h2>
          <p>Most recent ingestion runs and extracted competency volume.</p>
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Query</th>
                <th>Vacancies</th>
                <th>Competencies</th>
              </tr>
            </thead>
            <tbody>
              ${model.ingestionPreview
                .map(
                  (run) => `
                    <tr>
                      <td>${run.status}</td>
                      <td>${run.query}</td>
                      <td>${run.processedCount}</td>
                      <td>${run.competencyCount}</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </article>
      </section>

      <section class="grid" style="margin-top: 18px;">
        <article class="card">
          <h2>Shortlist</h2>
          <p>Top companies ranked by current scoring v1.</p>
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Region</th>
                <th>Stage</th>
                <th>Total</th>
                <th>Contacts</th>
              </tr>
            </thead>
            <tbody>
              ${model.shortlistPreview
                .map(
                  (company) => `
                    <tr>
                      <td>${company.name}</td>
                      <td>${company.region}</td>
                      <td>${company.stage}</td>
                      <td>${company.total}</td>
                      <td>${company.contactCount}</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </article>

        <article class="card">
          <h2>Draft Review</h2>
          <p>Latest generated drafts and their approval state.</p>
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Tone</th>
                <th>Approved</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              ${model.draftPreview
                .map(
                  (draft) => `
                    <tr>
                      <td>${draft.subject}</td>
                      <td>${draft.tone}</td>
                      <td>${draft.approved ? "approved" : "pending"}</td>
                      <td>${draft.updatedAt}</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </article>
      </section>

      <section class="grid" style="margin-top: 18px;">
        <article class="card">
          <h2>Vacancy Feed</h2>
          <p>Latest vacancies available for review and downstream scoring.</p>
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Company</th>
                <th>Source</th>
                <th>Competencies</th>
              </tr>
            </thead>
            <tbody>
              ${model.vacancyPreview
                .map(
                  (vacancy) => `
                    <tr>
                      <td>${vacancy.title}</td>
                      <td>${vacancy.companyName}</td>
                      <td>${vacancy.source}</td>
                      <td>${vacancy.competencyCount}</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </article>

        <article class="card">
          <h2>Competency Gaps</h2>
          <p>Highest market-vs-program gaps right now.</p>
          <table>
            <thead>
              <tr>
                <th>Competency</th>
                <th>Category</th>
                <th>Coverage</th>
                <th>Demand</th>
                <th>Gap</th>
              </tr>
            </thead>
            <tbody>
              ${model.competencyGaps
                .map(
                  (gap) => `
                    <tr>
                      <td>${gap.competencyName}</td>
                      <td>${gap.category}</td>
                      <td>${gap.programCoverage}</td>
                      <td>${gap.marketDemand}</td>
                      <td>${gap.gapScore}</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </article>
      </section>

      <section class="grid" style="margin-top: 18px;">
        <article class="card">
          <h2>Outreach Runtime</h2>
          <p>Campaign, delivery and follow-up state for the latest messages.</p>
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Status</th>
                <th>Kind</th>
                <th>Follow-up Due</th>
              </tr>
            </thead>
            <tbody>
              ${model.messagePreview
                .map(
                  (message) => `
                    <tr>
                      <td>${message.subject}</td>
                      <td>${message.status}</td>
                      <td>${message.kind}</td>
                      <td>${message.followUpDueAt}</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </article>

        <article class="card">
          <h2>Reply Queue</h2>
          <p>Positive replies are escalated into the human follow-up workflow.</p>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Positive</th>
                <th>Escalated</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              ${model.replyPreview
                .map(
                  (reply) => `
                    <tr>
                      <td>${reply.category}</td>
                      <td>${reply.positive ? "yes" : "no"}</td>
                      <td>${reply.escalated ? "yes" : "no"}</td>
                      <td>${reply.createdAt}</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </article>
      </section>

      <section class="card" style="margin-top: 18px;">
        <h2>Project Catalog</h2>
        <p>Phase 6 catalog built from partner agreements and generated briefs.</p>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Company</th>
              <th>Agreement</th>
              <th>Roles</th>
            </tr>
          </thead>
          <tbody>
            ${model.projectPreview
              .map(
                (project) => `
                  <tr>
                    <td>${project.title}</td>
                    <td>${project.companyName}</td>
                    <td>${project.agreementStatus}</td>
                    <td>${project.roleCount}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </section>

      <section class="card" style="margin-top: 18px;">
        <h2>Memory Layer</h2>
        <p>
          The agent now stores a retrieval-ready event log and adapts outreach behavior
          from historical outcomes.
        </p>
        <table>
          <tbody>
            <tr>
              <th>Events</th>
              <td>${model.memoryOverview.eventCount}</td>
            </tr>
            <tr>
              <th>Replies</th>
              <td>${model.memoryOverview.replyCount}</td>
            </tr>
            <tr>
              <th>Recommended Tone</th>
              <td>${model.memoryOverview.recommendedTone}</td>
            </tr>
            <tr>
              <th>Follow-up Days</th>
              <td>${model.memoryOverview.recommendedFollowUpDays}</td>
            </tr>
            <tr>
              <th>Confidence</th>
              <td>${model.memoryOverview.confidence}</td>
            </tr>
            <tr>
              <th>Top Events</th>
              <td>${model.memoryOverview.topEventTypes.join(", ") || "-"}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="card" style="margin-top: 18px;">
        <h2>Phase 7 Outcome</h2>
        <p>
          The platform now remembers outreach and partnership history, retrieves
          it through API, and uses it to recommend tone and follow-up cadence for
          the next interaction.
        </p>
      </section>

      <section class="card" style="margin-top: 18px;">
        <h2>Phase 8 ML Hardening</h2>
        <p>
          A separate Python recommender now evaluates the memory strategy against
          the current TS baseline and can be used as a remote recommendation engine.
        </p>
        <table>
          <tbody>
            <tr>
              <th>Status</th>
              <td>${model.mlOverview.status}</td>
            </tr>
            <tr>
              <th>Engine</th>
              <td>${model.mlOverview.engine}</td>
            </tr>
            <tr>
              <th>Items Evaluated</th>
              <td>${model.mlOverview.itemsEvaluated}</td>
            </tr>
            <tr>
              <th>Average Confidence</th>
              <td>${model.mlOverview.averageConfidence}</td>
            </tr>
            <tr>
              <th>Recommended Changes</th>
              <td>${model.mlOverview.recommendedChanges}</td>
            </tr>
          </tbody>
        </table>
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
