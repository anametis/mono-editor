import { notFound } from "next/navigation";
import { publicApi } from "../../../features/content/data";
import { SavePost } from "../../../features/interactions/save-post";
import type { Metadata } from "next";
export const dynamic = "force-dynamic";
async function getPost(slug: string) {
  const { data, response } = await publicApi().GET("/api/posts/{slug}", {
    params: { path: { slug } },
    cache: "no-store",
  });
  if (response.status === 404) notFound();
  if (!data) throw new Error("Could not load this story");
  return data;
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  return {
    title: post.title,
    description: post.summary,
    alternates: { canonical: `/posts/${slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.summary,
      publishedTime: post.publishedAt,
    },
  };
}
export default async function Story({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.summary,
    datePublished: post.publishedAt,
    url: `${process.env.WEB_URL ?? "http://localhost:3000"}/posts/${post.slug}`,
  };
  return (
    <article className="reading">
      <a href="/">All stories</a>
      <h1 style={{ marginTop: "2rem" }}>{post.title}</h1>
      <p className="muted">{post.summary}</p>
      <time dateTime={post.publishedAt}>
        {new Date(post.publishedAt).toLocaleDateString("en", {
          dateStyle: "long",
          timeZone: "UTC",
        })}
      </time>
      <div className="prose" style={{ margin: "2rem 0" }}>
        {post.body}
      </div>
      <SavePost postId={post.id} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
    </article>
  );
}
