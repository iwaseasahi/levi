import { slideTextDocumentFromPlainText } from "@/domain/slides/text-document";

/** Valid persisted TEXT Slide data for tests that intentionally bypass the repository. */
export function storedSlideText(text: string) {
  return { textDocument: slideTextDocumentFromPlainText(text) };
}
