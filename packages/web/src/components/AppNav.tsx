"use client";

import { usePathname } from "next/navigation";
import { Navigation } from "./Navigation";

export function AppNav() {
  const pathname = usePathname();
  return <Navigation currentPath={pathname} />;
}
