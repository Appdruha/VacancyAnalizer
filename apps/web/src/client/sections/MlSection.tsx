import { DataTable } from "../components/DataTable.js";
import type { DashboardData } from "../types.js";

type MlSectionProps = {
  data: DashboardData;
};

export function MlSection({ data }: MlSectionProps) {
  return (
    <>
      <DataTable
        className="span-4"
        title="Память и ML"
        subtitle="Текущее адаптивное состояние, с которым работает dashboard."
        headers={["Метрика", "Значение"]}
        rows={[
          ["База готова", String(data.health.databaseReady === true)],
          ["События", String(data.memoryOverview.eventCount)],
          ["Ответы", String(data.memoryOverview.replyCount)],
          ["Рекомендуемый тон", data.memoryOverview.recommendation.recommendedTone],
          ["Дней до follow-up", String(data.memoryOverview.recommendation.recommendedFollowUpDays)],
          ["ML engine", data.mlEvaluation.engine],
          ["Статус ML", data.mlHealth.status]
        ]}
      />

      <DataTable
        className="span-8"
        title="Примеры ML evaluation"
        subtitle="Текущие примеры сравнения локальных и remote-рекомендаций."
        headers={["Пример", "Сценарий", "Policy", "Локально", "Remote"]}
        rows={data.mlEvaluation.samples.slice(0, 10).map((sample) => [
          sample.label,
          sample.scenario,
          sample.policy.recommendedSource,
          `${sample.localRecommendation.recommendedTone} / ${sample.localRecommendation.recommendedFollowUpDays}d`,
          `${sample.remoteRecommendation.recommendedTone} / ${sample.remoteRecommendation.recommendedFollowUpDays}d`
        ])}
      />
    </>
  );
}
