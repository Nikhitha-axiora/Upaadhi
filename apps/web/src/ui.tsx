/* ============================================================================
   Upaadhi — UI primitives & hooks
   Reusable, dependency-light building blocks: theme, toasts, command palette,
   modal, animated counters, persisted state, and small visual helpers.
   ========================================================================== */
import {
  Command,
  CornerDownLeft,
  Search as SearchIcon,
  X
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";

/* ---- Persisted state ----------------------------------------------------- */

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or unavailable — non-fatal */
    }
  }, [key, value]);

  return [value, setValue] as const;
}

/* ---- Theme --------------------------------------------------------------- */

export type Theme = "light" | "dark";

export function useTheme() {
  const [theme, setTheme] = useLocalStorage<Theme>("upaadhi.theme", "light");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => (current === "light" ? "dark" : "light"));
  }, [setTheme]);

  return { theme, setTheme, toggle };
}

/* ---- Toast store (provider-free) ----------------------------------------- */

export type ToastKind = "success" | "error" | "info" | "warning";
export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

let toastSeq = 0;
let toastState: Toast[] = [];
const toastListeners = new Set<(toasts: Toast[]) => void>();

function emitToasts() {
  for (const listener of toastListeners) listener(toastState);
}

export function dismissToast(id: number) {
  toastState = toastState.filter((toast) => toast.id !== id);
  emitToasts();
}

export function pushToast(message: string, kind: ToastKind = "info") {
  const id = ++toastSeq;
  toastState = [...toastState, { id, kind, message }];
  emitToasts();
  window.setTimeout(() => dismissToast(id), 4200);
  return id;
}

export const toast = {
  success: (message: string) => pushToast(message, "success"),
  error: (message: string) => pushToast(message, "error"),
  info: (message: string) => pushToast(message, "info"),
  warning: (message: string) => pushToast(message, "warning")
};

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>(toastState);
  useEffect(() => {
    toastListeners.add(setToasts);
    return () => {
      toastListeners.delete(setToasts);
    };
  }, []);
  return toasts;
}

const toastIcon: Record<ToastKind, string> = {
  success: "✓",
  error: "✕",
  info: "i",
  warning: "!"
};

export function ToastViewport() {
  const toasts = useToasts();
  return (
    <div className="toast-viewport" role="region" aria-live="polite">
      {toasts.map((item) => (
        <div className={`toast toast-${item.kind}`} key={item.id} role="status">
          <span className="toast-glyph" aria-hidden="true">
            {toastIcon[item.kind]}
          </span>
          <span className="toast-message">{item.message}</span>
          <button
            className="toast-close"
            type="button"
            aria-label="Dismiss"
            onClick={() => dismissToast(item.id)}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---- Modal --------------------------------------------------------------- */

export function Modal({
  open,
  onClose,
  children,
  labelledBy
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/* ---- Command palette ----------------------------------------------------- */

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: ReactNode;
  run: () => void;
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen };
}

export function CommandPalette({
  open,
  onClose,
  commands
}: {
  open: boolean;
  onClose: () => void;
  commands: CommandItem[];
}) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.hint ?? ""} ${command.group}`.toLowerCase().includes(q)
    );
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    setCursor((value) => Math.min(value, Math.max(0, results.length - 1)));
  }, [results.length]);

  const runAt = useCallback(
    (index: number) => {
      const command = results[index];
      if (!command) return;
      command.run();
      onClose();
    },
    [results, onClose]
  );

  let lastGroup = "";

  return (
    <Modal open={open} onClose={onClose} labelledBy="cmdk-title">
      <div className="cmdk">
        <div className="cmdk-input">
          <SearchIcon size={18} />
          <input
            ref={inputRef}
            id="cmdk-title"
            value={query}
            placeholder="Type a command or search…"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setCursor((value) => Math.min(value + 1, results.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setCursor((value) => Math.max(value - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                runAt(cursor);
              }
            }}
          />
          <kbd className="cmdk-esc">esc</kbd>
        </div>
        <div className="cmdk-list">
          {results.length === 0 ? (
            <div className="cmdk-empty">No matching commands</div>
          ) : (
            results.map((command, index) => {
              const showGroup = command.group !== lastGroup;
              lastGroup = command.group;
              return (
                <div key={command.id}>
                  {showGroup ? <div className="cmdk-group">{command.group}</div> : null}
                  <button
                    type="button"
                    className={index === cursor ? "cmdk-item active" : "cmdk-item"}
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => runAt(index)}
                  >
                    <span className="cmdk-icon">{command.icon}</span>
                    <span className="cmdk-label">{command.label}</span>
                    {command.hint ? <span className="cmdk-hint">{command.hint}</span> : null}
                    {index === cursor ? (
                      <span className="cmdk-enter">
                        <CornerDownLeft size={13} />
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            })
          )}
        </div>
        <div className="cmdk-footer">
          <span>
            <Command size={12} /> Command palette
          </span>
          <span>↑↓ navigate · ↵ select · esc close</span>
        </div>
      </div>
    </Modal>
  );
}

/* ---- Animated counter ---------------------------------------------------- */

export function useCountUp(target: number, durationMs = 700) {
  const [value, setValue] = useState(0);
  const frame = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(from + (target - from) * eased);
      if (progress < 1) frame.current = requestAnimationFrame(animate);
    };
    frame.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame.current);
  }, [target, durationMs]);

  return value;
}

export function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const animated = useCountUp(value);
  return (
    <>
      {Math.round(animated)}
      {suffix}
    </>
  );
}

/* ---- Avatar -------------------------------------------------------------- */

const avatarGradients = [
  "linear-gradient(145deg,#3b82f6,#1e40af)",
  "linear-gradient(145deg,#25a468,#136c43)",
  "linear-gradient(145deg,#f59e0b,#b45309)",
  "linear-gradient(145deg,#7c3aed,#6d28d9)",
  "linear-gradient(145deg,#0f766e,#115e59)",
  "linear-gradient(145deg,#db2777,#9d174d)"
];

export function Avatar({
  name,
  size = 44,
  className = "",
  src
}: {
  name: string;
  size?: number;
  className?: string;
  src?: string | null;
}) {
  const hash = useMemo(() => {
    let total = 0;
    for (let i = 0; i < name.length; i += 1) total += name.charCodeAt(i);
    return total;
  }, [name]);
  const gradient = avatarGradients[hash % avatarGradients.length];
  return (
    <div
      className={`avatar ${className}`}
      style={{ width: size, height: size, background: src ? "var(--surface-muted)" : gradient, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {src ? <img className="avatar-photo" src={src} alt="" /> : name.slice(0, 1).toUpperCase()}
    </div>
  );
}
