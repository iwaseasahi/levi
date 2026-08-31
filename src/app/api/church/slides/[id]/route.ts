import { slideHandlers } from "../runtime";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return slideHandlers.read(request, (await context.params).id);
}
export async function PUT(request: Request, context: Context) {
  return slideHandlers.update(request, (await context.params).id);
}
export async function DELETE(request: Request, context: Context) {
  return slideHandlers.delete(request, (await context.params).id);
}
