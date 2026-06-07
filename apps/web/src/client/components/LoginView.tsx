import type { FormEvent } from "react";
import { Panel } from "./Panel.js";

type LoginViewProps = {
  googleStatus: string;
  localStatus: string;
  onLocalLogin: (event: FormEvent<HTMLFormElement>) => void;
};

export function LoginView({ googleStatus, localStatus, onLocalLogin }: LoginViewProps) {
  return (
    <div className="grid">
      <div className="span-12">
        <div className="auth-grid">
          <Panel
            title="Вход через Google"
            subtitle="Используй Google, если он включён в текущем окружении. Кнопка появится автоматически, когда клиент настроен."
          >
            <p className="muted">{googleStatus}</p>
            <div id="google-button" style={{ marginTop: "14px" }} />
          </Panel>

          <Panel
            title="Локальный вход администратора"
            subtitle="Резервный вариант для локального тестирования и админских операций, если Google-вход не используется."
          >
            <form onSubmit={onLocalLogin}>
              <div className="field">
                <label htmlFor="local-email">Почта</label>
                <input id="local-email" name="email" type="email" placeholder="admin@your-domain" required />
              </div>
              <div className="field">
                <label htmlFor="local-password">Пароль</label>
                <input
                  id="local-password"
                  name="password"
                  type="password"
                  placeholder="Значение ADMIN_PASSWORD"
                  required
                />
              </div>
              <div className="button-row">
                <button type="submit" className="button">
                  Войти
                </button>
                <span className="muted">{localStatus}</span>
              </div>
            </form>
          </Panel>
        </div>
      </div>
    </div>
  );
}
