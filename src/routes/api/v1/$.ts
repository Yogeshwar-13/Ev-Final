import { createFileRoute } from "@tanstack/react-router";
import { handleApiRequest } from "../../../../backend/api-handler";

const handle = ({ request }: { request: Request }) => handleApiRequest(request);

export const Route = createFileRoute("/api/v1/$")({
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
