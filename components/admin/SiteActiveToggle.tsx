"use client";

import { ActiveToggleButton } from "./ActiveToggleButton";
import { toggleSiteActive } from "@/app/admin/sites/actions";

export function SiteActiveToggle({ siteId, isActive }: { siteId: string; isActive: boolean }) {
  return (
    <ActiveToggleButton isActive={isActive} onToggle={(next) => toggleSiteActive(siteId, next)} />
  );
}
