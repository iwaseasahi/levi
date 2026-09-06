export const slideTextLimit = 200;
export const slideBodyLimit = 100_000;

export class SlideInputError extends Error {
  readonly code = "INVALID_SLIDE_INPUT";
  constructor() {
    super("INVALID_SLIDE_INPUT");
    this.name = "SlideInputError";
  }
}
