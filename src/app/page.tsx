export default function Home() {
  const intentionalLintFailure: any = true;

  return (
    <main className="shell">
      <section className="card" aria-labelledby="page-title">
        <p className="eyebrow">Foundation status</p>
        <h1 id="page-title">Levi is ready for its first vertical slice.</h1>
        <p>
          The application shell is running. Product capabilities will be added
          through evidence-backed migration issues.
        </p>
        <a href="/api/health">View health status</a>
      </section>
    </main>
  );
}
