import { useState } from "react";
import { authClient } from "@kara/auth-client";
import { Button, Notice } from "@kara/ui";
export function Account() {
  const { data: session, isPending } = authClient.useSession();
  const [message, setMessage] = useState("");
  const [challenge, setChallenge] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);
  const [backup, setBackup] = useState<string[]>([]);
  async function login(form: FormData) {
    const result = await authClient.signIn.username({
      username: String(form.get("username")),
      password: String(form.get("password")),
    });
    if (result.error) {
      setMessage(result.error.message ?? "Sign-in failed");
      return;
    }
    if (result.data && "twoFactorRedirect" in result.data) {
      setChallenge(true);
      await authClient.twoFactor.sendOtp();
      setMessage("A code was sent to your email.");
    } else
      setMessage(
        "Signed in. Enable two-step verification to access editorial tools.",
      );
  }
  return (
    <div className="split">
      <section>
        <h1>Account & security</h1>
        <p className="muted">
          Editorial access is invitation-only. Verify your email and complete
          two-step sign-in before managing content.
        </p>
        <a href="/">Return to editorial</a>
      </section>
      <section className="panel stack">
        {isPending ? (
          <p>Loading account…</p>
        ) : !session && !challenge ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void login(new FormData(e.currentTarget));
            }}
          >
            <h2>Sign in</h2>
            <label>
              Username
              <input name="username" autoComplete="username" required />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <Button>Sign in</Button>
          </form>
        ) : null}
        {session && !challenge && (
          <>
            <p>Signed in as {session.user.name}</p>
            {session.user.twoFactorEnabled && (
              <Button
                onClick={async () => {
                  const result = await authClient.twoFactor.sendOtp();
                  if (result.error)
                    setMessage(
                      result.error.message ?? "Could not send a code.",
                    );
                  else {
                    setChallenge(true);
                    setMessage("Check your email for your code.");
                  }
                }}
              >
                Verify staff access
              </Button>
            )}
            {!session.user.twoFactorEnabled && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const password = String(
                    new FormData(e.currentTarget).get("password"),
                  );
                  const result = await authClient.twoFactor.enable({
                    password,
                  });
                  if (result.error) {
                    setMessage(
                      result.error.message ?? "Could not enable verification",
                    );
                    return;
                  }
                  setBackup(
                    result.data && "backupCodes" in result.data
                      ? result.data.backupCodes
                      : [],
                  );
                  await authClient.twoFactor.sendOtp();
                  setChallenge(true);
                  setMessage(
                    "Enter the code sent to your email to finish enrollment.",
                  );
                }}
              >
                <h2>Email verification codes</h2>
                <label>
                  Confirm your password
                  <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </label>
                <Button>Enable two-step verification</Button>
              </form>
            )}
            <Button
              className="secondary"
              onClick={async () => {
                await authClient.signOut();
                location.reload();
              }}
            >
              Sign out
            </Button>
          </>
        )}
        {challenge && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const code = String(new FormData(e.currentTarget).get("code"));
              const result = useRecovery
                ? await authClient.twoFactor.verifyBackupCode({
                    code,
                    trustDevice: false,
                  })
                : await authClient.twoFactor.verifyOtp({
                    code,
                    trustDevice: false,
                  });
              if (result.error)
                setMessage(result.error.message ?? "Invalid code");
              else {
                setChallenge(false);
                setMessage(
                  "Verification complete. You can return to editorial.",
                );
              }
            }}
          >
            <label>
              {useRecovery ? "Recovery code" : "Email code"}
              <input
                name="code"
                inputMode={useRecovery ? "text" : "numeric"}
                autoComplete="one-time-code"
                required
              />
            </label>
            <Button>Verify code</Button>
            <Button
              type="button"
              className="secondary"
              onClick={() => setUseRecovery(!useRecovery)}
            >
              {useRecovery ? "Use email code" : "Use recovery code"}
            </Button>
            <Button
              type="button"
              className="secondary"
              onClick={async () => {
                const result = await authClient.twoFactor.sendOtp();
                setMessage(result.error?.message ?? "A new code was sent.");
              }}
            >
              Send another code
            </Button>
          </form>
        )}
        {backup.length > 0 && (
          <div className="notice">
            <h3>Save your recovery codes</h3>
            <p>Store these somewhere private before leaving this page.</p>
            <pre>{backup.join("\n")}</pre>
          </div>
        )}
        {message && <Notice>{message}</Notice>}
      </section>
    </div>
  );
}
