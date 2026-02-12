import { SecondOrderEngine } from "@/components/second-order-engine";

export default function HomePage() {
  return (
    <main className="grid" style={{ gap: 18 }}>
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
