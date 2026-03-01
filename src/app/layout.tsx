import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Keep In Touch CRM",
  description: "Personal contact relationship manager",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <div className="flex min-h-screen">
          <div className="hidden md:block">
            <Sidebar />
          </div>
          <main className="flex-1 md:ml-64">
            <div className="container mx-auto p-4 pb-20 md:p-8 md:pb-8">
              {children}
            </div>
          </main>
          <MobileNav />
        </div>
      </body>
    </html>
  );
}
