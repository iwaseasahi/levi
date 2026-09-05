const FIT_STEP = 0.95;
const MINIMUM_TARGET_SCALE = 0.1;

export function findAudienceFitScale(
  fitsAtScale: (candidateScale: number) => boolean,
) {
  let candidateScale = 1;

  while (candidateScale >= MINIMUM_TARGET_SCALE) {
    if (fitsAtScale(candidateScale)) return candidateScale;
    candidateScale *= FIT_STEP;
  }

  return candidateScale;
}
