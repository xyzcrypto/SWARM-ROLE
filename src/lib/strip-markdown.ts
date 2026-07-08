// Pure markdown → plain speakable text (for text-to-speech). No JSX, so it's
// safe to import from tests. Named to avoid colliding with markdown.tsx.

export function stripMarkdown(text: string): string {
  return (text || "")
    .replace(/\r/g, "")
    .replace(/^#{1,6}\s+/gm, "")        // headings
    .replace(/^\s*[-*•]\s+/gm, "")      // bullets
    .replace(/^\s*\d+[.)]\s+/gm, "")    // ordered markers
    .replace(/^>\s?/gm, "")             // blockquotes
    .replace(/\*\*([^*]+)\*\*/g, "$1")  // bold
    .replace(/\*([^*]+)\*/g, "$1")      // italic
    .replace(/`([^`]+)`/g, "$1")        // inline code
    .replace(/\n{2,}/g, ". ")           // paragraph breaks → sentence pause
    .replace(/\n/g, " ")
    .replace(/\.\s*\.+/g, ".")          // collapse doubled periods
    .replace(/\s{2,}/g, " ")
    .trim();
}
