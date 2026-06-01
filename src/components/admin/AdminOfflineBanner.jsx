import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";

export default function AdminOfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div className="sticky top-0 z-30 border-b border-amber-500/40 bg-amber-500/15 px-4 py-3 text-amber-200 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-2 text-xs font-bold uppercase tracking-wider">
        <WifiOff className="h-4 w-4 shrink-0" />
        <span>Offline mode: live admin data and saving are paused until the connection returns.</span>
      </div>
    </div>
  );
}
