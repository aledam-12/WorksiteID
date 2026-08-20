import { buildApp } from "../../../backend/src/app";

describe("BuildApp", () => {
  it("should", () => {
    const app = buildApp();
    expect(app).toBeTruthy();
  });
});
