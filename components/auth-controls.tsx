"use client";

import { signOut, useSession } from "next-auth/react";

export function AuthControls() {
  const { data: session, status } = useSession();

  if (status !== "authenticated" || !session?.user) {
    return null;
  }

  return (
    <section className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <p>
        Signed in as <strong>{session.user.email}</strong>
      </p>
      <button type="button" onClick={() => void signOut({ callbackUrl: "/auth/login" })}>
        Sign out
      </button>
    </section>
  );
}
