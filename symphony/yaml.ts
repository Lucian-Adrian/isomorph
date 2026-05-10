function parseScalar(raw: string): unknown {
  const value = raw.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map(item => String(parseScalar(item.trim())).replace(/^["']|["']$/g, ''));
  }
  return value.replace(/^["']|["']$/g, '');
}

function setAtPath(root: Record<string, unknown>, path: string[], key: string, value: unknown) {
  let node: Record<string, unknown> = root;
  for (const segment of path) {
    const current = node[segment];
    if (!current || Array.isArray(current) || typeof current !== 'object') node[segment] = {};
    node = node[segment] as Record<string, unknown>;
  }
  node[key] = value;
}

export function parseSimpleYaml(source: string): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  const stack: Array<{ indent: number; key: string; isList?: boolean }> = [];
  const lines = source.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const indent = raw.match(/^\s*/)?.[0].length ?? 0;
    const trimmed = raw.trim();

    while (stack.length > 0 && indent <= stack[stack.length - 1].indent) stack.pop();
    const path = stack.map(entry => entry.key);

    if (trimmed.startsWith('- ')) {
      const parent = stack[stack.length - 1];
      if (!parent) continue;
      let node: Record<string, unknown> = root;
      for (const segment of stack.slice(0, -1).map(entry => entry.key)) node = node[segment] as Record<string, unknown>;
      if (!Array.isArray(node[parent.key])) node[parent.key] = [];
      const list = node[parent.key] as unknown[];
      const content = trimmed.slice(2);
      if (content.includes(':')) {
        const [key, ...rest] = content.split(':');
        const item: Record<string, unknown> = {};
        item[key.trim()] = parseScalar(rest.join(':'));
        list.push(item);
        stack.push({ indent, key: String(list.length - 1), isList: true });
      } else {
        list.push(parseScalar(content));
      }
      continue;
    }

    const [keyPart, ...rest] = trimmed.split(':');
    const key = keyPart.trim();
    const value = rest.join(':');
    if (!key) continue;
    if (value.trim() === '') {
      setAtPath(root, path, key, {});
      stack.push({ indent, key });
    } else {
      setAtPath(root, path, key, parseScalar(value));
    }
  }

  return root;
}
