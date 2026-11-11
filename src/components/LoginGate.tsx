import { useState } from "react";
import { useStore } from "../store";
import { getSupabaseConfig } from "../lib/supabase";
import { Icon } from "./icons";

type Mode = "signin" | "signup";

/**
 * Full-screen login. When Supabase is configured the workspace is behind this
 * gate, so the local cache is always scoped to the signed-in account.
 */
export function LoginGate() {
  const cloud = useStore((s) => s.cloud);
  const signInCloud = useStore((s) => s.signInCloud);
  const signUpCloud = useStore((s) => s.signUpCloud);
  const saveCloudConfig = useStore((s) => s.saveCloudConfig);

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [url, setUrl] = useState(() => getSupabaseConfig().url);
  const [key, setKey] = useState(() => getSupabaseConfig().key);
  const [localError, setLocalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setLocalError(null);
    setNotice(null);
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
        mode === "signin" ? await signInCloud(email, password) : await signUpCloud(email, password, name);
      if (error) setLocalError(error);
    });

  const saveConfig = () =>
    run(async () => {
      await saveCloudConfig(url, key);
      setShowConfig(false);
      setNotice("Credenciais salvas.");
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
            <h1>Entrar no Whimsical</h1>
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
          <span className="spacer" />
          <button className="cloud-link" onClick={() => setShowConfig((v) => !v)}>
            <Icon name="settings" size={14} /> Credenciais
          </button>
        </div>

        {mode === "signup" ? (
          <label className="cloud-field">
            <span>Nome</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              autoComplete="name"
            />
          </label>
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

        {showConfig ? (
          <div className="cloud-config">
            <div className="cloud-config-head">
              <b>Credenciais do Supabase</b>
              <span>Somente URL e anon/publishable key.</span>
            </div>
            <label className="cloud-field">
              <span>Project URL</span>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://seu-projeto.supabase.co" />
            </label>
            <label className="cloud-field">
              <span>Anon / publishable key</span>
              <textarea value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJhbGciOi…" rows={3} />
            </label>
            <div className="inline-row cloud-actions">
              <button className="primary-btn" disabled={busy || !url.trim() || !key.trim()} onClick={() => void saveConfig()}>
                <Icon name="check" size={15} /> Salvar credenciais
              </button>
            </div>
          </div>
        ) : null}

        {error ? <div className="cloud-error">{error}</div> : null}
        {notice ? <div className="cloud-notice">{notice}</div> : null}

        <p className="login-note">
          O app usa Supabase Auth e o banco Supabase também no desenvolvimento local. Cada conta vê apenas os
          próprios boards; o cache local também é separado por usuário. Nunca use a service_role key no navegador.
        </p>
      </div>
    </div>
  );
}
