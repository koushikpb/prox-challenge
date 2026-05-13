const CITATION_MARKER = /\(p\.\s*\d+(?:\s*[-–]\s*\d+)?\)/g;

export function stripCitationMarkers(text: string): string {
  return text
    .replace(CITATION_MARKER, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]+([.,;:!?])/g, '$1')
    .trim();
}
