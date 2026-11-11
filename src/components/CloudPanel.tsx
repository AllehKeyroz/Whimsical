import { useEffect, useState } from "react";
import { useStore } from "../store";
import { getSupabaseConfig } from "../lib/supabase";
import { Modal } from "./Modals";
import { Icon } from "./icons";

type Mode = "signin" | "signup";

export function CloudPanel() {
  const open = useStore((s) => s.authOpen);
  const setOpen = useStore((s) => s.setAuthOpen);
  const cloud = useStore((s) => s.cloud);
  const boards = useStore((s) => s.boards);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const showToast = useStore((s) => s.showToast);
  const signInCloud = useStore((s) => s.signInCloud);
  const signUpCloud = useStore((s) => s.signUpCloud);
  const signOutCloud = useStore((s) => s.signOutCloud);
  const syncCloud = useStore((s) => s.syncCloud);
  const pushLocalToCloud = useStore((s) => s.pushLocalToCloud);

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [orgDraft, setOrgDraft] = useState(settings.organization);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setOrgDraft(settings.organization);
  }, [open, settings.organization]);

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

  const login = () =>
    run(async () => {
      const error = await signInCloud(email, password);
      if (error) setLocalError(error);
    });

  const signup = () =>
    run(async () => {
      const error = await signUpCloud(email, password, name, organization);
      if (error) setLocalError(error);
    });

  const statusLabel =
    cloud.status === "online"
      ? "Conectado"
      : cloud.status === "connecting"
        ? cloud.syncing
          ? "Sincronizando…"
          : "Conectando…"
        : cloud.status === "error"
          ? "Erro"
          : "Offline";

  const error = localError || cloud.error;

  return (
    <Modal
      open={open}
      title="Supabase / Nuvem"
      subtitle="Sincronize boards e pastas entre dispositivos. Os dados locais continuam funcionando offline."
      onClose={() => setOpen(false)}
      className="cloud-modal"
    >
      <div className="cloud-status-row">
        <span className={`cloud-status-dot ${cloud.status}`} />
        <b>{statusLabel}</b>
        <span className="cloud-status-detail">
          {cloud.user ? cloud.user.email || cloud.user.name : cloud.configured ? "Supabase configurado" : "Supabase não configurado"}
        </span>
        <span className="spacer" />
        {cloud.lastSync ? <small>Última sync: {new Date(cloud.lastSync).toLocaleString("pt-BR")}</small> : null}
      </div>

      {cloud.user ? (
        <div className="cloud-account">
          <div className="cloud-account-head">
            <span className="ws-avatar big">{(cloud.user.name || cloud.user.email || "A").charAt(0).toUpperCase()}</span>
            <div>
              <b>{cloud.user.name}</b>
              <small>{cloud.user.email}</small>
            </div>
            <span className="cloud-badge">Nuvem</span>
          </div>
          <div className="cloud-stats">
            <span>{boards.length} boards locais</span>
            <span>projeto: {getSupabaseConfig().url.replace(/^https?:\/\//, "")}</span>
          </div>
          <div className="cloud-org">
            <label className="cloud-field">
              <span>Organização / empresa</span>
              <input
                value={orgDraft}
                onChange={(e) => setOrgDraft(e.target.value)}
                placeholder="Nome da sua organização"
                maxLength={60}
              />
            </label>
            <button
              className="secondary-btn"
              disabled={busy || !orgDraft.trim() || orgDraft.trim() === settings.organization}
              onClick={() => {
                updateSettings({ organization: orgDraft.trim() });
                showToast("Organização atualizada.");
              }}
            >
              <Icon name="check" size={15} /> Salvar
            </button>
          </div>
          <div className="inline-row cloud-actions">
            <button className="primary-btn" disabled={cloud.syncing} onClick={() => void run(() => syncCloud())}>
              <Icon name="refresh" size={15} /> Sincronizar agora
            </button>
            <button className="secondary-btn" disabled={cloud.syncing} onClick={() => void run(() => pushLocalToCloud())}>
              <Icon name="upload" size={15} /> Enviar boards locais
            </button>
            <button className="secondary-btn danger-text" disabled={cloud.syncing} onClick={() => void run(() => signOutCloud())}>
              <Icon name="logout" size={15} /> Sair
            </button>
          </div>
        </div>
      ) : (
        <div className="cloud-auth">
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
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" autoComplete="name" />
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
                if (e.key === "Enter") void (mode === "signin" ? login() : signup());
              }}
            />
          </label>
          <div className="inline-row cloud-actions">
            <button
              className="primary-btn"
              disabled={busy || !cloud.configured || !email.trim() || !password}
              onClick={() => void (mode === "signin" ? login() : signup())}
            >
              <Icon name={mode === "signin" ? "login" : "cloud"} size={15} />
              {busy ? "Aguarde…" : mode === "signin" ? "Entrar" : "Criar conta"}
            </button>
            {cloud.configured ? (
              <span className="cloud-hint">Use uma conta criada no Supabase Auth.</span>
            ) : (
              <span className="cloud-hint">Configure o Supabase no .env e reimplante.</span>
            )}
          </div>
          <p className="cloud-note">
            Se a confirmação de e-mail estiver ativa no Supabase, confirme o link antes de entrar. A anon key é pública;
            nunca coloque a service_role key no navegador.
          </p>
        </div>
      )}

      {!cloud.configured ? (
        <p className="cloud-note">
          Defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no <code>.env</code> do deploy e
          reimplante. As credenciais são lidas do ambiente, não ficam no navegador.
        </p>
      ) : null}

      {error ? <div className="cloud-error">{error}</div> : null}
    </Modal>
  );
}
