import { createFileRoute } from "@tanstack/react-router";

const handle = async ({ request }: { request: Request }) => {
  const { handleApiRequest } = await import("../../../../backend/api-handler");
  return handleApiRequest(request);
};

export const Route = createFileRoute("/api/v1/$")({
  // @ts-expect-error TanStack's generated route type omits Start's server-handler option.
  server: {
    handlers: {
      GET: handle,
      HEAD: handle,
      POST: handle,
      PUT: handle,
      PATCH: handle,
      DELETE: handle,
      OPTIONS: handle,
    },
  },
});
