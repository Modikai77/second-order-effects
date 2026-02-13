"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, confirmPassword })
    });

    const payload = (await response.json()) as { ok?: boolean; error?: unknown };
    if (!response.ok || payload.ok === false) {
      setError(
        typeof payload.error === "string"
          ? payload.error
          : "Registration failed. Please check your input."
      );
      setLoading(false);
      return;
    }

    router.push("/auth/login");
  };

  return (
    <main style={{ maxWidth: 420 }}>
      <h1>Create account</h1>
      <form className="panel grid" onSubmit={onSubmit} style={{ gap: 12 }}>
        <label htmlFor="name">Name</label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <label htmlFor="confirm-password">Confirm password</label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create account"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
      <p className="muted" style={{ marginTop: 10 }}>
        Already have an account? <a href="/auth/login">Sign in</a>
      </p>
    </main>
  );
}
