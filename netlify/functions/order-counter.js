import { getStore } from "@netlify/blobs";

export default async (req) => {
  const store = getStore("counters");

  if (req.method === "GET") {
    const count = (await store.get("orders", { type: "json" })) ?? 143;
    return Response.json({ count });
  }

  if (req.method === "POST") {
    const current = (await store.get("orders", { type: "json" })) ?? 143;
    const count = current + 1;
    await store.setJSON("orders", count);
    return Response.json({ count });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config = { path: "/.netlify/functions/order-counter" };