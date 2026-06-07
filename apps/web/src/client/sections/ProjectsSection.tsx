import { useState } from "react";
import { DataTable } from "../components/DataTable.js";
import { StatusBadge } from "../components/StatusBadge.js";
import type { DashboardData } from "../types.js";

type ProjectsSectionProps = {
  data: DashboardData;
};

export function ProjectsSection({ data }: ProjectsSectionProps) {
  const [agreementStatus, setAgreementStatus] = useState("all");
  const agreements = data.agreements.items.filter((agreement) => agreementStatus === "all" || agreement.status === agreementStatus);

  return (
    <>
      <div className="span-12">
        <div className="filter-bar">
          <select value={agreementStatus} onChange={(event) => setAgreementStatus(event.target.value)}>
            <option value="all">все статусы соглашений</option>
            <option value="draft">черновик</option>
            <option value="aligned">согласовано</option>
            <option value="signed">подписано</option>
          </select>
        </div>
      </div>

      <DataTable
        className="span-6"
        title="Соглашения"
        subtitle="Текущие партнёрские соглашения и их состояние."
        headers={["Соглашение", "Компания", "Статус", "Создано"]}
        rows={agreements.slice(0, 8).map((agreement) => [
          agreement.id,
          agreement.companyId,
          <StatusBadge value={agreement.status} />,
          agreement.createdAt
        ])}
      />

      <DataTable
        className="span-6"
        title="Project Briefs"
        subtitle="Сгенерированные briefs, связанные с партнёрскими соглашениями."
        headers={["Brief", "Соглашение", "Название", "Создано"]}
        rows={data.briefs.items.slice(0, 8).map((brief) => [
          brief.id,
          brief.partnerAgreementId,
          brief.title,
          brief.createdAt
        ])}
      />

      <DataTable
        className="span-12"
        title="Каталог проектов"
        subtitle="Проектные артефакты, доступные после соглашения и генерации brief."
        headers={["Название", "Компания", "Этап", "Соглашение", "Скор"]}
        rows={data.projectCatalog.items.slice(0, 10).map((project) => [
          project.title,
          project.companyName,
          <StatusBadge value={project.companyStage} />,
          <StatusBadge value={project.agreementStatus} />,
          String(project.scoreTotal ?? 0)
        ])}
      />
    </>
  );
}
