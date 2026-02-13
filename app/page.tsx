import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SecondOrderEngine } from "@/components/second-order-engine";
import { AuthControls } from "@/components/auth-controls";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return (
      <main className="grid" style={{ gap: 18 }}>
        <section className="panel grid" style={{ gap: 10 }}>
          <h1>Second-Order Effects Engine</h1>
          <p className="muted">
            Sign in to access your private workspace for portfolio stress-testing and scenario isolation.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <a href="/auth/login">
              <button type="button">Sign in</button>
            </a>
            <a href="/auth/register">
              <button type="button" className="secondary">
                Create account
              </button>
            </a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="grid" style={{ gap: 18 }}>
      <AuthControls />
      <section className="grid" style={{ gap: 6 }}>
        <h1>Second-Order Effects Engine</h1>
        <p className="muted">
          Enter a structural shift, map causal layers, and quantify expected portfolio bias.
        </p>
      </section>
      <SecondOrderEngine />
    </main>
  );
}
