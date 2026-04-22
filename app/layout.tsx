import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocExplainer — Decode any document in plain language",
  description:
    "An API-orchestration pipeline that turns medical, legal, financial and government documents into plain English and Hindi.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
