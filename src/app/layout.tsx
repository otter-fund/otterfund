import type { Metadata, Viewport } from "next";
import { Newsreader, Hanken_Grotesk, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import { Providers } from "@/components/providers";
import { JsonLd } from "@/components/seo/json-ld";
import {
  ALL_KEYWORDS,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
  organizationLd,
  softwareApplicationLd,
  websiteLd,
} from "@/lib/seo";
import "./globals.css";

// otterfund design system typefaces:
//   Newsreader (display + figures), Hanken Grotesk (interface + data),
//   Space Grotesk (the brand wordmark, via <Wordmark>)
const newsreader = Newsreader({
  variable: "--font-num",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const hanken = Hanken_Grotesk({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Space Grotesk is reserved for the otterfund name itself: a signature face
// set apart from the body so the brand reads as a wordmark wherever it appears.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Brand always leads the title (visible first in the tab and search result);
  // the descriptor follows. Home renders an absolute title; every other page
  // slots into the template after the brand.
  title: {
    default: `${SITE_NAME} · AI Budgeting App`,
    template: `${SITE_NAME} · %s`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ALL_KEYWORDS,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "finance",
  alternates: { canonical: "/" },
  formatDetection: { email: false, address: false, telephone: false },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} · ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} · ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

// iOS: viewport-fit=cover lets the app paint edge-to-edge on notched iPhones
// (the CSS then respects env(safe-area-inset-*)); the theme color tints
// Safari's collapsed chrome to the warm canvas so the frame blends in.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f5f3ec",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${hanken.variable} ${spaceGrotesk.variable} h-full antialiased`}
      // The boot script below mutates <html>'s class/color-scheme before React
      // hydrates (to avoid a light→dark flash), so the server/client markup
      // intentionally differs here — silence the hydration warning for it only.
      suppressHydrationWarning
    >
      <head>
        {/* Pre-paint theme boot — set the night class from the `of-appearance`
            cookie (System resolved via the OS) BEFORE first paint, so a reload in
            dark never flashes light. Gated to the authenticated app (/dashboard,
            /dev); pre-auth pages (landing, login, onboarding) always stay light.
            next/script @ beforeInteractive inlines it into the server HTML so it
            runs before hydration — Next 16 rejects a raw executable <script>. */}
        <Script id="of-theme-boot" strategy="beforeInteractive">
          {"(function(){try{var p=location.pathname;if(p.indexOf('/dashboard')!==0&&p.indexOf('/dev')!==0)return;var m=document.cookie.match(/(?:^|; )of-appearance=([^;]*)/);var v=m?decodeURIComponent(m[1]):'system';var d=v==='dark'||(v!=='light'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){var e=document.documentElement;e.classList.add('dark');e.style.colorScheme='dark';}}catch(e){}})();"}
        </Script>
      </head>
      <body className="min-h-full flex flex-col">
        {/* Site-wide structured data — identifies the brand, the site, and the
            app (a FinanceApplication) to search engines for rich results. */}
        <JsonLd data={[organizationLd(), websiteLd(), softwareApplicationLd()]} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
