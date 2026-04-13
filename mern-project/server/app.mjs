import express from "express";
import cors from "cors";
import "./loadEnvironment.mjs";
import records from "./routes/record.mjs";
import healthcheck from "./routes/healthcheck.mjs";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/record", records);
app.use("/healthcheck", healthcheck);

export default app;
