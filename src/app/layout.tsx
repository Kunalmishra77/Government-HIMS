import type { Metadata } from "next"
// Product typeface: Inter — the open-source stand-in for Stripe's Sohne
// (see /DESIGN.md). Loaded via Google Fonts below; the family stack lives in
// globals.css (`--font-body` / `--font-heading`) with `ss01` enabled globally.
import "./globals.css"
import { Toaster } from "sonner"
import { getLocale } from "next-intl/server"
import { LocaleProvider } from "@/components/i18n/LocaleProvider"
import type { Locale } from "@/i18n/routing"
import { StoreHydrator } from "@/components/StoreHydrator"

export const metadata: Metadata = {
  title: "Agentix HIMS",
  description: "AI-Powered Hospital Management System — Agentix HIMS",
  icons: {
    icon: [
      { url: "/Agentix-logo-favicon.ico", sizes: "any" },
      { url: "/Agentix logo-health.svg", type: "image/svg+xml" },
    ],
    shortcut: "/Agentix-logo-favicon.ico",
    apple: "/Agentix logo-health.svg",
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = (await getLocale()) as Locale

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Noto Sans Devanagari — for Hindi text in CMO cockpit */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning className="font-body antialiased text-foreground bg-background">
        <LocaleProvider initialLocale={locale}>
          <StoreHydrator />
          {children}
        </LocaleProvider>
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            style: { fontFamily: 'var(--font-body, sans-serif)', fontSize: '14px' },
          }}
        />
      </body>
    </html>
  )
}
