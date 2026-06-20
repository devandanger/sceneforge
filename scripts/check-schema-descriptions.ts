import { exportVideoJsonSchema } from "@sceneforge/schema";

// Fails CI if any property in the generated JSON Schema lacks a non-empty
// `description`. The generated schema is the runtime discovery contract for
// agentic workflows, so "every capability documents itself" is enforced here
// rather than left to reviewer diligence. Add a .describe() in
// packages/schema/src/index.ts for anything this flags.

type JsonSchemaNode = Record<string, unknown>;

const missing: string[] = [];

function isObject(value: unknown): value is JsonSchemaNode {
  return typeof value === "object" && value !== null;
}

function hasDescription(node: unknown): boolean {
  return isObject(node) && typeof node.description === "string" && node.description.trim() !== "";
}

function walk(node: unknown, pathLabel: string): void {
  if (!isObject(node)) {
    return;
  }

  if (isObject(node.properties)) {
    for (const [key, child] of Object.entries(node.properties)) {
      const childPath = pathLabel ? `${pathLabel}.${key}` : key;
      if (!hasDescription(child)) {
        missing.push(childPath);
      }
      walk(child, childPath);
    }
  }

  for (const combinator of ["anyOf", "oneOf", "allOf"] as const) {
    const branches = node[combinator];
    if (Array.isArray(branches)) {
      branches.forEach((branch, index) => walk(branch, `${pathLabel}[${combinator}:${index}]`));
    }
  }

  if (node.items) {
    walk(node.items, `${pathLabel}[]`);
  }

  for (const container of ["definitions", "$defs"] as const) {
    const defs = node[container];
    if (isObject(defs)) {
      for (const [name, def] of Object.entries(defs)) {
        walk(def, pathLabel ? `${pathLabel}/${name}` : name);
      }
    }
  }
}

walk(exportVideoJsonSchema(), "");

const unique = [...new Set(missing)].sort();

if (unique.length > 0) {
  console.error("Schema fields missing a .describe():");
  for (const field of unique) {
    console.error(`  - ${field}`);
  }
  console.error(`\n${unique.length} undescribed field(s). Add .describe(...) in packages/schema/src/index.ts.`);
  process.exit(1);
}

console.log("All schema fields have descriptions.");
