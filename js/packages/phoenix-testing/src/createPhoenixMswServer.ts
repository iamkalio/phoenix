import type { RequestHandler } from "msw";
import { setupServer } from "msw/node";

/**
 * Creates an MSW server for intercepting HTTP in Node (Vitest, Jest with node environment).
 * Define handlers with `http` / `HttpResponse` from `msw` and Phoenix REST paths.
 */
export function createPhoenixMswServer(...handlers: Array<RequestHandler>) {
  return setupServer(...handlers);
}
