import { getStore } from "@netlify/blobs";

const CACHE = {
  "Cache-Control": "public, max-age=60",
  "Netlify-CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600"
};

export default async (req) => {
  const store = getStore("counters");

  if (req.method === "GET") {
    const count = (await store.get("orders", { type: "json" })) ?? 143;
    return Response.json({ count }, { headers: CACHE });
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