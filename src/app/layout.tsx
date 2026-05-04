import { Syne, DM_Sans } from "next/font/google";
import "./globals.css";
import { PrivyProvider } from "@/components/privy-provider";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export const metadata = {
  title: "StarkFlow: Gasless Payments for the Rest of Us",
  description: "High Performance | Self Custodial | Cross Chain Execution.",
  openGraph: {
    images: [{ url: '/logo.png' }],
  },
  icons: {
    icon: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable}`}>
      <body className="font-sans antialiased bg-black text-white">
        <PrivyProvider>{children}</PrivyProvider>
      </body>
    </html>
  );
}
