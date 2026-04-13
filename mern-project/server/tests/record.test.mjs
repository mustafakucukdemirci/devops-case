import request from "supertest";
import app from "../app.mjs";

// These tests require a running MongoDB instance.
// In CI: provided via GitHub Actions service container (mongodb:7.0).
// Locally: docker compose up mongodb, then run npm test.

const testRecord = {
  name: "Test User",
  position: "Engineer",
  level: "Senior",
};

let createdId;

describe("Record CRUD", () => {
  it("POST /record — creates a record", async () => {
    const res = await request(app).post("/record").send(testRecord);
    expect(res.status).toBe(204);
  });

  it("GET /record — returns array including the created record", async () => {
    const res = await request(app).get("/record");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const match = res.body.find((r) => r.name === testRecord.name);
    expect(match).toBeDefined();
    createdId = match._id;
  });

  it("GET /record/:id — returns the specific record", async () => {
    const res = await request(app).get(`/record/${createdId}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe(testRecord.name);
  });

  it("PATCH /record/:id — updates the record", async () => {
    const res = await request(app)
      .patch(`/record/${createdId}`)
      .send({ level: "Junior" });
    expect(res.status).toBe(200);
  });

  it("DELETE /record/:id — removes the record", async () => {
    const res = await request(app).delete(`/record/${createdId}`);
    expect(res.status).toBe(200);
  });
});
