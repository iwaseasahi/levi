process.env.DATABASE_URL ??=
  "postgresql://levi:levi@127.0.0.1:55433/levi_test?schema=public";
process.env.SHADOW_DATABASE_URL ??=
  "postgresql://levi:levi@127.0.0.1:55433/levi_shadow?schema=public";
