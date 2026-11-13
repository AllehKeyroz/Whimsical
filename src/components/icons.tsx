import type { ReactNode } from "react";

export type IconName =
  | "cursor"
  | "hand"
  | "rect"
  | "pill"
  | "ellipse"
  | "diamond"
  | "triangle"
  | "hexagon"
  | "cylinder"
  | "parallelogram"
  | "document"
  | "sticky"
  | "text"
  | "frame"
  | "connector"
  | "image"
  | "undo"
  | "redo"
  | "search"
  | "share"
  | "layers"
  | "sun"
  | "moon"
  | "grid"
  | "list"
  | "mindmap"
  | "branch"
  | "key"
  | "magnet"
  | "layout"
  | "fit"
  | "download"
  | "upload"
  | "help"
  | "zoomIn"
  | "zoomOut"
  | "plus"
  | "minus"
  | "trash"
  | "copy"
  | "more"
  | "rotate"
  | "bold"
  | "italic"
  | "underline"
  | "alignLeft"
  | "alignCenter"
  | "alignRight"
  | "comment"
  | "link"
  | "eye"
  | "eyeOff"
  | "lock"
  | "unlock"
  | "chevronUp"
  | "chevronDown"
  | "close"
  | "present"
  | "group"
  | "ungroup"
  | "dashboard"
  | "check"
  | "arrowLeft"
  | "arrowRight"
  | "star"
  | "swap"
  | "palette"
  | "type"
  | "fitWidth"
  | "clock"
  | "chevronRight"
  | "folder"
  | "users"
  | "board"
  | "doc"
  | "sparkles"
  | "bolt"
  | "file"
  | "panelLeft"
  | "code"
  | "cloud"
  | "cloudOff"
  | "login"
  | "logout"
  | "refresh"
  | "settings";

