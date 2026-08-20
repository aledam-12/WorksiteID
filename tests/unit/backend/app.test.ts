import { buildApp } from "../../../backend/src/app";

describe("BuildApp", () => {
  it("should build the application", async () => {
    const app = buildApp();

    expect(app).toBeTruthy();

    await app.close();
  });

  it("should return a healthy status", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
    });

    await app.close();
  });
});