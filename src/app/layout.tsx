import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShotFlow — VFX Pipeline Manager",
  description: "Professional VFX shot tracking and pipeline management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
