export interface PrintScaleInput {
  pageWidthPx: number;
  pageHeightPx: number;
  sidebarWidthPx: number;
  sidebarHeightPx: number;
  timelineWidthPx: number;
  timelineHeightPx: number;
  headerHeightPx: number;
  paddingX: number;
  paddingY: number;
  columnGap: number;
  minScale: number;
}

export interface PrintScaleResult {
  contentWidthPx: number;
  contentHeightPx: number;
  fitScale: number;
  scale: number;
  isClamped: boolean;
}

export const calculatePrintScale = ({
  pageWidthPx,
  pageHeightPx,
  sidebarWidthPx,
  sidebarHeightPx,
  timelineWidthPx,
  timelineHeightPx,
  headerHeightPx,
  paddingX,
  paddingY,
  columnGap,
  minScale,
}: PrintScaleInput): PrintScaleResult => {
  const contentWidthPx = sidebarWidthPx + columnGap + timelineWidthPx + paddingX;
  const contentHeightPx = headerHeightPx + Math.max(sidebarHeightPx, timelineHeightPx) + paddingY;
  const fitScale = Math.min(1, pageWidthPx / contentWidthPx, pageHeightPx / contentHeightPx);
  const scale = Math.max(minScale, fitScale);

  return {
    contentWidthPx,
    contentHeightPx,
    fitScale,
    scale,
    isClamped: scale > fitScale,
  };
};
