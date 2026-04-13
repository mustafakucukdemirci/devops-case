import request from "supertest";
import app from "../app.mjs";

describe("GET /healthcheck", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/healthcheck");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message", "OK");
    expect(res.body).toHaveProperty("uptime");
    expect(res.body).toHaveProperty("timestamp");
  });
});
