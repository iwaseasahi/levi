import { slideHandlers } from "./runtime";
import { slideSearchHandler } from "./search/runtime";

export const dynamic = "force-dynamic";
export const POST = slideHandlers.create;
export const GET = slideSearchHandler;
