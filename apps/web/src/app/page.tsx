import Link from "next/link";
import { publicApi } from "../features/content/data";
export const dynamic = "force-dynamic";
export const metadata = { alternates: { canonical: "/" } };
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Math.min(10000, Number(params.page) || 1));
  const { data, error } = await publicApi().GET("/api/posts", {
    params: { query: { page } },
    cache: "no-store",
  });
  if (error) throw new Error("Could not load published stories");
  return (
    <div className="shell">
      <section style={{ padding: "3rem 0", maxWidth: 850 }}>
        <h1>Worth your attention.</h1>
        <p className="muted">
          A collection of stories selected, reviewed, and published with care.
        </p>
      </section>
      <section className="stack" aria-label="Latest stories">
        {data?.length ? (
          data.map((post) => (
            <article className="panel" key={post.id}>
              <time className="muted" dateTime={post.publishedAt}>
                {new Date(post.publishedAt).toLocaleDateString("en", {
                  dateStyle: "long",
                  timeZone: "UTC",
                })}
              </time>
              <h2 style={{ marginTop: "1rem" }}>
                <Link href={`/posts/${post.slug}`}>{post.title}</Link>
              </h2>
              <p>{post.summary}</p>
            </article>
          ))
        ) : (
          <div className="panel">
            <h2>The next story starts here.</h2>
            <p>Our editors are preparing the first stories. Check back soon.</p>
          </div>
        )}
      </section>
      <nav
        className="actions"
        style={{ margin: "2rem 0" }}
        aria-label="Story pages"
      >
        {page > 1 && <Link href={`/?page=${page - 1}`}>Previous page</Link>}
        {data?.length === 20 && (
          <Link href={`/?page=${page + 1}`}>Next page</Link>
        )}
      </nav>
    </div>
  );
}
