import { slideTextDocumentFromPlainText } from "@/domain/slides/text-document";

/** Valid persisted TEXT Slide data for tests that intentionally bypass the repository. */
export function storedSlideText(body: string) {
  return { textDocument: slideTextDocumentFromPlainText(body) };
}
