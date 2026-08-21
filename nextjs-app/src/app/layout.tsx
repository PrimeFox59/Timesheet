import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Timesheet METSO | Commissioning Management System",
  description: "Modern Glassmorphism Timesheet and Commissioning Management System powered by Next.js and SQLite.",
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
