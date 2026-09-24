"use client";
import { useState } from "react";
import { apiClient } from "@kara/api-client";
import { Button, Notice } from "@kara/ui";
export function SavePost({ postId }: { postId: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const { error } = await apiClient().PUT("/api/bookmarks/{postId}", {
              params: { path: { postId } },
            });
            setMessage(
              error
                ? "Sign in with a verified account to save this story."
                : "Story saved to your account.",
            );
          } catch {
            setMessage("Could not save the story. Try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Save story
      </Button>
      {message && <Notice>{message}</Notice>}
    </section>
  );
}
