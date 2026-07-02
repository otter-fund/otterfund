import type { Metadata } from "next";
import { Newsreader, Hanken_Grotesk } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

// Bulga design system — the only two typefaces:
//   Newsreader (display + figures), Hanken Grotesk (interface + data)
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

export const metadata: Metadata = {
  title: "Bulga — Your money, in balance",
  description: "Calm, confident budgeting that does the math so you don't have to.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${hanken.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
