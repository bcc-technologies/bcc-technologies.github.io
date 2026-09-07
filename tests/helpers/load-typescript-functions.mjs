import { stripTypeScriptTypes } from "node:module";

function functionSource(source, name) {
  const declaration = new RegExp(`function\\s+${name}\\s*\\(`).exec(source);
  if (!declaration) throw new Error(`Function ${name} was not found`);

  const bodyStart = source.indexOf("{", declaration.index);
  if (bodyStart < 0) throw new Error(`Function ${name} has no body`);

  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(declaration.index, index + 1);
    }
  }
  throw new Error(`Function ${name} has an unterminated body`);
}

export function loadTypeScriptFunctions(source, names, injected = {}) {
  const declarations = names.map(name => functionSource(source, name)).join("\n");
  const transformed = stripTypeScriptTypes(declarations, { mode: "transform" });
  const keys = Object.keys(injected);
  const factory = new Function(...keys, `${transformed}\nreturn { ${names.join(", ")} };`);
  return factory(...keys.map(key => injected[key]));
}
