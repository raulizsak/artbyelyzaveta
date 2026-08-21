import type { ReactNode } from "react";

const inline = (text: string): ReactNode[] =>
  text
    .split(/(\*\*.*?\*\*)/g)
    .filter(Boolean)
    .map((part, index) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
      ) : (
        part
      ),
    );

export function PolicyContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const nodes: ReactNode[] = [];
  for (let index = 0; index < lines.length; ) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }
    if (line.startsWith("### ")) {
      nodes.push(<h2 key={`h-${index}`}>{line.slice(4)}</h2>);
      index += 1;
      continue;
    }
    if (line.startsWith("* ")) {
      const items: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith("* ")) {
        items.push(lines[index].trim().slice(2));
        index += 1;
      }
      nodes.push(
        <ul key={`ul-${index}`}>
          {items.map((item) => (
            <li key={item}>{inline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\. /.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\. /, ""));
        index += 1;
      }
      nodes.push(
        <ol key={`ol-${index}`}>
          {items.map((item) => (
            <li key={item}>{inline(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }
    nodes.push(<p key={`p-${index}`}>{inline(line)}</p>);
    index += 1;
  }
  return <div className="policy-copy">{nodes}</div>;
}
