import { supabase } from "../storage/db";

function signIn(provider: "google" | "apple") {
  const redirectTo = `${window.location.origin}/`;
  void supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
}

export function LoginPage({ pendingAccess, onSignOut }: { pendingAccess?: boolean; onSignOut?: () => void }) {
  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-brand">DohDocs</h1>
        <p className="login-tagline">Your team's shared notebook</p>

        {pendingAccess ? (
          <div className="login-pending">
            <p>Your account isn't set up yet.</p>
            <p>Contact your admin to request access.</p>
            {onSignOut && (
              <button className="login-btn" style={{ marginTop: "1rem" }} onClick={onSignOut}>
                Sign out and try a different account
              </button>
            )}
          </div>
        ) : (
          <div className="login-actions">
            <button className="login-btn login-btn--google" onClick={() => signIn("google")}>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
              </svg>
              Sign in with Google
            </button>

            <button className="login-btn login-btn--apple" onClick={() => signIn("apple")}>
              <svg width="18" height="18" viewBox="0 0 814 1000" aria-hidden="true" fill="currentColor">
                <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 405.8 10 262.6 10 185.8c0-86.8 40.1-172.6 113-232.8C171.9 3.8 248.3 0 313.4 0c57.2 0 131.4 26.3 179.1 50.5C544 75.2 598 106 641 106c37.8 0 97.3-31.8 163.1-58.9 5.2-2.6 13-5.2 19.5-5.2 6.5 0 13 0 19.5 1.3 0 0-4.6 138.2-55.1 296.7z"/>
              </svg>
              Sign in with Apple
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
