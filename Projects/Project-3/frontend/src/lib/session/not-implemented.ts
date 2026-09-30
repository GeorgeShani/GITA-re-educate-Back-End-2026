/** Placeholder for a BFF handler that is not built yet. Deliberately loud: a 501 cannot be mistaken for success. */
export function notImplemented(): Response {
  return Response.json(
    { statusCode: 501, message: "This session route is not implemented yet." },
    { status: 501 },
  );
}
