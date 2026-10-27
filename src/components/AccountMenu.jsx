import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon.jsx";

const errorMessages = {
  cancelled: "Sign-in was cancelled. You can try again whenever you’re ready.",
  invalid_state: "This sign-in link is invalid. Start sign-in again.",
  expired: "Sign-in expired. Please try again.",
  unavailable: "That sign-in option isn’t available yet.",
  rate_limited: "Please wait a minute before trying to sign in again.",
  failed: "Couldn’t complete sign-in. Please try again.",
};

export function AccountMenu({ actions, canEdit }) {
  const menu = useRef(null);
  const requestId = useRef(0);
  const channel = useRef(null);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load(signal) {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const response = await fetch("/api/auth/session", { signal, credentials: "same-origin" });
      if (!response.ok) throw new Error();
      const session = await response.json();
      if (id !== requestId.current || signal?.aborted) return;
      setAccount(session);
      actions.setAccount(session.user);
    } catch (failure) {
      if (failure.name === "AbortError" || id !== requestId.current) return;
      setAccount(null);
      actions.setAccount(null);
      setError("Couldn’t load sign-in options. Try again.");
    } finally {
      if (!signal?.aborted && id === requestId.current) setLoading(false);
    }
  }
  useEffect(() => {
    const abort = new AbortController();
    const url = new URL(location.href), reason = url.searchParams.get("authError");
    if (reason) {
      setError(errorMessages[reason] ?? errorMessages.failed);
      url.searchParams.delete("authError");
      history.replaceState(null, "", url);
      menu.current.showPopover();
    }
    load(abort.signal);
    const refresh = () => { if (!document.hidden) load(abort.signal); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = setInterval(refresh, 30_000);
    channel.current = new BroadcastChannel("diggy-account");
    channel.current.onmessage = () => {
      ++requestId.current;
      setAccount((current) => current ? { ...current, user: null } : null);
      actions.setAccount(null);
      refresh();
    };
    return () => {
      abort.abort();
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      channel.current.close();
    };
  }, []);

  function signIn(provider) {
    const projectId = new URL(location.href).searchParams.get("project");
    const returnTo = projectId ? `/?project=${projectId}` : "/";
    setBusy(true);
    location.assign(`/api/auth/${provider}/start?${new URLSearchParams({ returnTo })}`);
  }
  async function signOut() {
    ++requestId.current;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error();
      ++requestId.current;
      setAccount((current) => ({ ...current, user: null }));
      actions.setAccount(null);
      channel.current?.postMessage("signed-out");
    } catch {
      setError("Couldn’t sign out. Please try again.");
    } finally { setBusy(false); setLoading(false); }
  }
  const user = canEdit ? account?.user : null;
  return (
    <>
      <button
        className="button account-button"
        popoverTarget="account-menu"
        aria-label={user ? `Account: ${user.name}` : "Sign in to Diggy"}
        aria-busy={loading || busy}
      >
        <Icon name="crew" />
        <span>{user ? "Account" : "Sign in"}</span>
      </button>
      <div id="account-menu" className="account-menu" popover="auto" ref={menu} aria-labelledby="account-heading">
        <h2 id="account-heading">{user ? user.name : "Sign in to Diggy"}</h2>
        {user ? (
          <>
            <p>Signed in with {user.provider === "google" ? "Google" : "GitHub"}.</p>
            <button className="button" disabled={busy} onClick={signOut}>
              {busy ? "Signing out…" : "Sign out"}
            </button>
          </>
        ) : (
          <>
            <p>Sign in to create projects and make changes. Anyone with a dig’s private sharing link can view it.</p>
            <div className="account-providers" aria-busy={loading || busy}>
              <button className="button" disabled={loading || busy || !account?.providers.google} onClick={() => signIn("google")}>
                Continue with Google
              </button>
              <button className="button" disabled={loading || busy || !account?.providers.github} onClick={() => signIn("github")}>
                Continue with GitHub
              </button>
            </div>
            {loading ? <p role="status">Loading sign-in options…</p> : account && !account.providers.google && !account.providers.github && (
              <p className="help-note">Sign-in isn’t available yet. You can still view digs.</p>
            )}
            {account && Boolean(account.providers.google) !== Boolean(account.providers.github) && (
              <p className="help-note">The other sign-in option isn’t available yet.</p>
            )}
          </>
        )}
        {error && <p className="account-error" role="alert">{error}</p>}
        {!account && !loading && <button className="button" onClick={() => { setError(""); load(); }}>Try again</button>}
      </div>
    </>
  );
}
