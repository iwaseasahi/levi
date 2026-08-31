import type { ProjectionAction } from "./transport";

/** Basic scripture controls; Slide selection is owned by its adapter. */
export type DirectAudienceCommand = Exclude<
  ProjectionAction,
  { action: "select-page" }
>;
