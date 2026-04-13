import express from "express";
import db from "../db/conn.mjs";
import { ObjectId } from "mongodb";

const router = express.Router();

// GET /record — full collection
router.get("/", async (req, res) => {
  const collection = await db.collection("records");
  const results = await collection.find({}).toArray();
  res.status(200).json(results);
});

// GET /record/:id — single document
router.get("/:id", async (req, res) => {
  let oid;
  try {
    oid = new ObjectId(req.params.id);
  } catch {
    return res.status(400).json({ error: "Invalid id format" });
  }

  const collection = await db.collection("records");
  const result = await collection.findOne({ _id: oid });

  if (!result) return res.status(404).json({ error: "Not found" });
  res.status(200).json(result);
});

// POST /record — insert new document
router.post("/", async (req, res) => {
  const { name, position, level } = req.body;

  if (!name || !position || !level) {
    return res.status(400).json({ error: "name, position and level are required" });
  }

  const collection = await db.collection("records");
  await collection.insertOne({ name, position, level });
  res.status(204).end();
});

// PATCH /record/:id — partial update
router.patch("/:id", async (req, res) => {
  let oid;
  try {
    oid = new ObjectId(req.params.id);
  } catch {
    return res.status(400).json({ error: "Invalid id format" });
  }

  const updates = {};
  for (const field of ["name", "position", "level"]) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  const collection = await db.collection("records");
  const result = await collection.updateOne({ _id: oid }, { $set: updates });

  if (result.matchedCount === 0) return res.status(404).json({ error: "Not found" });
  res.status(200).json(result);
});

// DELETE /record/:id — remove document
router.delete("/:id", async (req, res) => {
  let oid;
  try {
    oid = new ObjectId(req.params.id);
  } catch {
    return res.status(400).json({ error: "Invalid id format" });
  }

  const collection = await db.collection("records");
  const result = await collection.deleteOne({ _id: oid });

  if (result.deletedCount === 0) return res.status(404).json({ error: "Not found" });
  res.status(200).json(result);
});

export default router;
