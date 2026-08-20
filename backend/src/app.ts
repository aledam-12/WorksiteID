import fastify from "fastify";

export function buildApp() {
  const app = fastify();

  app.get("/health", async () => {
    return { status: "ok" };
  });

  return app;
}
