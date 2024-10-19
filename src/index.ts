import express, { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import logger from "./middleware";

dotenv.config();

export const app: Express = express();
const PORT = process.env.PORT;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const PAGE_VERIFICATION_TOKEN = process.env.PAGE_VERIFICATION_TOKEN;
const USER_ID = process.env.USER_ID;

app.use(cors());
app.use(express.json());
app.use(logger);

app.get("/webhook", (req: Request, res: Response) => {
  let VERIFY_TOKEN = PAGE_ACCESS_TOKEN;

  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.get("/", (req: Request, res: Response) => {
  res.send("Smoke Detection webhook server is running");
});

// Receive messages or events (from ESP32 or Facebook)
app.post("/webhook", (req: Request, res: Response) => {
  let body = req.body;

  // Handle ESP32 smoke detection payload
  if (body.event === "smoke_detected" && USER_ID) {
    sendFacebookMessage(USER_ID, "Smoke detected!");
  }

  res.status(200).send("EVENT_RECEIVED");
});

function sendFacebookMessage(recipientId: string, text: string) {
  const request = require("request");
  const messageData = {
    recipient: { id: recipientId },
    message: { text: text },
  };

  request(
    {
      url: "https://graph.facebook.com/v12.0/me/messages",
      qs: { access_token: PAGE_ACCESS_TOKEN },
      method: "POST",
      json: messageData,
    },
    (error: Error, response: Response, body: any) => {
      if (!error && response.statusCode === 200) {
        console.log("Message sent");
      } else {
        console.error("Unable to send message:", error);
      }
    }
  );
}

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
