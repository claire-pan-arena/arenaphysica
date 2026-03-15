"use client";

/** Minimal markdown renderer for AI output — handles headings, bold, links, lists, and paragraphs */
export default function Markdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headings
    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-[13px] font-semibold tracking-wide text-white/90 uppercase mt-5 mb-2 first:mt-0">
          {renderInline(line.slice(3))}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-[12px] font-medium text-white/80 mt-4 mb-1.5">
          {renderInline(line.slice(4))}
        </h3>
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="text-[15px] font-semibold text-white mt-5 mb-2 first:mt-0">
          {renderInline(line.slice(2))}
        </h1>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div key={i} className="flex gap-2 ml-1 my-0.5">
          <span className="text-white/30 shrink-0">-</span>
          <span className="text-sm text-white/70 leading-relaxed">{renderInline(line.slice(2))}</span>
        </div>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+)\.\s(.*)$/);
      if (match) {
        elements.push(
          <div key={i} className="flex gap-2 ml-1 my-0.5">
            <span className="text-white/40 shrink-0 text-sm">{match[1]}.</span>
            <span className="text-sm text-white/70 leading-relaxed">{renderInline(match[2])}</span>
          </div>
        );
      }
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p key={i} className="text-sm text-white/70 leading-relaxed my-0.5">
          {renderInline(line)}
        </p>
      );
    }
  }

  return <div>{elements}</div>;
}

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match markdown links [text](url), bold **text**, and inline code `text`
  const regex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\$(\d[\d,.]*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1] && match[2]) {
      // Link
      parts.push(
        <a
          key={match.index}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-300/90 underline underline-offset-2 decoration-blue-300/30 hover:text-blue-200 hover:decoration-blue-200/50 transition-colors"
        >
          {match[1]}
        </a>
      );
    } else if (match[3]) {
      // Bold
      parts.push(
        <strong key={match.index} className="font-semibold text-white/90">{match[3]}</strong>
      );
    } else if (match[4]) {
      // Inline code
      parts.push(
        <code key={match.index} className="rounded bg-white/10 px-1.5 py-0.5 text-[12px] text-white/80">{match[4]}</code>
      );
    } else if (match[5]) {
      // Dollar amount
      parts.push(
        <span key={match.index} className="font-medium text-emerald-300/90">${match[5]}</span>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
