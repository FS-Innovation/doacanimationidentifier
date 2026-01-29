import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TAS - Transcript Animation Spotter",
  description: "Identify animation-worthy moments in your transcripts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
