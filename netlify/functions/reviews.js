import { getStore } from "@netlify/blobs";

const CACHE = {
  "Cache-Control": "public, max-age=120",
  "Netlify-CDN-Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600"
};

export default async (req) => {
  const store = getStore("reviews");

  if (req.method === "GET") {
    const all = (await store.get("all", { type: "json" })) || [];
    return Response.json({ reviews: all }, { headers: CACHE });
  }

  if (req.method === "POST") {
    const payload = await req.json();
    const all = (await store.get("all", { type: "json" })) || [];
    const review = {
      ...payload,
      date: new Date().toISOString().slice(0, 10),
      id: crypto.randomUUID()
    };
    all.unshift(review);
    await store.setJSON("all", all);
    return Response.json({ success: true, review });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config = { path: "/.netlify/functions/reviews" };