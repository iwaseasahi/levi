import { slideHandlers } from "../../runtime";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  return slideHandlers.image(request, (await context.params).id);
}
