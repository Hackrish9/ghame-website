// GitHub sign-in for the management portal (Decap CMS), step 1 of 2.
// Runs as a Cloudflare Pages Function at /api/auth.
// Needs GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET (see README, step 3).

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return new Response(
      "Sign-in is not configured. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in Cloudflare Workers > ghame-website > Settings > Variables and Secrets, then deploy the changes.",
      { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  const state = crypto.randomUUID();
  const scope = url.searchParams.get("scope") || env.GITHUB_SCOPE || "repo,user";

  const github = new URL("https://github.com/login/oauth/authorize");
  github.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  github.searchParams.set("redirect_uri", `${url.origin}/api/callback`);
  github.searchParams.set("scope", scope);
  github.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: github.toString(),
      "Set-Cookie": `ghame_oauth_state=${state}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      "Cache-Control": "no-store",
    },
  });
}
