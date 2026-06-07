import { DataTable } from "../components/DataTable.js";
import type { DashboardData } from "../types.js";

type MarketSectionProps = {
  data: DashboardData;
};

export function MarketSection({ data }: MarketSectionProps) {
  return (
    <>
      <DataTable
        className="span-6"
        title="Источники HH"
        subtitle="Настроенные источники вакансий и поисковый контекст, который они сейчас используют."
        headers={["Источник", "Статус", "Индустрия", "Запрос"]}
        rows={data.bootstrap.data.sources.slice(0, 6).map((source) => [
          source.source,
          source.status,
          source.industryId,
          String(source.config.query ?? "не задан")
        ])}
      />

      <DataTable
        className="span-6"
        title="Последние запуски"
        subtitle="Последние ingestion runs и сколько компетенций они принесли в pipeline."
        headers={["Статус", "Запрос", "Вакансии", "Компетенции"]}
        rows={data.bootstrap.data.ingestionRuns.slice(0, 6).map((run) => [
          run.status,
          run.query,
          String(run.processedCount),
          String(run.competencyCount)
        ])}
      />

      <DataTable
        className="span-12"
        title="Разрывы по компетенциям"
        subtitle="Где рыночный спрос сейчас сильнее, чем покрытие программы."
        headers={["Компетенция", "Категория", "Покрытие", "Спрос", "Разрыв"]}
        rows={data.competencyGap.items.slice(0, 10).map((gap) => [
          gap.competencyName,
          gap.category,
          String(gap.programCoverage),
          String(gap.marketDemand),
          String(gap.gapScore)
        ])}
      />
    </>
  );
}
