import { publicApi } from "../../features/content/data";
export const dynamic = "force-dynamic";
export async function GET() {
  const { data, error } = await publicApi().GET("/api/discovery/count", {
    cache: "no-store",
  });
  if (error || !data)
    return new Response("Sitemap unavailable", { status: 503 });
  const base = new URL(process.env.WEB_URL ?? "http://localhost:3000").origin;
  const pages = Math.max(1, Math.ceil(data.count / 1000));
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Array.from({ length: pages }, (_, i) => `<sitemap><loc>${base}/sitemaps/${i + 1}</loc></sitemap>`).join("")}</sitemapindex>`,
    {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "no-store",
      },
    },
  );
}
