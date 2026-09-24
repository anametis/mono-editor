import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiClient, type components } from "@kara/api-client";
import { Button, Notice } from "@kara/ui";
const api = apiClient();
import { schema } from "./draft-schema";
type Fields = z.infer<typeof schema>;
type Revision = components["schemas"]["RevisionDto"];
function check<T>(result: { data?: T; error?: unknown }): T {
  if (result.error || result.data === undefined)
    throw new Error(
      "The request was denied or could not be completed. Refresh and check your permissions.",
    );
  return result.data;
}
export function Editorial() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Revision | null>(null);
  const [selectedTime, setSelectedTime] = useState("");
  const access = useQuery({
    queryKey: ["access"],
    queryFn: async () => check(await api.GET("/api/identity/access")),
    retry: false,
  });
  const posts = useQuery({
    queryKey: ["editorial", page],
    queryFn: async () =>
      check(
        await api.GET("/api/editorial/posts", { params: { query: { page } } }),
      ),
    enabled: !!access.data,
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Fields>({ resolver: zodResolver(schema) });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["editorial"] });
  const mutation = useMutation({
    mutationFn: async (values: Fields) => {
      if (editing)
        check(
          await api.PATCH("/api/editorial/revisions/{id}", {
            params: { path: { id: editing.id } },
            body: {
              title: values.title,
              summary: values.summary,
              body: values.body,
              version: editing.version,
            },
          }),
        );
      else check(await api.POST("/api/editorial/posts", { body: values }));
    },
    onSuccess: () => {
      reset({ title: "", slug: "", summary: "", body: "" });
      setEditing(null);
      setMessage("Draft saved. Submit it when it is ready for review.");
      void refresh();
    },
    onError: (e) => setMessage(e.message),
  });
  async function transition(
    id: string,
    action: "submit" | "approve" | "publish" | "cancel" | "schedule",
  ) {
    try {
      const params = { path: { id } };
      if (action === "schedule") {
        if (!selectedTime)
          throw new Error("Choose a publication date and time.");
        check(
          await api.POST("/api/editorial/revisions/{id}/schedule", {
            params,
            body: { scheduledAt: new Date(selectedTime).toISOString() },
          }),
        );
      } else if (action === "submit")
        check(
          await api.POST("/api/editorial/revisions/{id}/submit", { params }),
        );
      else if (action === "approve")
        check(
          await api.POST("/api/editorial/revisions/{id}/approve", { params }),
        );
      else if (action === "publish")
        check(
          await api.POST("/api/editorial/revisions/{id}/publish", { params }),
        );
      else
        check(
          await api.POST("/api/editorial/revisions/{id}/cancel", { params }),
        );
      setMessage("Revision updated.");
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Request failed");
    }
  }
  const permissions = access.data?.permissions ?? [];
  if (access.isPending) return <Notice>Loading your workspace…</Notice>;
  if (access.isError)
    return (
      <div className="split">
        <section>
          <h1>A place for considered publishing.</h1>
          <p className="muted">
            Draft, review, and schedule your next story. Only approved revisions
            reach readers.
          </p>
          <a className="button" href="/account">
            Sign in to editorial
          </a>
        </section>
        <section className="panel">
          <h2>Your access</h2>
          <p>Staff membership and a completed email code are required.</p>
          <InvitationAccept onMessage={setMessage} />
          {message && <Notice>{message}</Notice>}
        </section>
      </div>
    );
  return (
    <>
      <div
        className="actions"
        style={{ justifyContent: "space-between", marginBottom: "2rem" }}
      >
        <div>
          <h1>Editorial desk</h1>
          <p className="muted">From first draft to published story.</p>
        </div>
        <span className="tag">{permissions.length} permissions</span>
      </div>
      {message && <Notice>{message}</Notice>}
      <div className="split">
        <aside className="stack">
          {permissions.includes("post:create") && (
            <form
              className="panel"
              onSubmit={handleSubmit((v) => mutation.mutate(v))}
            >
              <h2>{editing ? "Edit revision" : "New story"}</h2>
              {(["title", "slug", "summary", "body"] as const).map((field) => (
                <label key={field}>
                  {field.charAt(0).toUpperCase() + field.slice(1)}
                  {field === "body" ? (
                    <textarea {...register(field)} />
                  ) : (
                    <input
                      {...register(field)}
                      readOnly={field === "slug" && !!editing}
                    />
                  )}
                  <span className="error">{errors[field]?.message}</span>
                </label>
              ))}
              <Button disabled={mutation.isPending}>Save draft</Button>
              {editing && (
                <Button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setEditing(null);
                    reset();
                  }}
                >
                  Cancel editing
                </Button>
              )}
            </form>
          )}
          {permissions.includes("post:publish") && (
            <div className="panel">
              <label>
                Publication time
                <input
                  type="datetime-local"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                />
              </label>
              <p className="muted">
                Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}.
                Posts appear within three minutes of the selected time during
                normal operation.
              </p>
            </div>
          )}
          {permissions.includes("staff:manage") && (
            <Invite onMessage={setMessage} />
          )}
        </aside>
        <section className="stack" aria-label="Review queue">
          {posts.isPending ? (
            <Notice>Loading stories…</Notice>
          ) : posts.isError ? (
            <Notice error>Could not load stories. Try refreshing.</Notice>
          ) : !posts.data?.length ? (
            <div className="panel">
              <h2>No stories yet</h2>
              <p>Create a draft to start your first review.</p>
            </div>
          ) : (
            posts.data.map((post) => (
              <article className="panel" key={post.id}>
                <h2>{post.revisions[0]?.title ?? post.slug}</h2>
                <p className="muted">/{post.slug}</p>
                {post.revisions.map((r) => (
                  <section
                    key={r.id}
                    className="stack"
                    style={{ marginBottom: "1.5rem" }}
                  >
                    <div>
                      <span className="tag">{r.status.toLowerCase()}</span>
                      {r.scheduledAt && (
                        <p>{new Date(r.scheduledAt).toLocaleString()}</p>
                      )}
                    </div>
                    <p>{r.summary}</p>
                    <details>
                      <summary>Read revision</summary>
                      <p className="prose">{r.body}</p>
                    </details>
                    <div className="actions">
                      {permissions.includes("post:create") &&
                        (post.ownerId === access.data.id ||
                          post.assignedToId === access.data.id) && (
                          <>
                            <Button
                              className="secondary"
                              onClick={() => {
                                setEditing(r);
                                reset({
                                  title: r.title,
                                  slug: post.slug,
                                  summary: r.summary,
                                  body: r.body,
                                });
                              }}
                            >
                              Edit
                            </Button>
                            {r.status === "DRAFT" && (
                              <Button
                                onClick={() => void transition(r.id, "submit")}
                              >
                                Submit for review
                              </Button>
                            )}
                          </>
                        )}
                      {permissions.includes("post:review") &&
                        r.status === "SUBMITTED" && (
                          <Button
                            onClick={() => void transition(r.id, "approve")}
                          >
                            Approve revision
                          </Button>
                        )}
                      {permissions.includes("post:publish") &&
                        r.status === "APPROVED" && (
                          <>
                            <Button
                              onClick={() => void transition(r.id, "publish")}
                            >
                              Publish now
                            </Button>
                            <Button
                              className="secondary"
                              onClick={() => void transition(r.id, "schedule")}
                            >
                              Schedule
                            </Button>
                          </>
                        )}
                      {permissions.includes("post:publish") &&
                        r.status === "SCHEDULED" && (
                          <Button
                            className="secondary"
                            onClick={() => void transition(r.id, "cancel")}
                          >
                            Cancel schedule
                          </Button>
                        )}
                    </div>
                  </section>
                ))}
              </article>
            ))
          )}
          <nav className="actions" aria-label="Story pages">
            <Button
              className="secondary"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span>Page {page}</span>
            <Button
              className="secondary"
              disabled={(posts.data?.length ?? 0) < 20}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </nav>
        </section>
      </div>
    </>
  );
}
function Invite({ onMessage }: { onMessage: (message: string) => void }) {
  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        try {
          const result = await api.POST("/api/identity/invitations", {
            body: {
              email: String(form.get("email")),
              role: String(form.get("role")) as "creator",
            },
          });
          const data = check(result);
          onMessage(
            `Send this private invitation link to the invited email owner: ${data.invitationUrl}`,
          );
        } catch (e) {
          onMessage(String(e));
        }
      }}
    >
      <h2>Invite staff</h2>
      <label>
        Email
        <input name="email" type="email" required />
      </label>
      <label>
        Role
        <select name="role">
          <option>creator</option>
          <option>reviewer</option>
          <option>publisher</option>
          <option>administrator</option>
        </select>
      </label>
      <Button>Create invitation</Button>
    </form>
  );
}
function InvitationAccept({
  onMessage,
}: {
  onMessage: (message: string) => void;
}) {
  const token = new URLSearchParams(location.search).get("invite");
  if (!token) return null;
  return (
    <Button
      onClick={async () => {
        const result = await api.POST("/api/identity/invitations/accept", {
          body: { token },
        });
        onMessage(
          result.error
            ? "Sign in with the invited, verified email first."
            : "Invitation accepted. Complete two-step sign-in to continue.",
        );
      }}
    >
      Accept staff invitation
    </Button>
  );
}
