"use client";

import { TickerRow } from "@/components/dashboard/TickerRow";
import { MarketPulse } from "@/components/dashboard/MarketPulse";
import { PatternRadarWidget } from "@/components/dashboard/PatternRadar";
import { MarketIntelligence } from "@/components/dashboard/MarketIntelligence";
import { EconomicCalendar } from "@/components/dashboard/EconomicCalendar";
import { AiAssistant } from "@/components/dashboard/AiAssistant";
import { CommunityFeed } from "@/components/dashboard/CommunityFeed";
import { MyAlliance } from "@/components/dashboard/MyAlliance";
import { StreakBoard } from "@/components/dashboard/StreakBoard";
import { GfxaChat } from "@/components/dashboard/GfxaChat";
import { MembershipCard } from "@/components/dashboard/MembershipCard";

export function OverviewPanel() {
  return (
    <div className="space-y-5">
      <TickerRow />
      <MyAlliance />

      {/* L1 what's happening -> L3 why -> L4/L5 what traders and AI think */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <MarketPulse />
          <PatternRadarWidget />
          <MarketIntelligence />
          <EconomicCalendar />
        </div>

        <div className="space-y-5">
          <AiAssistant />
          <GfxaChat />
          <CommunityFeed />
          <StreakBoard />
          <MembershipCard />
        </div>
      </div>
    </div>
  );
}
