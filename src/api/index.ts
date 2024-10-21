import express, { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import logger from "../middleware";
import { formatDate } from "../lib/utils";
import {
  otnRequest,
  sendMessage,
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
  console.log("Setting up...");
  const data = await getConfig();
  USER_ID = data.USER_ID;
  ONE_TIME_NOTIF_TOKEN = data.ONE_TIME_NOTIF_TOKEN;

  console.log("USER_ID: ", USER_ID);
  console.log("ONE_TIME_NOTIF_TOKEN: ", ONE_TIME_NOTIF_TOKEN);

  console.log("Setup complete.");
}

app.use(cors());
app.use(express.json());
app.use(logger);

app.get("/", (req: Request, res: Response) => {
  res.send("Smoke Detection webhook server is running");
});

app.get("/api", (req: Request, res: Response) => {
  res.send("Smoke Detection webhook server is running");
});

app.get("/api/webhook", verifyToken);

app.post("/api/webhook", webhookCallback);

// Receive messages or events (from ESP32 or Facebook)
app.post("/api/webhook/smoke-detected", smokeDetected);

app.post("/api/webhook/otn-req", otnRequest);

app.post("/api/webhook/send-message", sendMessage);

app.listen(PORT, () => {
  setup();

  console.log(`Server is running at http://localhost:${PORT}`);
});

export default app;
