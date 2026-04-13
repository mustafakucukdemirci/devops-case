import request from "supertest";
import app from "../app.mjs";

// Requires a running MongoDB — provided via service container in CI,
// via docker compose locally.

const validRecord = { name: "Test User", position: "Engineer", level: "Senior" };
let createdId;

describe("Record CRUD", () => {
  it("POST /record — creates a record and returns 204", async () => {
    const res = await request(app).post("/record").send(validRecord);
    expect(res.status).toBe(204);
  });

  it("GET /record — returns an array containing the created record", async () => {
    const res = await request(app).get("/record");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const match = res.body.find((r) => r.name === validRecord.name);
    expect(match).toBeDefined();
    createdId = match._id;
  });

  it("GET /record/:id — returns the specific record", async () => {
    const res = await request(app).get(`/record/${createdId}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe(validRecord.name);
    expect(res.body.position).toBe(validRecord.position);
    expect(res.body.level).toBe(validRecord.level);
  });

  it("GET /record/:id — returns 404 for a non-existent id", async () => {
    const res = await request(app).get("/record/000000000000000000000000");
    expect(res.status).toBe(404);
  });

  it("PATCH /record/:id — updates a field and returns 200", async () => {
    const res = await request(app)
      .patch(`/record/${createdId}`)
      .send({ level: "Junior" });
    expect(res.status).toBe(200);
  });

  it("PATCH /record/:id — updated field is persisted", async () => {
    const res = await request(app).get(`/record/${createdId}`);
    expect(res.status).toBe(200);
    expect(res.body.level).toBe("Junior");
  });

  it("DELETE /record/:id — removes the record and returns 200", async () => {
    const res = await request(app).delete(`/record/${createdId}`);
    expect(res.status).toBe(200);
  });

  it("GET /record/:id — returns 404 after deletion", async () => {
    const res = await request(app).get(`/record/${createdId}`);
    expect(res.status).toBe(404);
  });
});

describe("Record validation", () => {
  it("POST /record — rejects empty body with 400", async () => {
    const res = await request(app).post("/record").send({});
    expect(res.status).toBe(400);
  });

  it("POST /record — rejects missing required fields with 400", async () => {
    const res = await request(app).post("/record").send({ name: "Only Name" });
    expect(res.status).toBe(400);
  });
});
