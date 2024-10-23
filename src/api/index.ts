import express, { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import logger from "../middleware";
import { formatDate } from "../lib/utils";
import {
  getConfigController,
  notifMsgRequest,
  sendMessage,
  sendQuickReply,
  smokeDetected,
  verifyToken,
  webhookCallback,
} from "../controllers/webhookController";
import { getConfig } from "../lib/helpers";

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT;

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

// app.post("/api/webhook/otn-req", otnRequest);

app.post("/api/webhook/test/notif-msg-req", notifMsgRequest);

app.post("/api/webhook/test/send-message", sendMessage);

app.post("/api/webhook/test/send-quick-reply", sendQuickReply);

app.get("/api/config", getConfigController);

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

export default app;
