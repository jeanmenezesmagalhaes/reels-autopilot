import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getLocale } from "@/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reels Autopilot",
  description: "Fila de Trial Reels",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = (await cookies()).get("theme")?.value;
  const locale = await getLocale();
  return (
    <html lang={locale === "pt" ? "pt-BR" : locale} data-theme={theme === "light" || theme === "dark" ? theme : "system"}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
