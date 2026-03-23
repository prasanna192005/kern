"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import CommandPalette from "@/components/CommandPalette";

export default function LayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login";

  if (isAuthPage) {
    return (
      <main className="relative flex-1 min-h-screen">
        {children}
      </main>
    );
  }

  return (
    <>
      <Navbar />
      <CommandPalette />
      <main className="relative flex-1 min-h-screen pl-20 lg:pl-64">
        {children}
      </main>
    </>
  );
}
