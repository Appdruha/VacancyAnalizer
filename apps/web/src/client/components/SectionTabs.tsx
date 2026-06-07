import type { DashboardRoute } from "../dashboard/navigation.js";
import { dashboardSections } from "../dashboard/navigation.js";

type SectionTabsProps = {
  currentRoute: DashboardRoute;
  onNavigate: (route: DashboardRoute) => void;
};

export function SectionTabs({ currentRoute, onNavigate }: SectionTabsProps) {
  return (
    <div className="section-tabs">
      {dashboardSections.map((section) => (
        <button
          key={section.id}
          type="button"
          className={currentRoute === section.id ? "section-tab active" : "section-tab"}
          onClick={() => onNavigate(section.id)}
        >
          <span>{section.label}</span>
          <small>{section.description}</small>
        </button>
      ))}
    </div>
  );
}
