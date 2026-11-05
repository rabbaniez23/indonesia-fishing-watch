import { Roboto_Condensed } from "next/font/google";

// Hanya dipakai di landing; aplikasi tetap memakai Inter. Di-self-host oleh next/font saat build.
export const landingFont = Roboto_Condensed({
  variable: "--font-landing",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  display: "swap",
});
