"use client";

import React from "react";

/** Renders markdown from AI output — headings, bold, italic, links, lists, hr, paragraphs */
export default function Markdown({ content }: { content: string }) {
  // Normalize line endings and split into lines
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  const elements: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();

    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(line.trim())) {
      elements.push(<hr key={key++} className="border-white/10 my-4" />);
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      if (level === 1) {
        elements.push(
          <h2 key={key++} className="text-base font-semibold text-white mt-6 mb-2 first:mt-0">
            {renderInline(text)}
          </h2>
        );
      } else if (level === 2) {
        elements.push(
          <h3 key={key++} className="text-[14px] font-semibold text-white/90 mt-5 mb-2 first:mt-0 border-b border-white/10 pb-2">
            {renderInline(text)}
          </h3>
        );
      } else {
        elements.push(
          <h4 key={key++} className="text-[13px] font-medium text-white/80 mt-4 mb-1.5">
            {renderInline(text)}
          </h4>
        );
      }
      continue;
    }

    // Unordered list item (with optional indent)
    const ulMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
    if (ulMatch) {
      const indent = Math.floor((ulMatch[1].length) / 2);
      elements.push(
        <div key={key++} className="flex gap-2.5 my-1" style={{ marginLeft: `${indent * 16}px` }}>
          <span className="text-white/30 shrink-0 mt-[2px]">&#8226;</span>
          <span className="text-sm text-white/70 leading-relaxed">{renderInline(ulMatch[2])}</span>
        </div>
      );
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
    if (olMatch) {
      const indent = Math.floor((olMatch[1].length) / 2);
      elements.push(
        <div key={key++} className="flex gap-2.5 my-1" style={{ marginLeft: `${indent * 16}px` }}>
          <span className="text-white/40 shrink-0 text-sm tabular-nums">{olMatch[2]}.</span>
          <span className="text-sm text-white/70 leading-relaxed">{renderInline(olMatch[3])}</span>
        </div>
      );
      continue;
    }

    // Empty line = spacer
    if (line.trim() === "") {
      elements.push(<div key={key++} className="h-1.5" />);
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={key++} className="text-sm text-white/70 leading-relaxed my-1">
        {renderInline(line)}
      </p>
    );
  }

  return <div className="flex flex-col">{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  // Process inline markdown: links, bold, italic, code, dollar amounts
  // Order matters — match longer/more specific patterns first
  const regex =
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\$(\d[\d,.]*\d)/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let k = 0;

  while ((match = regex.exec(text)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      parts.push(
        <React.Fragment key={k++}>{text.slice(lastIndex, match.index)}</React.Fragment>
      );
    }

    if (match[1] !== undefined && match[2] !== undefined) {
      // [link text](url)
      parts.push(
        <a
          key={k++}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-300 underline underline-offset-2 decoration-blue-400/40 hover:text-blue-200 transition-colors"
        >
          {match[1]}
        </a>
      );
    } else if (match[3] !== undefined) {
      // ***bold italic***
      parts.push(
        <strong key={k++} className="font-semibold italic text-white/90">{match[3]}</strong>
      );
    } else if (match[4] !== undefined) {
      // **bold**
      parts.push(
        <strong key={k++} className="font-semibold text-white/90">{match[4]}</strong>
      );
    } else if (match[5] !== undefined) {
      // *italic*
      parts.push(
        <em key={k++} className="italic text-white/80">{match[5]}</em>
      );
    } else if (match[6] !== undefined) {
      // `code`
      parts.push(
        <code key={k++} className="rounded bg-white/10 px-1.5 py-0.5 text-[12px] text-white/80 font-mono">
          {match[6]}
        </code>
      );
    } else if (match[7] !== undefined) {
      // $123.45
      parts.push(
        <span key={k++} className="font-semibold text-emerald-300">${match[7]}</span>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(
      <React.Fragment key={k++}>{text.slice(lastIndex)}</React.Fragment>
    );
  }

  return parts.length > 0 ? <>{parts}</> : text;
}
