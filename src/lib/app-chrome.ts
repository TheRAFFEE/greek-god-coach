export interface CompactAppChromeInput {
  currentWeek: number;
}

export interface CompactAppChromeModel {
  title: "Greek God Coach";
  subtitle: string;
  heroHeadline: null;
  globalStartDayCta: false;
  previousMobileChromeHeightPx: number;
  estimatedMobileChromeHeightPx: number;
  contentTopGapPx: number;
}

export function buildCompactAppChrome(input: CompactAppChromeInput): CompactAppChromeModel {
  const week = Math.max(1, Math.min(12, Math.round(input.currentWeek || 1)));

  return {
    title: "Greek God Coach",
    subtitle: `Week ${week}`,
    heroHeadline: null,
    globalStartDayCta: false,
    previousMobileChromeHeightPx: 176,
    estimatedMobileChromeHeightPx: 48,
    contentTopGapPx: 8,
  };
}
