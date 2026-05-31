import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import SiteSettingsManager from "../SiteSettingsManager";

export default function SettingsPanel() {
  const { data: settingsRecords = [] } = useQuery({ queryKey: ["siteSettings"], queryFn: () => base44.entities.SiteSettings.list("-updated_date", 1) });
  return <SiteSettingsManager settings={settingsRecords[0]} />;
}
