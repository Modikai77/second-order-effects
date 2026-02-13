"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";

type SessionProviderProps = {
  session: Session | null;
  children: React.ReactNode;
};

export function SessionProviderWrapper({ session, children }: SessionProviderProps) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
