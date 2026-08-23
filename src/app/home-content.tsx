export function HomeContent({ isLoggedIn }: { isLoggedIn: boolean }) {
  const action = isLoggedIn
    ? { href: "/scripture", label: "聖書検索" }
    : { href: "/login", label: "ログイン" };

  return (
    <main className="shell">
      <section className="card" aria-labelledby="page-title">
        <h1 id="page-title">礼拝投影システム Levi</h1>
        <a className="home-login-link" href={action.href}>
          {action.label}
        </a>
      </section>
    </main>
  );
}
