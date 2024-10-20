import express, { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import logger from "../middleware";
import { formatDate } from "../lib/utils";

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT;
const PAGE_ID = process.env.PAGE_ID;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const PAGE_VERIFICATION_TOKEN = process.env.PAGE_VERIFICATION_TOKEN;
const USER_ID = process.env.USER_ID;
const ONE_TIME_NOTIF_TOKEN = process.env.ONE_TIME_NOTIF_TOKEN;

app.use(cors());
app.use(express.json());
app.use(logger);

app.get("/api", (req: Request, res: Response) => {
  res.send("Smoke Detection webhook server is running");
});

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

app.post("/api/webhook", async (req: Request, res: Response) => {
  const body = req.body;
  if (body.object === "page") {
    body.entry.forEach(async (entry: any) => {
      const webhook_event = entry.messaging[0];

      if (webhook_event.optin && webhook_event.optin.one_time_notif_token) {
        const otn_token = webhook_event.optin.one_time_notif_token;
        const user_id = webhook_event.sender.id;
        const payload = webhook_event.optin.payload;

        // Log or store the OTN token along with the user ID
        console.log("Received OTN Token:", otn_token);
        console.log("For user:", user_id);

        // Store in your database for future use
        const { error } = await sendFacebookMessage(
          webhook_event.sender.id,
          `Your OTN is: ${otn_token} and your payload is: ${payload}. Please don't share it with anyone!`
        );
        res.status(200).send({
          status: "EVENT_RECEIVED",
          error: error ? error : null,
        });
      }

      console.log(webhook_event);
    });
  }

  if (USER_ID)
    sendFacebookMessage(USER_ID, "An error occured. Please try again later.");
  res.sendStatus(404);
});

// Receive messages or events (from ESP32 or Facebook)
app.post("/api/webhook/smoke-detected", async (req: Request, res: Response) => {
  const text = "Smoke detected! at " + formatDate(new Date());
  const body = req.body;

  // Handle ESP32 smoke detection payload
  if (body.event === "smoke_detected" && USER_ID) {
    const { error } = await sendFacebookMessage(USER_ID, text);
    res.status(200).send({
      status: "EVENT_RECEIVED",
      error: error ? error : null,
    });
  } else {
    res.status(500).send({
      status: "EVENT_RECEIVED",
      error: { message: "Unknown event", body },
    });
  }
});

app.post("/api/webhook/otn-req", async (req: Request, res: Response) => {
  const text = "Click below to receive a one-time notification.";

  if (!USER_ID) {
    res.status(500).send({
      status: "EVENT_RECEIVED",
      error: { message: "User ID is not defined", body: req.body },
    });
    return;
  }

  const { error } = await sendFacebookMessageTag(USER_ID, text);
  res.status(200).send({
    status: "EVENT_RECEIVED",
    error: error ? error : null,
  });
});

async function sendFacebookMessage(recipientId: string, text: string) {
  const messageData = {
    recipient: ONE_TIME_NOTIF_TOKEN
      ? { one_time_notif_token: ONE_TIME_NOTIF_TOKEN }
      : { id: recipientId },
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
      return { error: null };
    } else {
      const errorBody = await response.json();
      console.error("Unable to send message:", errorBody.error);
      return { error: errorBody.error };
    }
  } catch (error) {
    console.error("Fetch error:", error);
    return { error: error };
  }
}

async function sendFacebookMessageTag(recipientId: string, text: string) {
  const messageData = {
    recipient: { id: recipientId },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "one_time_notif_req",
          title: text,
          payload: "OTN_PAYLOAD",
        },
      },
    },
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
      return { error: null, response: await response.json() };
    } else {
      const errorBody = await response.json();
      console.error("Unable to send message:", errorBody.error);
      return { error: errorBody.error, response: null };
    }
  } catch (error) {
    console.error("Fetch error:", error);
    return { error: error, response: null };
  }
}

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

export default app;
