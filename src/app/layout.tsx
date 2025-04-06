import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'UAE Corporate Tax Analysis',
  description: 'Advanced tax analysis for UAE businesses',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
} 