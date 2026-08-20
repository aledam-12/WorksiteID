import fastify from "fastify";

export function buildApp() {
  const app = fastify();
  return app;
}
