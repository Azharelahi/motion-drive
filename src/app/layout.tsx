import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Motion Drive Rental Manager",
  description: "Vehicle rental management for Motion Drive Pty Ltd.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU">
      <body>{children}</body>
    </html>
  );
}
