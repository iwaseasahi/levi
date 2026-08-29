const nodeEnvironments = ["development", "test", "production"] as const;

type NodeEnvironment = (typeof nodeEnvironments)[number];

export interface AuthRuntimeConfig {
  secret: string;
  baseURL: string;
  trustedOrigins: string[];
  nodeEnvironment: NodeEnvironment;
}

export type AdminAuthRuntimeConfig = AuthRuntimeConfig;

export interface DiscardMailRuntimeConfig {
  deliveryMode: "discard";
  from: string;
}

export interface SmtpMailRuntimeConfig {
  deliveryMode: "smtp";
  from: string;
  host: string;
  password?: string;
  port: number;
  secure: boolean;
  user?: string;
}

export type MailRuntimeConfig =
  DiscardMailRuntimeConfig | SmtpMailRuntimeConfig;

export interface AdminBasicAuthConfig {
  passwordHash: string;
  username: string;
}

const ADMIN_PASSWORD_HASH_PATTERN = /^[a-f0-9]{32}:[a-f0-9]{128}$/;

export function parseAdminBasicAuthConfig(values: {
  passwordHash: string | undefined;
  username: string | undefined;
}): AdminBasicAuthConfig {
  const username = values.username?.trim() ?? "";
  if (
    username.length < 1 ||
    username.length > 128 ||
    username.includes(":") ||
    /[\u0000-\u001f\u007f]/.test(username)
  ) {
    throw new Error("ADMIN_BASIC_AUTH_USERNAME is invalid");
  }

  const passwordHash = values.passwordHash?.trim() ?? "";
  if (!ADMIN_PASSWORD_HASH_PATTERN.test(passwordHash)) {
    throw new Error("ADMIN_BASIC_AUTH_PASSWORD_HASH is invalid");
  }

  return { passwordHash, username };
}

export function getAdminBasicAuthConfig(): AdminBasicAuthConfig {
  return parseAdminBasicAuthConfig({
    passwordHash: process.env.ADMIN_BASIC_AUTH_PASSWORD_HASH,
    username: process.env.ADMIN_BASIC_AUTH_USERNAME,
  });
}

export function parseNodeEnvironment(
  value: string | undefined,
): NodeEnvironment {
  const candidate = value ?? "development";

  if (nodeEnvironments.some((environment) => environment === candidate)) {
    return candidate as NodeEnvironment;
  }

  throw new Error(`Invalid NODE_ENV: ${candidate}`);
}

export const env = Object.freeze({
  nodeEnv: parseNodeEnvironment(process.env.NODE_ENV),
});

export function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for database access");
  }

  return databaseUrl;
}

function parseExactOrigin(value: string, label: string): string {
  if (value.includes("*")) {
    throw new Error(`${label} must not contain a wildcard`);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute URL origin`);
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${label} must be an exact HTTP(S) origin`);
  }

  return url.origin;
}

export function parseAuthRuntimeConfig(
  values: {
    secret: string | undefined;
    baseURL: string | undefined;
    trustedOrigins: string | undefined;
  },
  nodeEnvironment: NodeEnvironment,
): AuthRuntimeConfig {
  if (!values.secret || values.secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters");
  }
  if (!values.baseURL) {
    throw new Error("BETTER_AUTH_BASE_URL is required");
  }

  const baseURL = parseExactOrigin(
    values.baseURL.trim(),
    "BETTER_AUTH_BASE_URL",
  );
  const trustedOrigins = (values.trustedOrigins ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin, index) =>
      parseExactOrigin(origin, `BETTER_AUTH_TRUSTED_ORIGINS[${index}]`),
    );

  if (trustedOrigins.length === 0 || !trustedOrigins.includes(baseURL)) {
    throw new Error(
      "BETTER_AUTH_TRUSTED_ORIGINS must include BETTER_AUTH_BASE_URL",
    );
  }
  if (
    nodeEnvironment === "production" &&
    [baseURL, ...trustedOrigins].some(
      (origin) => new URL(origin).protocol !== "https:",
    )
  ) {
    throw new Error("Production Better Auth origins must use HTTPS");
  }

  return {
    secret: values.secret,
    baseURL,
    trustedOrigins: [...new Set(trustedOrigins)],
    nodeEnvironment,
  };
}

export function getAuthRuntimeConfig(): AuthRuntimeConfig {
  return parseAuthRuntimeConfig(
    {
      secret: process.env.BETTER_AUTH_SECRET,
      baseURL: process.env.BETTER_AUTH_BASE_URL,
      trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
    },
    env.nodeEnv,
  );
}

export function getAdminAuthRuntimeConfig(): AdminAuthRuntimeConfig {
  return parseAuthRuntimeConfig(
    {
      secret:
        process.env.ADMIN_BETTER_AUTH_SECRET ??
        (env.nodeEnv === "production"
          ? undefined
          : process.env.BETTER_AUTH_SECRET),
      baseURL: process.env.BETTER_AUTH_BASE_URL,
      trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
    },
    env.nodeEnv,
  );
}

export function parseMailRuntimeConfig(
  values: {
    deliveryMode?: string | undefined;
    from: string | undefined;
    host: string | undefined;
    password: string | undefined;
    port: string | undefined;
    secure: string | undefined;
    user: string | undefined;
  },
  nodeEnvironment: NodeEnvironment,
): MailRuntimeConfig {
  const from = values.from?.trim();
  const deliveryMode = values.deliveryMode ?? "smtp";
  if (!from || !/^\S+@\S+\.\S+$/.test(from))
    throw new Error("MAIL_FROM must be an email address");
  if (deliveryMode !== "smtp" && deliveryMode !== "discard")
    throw new Error("MAIL_DELIVERY_MODE must be smtp or discard");
  if (deliveryMode === "discard") {
    if (nodeEnvironment !== "test")
      throw new Error("Discarded mail delivery is allowed only in tests");
    return { deliveryMode, from };
  }

  const host = values.host?.trim();
  const port = Number(values.port ?? "");
  if (!host) throw new Error("SMTP_HOST is required");
  if (!Number.isInteger(port) || port < 1 || port > 65_535)
    throw new Error("SMTP_PORT is invalid");
  if (!["true", "false"].includes(values.secure ?? "false"))
    throw new Error("SMTP_SECURE must be true or false");
  const user = values.user?.trim() || undefined;
  const password = values.password || undefined;
  if ((user && !password) || (!user && password))
    throw new Error("SMTP_USER and SMTP_PASSWORD must be set together");
  if (nodeEnvironment === "production") {
    if (
      host !== "smtp.gmail.com" ||
      port !== 587 ||
      values.secure !== "false" ||
      !user ||
      !password
    )
      throw new Error(
        "Production SMTP must use authenticated Gmail on port 587",
      );
  }
  return {
    deliveryMode,
    from,
    host,
    port,
    secure: values.secure === "true",
    ...(password ? { password } : {}),
    ...(user ? { user } : {}),
  };
}

export function getMailRuntimeConfig(): MailRuntimeConfig {
  return parseMailRuntimeConfig(
    {
      deliveryMode: process.env.MAIL_DELIVERY_MODE,
      from: process.env.MAIL_FROM,
      host: process.env.SMTP_HOST,
      password: process.env.SMTP_PASSWORD,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE,
      user: process.env.SMTP_USER,
    },
    env.nodeEnv,
  );
}
