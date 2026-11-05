import type { SafeUser } from "@/lib/auth/service";
import { oceanMeta } from "@/lib/oseanografi/data";
import { WPP_NAMES } from "@/lib/regions";
import { viirsMeta, viirsProfile } from "@/lib/viirs/data";
import { monthLabel } from "@/lib/viirs/format";
import "./landing.css";
import { landingFont } from "./fonts";
import { LandingContact } from "./LandingContact";
import { LandingData, type LandingStats } from "./LandingData";
import { LandingFaq } from "./LandingFaq";
import { LandingFeatures } from "./LandingFeatures";
import { LandingFooter } from "./LandingFooter";
import { LandingHero } from "./LandingHero";
import { LandingNavbar } from "./LandingNavbar";
import { LandingTeam } from "./LandingTeam";
import { LandingZones, type LandingWpp } from "./LandingZones";

export function LandingPage({ user }: { user: SafeUser | null }) {
  const period = `${monthLabel(viirsMeta.dateRange.start.slice(0, 7))} – ${monthLabel(viirsMeta.dateRange.end.slice(0, 7))}`;
  const zones: LandingWpp[] = viirsMeta.wpp.map((code) => ({
    code,
    name: WPP_NAMES[code],
    detections: viirsProfile.wpp[code].n,
    share: viirsProfile.wpp[code].share ?? 0,
  }));
  const stats: LandingStats = {
    detections: viirsProfile.total.n,
    period: `${viirsMeta.dateRange.start.slice(0, 4)}–${viirsMeta.dateRange.end.slice(0, 4)}`,
    wpp: zones.length,
    oceanVariables: oceanMeta.variables.length,
  };

  return (
    <div className={`${landingFont.variable} bg-black font-[family-name:var(--font-landing)] text-white selection:bg-white selection:text-black`}>
      <LandingNavbar user={user} />
      <main>
        <LandingHero user={user} />
        <LandingData stats={stats} />
        <LandingFeatures />
        <LandingZones zones={zones} period={period} />
        <LandingTeam />
        <LandingFaq />
        <LandingContact user={user} />
      </main>
      <LandingFooter />
    </div>
  );
}
