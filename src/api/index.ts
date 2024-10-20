import express, { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import logger from "../middleware";
import { formatDate } from "../lib/utils";
import {
  otnRequest,
  smokeDetected,
  verifyToken,
  webhookCallback,
} from "../controllers/webhookController";
import { getConfig } from "../lib/helpers";

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT;
export let USER_ID: string;
export let ONE_TIME_NOTIF_TOKEN: string;

async function setup() {
  USER_ID = await getConfig("USER_ID");
  ONE_TIME_NOTIF_TOKEN = await getConfig("ONE_TIME_NOTIF_TOKEN");
}
setup();

app.use(cors());
app.use(express.json());
app.use(logger);

app.get("/api", (req: Request, res: Response) => {
  res.send("Smoke Detection webhook server is running");
});

app.get("/api/webhook", verifyToken);

app.post("/api/webhook", webhookCallback);

// Receive messages or events (from ESP32 or Facebook)
app.post("/api/webhook/smoke-detected", smokeDetected);

app.post("/api/webhook/otn-req", otnRequest);

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

export default app;
