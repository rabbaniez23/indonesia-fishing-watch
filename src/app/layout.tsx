import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Inter di-self-host oleh next/font saat build; browser tidak meminta ke Google.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Indonesia Fishing Watch",
    template: "%s · Indonesia Fishing Watch",
  },
  description:
    "Pilot internal pemantauan aktivitas maritim teramati di Indonesia berbasis data Global Fishing Watch.",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${inter.variable} antialiased`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
