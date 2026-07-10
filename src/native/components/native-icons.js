/**
 * String-key → lucide component registry for the native shell. Nav config
 * modules (native-tabs.js) stay pure/importable in node tests by referring
 * to icons by key; components resolve them here.
 */
import {
  Home,
  Newspaper,
  MessageSquare,
  ShoppingBag,
  User,
  Compass,
  Image,
  HelpCircle,
  FileText,
  Shield,
  ShieldCheck,
} from "lucide-react";

const ICONS = {
  home: Home,
  newspaper: Newspaper,
  "message-square": MessageSquare,
  "shopping-bag": ShoppingBag,
  user: User,
  compass: Compass,
  image: Image,
  "help-circle": HelpCircle,
  "file-text": FileText,
  shield: Shield,
  "shield-check": ShieldCheck,
};

export function nativeIcon(key) {
  return ICONS[key] || Shield;
}
