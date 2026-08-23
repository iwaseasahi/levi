const FIT_STEP = 0.95;
const MINIMUM_TARGET_SCALE = 0.2;

export function calculateAudienceFitScale({
  availableHeight,
  availableWidth,
  contentHeight,
  contentWidth,
}: {
  availableHeight: number;
  availableWidth: number;
  contentHeight: number;
  contentWidth: number;
}) {
  const ratio = Math.min(
    1,
    availableHeight / Math.max(1, contentHeight),
    availableWidth / Math.max(1, contentWidth),
  );
  if (ratio >= 1) return 1;
  const target = Math.max(MINIMUM_TARGET_SCALE, ratio);
  const steps = Math.ceil(Math.log(target) / Math.log(FIT_STEP));
  return FIT_STEP ** steps;
}
