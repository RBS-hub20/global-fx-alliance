import { Navbar } from "@/components/landing/Navbar";
import { LiveBanner } from "@/components/launch/LiveBanner";
import { SocialProof } from "@/components/launch/SocialProof";
import { Hero } from "@/components/landing/Hero";
import { WhySection } from "@/components/landing/WhySection";
import { MarketIntelligencePreview } from "@/components/landing/MarketIntelligencePreview";
import { GlobalCommunity } from "@/components/landing/GlobalCommunity";
import { ChaptersPreview } from "@/components/landing/ChaptersPreview";
import { MembersSection } from "@/components/landing/MembersSection";
import { AcademyPreview } from "@/components/landing/AcademyPreview";
import { JourneySection } from "@/components/landing/JourneySection";
import { EcosystemSection } from "@/components/landing/EcosystemSection";
import { BlogPreview } from "@/components/landing/BlogPreview";
import { FinalCta } from "@/components/landing/FinalCta";
import { Footer } from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <>
      <LiveBanner />
      <Navbar />
      <main style={{ paddingTop: "var(--gfxa-banner-h, 0px)" }}>
        <Hero />
        <SocialProof />
        <WhySection />
        <MarketIntelligencePreview />
        <GlobalCommunity />
        <ChaptersPreview />
        <MembersSection />
        <AcademyPreview />
        <JourneySection />
        <EcosystemSection />
        <BlogPreview />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
