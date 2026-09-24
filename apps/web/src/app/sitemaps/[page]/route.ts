import { publicApi } from "../../../features/content/data";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  context: { params: Promise<{ page: string }> },
) {
  const { page } = await context.params;
  if (!/^[1-9]\d{0,5}$/.test(page))
    return new Response("Not found", { status: 404 });
  const { data, error } = await publicApi().GET("/api/discovery/entries", {
    params: { query: { page: Number(page) } },
    cache: "no-store",
  });
  if (error || !data)
    return new Response("Sitemap unavailable", { status: 503 });
  const base = new URL(process.env.WEB_URL ?? "http://localhost:3000").origin;
  const home = page === "1" ? `<url><loc>${base}</loc></url>` : "";
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${home}${data.map((p) => `<url><loc>${base}/posts/${encodeURIComponent(p.slug)}</loc><lastmod>${p.publishedAt}</lastmod></url>`).join("")}</urlset>`,
    {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "no-store",
      },
    },
  );
}
