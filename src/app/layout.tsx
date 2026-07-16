import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { getBranding } from "@/lib/branding/branding";
import { brandThemeCss } from "@/lib/branding/color";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { appName } = await getBranding();
  return {
    title: { default: appName, template: `%s – ${appName}` },
    description:
      "File manager for your storage buckets — read-only by default.",
  };
}

// Every page hangs off the live database (session, sources), so nothing is
// prerendered at build time — builds run without a database.
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { primaryColor } = await getBranding();
  const themeCss = primaryColor ? brandThemeCss(primaryColor) : null;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* White-label primary color: overrides the amber defaults from
            globals.css for both modes. Invalid stored colors yield null and
            fall back to the stock theme. */}
        {themeCss ? <style>{themeCss}</style> : null}
        <NuqsAdapter>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <QueryProvider>
              {children}
              <Toaster />
            </QueryProvider>
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
