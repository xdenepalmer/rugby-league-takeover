import React from "react";
import { Music2 } from "lucide-react";

export const DEFAULT_SOCIAL_LINKS = {
  facebook: "https://www.facebook.com/groups/663237792349090",
  instagram: "https://www.instagram.com/rugbyleaguetakeover?igsh=MTY1d3lkaWs1NDhnaw==",
  tiktok: "https://www.tiktok.com/@nrl_las_vegas?_r=1&_t=ZS-96zem8W4clw",
};

const FacebookIcon = ({ className = "" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const InstagramIcon = ({ className = "", style }) => (
  <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

export function getSocialLinks(settings = {}) {
  return [
    {
      key: "facebook",
      label: "Facebook",
      detail: "NRL Las Vegas",
      url: settings.social_facebook_url || DEFAULT_SOCIAL_LINKS.facebook,
      color: "#1877F2",
      icon: FacebookIcon,
    },
    {
      key: "instagram",
      label: "Instagram",
      detail: "@rugbyleaguetakeover",
      url: settings.social_instagram_url || DEFAULT_SOCIAL_LINKS.instagram,
      color: "#E1306C",
      icon: InstagramIcon,
    },
    {
      key: "tiktok",
      label: "TikTok",
      detail: "@nrl_las_vegas",
      url: settings.social_tiktok_url || DEFAULT_SOCIAL_LINKS.tiktok,
      color: "#25F4EE",
      icon: Music2,
    },
  ].filter((link) => link.url);
}

export default function SocialLinks({ settings = {}, className = "", compact = false }) {
  return (
    <div className={`grid gap-2 ${className}`}>
      {getSocialLinks(settings).map((link) => {
        const Icon = link.icon;
        return (
          <a
            key={link.key}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="group flex min-h-11 items-center gap-2.5 border border-border/40 bg-card/20 px-3 py-2.5 transition-all duration-300 hover:bg-card/35"
            style={{ borderColor: `${link.color}33` }}
          >
            <Icon className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110" style={{ color: link.color }} />
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-foreground transition-colors truncate" style={{ color: compact ? undefined : link.color }}>{link.label}</p>
              <p className="text-[9px] text-muted-foreground font-mono truncate">{link.detail}</p>
            </div>
            <svg viewBox="0 0 24 24" className="ml-auto h-3 w-3 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M7 17L17 7M17 7H7M17 7v10" /></svg>
          </a>
        );
      })}
    </div>
  );
}