import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import {
  addPushListeners,
  getPushPermissionStatus,
  requestPushPermission,
} from "@/lib/native/push";
import { disableUserPushTokens, persistPushToken } from "@/lib/native/push-registration";

/**
 * Native-only push control for the account Notification Preferences.
 *
 * Requests OS permission on an explicit toggle (never on launch — Apple rejects
 * unprompted permission requests), registers with APNs, and persists the device
 * token. iOS gives no way to revoke permission from inside the app, so turning
 * the switch off disables the user's stored tokens (the send pipeline honors
 * `enabled`) and denied users are pointed at iOS Settings.
 */
export default function PushNotificationToggle() {
  const { user, updateProfile } = useAuth();
  const userId = user?.id;
  const [status, setStatus] = useState("prompt"); // prompt | granted | denied | unsupported
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const cleanupRef = useRef(null);

  useEffect(() => {
    let active = true;
    getPushPermissionStatus().then((s) => {
      if (!active) return;
      setStatus(s);
      setOn(s === "granted" && user?.push_opt_in === true);
    });
    // Attach listeners so a token that arrives after register() (or on a later
    // launch once already authorized) is persisted for the current user.
    cleanupRef.current = addPushListeners({
      onToken: (token) => {
        persistPushToken(userId, token).catch(() => {});
      },
      onError: () =>
        toast({
          title: "Couldn't enable push",
          description: "APNs registration failed. Please try again shortly.",
          variant: "destructive",
        }),
    });
    return () => {
      active = false;
      cleanupRef.current?.();
    };
  }, [userId, user?.push_opt_in]);

  const handleToggle = useCallback(
    async (value) => {
      if (busy) return;
      setBusy(true);
      try {
        if (!value) {
          setOn(false);
          await disableUserPushTokens(userId).catch(() => {});
          await updateProfile({ push_opt_in: false }).catch(() => {});
          toast({ title: "Push notifications paused" });
          return;
        }
        const result = await requestPushPermission();
        setStatus(result);
        if (result === "granted") {
          setOn(true);
          await updateProfile({ push_opt_in: true }).catch(() => {});
          toast({
            title: "Push notifications on",
            description: "You'll get match countdowns, ticket alerts and forum replies.",
          });
        } else {
          setOn(false);
          if (result === "denied") {
            toast({
              title: "Permission needed",
              description:
                "Turn on notifications for Rugby League Takeover in iOS Settings to receive alerts.",
              variant: "destructive",
            });
          }
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, userId, updateProfile]
  );

  const denied = status === "denied";

  return (
    <label className="flex items-center justify-between text-sm cursor-pointer select-none border-t border-border/10 pt-4">
      <div className="space-y-0.5 pr-4">
        <span className="font-semibold">Push Notifications</span>
        <p className="text-xs text-muted-foreground">
          {denied
            ? "Notifications are blocked. Enable them for Rugby League Takeover in iOS Settings."
            : "Match countdowns, ticket alerts and forum replies delivered straight to your device."}
        </p>
      </div>
      <Switch checked={on} disabled={busy || denied} onCheckedChange={handleToggle} />
    </label>
  );
}
