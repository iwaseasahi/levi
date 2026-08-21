const assignmentPattern = /^([A-Za-z_][A-Za-z0-9_]*)=/;

function assignedKeys(source: string) {
  return new Set(
    source
      .split(/\r?\n/)
      .map((line) => assignmentPattern.exec(line)?.[1])
      .filter((key): key is string => Boolean(key)),
  );
}

export type LocalEnvironmentPlan = Readonly<{
  addedKeys: readonly string[];
  appendix: string;
  content: string;
  created: boolean;
}>;

export function planLocalEnvironment(
  example: string,
  current?: string,
): LocalEnvironmentPlan {
  const exampleLines = example.split(/\r?\n/);
  const exampleKeys = assignedKeys(example);

  if (current === undefined) {
    return {
      addedKeys: [...exampleKeys],
      appendix: "",
      content: example.endsWith("\n") ? example : `${example}\n`,
      created: true,
    };
  }

  const currentKeys = assignedKeys(current);
  const missingLines = exampleLines.filter((line) => {
    const key = assignmentPattern.exec(line)?.[1];
    return key !== undefined && !currentKeys.has(key);
  });
  const addedKeys = missingLines.map(
    (line) => assignmentPattern.exec(line)?.[1] as string,
  );

  if (missingLines.length === 0) {
    return { addedKeys, appendix: "", content: current, created: false };
  }

  const separator = current.length === 0 || current.endsWith("\n") ? "" : "\n";
  const appendix = `${separator}\n# Added from .env.example by mise run setup.\n${missingLines.join("\n")}\n`;
  return {
    addedKeys,
    appendix,
    content: `${current}${appendix}`,
    created: false,
  };
}
