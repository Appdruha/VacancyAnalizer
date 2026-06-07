import { useState, type FormEvent } from "react";
import {
  approveDraftAction,
  bootstrapIndustry,
  createAgreementAction,
  enqueueCompanyDiscovery,
  enqueueHhIngestion,
  generateBriefAction,
  generateDraftAction,
  generateMaterialsAction,
  logReplyOutcomeAction,
  runFollowUpsAction,
  sendCampaignAction,
  simulateReplyAction,
  updateAgreementStatusAction,
  updateCompanyStageAction
} from "../api.js";
import { getToken } from "../session.js";
import type { DashboardData } from "../types.js";
import { Panel } from "./Panel.js";

type ActionPanelProps = {
  data: DashboardData;
  onRefresh: () => Promise<void>;
};

type ActionStatus = {
  tone: "neutral" | "error" | "success";
  message: string;
};

type WorkflowStep = {
  id: string;
  number: number;
  title: string;
  description: string;
  state: "done" | "active" | "pending";
  result: string;
};

function defaultCompetencyTemplate(): string {
  return ["TypeScript|program|0.9", "Product analytics|program|0.8", "AI workflows|program|0.7"].join("\n");
}

function parseCompetencyLines(raw: string): Array<{ name: string; category?: string; coverageScore: number }> {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((part) => part.trim());
      const name = parts[0] ?? "";
      const category = parts[1] ?? "";
      const coverage = parts[2] ?? "";
      return {
        name,
        ...(category ? { category } : {}),
        coverageScore: Number(coverage || "0")
      };
    })
    .filter((item) => item.name.length > 0 && Number.isFinite(item.coverageScore));
}

function buildWorkflowSteps(data: DashboardData): WorkflowStep[] {
  const hasBootstrap = data.bootstrap.data.industries.length > 0;
  const hasIngestion = data.bootstrap.data.ingestionRuns.length > 0;
  const hasCompanies = data.companies.items.length > 0;
  const hasDrafts = data.drafts.items.length > 0;
  const hasMessages = data.messages.items.length > 0;
  const hasReplies = data.replies.items.length > 0;
  const hasAgreements = data.agreements.items.length > 0;
  const hasBriefs = data.briefs.items.length > 0;
  const hasMaterials = data.communicationPackages.items.length > 0;

  return [
    {
      id: "bootstrap",
      number: 1,
      title: "Подготовка индустрии",
      description: "Создаём индустрию, профиль программы и подключаем источник HH.",
      state: hasBootstrap ? "done" : "active",
      result: hasBootstrap
        ? `${data.bootstrap.data.industries[0]?.name ?? "Индустрия"} подключена, источник HH активен.`
        : "Сначала нужно создать индустрию и компетенции программы."
    },
    {
      id: "market",
      number: 2,
      title: "Анализ вакансий",
      description: "Загружаем рынок вакансий, извлекаем компетенции и считаем gap analysis.",
      state: hasIngestion ? "done" : hasBootstrap ? "active" : "pending",
      result: hasIngestion
        ? `Последний ingestion: ${data.bootstrap.data.ingestionRuns[0]?.processedCount ?? 0} вакансий, ${data.bootstrap.data.ingestionRuns[0]?.competencyCount ?? 0} competency signals.`
        : "После bootstrap запусти HH ingestion."
    },
    {
      id: "companies",
      number: 3,
      title: "Поиск компаний",
      description: "Строим пул компаний по vacancy intelligence и формируем shortlist.",
      state: hasCompanies ? "done" : hasIngestion ? "active" : "pending",
      result: hasCompanies
        ? `Найдено компаний: ${data.companies.items.length}, в shortlist: ${data.shortlist.items.length}.`
        : "Когда вакансии загружены, можно искать компании."
    },
    {
      id: "outreach",
      number: 4,
      title: "Коммуникация",
      description: "Генерируем draft, подтверждаем его и запускаем outreach campaign.",
      state: hasMessages ? "done" : hasCompanies ? "active" : "pending",
      result: hasMessages
        ? `Есть ${data.messages.items.length} сообщений и ${data.drafts.items.filter((item) => item.approved).length} подтверждённых drafts.`
        : hasDrafts
          ? "Draft уже есть, теперь его нужно подтвердить и отправить."
          : "После shortlist можно переходить к draft и campaign."
    },
    {
      id: "reply",
      number: 5,
      title: "Ответ и outcome",
      description: "Получаем reply, квалифицируем его и фиксируем результат коммуникации.",
      state: hasReplies ? "done" : hasMessages ? "active" : "pending",
      result: hasReplies
        ? `Получено replies: ${data.replies.items.length}, эскалировано: ${data.replies.items.filter((item) => item.escalated).length}.`
        : "После отправки campaign можно симулировать reply."
    },
    {
      id: "project",
      number: 6,
      title: "Соглашение и проект",
      description: "Создаём agreement, project brief и communication materials.",
      state: hasBriefs || hasMaterials ? "done" : hasReplies ? "active" : "pending",
      result: hasAgreements || hasBriefs || hasMaterials
        ? `Agreements: ${data.agreements.items.length}, briefs: ${data.briefs.items.length}, materials: ${data.communicationPackages.items.length}.`
        : "Финальный шаг — договорённость, brief и материалы."
    }
  ];
}

