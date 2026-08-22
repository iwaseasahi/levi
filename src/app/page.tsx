export default function Home() {
  return (
    <main className="shell">
      <section className="card" aria-labelledby="page-title">
        <p className="eyebrow">Levi</p>
        <h1 id="page-title">礼拝投影システム Levi</h1>
        <p>教会用画面を利用するには、ログインしてください。</p>
        <a className="home-login-link" href="/login">
          ログイン画面へ
        </a>
      </section>
    </main>
  );
}
