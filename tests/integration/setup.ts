import { assertDedicatedTestEnvironment } from "@/infrastructure/database/test-database-guard";

process.env.DATABASE_URL ??=
  "postgresql://levi:levi@127.0.0.1:55433/levi_test?schema=public";
process.env.SHADOW_DATABASE_URL ??=
  "postgresql://levi:levi@127.0.0.1:55433/levi_shadow?schema=public";
process.env.BETTER_AUTH_SECRET ??= "x".repeat(32);
process.env.ADMIN_BETTER_AUTH_SECRET ??= "a".repeat(32);
process.env.BETTER_AUTH_BASE_URL ??= "http://localhost:3000";
process.env.BETTER_AUTH_TRUSTED_ORIGINS ??= "http://localhost:3000";
process.env.MAIL_FROM ??= "levi-integration@example.test";
process.env.SMTP_HOST ??= "127.0.0.1";
process.env.SMTP_PORT ??= "1125";
process.env.SMTP_SECURE ??= "false";

assertDedicatedTestEnvironment(process.env);
