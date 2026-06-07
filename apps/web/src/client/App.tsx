import { useCallback, useState, type FormEvent } from "react";
import { loadDashboardData, signInLocal } from "./api.js";
import { buildSummary } from "./dashboard/summary.js";
import { DashboardView } from "./components/DashboardView.js";
import { LoginView } from "./components/LoginView.js";
import { useDashboardBootstrap } from "./hooks/useDashboardBootstrap.js";
import { useGoogleAuth } from "./hooks/useGoogleAuth.js";
import { useHashRoute } from "./hooks/useHashRoute.js";
import { clearSession, getSavedUser, getToken, saveSession } from "./session.js";
import type { DashboardData, DashboardSummary, SessionUser, WebRuntimeConfig } from "./types.js";

export function App() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(getSavedUser());
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [status, setStatus] = useState("Войди, чтобы загрузить рабочее пространство.");
  const [statusTone, setStatusTone] = useState<"neutral" | "error">("neutral");
  const [localStatus, setLocalStatus] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [route, navigate] = useHashRoute();
  const [runtimeConfig] = useState<WebRuntimeConfig>(
    window.__EDAGENT_CONFIG__ ?? {
      apiBaseUrl: "/api",
      appName: "EdAgent Workspace"
    }
  );

  const refreshDashboard = useCallback(async (): Promise<void> => {
    const token = getToken();
    if (!token) {
      throw new Error("Токен авторизации отсутствует.");
    }
    const nextData = await loadDashboardData(token);
    setSessionUser(nextData.me.user);
    setDashboardData(nextData);
    setLastUpdated(new Date().toISOString());
  }, []);

  const handleSessionResolved = useCallback((user: SessionUser, data: DashboardData) => {
    setSessionUser(user);
    setDashboardData(data);
    setLastUpdated(new Date().toISOString());
  }, []);

  const handleSessionCleared = useCallback(() => {
    setSessionUser(null);
    setDashboardData(null);
    setLastUpdated(null);
  }, []);

  const handleStatus = useCallback((message: string) => {
    setStatus(message);
  }, []);

  const handleStatusTone = useCallback((tone: "neutral" | "error") => {
    setStatusTone(tone);
  }, []);

  const handleLocalStatusReset = useCallback(() => {
    setLocalStatus("");
  }, []);

  useDashboardBootstrap({
    onSessionResolved: handleSessionResolved,
    onSessionCleared: handleSessionCleared,
    onStatus: handleStatus,
    onStatusTone: handleStatusTone
  });

  const googleStatus = useGoogleAuth({
    onSession: handleSessionResolved,
    loadDashboardData,
    onStatus: handleStatus,
    onStatusTone: handleStatusTone,
    onLocalStatusReset: handleLocalStatusReset
  });

  async function handleLocalLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    setLocalStatus("Выполняется вход...");
    setStatusTone("neutral");

    try {
      const session = await signInLocal(email, password);
      saveSession(session);
      setSessionUser(session.user);
      setLocalStatus("Вход выполнен.");
      setStatus("Загрузка рабочего пространства...");
      const token = getToken();
      if (!token) {
        throw new Error("Токен авторизации отсутствует.");
      }
      await refreshDashboard();
      navigate("overview");
      setStatus("Рабочее пространство загружено.");
    } catch (error) {
      setLocalStatus(error instanceof Error ? error.message : "Ошибка входа.");
      setStatusTone("error");
    }
  }

  const handleLogout = useCallback(() => {
    clearSession();
    setSessionUser(null);
    setDashboardData(null);
    setLastUpdated(null);
    setStatus("Сессия завершена. Войди снова, чтобы загрузить workspace.");
    setStatusTone("neutral");
  }, []);

  const summary = dashboardData ? buildSummary(dashboardData) : null;

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-grid">
          <div>
            <span className="pill">React Workspace</span>
            <h1 className="headline">EdAgent: операторская консоль для поиска индустрий и outreach.</h1>
            <p className="lede">
              Этот workspace работает как полноценный React-клиент через same-origin API proxy, поэтому auth,
              orchestration, partner signals, memory и ML evaluation собраны в одном цельном интерфейсе.
            </p>
          </div>
          <aside className="hero-meta">
            <span className="hero-meta-label">Runtime</span>
            <span className="hero-meta-value">{runtimeConfig.appName}</span>
            <span className="hero-meta-label">Маршрут API</span>
            <span className="hero-meta-value">{runtimeConfig.apiBaseUrl}</span>
            <span className="hero-meta-label">Режим сессии</span>
            <span className="hero-meta-value">{sessionUser ? `${sessionUser.role} авторизован` : "ожидание входа"}</span>
          </aside>
        </div>
      </section>

      <div className="status-banner" data-tone={statusTone}>
        {status}
      </div>

      {sessionUser && dashboardData && summary ? (
        <DashboardView
          user={sessionUser}
          data={dashboardData}
          summary={summary}
          onLogout={handleLogout}
          route={route}
          onNavigate={navigate}
          onRefresh={refreshDashboard}
          lastUpdated={lastUpdated}
        />
      ) : (
        <LoginView googleStatus={googleStatus} localStatus={localStatus} onLocalLogin={handleLocalLogin} />
      )}
    </main>
  );
}
