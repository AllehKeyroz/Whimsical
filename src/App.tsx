import { useEffect } from "react";
import { Canvas } from "./components/Canvas";
import { Toolbar } from "./components/Toolbar";
import { ToolPalette } from "./components/ToolPalette";
import { AlignBar } from "./components/AlignBar";
import { LayersPanel } from "./components/LayersPanel";
import { WorkspaceSidebar } from "./components/WorkspaceSidebar";
import { Dashboard } from "./components/Dashboard";
import { BoardBottomBar } from "./components/BoardBottomBar";
import { IconPicker } from "./components/IconPicker";
import { CloudPanel } from "./components/CloudPanel";
import { LoginGate } from "./components/LoginGate";
import {
  CommentsPanel,
  ErrorBoundary,
  HelpModal,
  LoadingScreen,
  MermaidModal,
  PresentationBar,
  SearchPalette,
  SharePanel,
  TemplateGallery,
} from "./components/Modals";
import { useStore } from "./store";

function AppInner() {
  const ready = useStore((s) => s.ready);
  const view = useStore((s) => s.view);
  const board = useStore((s) => s.board);
  const settings = useStore((s) => s.settings);
  const presentation = useStore((s) => s.presentation);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const toast = useStore((s) => s.toast);
  const cloud = useStore((s) => s.cloud);

  useEffect(() => {
    void (async () => {
      await useStore.getState().init();
      await useStore.getState().initCloud();
    })();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.style.colorScheme = settings.theme;
  }, [settings.theme]);

  useEffect(() => {
    document.title = view === "board" ? `${board.title} · Whimsical` : "Whimsical · Seus boards";
  }, [board.title, view]);

  useEffect(() => {
    const flush = () => {
      void useStore.getState().persistNow();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (!ready) return <LoadingScreen />;

  // When Supabase is configured, the workspace only opens after login so the
  // local cache and the cloud data always belong to the same account.
  if (cloud.configured && cloud.initialized && !cloud.user) {
    return <LoginGate />;
  }

  if (view === "dashboard") {
    return (
      <div className={`workspace ${sidebarOpen ? "" : "sidebar-closed"}`}>
        <WorkspaceSidebar />
        <Dashboard />
        <HelpModal />
        <TemplateGallery />
        <SharePanel />
        <CloudPanel />
        {toast ? <div className="ws-toast">{toast}</div> : null}
      </div>
    );
  }

  if (presentation) {
    return (
      <div className="app presentation-mode">
        <Canvas />
        <PresentationBar />
        <HelpModal />
      </div>
    );
  }

  return (
    <div className={`workspace board-view ${sidebarOpen ? "" : "sidebar-closed"}`}>
      <WorkspaceSidebar />
      <div className="board-main">
        <Toolbar />
        <div className="board-body">
          <ToolPalette />
          <Canvas />
          <LayersPanel />
          <BoardBottomBar />
          <AlignBar />
        </div>
      </div>
      <HelpModal />
      <SearchPalette />
      <TemplateGallery />
      <SharePanel />
      <CommentsPanel />
      <IconPicker />
      <MermaidModal />
      <CloudPanel />
      {toast ? <div className="ws-toast">{toast}</div> : null}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
