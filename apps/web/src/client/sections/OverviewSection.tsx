import { useState } from "react";
import { DataTable } from "../components/DataTable.js";
import { KpiGrid } from "../components/KpiGrid.js";
import { StatusBadge } from "../components/StatusBadge.js";
import type { DashboardData, DashboardSummary } from "../types.js";

type OverviewSectionProps = {
  data: DashboardData;
  summary: DashboardSummary;
};

export function OverviewSection({ data, summary }: OverviewSectionProps) {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("all");
  const shortlist = data.shortlist.items.filter((company) => {
    const needle = query.trim().toLowerCase();
    const matchesQuery =
      needle.length === 0 ||
      company.name.toLowerCase().includes(needle) ||
      company.region.toLowerCase().includes(needle);
    const matchesStage = stage === "all" || company.stage === stage;
    return matchesQuery && matchesStage;
  });

  return (
    <>
      <div className="span-12">
        <KpiGrid
          items={[
            { label: "Приоритетные индустрии", value: summary.industries },
            { label: "Загружено вакансий", value: summary.vacancies },
            { label: "Компаний в пуле", value: summary.companies },
            { label: "Версий draft", value: summary.drafts },
            { label: "Отправленных сообщений", value: summary.messages },
            { label: "Полученных ответов", value: summary.replies },
            { label: "Project briefs", value: summary.briefs },
            { label: "События памяти", value: summary.memoryEvents }
          ]}
        />
      </div>

      <div className="span-12">
        <div className="filter-bar">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по shortlist: компания или регион"
          />
          <select value={stage} onChange={(event) => setStage(event.target.value)}>
            <option value="all">все этапы</option>
            <option value="discovered">найдена</option>
            <option value="shortlisted">в shortlist</option>
            <option value="approved">подтверждена</option>
            <option value="contacted">свяжались</option>
            <option value="partnered">партнёр</option>
          </select>
        </div>
      </div>

      <DataTable
        className="span-6"
        title="Shortlist"
        subtitle="Компании, которые сейчас выходят в верх списка по скоринговой политике."
        headers={["Компания", "Регион", "Этап", "Итог"]}
        rows={shortlist.map((company) => [
          company.name,
          company.region,
          <StatusBadge value={company.stage} />,
          String(company.score?.total ?? 0)
        ])}
      />

      <DataTable
        className="span-6"
        title="Состояние workspace"
        subtitle="Быстрый снимок текущего рабочего пространства и demo-safe режима."
        headers={["Метрика", "Значение"]}
        rows={[
          ["Компании", String(summary.companies)],
          ["Контакты", String(summary.contacts)],
          ["Источники", String(summary.sources)],
          ["Запуски", String(summary.ingestionRuns)],
          ["Подтверждённые drafts", String(summary.approvedDrafts)],
          ["Эскалированные ответы", String(summary.escalatedReplies)],
          ["Соглашения", String(summary.agreements)],
          ["Задачи", String(summary.jobs)],
          ["Режим outreach", "симулированное демо"]
        ]}
      />
    </>
  );
}
