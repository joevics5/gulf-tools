"use client";

interface AdUnitProps {
  slot?: string;
  format?: string;
  layout?: string;
  layoutKey?: string;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * AdUnit — AdSense has been disabled site-wide.
 * This component is kept as a no-op so existing <AdUnit /> placements
 * throughout the app don't need to be individually removed.
 */
export default function AdUnit(_props: AdUnitProps) {
  return null;
}
