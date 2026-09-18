// GitHub sign-in for the management portal (Decap CMS), step 2 of 2.
// Exchanges GitHub's one-time code for a token and hands it to the portal
// window that opened the sign-in popup. Runs at /api/callback.

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = request.headers.get("Cookie") || "";
  const saved = (cookie.match(/(?:^|;\s*)ghame_oauth_state=([^;]+)/) || [])[1];

  if (!code || !state || !saved || saved !== state) {
    return reply(url.origin, "error", { message: "Sign-in expired or was started in another window. Close this window and try again." });
  }

  let data;
  try {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "ghame-cms-auth",
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${url.origin}/api/callback`,
      }),
    });
    data = await res.json();
  } catch (err) {
    return reply(url.origin, "error", { message: "Could not reach GitHub. Try again." });
  }

  if (!data || data.error || !data.access_token) {
    return reply(url.origin, "error", { message: (data && (data.error_description || data.error)) || "GitHub did not return a token." });
  }

  return reply(url.origin, "success", { token: data.access_token, provider: "github" });
}

// Decap CMS popup handshake: announce, wait for the portal to answer, then
// post the result back to that same origin only.
function reply(origin, status, content) {
  const message = JSON.stringify(`authorization:github:${status}:${JSON.stringify(content)}`);
  const allowed = JSON.stringify(origin);
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Signing in</title></head>
<body style="font:16px system-ui,sans-serif;padding:2rem;color:#242321">
<p>${status === "success" ? "Signed in. You can close this window if it stays open." : "Sign-in failed. " + escapeHtml(content.message || "")}</p>
<script>
(function () {
  var allowed = ${allowed};
  function receive(e) {
    if (e.origin !== allowed) return;
    window.opener.postMessage(${message}, e.origin);
    window.removeEventListener("message", receive, false);
  }
  window.addEventListener("message", receive, false);
  if (window.opener) window.opener.postMessage("authorizing:github", allowed);
})();
</script>
</body></html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Set-Cookie": "ghame_oauth_state=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    },
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
