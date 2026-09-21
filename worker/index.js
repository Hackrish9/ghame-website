import { onRequestGet as authGet } from "../functions/api/auth.js";
import { onRequestGet as callbackGet } from "../functions/api/callback.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/auth") {
      if (request.method !== "GET") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: { Allow: "GET" },
        });
      }
      return authGet({ request, env, params: {}, data: {}, waitUntil: ctx.waitUntil.bind(ctx) });
    }

    if (url.pathname === "/api/callback") {
      if (request.method !== "GET") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: { Allow: "GET" },
        });
      }
      return callbackGet({ request, env, params: {}, data: {}, waitUntil: ctx.waitUntil.bind(ctx) });
    }

    return env.ASSETS.fetch(request);
  },
};
