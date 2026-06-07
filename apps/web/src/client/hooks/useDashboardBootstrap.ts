import { useEffect } from "react";
import { loadDashboardData } from "../api.js";
import { clearSession, getToken } from "../session.js";
import type { DashboardData, SessionUser } from "../types.js";

type UseDashboardBootstrapInput = {
  onSessionResolved: (user: SessionUser, data: DashboardData) => void;
  onSessionCleared: () => void;
  onStatus: (message: string) => void;
  onStatusTone: (tone: "neutral" | "error") => void;
};

export function useDashboardBootstrap({
  onSessionResolved,
  onSessionCleared,
  onStatus,
  onStatusTone
}: UseDashboardBootstrapInput): void {
  useEffect(() => {
    let cancelled = false;
    const token = getToken();

    if (!token) {
      return () => {
        cancelled = true;
      };
    }

    onStatus("Загрузка рабочего пространства...");
    onStatusTone("neutral");

    void loadDashboardData(token)
      .then((data) => {
        if (!cancelled) {
          onSessionResolved(data.me.user, data);
          onStatus("Рабочее пространство загружено.");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          clearSession();
          onSessionCleared();
          onStatus(error instanceof Error ? error.message : "Не удалось загрузить рабочее пространство.");
          onStatusTone("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [onSessionCleared, onSessionResolved, onStatus, onStatusTone]);
}
