/**
 * Notion API client for fetching page content.
 * Requires NOTION_API_KEY environment variable (internal integration token).
 */

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

/** Extract a Notion page ID from various URL formats */
export function parseNotionPageId(url: string): string | null {
  // Handle: https://www.notion.so/workspace/Page-Title-abc123def456
  // Handle: https://notion.so/abc123def456
  // Handle: https://myspace.notion.site/Page-Title-abc123def456
  // The page ID is the last 32 hex chars (with or without dashes)
  const match = url.match(/([a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  if (!match) return null;
  const raw = match[1].replace(/-/g, "");
  // Format as UUID
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
}

/** Check if a string contains a Notion URL */
export function containsNotionUrl(text: string): string | null {
  const match = text.match(/https?:\/\/(?:www\.)?notion\.(?:so|site)\/[^\s)]+/i);
  return match ? match[0] : null;
}

/** Extract all Notion URLs from text */
export function extractNotionUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/(?:www\.)?notion\.(?:so|site)\/[^\s)]+/gi);
  return matches || [];
}

async function notionFetch(path: string, apiKey: string): Promise<any> {
  const res = await fetch(`${NOTION_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Notion API error (${res.status}): ${errText}`);
  }
  return res.json();
}

/** Convert a Notion rich_text array to plain text */
function richTextToPlain(richText: any[]): string {
  if (!richText || !Array.isArray(richText)) return "";
  return richText.map((rt: any) => rt.plain_text || "").join("");
}

/** Convert a single Notion block to markdown-like text */
function blockToMarkdown(block: any, depth: number = 0): string {
  const indent = "  ".repeat(depth);
  const type = block.type;

  switch (type) {
    case "paragraph":
      return `${indent}${richTextToPlain(block.paragraph?.rich_text)}\n`;
    case "heading_1":
      return `\n# ${richTextToPlain(block.heading_1?.rich_text)}\n`;
    case "heading_2":
      return `\n## ${richTextToPlain(block.heading_2?.rich_text)}\n`;
    case "heading_3":
      return `\n### ${richTextToPlain(block.heading_3?.rich_text)}\n`;
    case "bulleted_list_item":
      return `${indent}- ${richTextToPlain(block.bulleted_list_item?.rich_text)}\n`;
    case "numbered_list_item":
      return `${indent}1. ${richTextToPlain(block.numbered_list_item?.rich_text)}\n`;
    case "to_do": {
      const checked = block.to_do?.checked ? "[x]" : "[ ]";
      return `${indent}- ${checked} ${richTextToPlain(block.to_do?.rich_text)}\n`;
    }
    case "toggle":
      return `${indent}<toggle> ${richTextToPlain(block.toggle?.rich_text)}\n`;
    case "quote":
      return `${indent}> ${richTextToPlain(block.quote?.rich_text)}\n`;
    case "callout":
      return `${indent}> ${richTextToPlain(block.callout?.rich_text)}\n`;
    case "code":
      return `${indent}\`\`\`\n${indent}${richTextToPlain(block.code?.rich_text)}\n${indent}\`\`\`\n`;
    case "divider":
      return `\n---\n`;
    case "table_row":
      return `${indent}| ${(block.table_row?.cells || []).map((c: any) => richTextToPlain(c)).join(" | ")} |\n`;
    case "child_page":
      return `${indent}[Child Page: ${block.child_page?.title || "Untitled"}]\n`;
    case "child_database":
      return `${indent}[Child Database: ${block.child_database?.title || "Untitled"}]\n`;
    case "bookmark":
      return `${indent}[Bookmark: ${block.bookmark?.url || ""}]\n`;
    case "image":
      return `${indent}[Image]\n`;
    case "embed":
      return `${indent}[Embed: ${block.embed?.url || ""}]\n`;
    default:
      return "";
  }
}

/** Recursively fetch all blocks from a Notion page and convert to text */
async function fetchBlocks(
  blockId: string,
  apiKey: string,
  depth: number = 0,
  maxDepth: number = 5
): Promise<string> {
  if (depth > maxDepth) return "";

  let allBlocks: any[] = [];
  let cursor: string | undefined;

  // Paginate through blocks
  do {
    const path = `/blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`;
    const data = await notionFetch(path, apiKey);
    allBlocks = allBlocks.concat(data.results || []);
    cursor = data.has_more ? data.next_cursor : undefined;

    // Small delay to respect rate limits
    if (cursor) await new Promise((r) => setTimeout(r, 350));
  } while (cursor);

  let text = "";
  for (const block of allBlocks) {
    text += blockToMarkdown(block, depth);

    // Recursively fetch children if the block has them
    if (block.has_children) {
      text += await fetchBlocks(block.id, apiKey, depth + 1, maxDepth);
    }
  }

  return text;
}

/** Main function: fetch a Notion page's title and full content as markdown text */
export async function fetchNotionPageContent(
  pageUrl: string
): Promise<{ pageId: string; title: string; content: string }> {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    throw new Error("NOTION_API_KEY environment variable is not set.");
  }

  const pageId = parseNotionPageId(pageUrl);
  if (!pageId) {
    throw new Error(`Could not parse Notion page ID from URL: ${pageUrl}`);
  }

  // Fetch page metadata for title
  const page = await notionFetch(`/pages/${pageId}`, apiKey);
  let title = "Untitled";

  // Extract title from properties
  const props = page.properties || {};
  for (const key of Object.keys(props)) {
    const prop = props[key];
    if (prop.type === "title" && prop.title) {
      title = richTextToPlain(prop.title) || "Untitled";
      break;
    }
  }

  // Fetch all blocks (content)
  const content = await fetchBlocks(pageId, apiKey);

  // Truncate very long pages to ~15000 chars
  const truncated =
    content.length > 15000
      ? content.slice(0, 15000) + "\n\n[Content truncated — page is very long]"
      : content;

  return { pageId, title, content: truncated };
}
