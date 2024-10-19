import express, { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import logger from "../middleware";

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT;
const PAGE_ID = process.env.PAGE_ID;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const PAGE_VERIFICATION_TOKEN = process.env.PAGE_VERIFICATION_TOKEN;
const USER_ID = process.env.USER_ID;

app.use(cors());
app.use(express.json());
app.use(logger);

app.get("/api/webhook", (req: Request, res: Response) => {
  let VERIFY_TOKEN = PAGE_VERIFICATION_TOKEN;

  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.get("/api", (req: Request, res: Response) => {
  res.send("Smoke Detection webhook server is running");
});

// Receive messages or events (from ESP32 or Facebook)
app.post("/api/webhook", (req: Request, res: Response) => {
  let body = req.body;

  // Handle ESP32 smoke detection payload
  if (body.event === "smoke_detected" && USER_ID) {
    sendFacebookMessage(USER_ID, "Smoke detected!");
  } else {
    res.status(400).send(body);
  }

  res.status(200).send("EVENT_RECEIVED");
});

async function sendFacebookMessage(recipientId: string, text: string) {
  const messageData = {
    recipient: { id: recipientId },
    messaging_type: "RESPONSE",
    message: { text: text },
    access_token: PAGE_ACCESS_TOKEN,
  };

  try {
    console.log("Sending message: ", messageData);
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${PAGE_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messageData),
      }
    );

    if (response.ok) {
      console.log("Message sent");
    } else {
      const errorBody = await response.json();
      console.error("Unable to send message:", errorBody.error);
    }
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

export default app;
