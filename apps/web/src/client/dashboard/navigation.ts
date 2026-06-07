export type DashboardRoute = "overview" | "market" | "outreach" | "projects" | "ml";

export const dashboardSections: Array<{
  id: DashboardRoute;
  label: string;
  description: string;
}> = [
  {
    id: "overview",
    label: "Обзор",
    description: "Главные KPI и текущее состояние shortlist."
  },
  {
    id: "market",
    label: "Рынок",
    description: "Источники, ingestion runs и разрывы компетенций."
  },
  {
    id: "outreach",
    label: "Коммуникации",
    description: "Сообщения, ответы и материалы для коммуникации."
  },
  {
    id: "projects",
    label: "Проекты",
    description: "Соглашения, briefs и артефакты каталога."
  },
  {
    id: "ml",
    label: "Память и ML",
    description: "Адаптивное состояние и evaluation samples."
  }
];

export function isDashboardRoute(value: string): value is DashboardRoute {
  return dashboardSections.some((section) => section.id === value);
}
