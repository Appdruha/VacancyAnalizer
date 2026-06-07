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
  sendCampaignAction
  ,
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

export function ActionPanel({ data, onRefresh }: ActionPanelProps) {
  const [status, setStatus] = useState<ActionStatus>({
    tone: "neutral",
    message: "Используй эти действия, чтобы пройти основной сценарий прямо из dashboard."
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
      "Bootstrap индустрии завершён, dashboard обновлён."
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
      "Задача HH ingestion поставлена в очередь."
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
      "Задача поиска компаний поставлена в очередь."
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
      "Draft успешно сгенерирован."
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
      "Сценарий отправки campaign запущен."
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
      "Статус draft обновлён."
    );
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
      "Соглашение создано."
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
      "Симуляция ответа поставлена в очередь."
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
      "Результат коммуникации сохранён."
    );
  }

  async function handleRunFollowUps(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = requireToken();
    await runAction(() => runFollowUpsAction(token).then(() => undefined), "Планировщик follow-up поставлен в очередь.");
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
  const approvedDrafts = data.drafts.items.filter((item) => item.approved);
  const companies = data.companies.items;
  const agreements = data.agreements.items;
  const allDrafts = data.drafts.items;
  const messages = data.messages.items;
  const replies = data.replies.items;

  return (
    <div className="span-12">
      <Panel title="Действия сценария" subtitle="Запускай основной workflow прямо из dashboard и обновляй состояние после каждого шага.">
        <div className="status-banner" data-tone={status.tone}>
          {status.message}
        </div>

        <div className="action-grid">
          <form className="action-card" onSubmit={(event) => void handleBootstrap(event)}>
            <h3>Bootstrap индустрии</h3>
            <p className="muted">Создай стартовую индустрию, program mapping и HH source за один шаг.</p>
            <div className="field">
              <label>Название индустрии</label>
              <input name="industryName" defaultValue="EdTech" required />
            </div>
            <div className="field">
              <label>Название программы</label>
              <input name="programName" defaultValue="Project Learning" required />
            </div>
            <div className="field">
              <label>Запрос HH</label>
              <input name="query" defaultValue="typescript edtech" required />
            </div>
            <div className="field">
              <label>Компетенции</label>
              <textarea name="competencies" defaultValue={defaultCompetencyTemplate()} rows={5} />
            </div>
            <div className="button-row">
              <button className="button" type="submit">
                Создать
              </button>
            </div>
          </form>

          <form className="action-card" onSubmit={(event) => void handleIngestion(event)}>
            <h3>Запустить HH ingestion</h3>
            <p className="muted">Поставить в очередь новый запуск загрузки вакансий для выбранной индустрии.</p>
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
              <label>Запрос</label>
              <input name="query" defaultValue="typescript edtech" required />
            </div>
            <div className="button-row">
              <button className="button" type="submit">
                Запустить ingestion
              </button>
            </div>
          </form>

          <form className="action-card" onSubmit={(event) => void handleDiscovery(event)}>
            <h3>Найти компании</h3>
            <p className="muted">Поставить в очередь поиск компаний по текущей vacancy intelligence.</p>
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
              <label>Лимит</label>
              <input name="limit" type="number" min="1" defaultValue="20" />
            </div>
            <div className="button-row">
              <button className="button" type="submit">
                Запустить поиск
              </button>
            </div>
          </form>

          <form className="action-card" onSubmit={(event) => void handleDraft(event)}>
            <h3>Сгенерировать draft</h3>
            <p className="muted">Создать новый outreach или follow-up draft для выбранной компании.</p>
            <div className="field">
              <label>Компания</label>
              <select name="companyId" defaultValue={data.companies.items[0]?.id ?? ""} required>
                {data.companies.items.map((company) => (
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
            <div className="field">
              <label>Тип</label>
              <select name="kind" defaultValue="outreach-email">
                <option value="outreach-email">outreach-email</option>
                <option value="follow-up-email">follow-up-email</option>
              </select>
            </div>
            <div className="button-row">
              <button className="button" type="submit">
                Сгенерировать draft
              </button>
            </div>
          </form>

          <form className="action-card" onSubmit={(event) => void handleCampaign(event)}>
            <h3>Отправить campaign</h3>
            <p className="muted">Запустить outreach runtime по подтверждённым версиям draft.</p>
            <div className="field">
              <label>Название campaign</label>
              <input name="name" defaultValue="Pilot outreach" required />
            </div>
            <div className="field">
              <label>Подтверждённые drafts</label>
              <div className="check-list">
                {approvedDrafts.length > 0 ? (
                  approvedDrafts.slice(0, 8).map((draft) => (
                    <label key={draft.id} className="check-item">
                      <input type="checkbox" name="draftIds" value={draft.id} />
                      <span>{draft.id}</span>
                    </label>
                  ))
                ) : (
                  <div className="empty">Подтверждённых drafts пока нет.</div>
                )}
              </div>
            </div>
            <div className="button-row">
              <button className="button" type="submit" disabled={approvedDrafts.length === 0}>
                Отправить campaign
              </button>
              <button className="ghost-button" type="button" onClick={() => void onRefresh()}>
                Обновить данные
              </button>
            </div>
          </form>

          <form className="action-card" onSubmit={(event) => void handleDraftApproval(event)}>
            <h3>Подтвердить draft</h3>
            <p className="muted">Подтвердить или отклонить существующую версию draft.</p>
            <div className="field">
              <label>Draft</label>
              <select name="draftId" defaultValue={allDrafts[0]?.id ?? ""} required>
                {allDrafts.map((draft) => (
                  <option key={draft.id} value={draft.id}>
                    {draft.subject ?? draft.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Решение</label>
              <select name="approved" defaultValue="true">
                <option value="true">подтвердить</option>
                <option value="false">отклонить</option>
              </select>
            </div>
            <div className="button-row">
              <button className="button" type="submit">
                Сохранить решение
              </button>
            </div>
          </form>

          <form className="action-card" onSubmit={(event) => void handleStageUpdate(event)}>
            <h3>Изменить этап компании</h3>
            <p className="muted">Перевести компанию на следующий этап qualification pipeline.</p>
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
              <label>Этап</label>
              <select name="stage" defaultValue="approved">
                <option value="discovered">discovered</option>
                <option value="shortlisted">shortlisted</option>
                <option value="approved">approved</option>
                <option value="contacted">contacted</option>
                <option value="partnered">partnered</option>
              </select>
            </div>
            <div className="button-row">
              <button className="button" type="submit">
                Обновить этап
              </button>
            </div>
          </form>

          <form className="action-card" onSubmit={(event) => void handleAgreementCreate(event)}>
            <h3>Создать agreement</h3>
            <p className="muted">Создать следующую project-запись после квалификации партнёра.</p>
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
              <label>Статус</label>
              <select name="status" defaultValue="draft">
                <option value="draft">draft</option>
                <option value="aligned">aligned</option>
                <option value="signed">signed</option>
              </select>
            </div>
            <div className="button-row">
              <button className="button" type="submit">
                Создать agreement
              </button>
            </div>
          </form>

          <form className="action-card" onSubmit={(event) => void handleBriefGenerate(event)}>
            <h3>Сгенерировать brief</h3>
            <p className="muted">Построить project brief из существующего partner agreement.</p>
            <div className="field">
              <label>Agreement</label>
              <select name="partnerAgreementId" defaultValue={agreements[0]?.id ?? ""} required>
                {agreements.map((agreement) => (
                  <option key={agreement.id} value={agreement.id}>
                    {agreement.id} · {agreement.status}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Свое название</label>
              <input name="title" placeholder="Необязательное название brief" />
            </div>
            <div className="button-row">
              <button className="button" type="submit" disabled={agreements.length === 0}>
                Сгенерировать brief
              </button>
            </div>
          </form>

          <form className="action-card" onSubmit={(event) => void handleMaterialsGenerate(event)}>
            <h3>Сгенерировать материалы</h3>
            <p className="muted">Создать one-pager и FAQ-материалы для выбранной компании.</p>
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
              <label>Контекст agreement</label>
              <select name="partnerAgreementId" defaultValue="">
                <option value="">без agreement</option>
                {agreements.map((agreement) => (
                  <option key={agreement.id} value={agreement.id}>
                    {agreement.id} · {agreement.status}
                  </option>
                ))}
              </select>
            </div>
            <div className="button-row">
              <button className="button" type="submit">
                Сгенерировать материалы
              </button>
            </div>
          </form>

          <form className="action-card" onSubmit={(event) => void handleSimulateReply(event)}>
            <h3>Симулировать reply</h3>
            <p className="muted">Добавить входящий reply в runtime, чтобы проверить сценарий ответа.</p>
            <div className="field">
              <label>Сообщение</label>
              <select name="messageId" defaultValue={messages[0]?.id ?? ""} required>
                {messages.map((message) => (
                  <option key={message.id} value={message.id}>
                    {message.subject}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>От кого</label>
              <input name="incomingFrom" placeholder="partner@example.com" />
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
            <div className="button-row">
              <button className="button" type="submit" disabled={messages.length === 0}>
                Симулировать reply
              </button>
            </div>
          </form>

          <form className="action-card" onSubmit={(event) => void handleReplyOutcome(event)}>
            <h3>Сохранить outcome по reply</h3>
            <p className="muted">Зафиксировать бизнес-результат после того, как оператор обработал reply.</p>
            <div className="field">
              <label>Reply</label>
              <select name="replyId" defaultValue={replies[0]?.id ?? ""} required>
                {replies.map((reply) => (
                  <option key={reply.id} value={reply.id}>
                    {reply.id} · {reply.category}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Результат</label>
              <select name="outcome" defaultValue="meeting_scheduled">
                <option value="meeting_scheduled">meeting_scheduled</option>
                <option value="pilot_agreed">pilot_agreed</option>
                <option value="follow_up_needed">follow_up_needed</option>
                <option value="declined_after_call">declined_after_call</option>
              </select>
            </div>
            <div className="field">
              <label>Заметки</label>
              <textarea name="notes" rows={3} placeholder="Необязательные заметки оператора" />
            </div>
            <div className="button-row">
              <button className="button" type="submit" disabled={replies.length === 0}>
                Сохранить результат
              </button>
            </div>
          </form>

          <form className="action-card" onSubmit={(event) => void handleRunFollowUps(event)}>
            <h3>Запустить follow-up</h3>
            <p className="muted">Запустить follow-up scheduler из браузера и обновить runtime state.</p>
            <div className="button-row">
              <button className="button" type="submit">
                Запустить scheduler
              </button>
            </div>
          </form>

          <form className="action-card" onSubmit={(event) => void handleAgreementStatusUpdate(event)}>
            <h3>Изменить статус agreement</h3>
            <p className="muted">Перевести agreement из draft в aligned или signed прямо из workspace.</p>
            <div className="field">
              <label>Agreement</label>
              <select name="agreementId" defaultValue={agreements[0]?.id ?? ""} required>
                {agreements.map((agreement) => (
                  <option key={agreement.id} value={agreement.id}>
                    {agreement.id} · {agreement.status}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Статус</label>
              <select name="status" defaultValue="aligned">
                <option value="draft">draft</option>
                <option value="aligned">aligned</option>
                <option value="signed">signed</option>
              </select>
            </div>
            <div className="button-row">
              <button className="button" type="submit" disabled={agreements.length === 0}>
                Обновить agreement
              </button>
            </div>
          </form>
        </div>
      </Panel>
    </div>
  );
}
