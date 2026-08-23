export type BibleSourceEvidence = {
  counts: {
    bookNames: number;
    verses: number;
  };
  integrity: BibleIntegrityEvidence;
};

export type BibleTargetEvidence = BibleIntegrityEvidence & {
  books: number;
  names: number;
  verses: number;
};

type BibleIntegrityEvidence = {
  bookFingerprint: string;
  nameFingerprint: string;
  locationFingerprint: string;
  contentFingerprint: string;
  sampleFingerprint: string;
};

export function evaluateBibleExactness(
  source: BibleSourceEvidence,
  target: BibleTargetEvidence,
) {
  const sampleExact =
    target.sampleFingerprint === source.integrity.sampleFingerprint;
  const completeExact =
    target.books === source.counts.bookNames &&
    target.names === source.counts.bookNames * 2 &&
    target.verses === source.counts.verses &&
    target.bookFingerprint === source.integrity.bookFingerprint &&
    target.nameFingerprint === source.integrity.nameFingerprint &&
    target.locationFingerprint === source.integrity.locationFingerprint &&
    target.contentFingerprint === source.integrity.contentFingerprint;

  return { exact: completeExact && sampleExact, sampleExact };
}
