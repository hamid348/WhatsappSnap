export interface ParsedNumber {
  original: string;
  normalized: string;
  label?: string;
  confidence?: number;
}

export interface ScanResult {
  numbers: ParsedNumber[];
  rawText?: string;
}

// Minimal type definition for Chrome API to avoid TS errors in a standard environment
// In a real extension project, you would install @types/chrome
declare global {
  const chrome: any;
}
