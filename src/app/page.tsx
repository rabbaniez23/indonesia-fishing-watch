import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { LandingPage } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "Indonesia Fishing Watch · Platform Pemantauan Maritim & Perikanan",
  description:
    "Platform riset dan pemantauan aktivitas maritim teramati di Indonesia berbasis satelit, AIS Global Fishing Watch, VIIRS boat detection, dan Copernicus Marine.",
};

async function LandingWithUser() {
  const user = await getCurrentUser();
  return <LandingPage user={user} />;
}

export default function Home() {
  return (
    <Suspense fallback={<LandingPage user={null} />}>
      <LandingWithUser />
    </Suspense>
  );
}
