import { slideHandlers } from "./runtime";
import { slideListHandler } from "./list/runtime";

export const dynamic = "force-dynamic";
export const POST = slideHandlers.create;
export const GET = slideListHandler;
