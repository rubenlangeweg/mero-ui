export function* markupTokens(code) {
  let offset = 0;
  for (const token of code.matchAll(/<!--[\s\S]*?-->|<\/?[\w-]+|\s[\w:-]+(?==)|"[^"]*"|'[^']*'/g)) {
    const source = token[0];
    const type = source.startsWith("<!--")
      ? "comment"
      : source.startsWith("<")
        ? "tag"
        : /^["']/.test(source)
          ? "string"
          : "attr";
    if (token.index > offset) yield [code.slice(offset, token.index), null];
    yield [source, type];
    offset = token.index + source.length;
  }
  if (offset < code.length) yield [code.slice(offset), null];
}
