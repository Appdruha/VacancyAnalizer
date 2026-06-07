import { useState } from "react";
import { DataTable } from "../components/DataTable.js";
import { StatusBadge } from "../components/StatusBadge.js";
import type { DashboardData } from "../types.js";

type OutreachSectionProps = {
  data: DashboardData;
};

export function OutreachSection({ data }: OutreachSectionProps) {
  const [messageStatus, setMessageStatus] = useState("all");
  const [replyQuery, setReplyQuery] = useState("");
  const filteredMessages = data.messages.items.filter((message) => messageStatus === "all" || message.status === messageStatus);
  const filteredReplies = data.replies.items.filter((reply) => {
    const needle = replyQuery.trim().toLowerCase();
    return needle.length === 0 || reply.category.toLowerCase().includes(needle) || reply.createdAt.toLowerCase().includes(needle);
  });

  return (
    <>
      <div className="span-12">
        <div className="filter-bar">
          <select value={messageStatus} onChange={(event) => setMessageStatus(event.target.value)}>
            <option value="all">все статусы сообщений</option>
            <option value="queued">в очереди</option>
            <option value="sent">отправлено</option>
            <option value="delivered">доставлено</option>
            <option value="replied">с ответом</option>
            <option value="failed">ошибка</option>
          </select>
          <input
            value={replyQuery}
            onChange={(event) => setReplyQuery(event.target.value)}
            placeholder="Поиск ответов по категории или времени"
          />
        </div>
      </div>

      <DataTable
        className="span-6"
        title="Состояние outreach"
        subtitle="Текущий статус сообщений в рабочем outreach-потоке."
        headers={["Тема", "Статус", "Тип", "Follow-up до"]}
        rows={filteredMessages.slice(0, 8).map((message) => [
          message.subject,
          <StatusBadge value={message.status} />,
          message.kind,
          message.followUpDueAt ?? "-"
        ])}
      />

      <DataTable
        className="span-6"
        title="Ответы"
        subtitle="Входящие сигналы от партнёров, уже классифицированные системой."
        headers={["Категория", "Позитивный", "Эскалирован", "Создан"]}
        rows={filteredReplies.slice(0, 8).map((reply) => [
          <StatusBadge value={reply.category} />,
          <StatusBadge value={reply.positive ? "positive" : "neutral"} />,
          <StatusBadge value={reply.escalated ? "escalated" : "not escalated"} />,
          reply.createdAt
        ])}
      />

      <DataTable
        className="span-12"
        title="Коммуникационные пакеты"
        subtitle="One-pager и FAQ-материалы, подготовленные для общения с партнёром."
        headers={["Тип", "Название", "Кратко", "Пункты"]}
        rows={data.communicationPackages.items.slice(0, 8).map((item) => [
          item.kind,
          item.title,
          item.summary,
          String(item.bullets.length)
        ])}
      />
    </>
  );
}
