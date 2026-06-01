import React, { useState, useRef, useEffect } from "react";
import { Terminal, Send, Cpu } from "lucide-react";

const initialLines = [
  "SYSTEM CORE v1.0.4 READY // USER: admin",
  "Type 'help' to view available diagnostic commands.",
  "-------------------------------------------------"
];

const mockLogs = [
  "INFO  [Auth] User tommy@rlfans.com authenticated successfully.",
  "SYNC  [PWA] Service Worker assets cache updated (42 elements).",
  "AUDIT [Forum] Thread #19445 'Vegas meetup' submitted for moderation.",
  "STRIPE [Sales] Charge webhook received for order #RLT-9904 (AUD 240.00).",
  "INFO  [Admin] Overview settings updated by console session.",
  "SYNC  [Database] Synchronized SiteSettings schema with local storage.",
  "WARN  [Network] Elevated latency detected on primary API endpoint (148ms)."
];

export default function MissionControlTerminal() {
  const [lines, setLines] = useState(initialLines);
  const [inputValue, setInputValue] = useState("");
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const terminalEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom of terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  // Idle logger: append mock logs automatically every 15 seconds to simulate a live server stream
  useEffect(() => {
    const interval = setInterval(() => {
      const randomLog = mockLogs[Math.floor(Math.random() * mockLogs.length)];
      const timestamp = new Date().toLocaleTimeString("en-AU", { hour12: false });
      setLines((prev) => [...prev, `[${timestamp}] ${randomLog}`]);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleCommand = (cmd) => {
    const trimmed = cmd.trim().toLowerCase();
    const timestamp = new Date().toLocaleTimeString("en-AU", { hour12: false });
    const promptLine = `admin@rlt-command-hq:~$ ${cmd}`;

    if (!trimmed) {
      setLines((prev) => [...prev, promptLine]);
      return;
    }

    let responseLines = [];

    switch (trimmed) {
      case "help":
        responseLines = [
          "AVAILABLE DIAGNOSTIC COMMANDS:",
          "  help       - Display this command reference manual",
          "  health     - Execute systems integrity diagnostics",
          "  metrics    - Show real-time CPU & telemetry stats",
          "  logs       - Fetch a snapshot of server audit logs",
          "  pwa        - Check PWA offline service worker state",
          "  optimize   - Trigger database table optimization",
          "  clear      - Wipe console buffer and reset terminal"
        ];
        break;

      case "health":
        responseLines = [
          "[START] Executing systems integrity diagnostics...",
          "  [OK] Network link latency : 42ms (Node primary-syd)",
          "  [OK] Database synchronization : 100% replication",
          "  [OK] Session handshake tokens : VALID",
          "  [OK] PWA assets local manifest : ACTIVE & SECURE",
          "[SUCCESS] All server systems operating within nominal limits."
        ];
        break;

      case "metrics":
        responseLines = [
          "SYSTEM METRICS TELEMETRY REPORT:",
          "  CPU Load      : [||||||......] 48%",
          "  Memory Consumption: 248.6 MB / 1024 MB (24.2%)",
          "  PWA Cache Size: 14.82 MB (offline ready)",
          "  Active Connections : 12 concurrent fans",
          "  API Bandwidth : 4.8 KB/s down / 2.1 KB/s up"
        ];
        break;

      case "logs":
        responseLines = [
          "LATEST AUDIT LOG SHAPSHOT:",
          `  [${timestamp}] INFO  [Server] Core daemon operating normally.`,
          `  [${timestamp}] AUDIT [Forum] Thread moderation queue refreshed.`,
          `  [${timestamp}] SYNC  [ServiceWorker] Event push state: standby.`
        ];
        break;

      case "pwa":
        responseLines = [
          "PWA OFFLINE ENGINE ENVIRONMENT:",
          "  Service Worker: REGISTERED (sw.js)",
          "  Lifecycle State: ACTIVE (running)",
          "  Local Sandbox : enabled (isolated app storage)",
          "  Cached Resources: 42 files (index, shell, styles, icons)",
          "  Background Sync: COMPLIANT"
        ];
        break;

      case "optimize":
        responseLines = [
          "[DB] Starting index compaction & table alignment...",
          "  [DB] Re-indexing tables: siteSettings, news, matchups, orders",
          "  [DB] Compaction completed in 240ms.",
          "[SUCCESS] Index fragment index reduced by 84%. Speed score elevated."
        ];
        break;

      case "clear":
        setLines([`SYSTEM BUFFER WIPED // TIME: ${timestamp}`, "---------------------------------------------"]);
        return;

      default:
        responseLines = [
          `bash: command not found: ${trimmed}`,
          "Type 'help' to review available terminal options."
        ];
        break;
    }

    setLines((prev) => [...prev, promptLine, ...responseLines]);
    setCommandHistory((prev) => [cmd, ...prev.slice(0, 19)]);
    setHistoryIndex(-1);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    handleCommand(inputValue);
    setInputValue("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
        const nextIdx = historyIndex + 1;
        setHistoryIndex(nextIdx);
        setInputValue(commandHistory[nextIdx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setInputValue(commandHistory[nextIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputValue("");
      }
    }
  };

  const focusInput = () => {
    inputRef.current?.focus();
  };

  return (
    <div className="border border-border bg-card/60 cmd-glass overflow-hidden">
      {/* Accent Header */}
      <div className="h-[2px] w-full bg-gradient-to-r from-emerald-500 via-primary to-emerald-500" />
      
      <div className="p-5">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-emerald-400 cmd-pulse" />
            <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
              Mission Control System Terminal
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-bold uppercase tracking-wider text-emerald-400">
              <Cpu className="h-2.5 w-2.5" /> Diagnostic Console
            </span>
          </div>
        </div>

        {/* ── Console Interface ── */}
        <div 
          onClick={focusInput}
          className="relative h-[240px] border border-border/60 bg-neutral-950/95 font-mono text-[11px] text-emerald-400 p-4 overflow-y-auto cmd-scrollbar cursor-text"
        >
          {/* Glass Scanline Glow */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-neutral-950/0 via-emerald-950/[0.02] to-neutral-950/0 overflow-hidden">
            <div className="absolute left-0 right-0 h-[1.5px] bg-emerald-400/15 cmd-scan-line" />
          </div>

          <div className="space-y-1.5 select-text">
            {lines.map((line, i) => (
              <div 
                key={i} 
                className={`whitespace-pre-wrap leading-relaxed ${
                  line.startsWith("admin@rlt-command-hq:") ? "text-primary font-semibold" :
                  line.includes("[SUCCESS]") || line.includes("[OK]") ? "text-emerald-300 font-bold" :
                  line.includes("[DB]") || line.includes("WARN") ? "text-amber-400" :
                  line.includes("error") || line.includes("not found") ? "text-red-400 font-semibold" : 
                  "text-emerald-400/80"
                }`}
              >
                {line}
              </div>
            ))}
            <div ref={terminalEndRef} />
          </div>
        </div>

        {/* ── Input bar ── */}
        <form onSubmit={onSubmit} className="flex items-center gap-2 mt-2">
          <div className="flex-1 relative flex items-center bg-neutral-950/80 border border-border/80 px-3">
            <span className="text-[11px] font-mono text-primary font-bold shrink-0 select-none mr-1.5">
              admin@rlt-command-hq:~$
            </span>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent border-none outline-none ring-0 text-emerald-400 font-mono text-[11px] h-9 py-1"
              placeholder="type 'help'..."
              autoComplete="off"
              autoCapitalize="off"
            />
          </div>
          <button
            type="submit"
            className="flex min-h-[38px] min-w-[38px] items-center justify-center border border-border bg-card/60 hover:bg-neutral-900 text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
