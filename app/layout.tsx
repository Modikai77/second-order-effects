import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Second-Order Effects Engine",
  description: "Portfolio stress-testing for structural themes"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
