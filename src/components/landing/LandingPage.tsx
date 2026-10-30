import type { SafeUser } from "@/lib/auth/service";
import { LandingNavbar } from "./LandingNavbar";
import { LandingHero } from "./LandingHero";
import { LandingFeatures } from "./LandingFeatures";
import { LandingInteractiveDemo } from "./LandingInteractiveDemo";
import { LandingZones } from "./LandingZones";
import { LandingTeam } from "./LandingTeam";
import { LandingDataGov } from "./LandingDataGov";
import { LandingFaq } from "./LandingFaq";
import { LandingContact } from "./LandingContact";
import { LandingFooter } from "./LandingFooter";

export function LandingPage({ user }: { user: SafeUser | null }) {
  return (
    <div className="min-h-screen bg-white text-ink selection:bg-primary-soft selection:text-primary scroll-smooth">
      <LandingNavbar user={user} />
      <main>
        <LandingHero user={user} />
        <LandingFeatures />
        <LandingInteractiveDemo />
        <LandingZones />
        <LandingTeam />
        <LandingDataGov />
        <LandingFaq />
        <LandingContact />
      </main>
      <LandingFooter user={user} />
    </div>
  );
}