function paths(name: IconName): ReactNode {
  switch (name) {
    case "cursor":
      return <path d="M5 3l14 8-6 1.5L10 19z" />;
    case "hand":
      return (
        <>
          <path d="M8 12V6a1.5 1.5 0 0 1 3 0v5" />
          <path d="M11 11V4.5a1.5 1.5 0 0 1 3 0V11" />
          <path d="M14 11V6.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2-4a1.6 1.6 0 0 1 2.7-1.7L8 15" />
        </>
      );
    case "rect":
      return <rect x="4" y="6" width="16" height="12" rx="2" />;
    case "pill":
      return <rect x="3" y="8" width="18" height="8" rx="4" />;
    case "ellipse":
      return <ellipse cx="12" cy="12" rx="9" ry="6" />;
    case "diamond":
      return <path d="M12 3l9 9-9 9-9-9z" />;
    case "triangle":
      return <path d="M12 3l9 17H3z" />;
    case "hexagon":
      return <path d="M7 4h10l4 8-4 8H7l-4-8z" />;
    case "cylinder":
      return (
        <>
          <path d="M4 7a8 3 0 0 0 16 0v10a8 3 0 0 1-16 0z" />
          <path d="M4 7a8 3 0 0 1 16 0" />
        </>
      );
    case "parallelogram":
      return <path d="M7 5h14l-4 14H3z" />;
    case "document":
      return <path d="M4 4h16v11c-2 1-4 0-8 1s-6 0-8 1z" />;
    case "sticky":
      return <path d="M5 4h14v11l-5 5H5zM14 20v-5h5" />;
    case "text":
      return <path d="M5 6h14M12 6v13" />;
    case "frame":
      return <path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3" />;
    case "connector":
      return (
        <>
          <path d="M5 18L19 6" />
          <path d="M14 6h5v5" />
        </>
      );
    case "image":
      return (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="9" cy="10" r="2" />
          <path d="M4 18l5-5 4 4 3-3 4 4" />
        </>
      );
    case "undo":
      return <path d="M9 7L4 12l5 5M4 12h9a6 6 0 0 1 6 6" />;
    case "redo":
      return <path d="M15 7l5 5-5 5M20 12h-9a6 6 0 0 0-6 6" />;
    case "search":
      return (
        <>
          <circle cx="11" cy="11" r="6" />
          <path d="M16 16l4 4" />
        </>
      );
    case "share":
      return (
        <>
          <circle cx="6" cy="12" r="2.5" />
          <circle cx="18" cy="6" r="2.5" />
          <circle cx="18" cy="18" r="2.5" />
          <path d="M8.3 10.8l7.4-3.6M8.3 13.2l7.4 3.6" />
        </>
      );
    case "layers":
      return <path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5" />;
    case "sun":
      return (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
        </>
      );
    case "moon":
      return <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z" />;
    case "key":
      return (
        <>
          <circle cx="15" cy="8" r="4" />
          <path d="M12 11l-8 8M4 19l2 2M7 16l2 2" />
        </>
      );
    case "branch":
      return (
        <>
          <circle cx="6" cy="5" r="2" />
          <circle cx="18" cy="19" r="2" />
          <path d="M6 7v5a7 7 0 0 0 7 7h3" />
        </>
      );
    case "mindmap":
      return (
        <>
          <circle cx="12" cy="12" r="2.4" />
          <circle cx="20" cy="5.5" r="2" />
          <circle cx="20" cy="18.5" r="2" />
          <path d="M14.2 11.2l4-4.3M14.2 12.8l4 4.3M3 12h6.6" />
        </>
      );
    case "list":
      return <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />;
    case "grid":
      return (
        <>
          <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
        </>
      );
    case "magnet":
      return (
        <>
          <path d="M6 4v8a6 6 0 0 0 12 0V4" />
          <path d="M6 8h4M14 8h4" />
        </>
      );
    case "layout":
      return (
        <>
          <rect x="3" y="4" width="7" height="6" rx="1" />
          <rect x="14" y="4" width="7" height="6" rx="1" />
          <rect x="8" y="15" width="8" height="5" rx="1" />
          <path d="M12 10v5" />
        </>
      );
    case "fit":
      return <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />;
    case "fitWidth":
      return <path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4" />;
    case "download":
      return <path d="M12 3v12M7 10l5 5 5-5M4 20h16" />;
    case "upload":
      return <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />;
    case "help":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .8-1.5 1.3-1.5 2.5M12 17.5v.5" />
        </>
      );
    case "zoomIn":
      return (
        <>
          <circle cx="11" cy="11" r="6" />
          <path d="M16 16l4 4M11 8v6M8 11h6" />
        </>
      );
    case "zoomOut":
      return (
        <>
          <circle cx="11" cy="11" r="6" />
          <path d="M16 16l4 4M8 11h6" />
        </>
      );
    case "plus":
      return <path d="M12 5v14M5 12h14" />;
    case "minus":
      return <path d="M5 12h14" />;
    case "trash":
      return <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />;
    case "copy":
      return (
        <>
          <rect x="8" y="8" width="12" height="12" rx="2" />
          <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2" />
        </>
      );
    case "more":
      return (
        <>
          <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
        </>
      );
    case "rotate":
      return <path d="M19 8a8 8 0 1 0 1 6M19 3v5h-5" />;
    case "bold":
      return <path d="M7 4h6a4 4 0 0 1 0 8H7zM7 12h7a4 4 0 0 1 0 8H7z" />;
    case "italic":
      return <path d="M10 4h8M6 20h8M14 4l-4 16" />;
    case "underline":
      return <path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14" />;
    case "alignLeft":
      return <path d="M4 6h16M4 11h10M4 16h13" />;
    case "alignCenter":
      return <path d="M4 6h16M7 11h10M6 16h12" />;
    case "alignRight":
      return <path d="M4 6h16M10 11h10M7 16h13" />;
    case "comment":
      return <path d="M4 5h16v11H9l-5 4z" />;
    case "link":
      return <path d="M10 13a4 4 0 0 0 6 .5l2-2a4 4 0 0 0-5.5-5.5l-1 1M14 11a4 4 0 0 0-6-.5l-2 2A4 4 0 0 0 11.5 18l1-1" />;
    case "eye":
      return (
        <>
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </>
      );
    case "eyeOff":
      return <path d="M3 3l18 18M10.5 5.2A10.8 10.8 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3 3.8M6.2 6.4A17 17 0 0 0 2 12s4 7 10 7a10 10 0 0 0 4-1" />;
    case "lock":
      return (
        <>
          <rect x="5" y="10" width="14" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </>
      );
    case "unlock":
      return (
        <>
          <rect x="5" y="10" width="14" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 7.5-2" />
        </>
      );
    case "chevronUp":
      return <path d="M6 14l6-6 6 6" />;
    case "chevronDown":
      return <path d="M6 10l6 6 6-6" />;
    case "close":
      return <path d="M6 6l12 12M18 6L6 18" />;
    case "present":
      return (
        <>
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M12 16v4M8 20h8" />
        </>
      );
    case "group":
      return (
        <>
          <rect x="3" y="3" width="8" height="8" rx="1" />
          <rect x="13" y="13" width="8" height="8" rx="1" />
          <path d="M13 3h8v8M3 13v8h8" strokeDasharray="2 2" />
        </>
      );
    case "ungroup":
      return (
        <>
          <rect x="3" y="3" width="8" height="8" rx="1" />
          <rect x="13" y="13" width="8" height="8" rx="1" />
        </>
      );
    case "dashboard":
      return (
        <>
          <rect x="3" y="3" width="8" height="8" rx="1.5" />
          <rect x="13" y="3" width="8" height="5" rx="1.5" />
          <rect x="13" y="10" width="8" height="11" rx="1.5" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" />
        </>
      );
    case "check":
      return <path d="M4 12l5 5L20 6" />;
    case "arrowLeft":
      return <path d="M19 12H5M11 6l-6 6 6 6" />;
    case "arrowRight":
      return <path d="M5 12h14M13 6l6 6-6 6" />;
    case "star":
      return <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19l1-5.8L3.5 9.2l5.9-.9z" />;
    case "swap":
      return <path d="M4 7h13l-3-3M20 17H7l3 3" />;
    case "palette":
      return (
        <>
          <path d="M12 3a9 9 0 1 0 0 18c2 0 2-2 1-3-1-1 0-3 2-3h4a2 2 0 0 0 2-2 10 10 0 0 0-9-10z" />
          <circle cx="7.5" cy="11" r="1" fill="currentColor" stroke="none" />
          <circle cx="10" cy="7" r="1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="8" r="1" fill="currentColor" stroke="none" />
        </>
      );
    case "type":
      return <path d="M4 6h16M12 6v13M9 19h6" />;
    case "clock":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      );
    case "chevronRight":
      return <path d="M9 6l6 6-6 6" />;
    case "folder":
      return <path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />;
    case "file":
      return (
        <>
          <path d="M6 3h8l4 4v14H6z" />
          <path d="M14 3v5h5M9 13h6M9 17h6" />
        </>
      );
    case "users":
      return (
        <>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3 20a6 6 0 0 1 12 0" />
          <path d="M16 5.5a3 3 0 0 1 0 5.8M17 14a5 5 0 0 1 4 5" />
        </>
      );
    case "board":
      return (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M8 8v8M12 8v8M16 8v8" />
        </>
      );
    case "doc":
      return (
        <>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </>
      );
    case "sparkles":
      return (
        <>
          <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
          <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
          <path d="M5 14l.6 1.7L7.3 16l-1.7.6L5 18.3l-.6-1.7L2.7 16l1.7-.3z" />
        </>
      );
    case "bolt":
      return <path d="M13 2L4 14h6l-1 8 9-12h-6z" />;
    case "panelLeft":
      return (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 4v16" />
        </>
      );
    case "code":
      return <path d="M8 7l-4 5 4 5M16 7l4 5-4 5M13 4l-2 16" />;
    case "cloud":
      return <path d="M7 18a4 4 0 0 1-.5-7.97A6 6 0 0 1 18 9a4.5 4.5 0 0 1 .5 9z" />;
    case "cloudOff":
      return (
        <>
          <path d="M7 18a4 4 0 0 1-.5-7.97 6 6 0 0 1 9.6-4.3M18.5 9A4.5 4.5 0 0 1 18 18h-7" />
          <path d="M3 3l18 18" />
        </>
      );
    case "login":
      return <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 8l4 4-4 4M14 12H3" />;
    case "logout":
      return <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M16 8l4 4-4 4M20 12H9" />;
    case "refresh":
      return <path d="M20 7v5h-5M4 17v-5h5M6.1 9a7 7 0 0 1 11.5-2L20 9M4 15l2.4 2A7 7 0 0 0 18 15" />;
    case "settings":
      return (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a1.7 1.7 0 0 0-1.6-1H1a2 2 0 1 1 0-4h.4A1.7 1.7 0 0 0 3 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 8 4.6 1.7 1.7 0 0 0 9 3V2a2 2 0 1 1 4 0v.4A1.7 1.7 0 0 0 15 4a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 19.4 9c.2.6.8 1 1.4 1H21a2 2 0 1 1 0 4h-.4a1.7 1.7 0 0 0-1.2.9z" />
        </>
      );
    default:
      return null;
  }
}

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths(name)}
    </svg>
  );
}

export function ShapeIcon({ type, size = 20 }: { type: string; size?: number }) {
  const map: Record<string, IconName> = {
    rect: "rect",
    pill: "pill",
    ellipse: "ellipse",
    diamond: "diamond",
    triangle: "triangle",
    hexagon: "hexagon",
    cylinder: "cylinder",
    parallelogram: "parallelogram",
    document: "document",
    sticky: "sticky",
  };
  return <Icon name={map[type] ?? "rect"} size={size} />;
}
