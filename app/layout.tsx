import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  icons: { icon: "/favicon.svg" },
  title: "Applebrook",
  description: "Game desa pertanian pixel. Warga menanam, memanen, dan berdagang sepanjang empat musim.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
