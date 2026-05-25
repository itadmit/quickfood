import { handler, apiJson } from "@/lib/api-response";
import { UploadInitSchema } from "@/lib/validate";
import { requireSession } from "@/lib/auth/guards";
import { createUploadUrl } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 25;

export const POST = handler(async (req: Request) => {
  const session = await requireSession();
  const body = UploadInitSchema.parse(await req.json());

  const extension = body.filename.includes(".")
    ? body.filename.split(".").pop()!.toLowerCase()
    : body.mime_type.split("/")[1];

  const scope = session.tenantId ?? session.userId;
  const fileId = crypto.randomUUID();
  const key = `${scope}/${body.type}/${fileId}.${extension}`;

  const { url, method, headers } = await createUploadUrl({
    key,
    contentType: body.mime_type,
    contentLength: body.size_bytes,
  });

  return apiJson({
    file_id: fileId,
    key,
    upload: { url, method, headers },
  });
});
