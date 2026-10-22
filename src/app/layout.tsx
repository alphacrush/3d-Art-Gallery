import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const serif = Fraunces({ subsets: ["latin"], variable: "--font-serif", weight: ["500", "600", "700"] });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "SUNFLWR - Gallery",
  description:
    "A beautiful walkable 3D gallery for your pictures and video clips. Invite friends with a link — every visitor appears as a live character in the hall.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body className="bg-[#171310] font-sans text-stone-100 antialiased">{children}</body>
    </html>
  );
}
