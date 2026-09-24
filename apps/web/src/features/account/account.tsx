"use client";
import { useState } from "react";
import { authClient } from "@kara/auth-client";
import { apiClient } from "@kara/api-client";
import { Button, Notice } from "@kara/ui";
export function Account() {
  const { data: session, isPending } = authClient.useSession();
  const [mode, setMode] = useState<"login" | "register" | "reset" | "otp">(
    "login",
  );
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState<
    { postId: string; title: string; slug: string }[]
  >([]);
  const [recovery, setRecovery] = useState<string[]>([]);
  const [useRecovery, setUseRecovery] = useState(false);
  async function submit(form: FormData) {
    try {
      const username = String(form.get("username")),
        password = String(form.get("password")),
        email = String(form.get("email"));
      if (mode === "register") {
        const result = await authClient.signUp.email({
          name: username,
          username,
          email,
          password,
          callbackURL: location.origin + "/account",
        });
        setMessage(
          result.error?.message ??
            "Check your email to verify your account before signing in.",
        );
      } else if (mode === "reset") {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: location.origin + "/account",
        });
        setMessage(
          result.error?.message ??
            "If an account exists, a recovery link will arrive shortly.",
        );
      } else if (mode === "otp") {
        const result = useRecovery
          ? await authClient.twoFactor.verifyBackupCode({
              code: String(form.get("code")),
              trustDevice: false,
            })
          : await authClient.twoFactor.verifyOtp({
              code: String(form.get("code")),
              trustDevice: false,
            });
        if (result.error) setMessage(result.error.message ?? "Invalid code");
        else {
          setMode("login");
          setMessage("Signed in.");
        }
      } else {
        const result = await authClient.signIn.username({ username, password });
        if (result.error) setMessage(result.error.message ?? "Sign-in failed");
        else if (result.data && "twoFactorRedirect" in result.data) {
          setMode("otp");
          await authClient.twoFactor.sendOtp();
          setMessage("Check your email for your sign-in code.");
        }
      }
    } catch {
      setMessage("Could not connect. Please try again.");
    }
  }
  const token =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("token")
      : null;
  return (
    <div className="split">
      <section>
        <h1>Your reading space.</h1>
        <p className="muted">
          Keep stories close and manage your account securely.
        </p>
        <a href="/">Browse the journal</a>
      </section>
      <section className="panel stack">
        {isPending ? (
          <p>Loading account…</p>
        ) : token ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const result = await authClient.resetPassword({
                token,
                newPassword: String(
                  new FormData(e.currentTarget).get("password"),
                ),
              });
              setMessage(
                result.error?.message ??
                  "Password changed. You can now sign in.",
              );
            }}
          >
            <h2>Choose a new password</h2>
            <label>
              Password
              <input
                name="password"
                type="password"
                minLength={12}
                required
                autoComplete="new-password"
              />
            </label>
            <Button>Reset password</Button>
          </form>
        ) : session && mode !== "otp" ? (
          <>
            <h2>Hello, {session.user.name}</h2>
            <Button
              onClick={async () => {
                const { data, error } = await apiClient().GET("/api/bookmarks");
                if (error) setMessage("Could not load saved stories.");
                else setSaved(data ?? []);
              }}
            >
              Load saved stories
            </Button>
            {saved.map(({ postId: id, title, slug }) => (
              <div className="actions" key={id}>
                <a href={`/posts/${slug}`}>{title}</a>
                <Button
                  className="secondary"
                  onClick={async () => {
                    const { error } = await apiClient().DELETE(
                      "/api/bookmarks/{postId}",
                      {
                        params: { path: { postId: id } },
                      },
                    );
                    if (error) {
                      setMessage(
                        "Could not remove the story. Please try again.",
                      );
                      return;
                    }
                    setSaved(saved.filter((p) => p.postId !== id));
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const result = await authClient.twoFactor.enable({
                  password: String(
                    new FormData(e.currentTarget).get("password"),
                  ),
                });
                if (result.error) {
                  setMessage(
                    result.error.message ?? "Could not enable verification",
                  );
                  return;
                }
                setRecovery(
                  result.data && "backupCodes" in result.data
                    ? result.data.backupCodes
                    : [],
                );
                await authClient.twoFactor.sendOtp();
                setMode("otp");
              }}
            >
              <h3>Optional two-step verification</h3>
              <label>
                Confirm password
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                />
              </label>
              <Button>Enable email codes</Button>
            </form>
            <Button
              className="secondary"
              onClick={async () => {
                await authClient.signOut();
                setSaved([]);
              }}
            >
              Sign out
            </Button>
          </>
        ) : (
          <>
            <h2>
              {mode === "register"
                ? "Create an account"
                : mode === "reset"
                  ? "Recover your account"
                  : mode === "otp"
                    ? "Check your email"
                    : "Welcome back"}
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit(new FormData(e.currentTarget));
              }}
            >
              {mode === "otp" ? (
                <label>
                  {useRecovery ? "Recovery code" : "Email code"}
                  <input
                    name="code"
                    autoComplete="one-time-code"
                    inputMode={useRecovery ? "text" : "numeric"}
                    required
                  />
                </label>
              ) : (
                <>
                  {mode !== "reset" && (
                    <label>
                      Username
                      <input name="username" autoComplete="username" required />
                    </label>
                  )}
                  {(mode === "register" || mode === "reset") && (
                    <label>
                      Email
                      <input
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                      />
                    </label>
                  )}
                  {mode !== "reset" && (
                    <label>
                      Password
                      <input
                        name="password"
                        type="password"
                        minLength={12}
                        autoComplete={
                          mode === "register"
                            ? "new-password"
                            : "current-password"
                        }
                        required
                      />
                    </label>
                  )}
                </>
              )}
              <Button>
                {mode === "register"
                  ? "Create account"
                  : mode === "reset"
                    ? "Send recovery email"
                    : mode === "otp"
                      ? "Verify code"
                      : "Sign in"}
              </Button>
            </form>
            {mode === "otp" && (
              <Button
                className="secondary"
                onClick={() => setUseRecovery(!useRecovery)}
              >
                {useRecovery ? "Use email code" : "Use a recovery code"}
              </Button>
            )}
            <div className="actions">
              <Button
                className="secondary"
                onClick={() =>
                  setMode(mode === "register" ? "login" : "register")
                }
              >
                {mode === "register" ? "Sign in" : "Create account"}
              </Button>
              <Button className="secondary" onClick={() => setMode("reset")}>
                Forgot password
              </Button>
            </div>
          </>
        )}
        {recovery.length > 0 && (
          <div>
            <h3>Store your recovery codes safely</h3>
            <pre>{recovery.join("\n")}</pre>
          </div>
        )}
        {message && <Notice>{message}</Notice>}
      </section>
    </div>
  );
}
