import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Foundry Management System - نظام إدارة المسبك',
  description: 'Aluminum Foundry Management System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
