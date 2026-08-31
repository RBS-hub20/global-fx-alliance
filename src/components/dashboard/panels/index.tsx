import type { ComponentType } from "react";
import { OverviewPanel } from "./OverviewPanel";
import { MarketOverviewPanel } from "./MarketOverviewPanel";
import { MarketAnalysisPanel } from "./MarketAnalysisPanel";
import { MarketNewsPanel } from "./MarketNewsPanel";
import { WatchlistPanel } from "./WatchlistPanel";
import { CommunityPanel } from "./CommunityPanel";
import { DiscussionsPanel } from "./DiscussionsPanel";
import { AcademyPanel } from "./AcademyPanel";
import { ChallengesPanel } from "./ChallengesPanel";
import { ChaptersPanel } from "./ChaptersPanel";
import { CalculatorPanel } from "./CalculatorPanel";
import { CalendarPanel } from "./CalendarPanel";
import { JournalPanel } from "./JournalPanel";
import { AiToolsPanel } from "./AiToolsPanel";
import { ProfilePanel } from "./ProfilePanel";
import { MembershipPanel } from "./MembershipPanel";
import { SettingsPanel } from "./SettingsPanel";

export interface PanelProps {
  /** Preselected instrument, from `?pair=` on the URL. */
  pair?: string;
}

/** Slug -> panel. Keys must match src/lib/tabs.ts. */
export const PANELS: Record<string, ComponentType<PanelProps>> = {
  dashboard: OverviewPanel,
  "market-overview": MarketOverviewPanel,
  "market-analysis": MarketAnalysisPanel,
  "market-news": MarketNewsPanel,
  watchlist: WatchlistPanel,
  community: CommunityPanel,
  discussions: DiscussionsPanel,
  academy: AcademyPanel,
  challenges: ChallengesPanel,
  chapters: ChaptersPanel,
  calculator: CalculatorPanel,
  calendar: CalendarPanel,
  journal: JournalPanel,
  ai: AiToolsPanel,
  profile: ProfilePanel,
  membership: MembershipPanel,
  settings: SettingsPanel,
};
