import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import { workflowRouter } from "./routes/workflows.js";
import { instanceRouter } from "./routes/instances.js";
import { dashboardRouter } from "./routes/dashboard.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/workflows", workflowRouter);
app.use("/api/instances", instanceRouter);
app.use("/api/dashboard", dashboardRouter);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`Backend Workflow Platform in ascolto su http://localhost:${port}`);
});
