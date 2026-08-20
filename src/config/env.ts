const nodeEnvironments = ["development", "test", "production"] as const;

type NodeEnvironment = (typeof nodeEnvironments)[number];

function parseNodeEnvironment(value: string | undefined): NodeEnvironment {
  const candidate = value ?? "development";

  if (nodeEnvironments.some((environment) => environment === candidate)) {
    return candidate as NodeEnvironment;
  }

  throw new Error(`Invalid NODE_ENV: ${candidate}`);
}

export const env = Object.freeze({
  nodeEnv: parseNodeEnvironment(process.env.NODE_ENV),
});