export function ActionPanel({ data, onRefresh }: ActionPanelProps) {
  const [status, setStatus] = useState<ActionStatus>({
    tone: "neutral",
    message: "Иди по шагам слева направо: сначала источник, потом вакансии, компании, коммуникация и проектные артефакты."
  });

  async function runAction(action: () => Promise<void>, successMessage: string) {
    setStatus({ tone: "neutral", message: "Выполняется действие..." });
    try {
      await action();
      await onRefresh();
      setStatus({ tone: "success", message: successMessage });
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Ошибка выполнения действия."
      });
    }
  }

  function requireToken(): string {
    const token = getToken();
    if (!token) {
      throw new Error("Токен авторизации отсутствует.");
    }
    return token;
  }

  async function handleBootstrap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const token = requireToken();
    const competencies = parseCompetencyLines(String(form.get("competencies") ?? ""));

    await runAction(
      () =>
        bootstrapIndustry(
          {
            industryName: String(form.get("industryName") ?? ""),
            priority: Number(form.get("priority") ?? "1"),
            query: String(form.get("query") ?? ""),
            area: String(form.get("area") ?? "1"),
            perPage: Number(form.get("perPage") ?? "20"),
            programName: String(form.get("programName") ?? ""),
            competencies
          },
          token
        ).then(() => undefined),
      "Индустрия создана, программа привязана, источник HH подключён."
    );
  }

  async function handleIngestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const token = requireToken();
    await runAction(
      () =>
        enqueueHhIngestion(
          {
            industryId: String(form.get("industryId") ?? ""),
            query: String(form.get("query") ?? ""),
            area: String(form.get("area") ?? "1"),
            perPage: Number(form.get("perPage") ?? "20"),
            page: 0
          },
          token
        ).then(() => undefined),
      "HH ingestion поставлен в очередь. Через несколько секунд обновятся вакансии и gap analysis."
    );
  }

  async function handleDiscovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const token = requireToken();
    await runAction(
      () =>
        enqueueCompanyDiscovery(
          {
            industryId: String(form.get("industryId") ?? ""),
            limit: Number(form.get("limit") ?? "20")
          },
          token
        ).then(() => undefined),
      "Поиск компаний поставлен в очередь. После обновления появятся компании и shortlist."
    );
  }

  async function handleDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const token = requireToken();
    await runAction(
      () =>
        generateDraftAction(
          {
            companyId: String(form.get("companyId") ?? ""),
            tone: String(form.get("tone") ?? "formal") as "formal" | "neutral" | "friendly",
            kind: String(form.get("kind") ?? "outreach-email") as "outreach-email" | "follow-up-email"
          },
          token
        ).then(() => undefined),
      "Новый draft создан. Теперь его можно подтвердить."
    );
  }

  async function handleDraftApproval(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const token = requireToken();
    await runAction(
      () =>
        approveDraftAction(
          String(form.get("draftId") ?? ""),
          String(form.get("approved") ?? "true") === "true",
          token
        ).then(() => undefined),
      "Статус draft обновлён. Если он подтверждён, его можно отправлять в campaign."
    );
  }

  async function handleCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const token = requireToken();
    const draftIds = form.getAll("draftIds").map((value) => String(value));
    await runAction(
      () =>
        sendCampaignAction(
          {
            name: String(form.get("name") ?? "Pilot outreach"),
            draftIds
          },
          token
        ).then(() => undefined),
      "Campaign запущена. После обновления появятся сообщение и message events."
    );
  }

  async function handleSimulateReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const token = requireToken();
    const incomingFrom = String(form.get("incomingFrom") ?? "");
    await runAction(
      () =>
        simulateReplyAction(
          {
            messageId: String(form.get("messageId") ?? ""),
            body: String(form.get("body") ?? ""),
            ...(incomingFrom ? { incomingFrom } : {})
          },
          token
        ).then(() => undefined),
      "Reply поставлен в очередь. После обновления появится входящий ответ."
    );
  }

  async function handleReplyOutcome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const token = requireToken();
    const notes = String(form.get("notes") ?? "");
    await runAction(
      () =>
        logReplyOutcomeAction(
          String(form.get("replyId") ?? ""),
          {
            outcome: String(form.get("outcome") ?? "meeting_scheduled") as
              | "meeting_scheduled"
              | "pilot_agreed"
              | "follow_up_needed"
              | "declined_after_call",
            ...(notes ? { notes } : {})
          },
          token
        ).then(() => undefined),
      "Результат общения сохранён и записан в память системы."
    );
  }

  async function handleAgreementCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const token = requireToken();
    await runAction(
      () =>
        createAgreementAction(
          {
            companyId: String(form.get("companyId") ?? ""),
            status: String(form.get("status") ?? "draft")
          },
          token
        ).then(() => undefined),
      "Соглашение создано. Теперь можно генерировать project brief."
    );
  }

  async function handleBriefGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const token = requireToken();
    await runAction(
      () =>
        generateBriefAction(
          {
            partnerAgreementId: String(form.get("partnerAgreementId") ?? ""),
            title: String(form.get("title") ?? "")
          },
          token
        ).then(() => undefined),
      "Project brief сгенерирован."
    );
  }

  async function handleMaterialsGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const token = requireToken();
    const partnerAgreementId = String(form.get("partnerAgreementId") ?? "");
    await runAction(
      () =>
        generateMaterialsAction(
          {
            companyId: String(form.get("companyId") ?? ""),
            ...(partnerAgreementId ? { partnerAgreementId } : {})
          },
          token
        ).then(() => undefined),
      "Коммуникационные материалы сгенерированы."
    );
  }

  async function handleRunFollowUps(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = requireToken();
    await runAction(() => runFollowUpsAction(token).then(() => undefined), "Follow-up scheduler поставлен в очередь.");
  }

  async function handleStageUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const token = requireToken();
    await runAction(
      () =>
        updateCompanyStageAction(
          String(form.get("companyId") ?? ""),
          String(form.get("stage") ?? ""),
          token
        ).then(() => undefined),
      "Этап компании обновлён."
    );
  }

  async function handleAgreementStatusUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const token = requireToken();
    await runAction(
      () =>
        updateAgreementStatusAction(
          String(form.get("agreementId") ?? ""),
          String(form.get("status") ?? "aligned"),
          token
        ).then(() => undefined),
      "Статус соглашения обновлён."
    );
  }

  const industries = data.bootstrap.data.industries;
  const companies = data.companies.items;
  const allDrafts = data.drafts.items;
  const approvedDrafts = allDrafts.filter((item) => item.approved);
  const messages = data.messages.items;
  const replies = data.replies.items;
  const agreements = data.agreements.items;
  const steps = buildWorkflowSteps(data);
  const latestRun = data.bootstrap.data.ingestionRuns[0];
  const latestDraft = allDrafts[0];
  const latestApprovedDraft = approvedDrafts[0];
  const latestMessage = messages[0];
  const latestReply = replies[0];
  const latestAgreement = agreements[0];

  return (
    <div className="span-12">
      <Panel
        title="Пошаговый сценарий"
        subtitle="Главный экран теперь ведёт по основному e2e-флоу: от индустрии и вакансий до reply, agreement и project brief."
      >
        <div className="status-banner" data-tone={status.tone}>
          {status.message}
        </div>

        <div className="workflow-progress">
          {steps.map((step) => (
            <div key={step.id} className="workflow-step" data-state={step.state}>
              <div className="workflow-step-number">{step.number}</div>
              <div className="workflow-step-body">
                <strong>{step.title}</strong>
                <p>{step.description}</p>
                <span>{step.result}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="workflow-stack">
          <section className="workflow-phase">
            <div className="workflow-phase-header">
              <span className="pill">Шаг 1</span>
              <div>
                <h3>Подготовка индустрии</h3>
                <p>Создай базовую индустрию, привяжи программу и настрой контекст HH-поиска.</p>
              </div>
            </div>
            <div className="workflow-phase-grid">
              <form className="workflow-card" onSubmit={(event) => void handleBootstrap(event)}>
                <div className="field">
                  <label>Индустрия</label>
                  <input name="industryName" defaultValue="EdTech" required />
                </div>
                <div className="field">
                  <label>Программа</label>
                  <input name="programName" defaultValue="Project Learning" required />
                </div>
                <div className="field">
                  <label>Запрос HH</label>
                  <input name="query" defaultValue="typescript edtech" required />
                </div>
                <div className="field">
                  <label>Компетенции программы</label>
                  <textarea name="competencies" defaultValue={defaultCompetencyTemplate()} rows={4} />
                </div>
                <input type="hidden" name="priority" value="1" />
                <input type="hidden" name="area" value="1" />
                <input type="hidden" name="perPage" value="20" />
                <div className="button-row">
                  <button className="button" type="submit">
                    Выполнить bootstrap
                  </button>
                </div>
              </form>

              <div className="workflow-card workflow-result-card">
                <h4>Что должно получиться</h4>
                <ul className="result-list">
                  <li>Появится индустрия и запись источника HH.</li>
                  <li>В блоке «Источники HH» появится активный источник с запросом.</li>
                  <li>После этого можно переходить к ingestion.</li>
                </ul>
                <div className="workflow-metric">
                  <span>Индустрий</span>
                  <strong>{industries.length}</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="workflow-phase">
            <div className="workflow-phase-header">
              <span className="pill">Шаг 2-3</span>
              <div>
                <h3>Рынок и компании</h3>
                <p>Сначала загрузи вакансии, затем построй shortlist компаний на основе vacancy intelligence.</p>
              </div>
            </div>
            <div className="workflow-phase-grid">
              <form className="workflow-card" onSubmit={(event) => void handleIngestion(event)}>
                <div className="field">
                  <label>Индустрия</label>
                  <select name="industryId" defaultValue={industries[0]?.id ?? ""} required>
                    {industries.map((industry) => (
                      <option key={industry.id} value={industry.id}>
                        {industry.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Поисковый запрос</label>
                  <input name="query" defaultValue="typescript edtech" required />
                </div>
                <input type="hidden" name="area" value="1" />
                <input type="hidden" name="perPage" value="20" />
                <div className="button-row">
                  <button className="button" type="submit" disabled={industries.length === 0}>
                    Запустить HH ingestion
                  </button>
                </div>
                <div className="inline-note">
                  Последний запуск:{" "}
                  {latestRun
                    ? `${latestRun.status}, вакансий ${latestRun.processedCount}, компетенций ${latestRun.competencyCount}`
                    : "ещё не запускался"}
                </div>
              </form>

              <form className="workflow-card" onSubmit={(event) => void handleDiscovery(event)}>
                <div className="field">
                  <label>Индустрия</label>
                  <select name="industryId" defaultValue={industries[0]?.id ?? ""} required>
                    {industries.map((industry) => (
                      <option key={industry.id} value={industry.id}>
                        {industry.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Лимит компаний</label>
                  <input name="limit" type="number" min="1" defaultValue="20" />
                </div>
                <div className="button-row">
                  <button className="button" type="submit" disabled={industries.length === 0}>
                    Найти компании
                  </button>
                </div>
                <div className="inline-note">
                  Сейчас в пуле {companies.length} компаний, в shortlist {data.shortlist.items.length}.
                </div>
              </form>
            </div>
          </section>

          <section className="workflow-phase">
            <div className="workflow-phase-header">
              <span className="pill">Шаг 4</span>
              <div>
                <h3>Коммуникация</h3>
                <p>Создай draft, подтверди его и запусти outreach campaign по одобренному сообщению.</p>
              </div>
            </div>
            <div className="workflow-phase-grid workflow-phase-grid-3">
              <form className="workflow-card" onSubmit={(event) => void handleDraft(event)}>
                <div className="field">
                  <label>Компания</label>
                  <select name="companyId" defaultValue={companies[0]?.id ?? ""} required>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Тон</label>
                  <select name="tone" defaultValue="formal">
                    <option value="formal">formal</option>
                    <option value="neutral">neutral</option>
                    <option value="friendly">friendly</option>
                  </select>
                </div>
                <input type="hidden" name="kind" value="outreach-email" />
                <div className="button-row">
                  <button className="button" type="submit" disabled={companies.length === 0}>
                    Сгенерировать draft
                  </button>
                </div>
                <div className="inline-note">Последний draft: {latestDraft?.subject ?? "ещё не создан"}</div>
              </form>

              <form className="workflow-card" onSubmit={(event) => void handleDraftApproval(event)}>
                <div className="field">
                  <label>Draft</label>
                  <select name="draftId" defaultValue={latestDraft?.id ?? ""} required>
                    {allDrafts.map((draft) => (
                      <option key={draft.id} value={draft.id}>
                        {draft.subject ?? draft.id}
                      </option>
                    ))}
                  </select>
                </div>
                <input type="hidden" name="approved" value="true" />
                <div className="button-row">
                  <button className="button" type="submit" disabled={allDrafts.length === 0}>
                    Подтвердить draft
                  </button>
                </div>
                <div className="inline-note">
                  Подтверждённых drafts: {approvedDrafts.length}
                </div>
              </form>

              <form className="workflow-card" onSubmit={(event) => void handleCampaign(event)}>
                <div className="field">
                  <label>Название campaign</label>
                  <input name="name" defaultValue="Pilot outreach" required />
                </div>
                <div className="field">
                  <label>Какой draft отправить</label>
                  <select name="draftIds" defaultValue={latestApprovedDraft?.id ?? ""} required>
                    {approvedDrafts.map((draft) => (
                      <option key={draft.id} value={draft.id}>
                        {draft.subject ?? draft.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="button-row">
                  <button className="button" type="submit" disabled={approvedDrafts.length === 0}>
                    Отправить campaign
                  </button>
                </div>
                <div className="inline-note">
                  Сообщений в runtime: {messages.length}
                </div>
              </form>
            </div>
          </section>

          <section className="workflow-phase">
            <div className="workflow-phase-header">
              <span className="pill">Шаг 5</span>
              <div>
                <h3>Ответ и фиксация результата</h3>
                <p>Симулируй ответ компании, затем зафиксируй outcome переговоров для памяти и pipeline.</p>
              </div>
            </div>
            <div className="workflow-phase-grid">
              <form className="workflow-card" onSubmit={(event) => void handleSimulateReply(event)}>
                <div className="field">
                  <label>Сообщение</label>
                  <select name="messageId" defaultValue={latestMessage?.id ?? ""} required>
                    {messages.map((message) => (
                      <option key={message.id} value={message.id}>
                        {message.subject}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Текст reply</label>
                  <textarea
                    name="body"
                    rows={4}
                    defaultValue="We are interested, let's schedule a short call next week."
                    required
                  />
                </div>
                <input type="hidden" name="incomingFrom" value="partner@example.com" />
                <div className="button-row">
                  <button className="button" type="submit" disabled={messages.length === 0}>
                    Симулировать reply
                  </button>
                </div>
                <div className="inline-note">Replies в системе: {replies.length}</div>
              </form>

              <form className="workflow-card" onSubmit={(event) => void handleReplyOutcome(event)}>
                <div className="field">
                  <label>Reply</label>
                  <select name="replyId" defaultValue={latestReply?.id ?? ""} required>
                    {replies.map((reply) => (
                      <option key={reply.id} value={reply.id}>
                        {reply.id} · {reply.category}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Outcome</label>
                  <select name="outcome" defaultValue="pilot_agreed">
                    <option value="meeting_scheduled">meeting_scheduled</option>
                    <option value="pilot_agreed">pilot_agreed</option>
                    <option value="follow_up_needed">follow_up_needed</option>
                    <option value="declined_after_call">declined_after_call</option>
                  </select>
                </div>
                <div className="field">
                  <label>Заметка оператора</label>
                  <textarea name="notes" rows={3} defaultValue="Подтверждён интерес и следующий шаг." />
                </div>
                <div className="button-row">
                  <button className="button" type="submit" disabled={replies.length === 0}>
                    Сохранить outcome
                  </button>
                </div>
              </form>
            </div>
          </section>

          <section className="workflow-phase">
            <div className="workflow-phase-header">
              <span className="pill">Шаг 6</span>
              <div>
                <h3>Agreement, brief и материалы</h3>
                <p>После положительного ответа создай agreement, сформируй project brief и communication package.</p>
              </div>
            </div>
            <div className="workflow-phase-grid workflow-phase-grid-3">
              <form className="workflow-card" onSubmit={(event) => void handleAgreementCreate(event)}>
                <div className="field">
                  <label>Компания</label>
                  <select name="companyId" defaultValue={companies[0]?.id ?? ""} required>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
                <input type="hidden" name="status" value="draft" />
                <div className="button-row">
                  <button className="button" type="submit" disabled={companies.length === 0}>
                    Создать agreement
                  </button>
                </div>
                <div className="inline-note">Agreements: {agreements.length}</div>
              </form>

              <form className="workflow-card" onSubmit={(event) => void handleBriefGenerate(event)}>
                <div className="field">
                  <label>Agreement</label>
                  <select name="partnerAgreementId" defaultValue={latestAgreement?.id ?? ""} required>
                    {agreements.map((agreement) => (
                      <option key={agreement.id} value={agreement.id}>
                        {agreement.id} · {agreement.status}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Название brief</label>
                  <input name="title" placeholder="Можно оставить пустым" />
                </div>
                <div className="button-row">
                  <button className="button" type="submit" disabled={agreements.length === 0}>
                    Сгенерировать brief
                  </button>
                </div>
                <div className="inline-note">Briefs: {data.briefs.items.length}</div>
              </form>

              <form className="workflow-card" onSubmit={(event) => void handleMaterialsGenerate(event)}>
                <div className="field">
                  <label>Компания</label>
                  <select name="companyId" defaultValue={companies[0]?.id ?? ""} required>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Agreement context</label>
                  <select name="partnerAgreementId" defaultValue={latestAgreement?.id ?? ""}>
                    <option value="">без agreement</option>
                    {agreements.map((agreement) => (
                      <option key={agreement.id} value={agreement.id}>
                        {agreement.id} · {agreement.status}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="button-row">
                  <button className="button" type="submit" disabled={companies.length === 0}>
                    Сгенерировать материалы
                  </button>
                </div>
                <div className="inline-note">Materials: {data.communicationPackages.items.length}</div>
              </form>
            </div>
          </section>

          <details className="advanced-actions">
            <summary>Дополнительные действия и ручное управление</summary>
            <div className="workflow-phase-grid advanced-actions-grid">
              <form className="workflow-card" onSubmit={(event) => void handleStageUpdate(event)}>
                <div className="field">
                  <label>Компания</label>
                  <select name="companyId" defaultValue={companies[0]?.id ?? ""} required>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Новый этап</label>
                  <select name="stage" defaultValue="approved">
                    <option value="discovered">discovered</option>
                    <option value="shortlisted">shortlisted</option>
                    <option value="approved">approved</option>
                    <option value="contacted">contacted</option>
                    <option value="partnered">partnered</option>
                  </select>
                </div>
                <button className="ghost-button" type="submit">
                  Обновить этап компании
                </button>
              </form>

              <form className="workflow-card" onSubmit={(event) => void handleAgreementStatusUpdate(event)}>
                <div className="field">
                  <label>Agreement</label>
                  <select name="agreementId" defaultValue={latestAgreement?.id ?? ""} required>
                    {agreements.map((agreement) => (
                      <option key={agreement.id} value={agreement.id}>
                        {agreement.id} · {agreement.status}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Новый статус</label>
                  <select name="status" defaultValue="aligned">
                    <option value="draft">draft</option>
                    <option value="aligned">aligned</option>
                    <option value="signed">signed</option>
                  </select>
                </div>
                <button className="ghost-button" type="submit" disabled={agreements.length === 0}>
                  Обновить статус agreement
                </button>
              </form>

              <form className="workflow-card" onSubmit={(event) => void handleRunFollowUps(event)}>
                <h4>Follow-up scheduler</h4>
                <p className="muted">Запускает планировщик follow-up вне основного пути, когда нужно догнать старые сообщения.</p>
                <button className="ghost-button" type="submit">
                  Запустить follow-up
                </button>
              </form>
            </div>
          </details>
        </div>
      </Panel>
    </div>
  );
}
