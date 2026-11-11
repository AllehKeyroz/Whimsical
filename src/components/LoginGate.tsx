import { useState } from "react";
import { useStore } from "../store";
import { Icon } from "./icons";

type Mode = "signin" | "signup";

/**
 * Full-screen login. When Supabase is configured the workspace is behind this
 * gate, so the local cache is always scoped to the signed-in account.
 * Credentials come exclusively from the environment (.env / Easypanel).
 */
export function LoginGate() {
  const cloud = useStore((s) => s.cloud);
  const signInCloud = useStore((s) => s.signInCloud);
  const signUpCloud = useStore((s) => s.signUpCloud);

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setLocalError(null);
    try {
      await fn();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Falha inesperada.");
    } finally {
      setBusy(false);
    }
  };

  const submit = () =>
    run(async () => {
      const error =
        mode === "signin"
          ? await signInCloud(email, password)
          : await signUpCloud(email, password, name, organization);
      if (error) setLocalError(error);
    });

  const error = localError || cloud.error;

  return (
    <div className="login-gate">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-logo">
            <Icon name="cloud" size={22} />
          </span>
          <div>
            <h1>Entrar no KDS FLUX</h1>
            <p>Seus boards ficam no Supabase e são separados por conta.</p>
          </div>
        </div>

        <div className="cloud-tabs">
          <button className={mode === "signin" ? "active" : ""} onClick={() => setMode("signin")}>
            Entrar
          </button>
          <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>
            Criar conta
          </button>
        </div>

        {mode === "signup" ? (
          <>
            <label className="cloud-field">
              <span>Nome</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                autoComplete="name"
              />
            </label>
            <label className="cloud-field">
              <span>Organização / empresa</span>
              <input
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="Nome da sua empresa ou equipe"
                maxLength={60}
              />
            </label>
          </>
        ) : null}

        <label className="cloud-field">
          <span>E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com"
            autoComplete="email"
            autoFocus
          />
        </label>

        <label className="cloud-field">
          <span>Senha</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
          />
        </label>

        <button
          className="primary-btn login-submit"
          disabled={busy || !email.trim() || !password}
          onClick={() => void submit()}
        >
          <Icon name={mode === "signin" ? "login" : "cloud"} size={15} />
          {busy ? "Aguarde…" : mode === "signin" ? "Entrar" : "Criar conta"}
        </button>

        {error ? <div className="cloud-error">{error}</div> : null}

        <p className="login-note">
          O app usa Supabase Auth e o banco Supabase também no desenvolvimento local. Cada conta vê apenas os
          próprios boards; o cache local também é separado por usuário. Nunca use a service_role key no navegador.
        </p>
      </div>
    </div>
  );
}
