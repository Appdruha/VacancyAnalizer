import { useEffect, useState } from "react";
import { getGoogleConfig, signInWithGoogle } from "../api.js";
import { getToken, saveSession } from "../session.js";
import type { DashboardData, SessionUser } from "../types.js";

async function loadGoogleScript(clientId: string, onCredential: (idToken: string) => Promise<void>): Promise<void> {
  if (!window.google) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Не удалось загрузить скрипт Google Sign-In."));
      document.head.appendChild(script);
    });
  }

  window.google?.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => {
      void onCredential(response.credential);
    }
  });
  window.google?.accounts.id.renderButton(document.getElementById("google-button"), {
    theme: "outline",
    size: "large",
    shape: "pill",
    text: "signin_with"
  });
}

type UseGoogleAuthInput = {
  onSession: (user: SessionUser, data: DashboardData) => void;
  loadDashboardData: (token: string) => Promise<DashboardData>;
  onStatus: (message: string) => void;
  onStatusTone: (tone: "neutral" | "error") => void;
  onLocalStatusReset: () => void;
};

export function useGoogleAuth({
  onSession,
  loadDashboardData,
  onStatus,
  onStatusTone,
  onLocalStatusReset
}: UseGoogleAuthInput): string {
  const [googleStatus, setGoogleStatus] = useState("Проверка конфигурации Google auth...");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const config = await getGoogleConfig();
        if (cancelled) {
          return;
        }

        if (!config.enabled || !config.clientIdConfigured || !config.clientId) {
          setGoogleStatus("Google auth отключён в текущем окружении.");
          return;
        }

        setGoogleStatus("Google auth готов.");
        await loadGoogleScript(config.clientId, async (idToken) => {
          try {
            const session = await signInWithGoogle(idToken);
            saveSession(session);
            setGoogleStatus("Вход через Google выполнен.");
            onLocalStatusReset();
            onStatusTone("neutral");
            onStatus("Загрузка рабочего пространства...");
            const token = getToken();
            if (!token) {
              throw new Error("Токен авторизации отсутствует.");
            }
            const nextData = await loadDashboardData(token);
            if (!cancelled) {
              onSession(session.user, nextData);
              onStatus("Рабочее пространство загружено.");
            }
          } catch (error) {
            if (!cancelled) {
              setGoogleStatus(error instanceof Error ? error.message : "Ошибка входа через Google.");
              onStatusTone("error");
            }
          }
        });
      } catch (error) {
        if (!cancelled) {
          setGoogleStatus(error instanceof Error ? error.message : "Не удалось загрузить конфигурацию Google auth.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadDashboardData, onLocalStatusReset, onSession, onStatus, onStatusTone]);

  return googleStatus;
}
