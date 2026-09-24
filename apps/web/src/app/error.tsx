"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="shell">
      <h1>Stories are temporarily unavailable.</h1>
      <p>Please try again shortly.</p>
      <button onClick={reset}>Try again</button>
    </section>
  );
}
