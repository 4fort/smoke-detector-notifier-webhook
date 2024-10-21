import { Request, Response } from "express";
import {
  getConfig,
  sendFacebookMessage,
  sendFacebookMessageTag,
  setConfig,
} from "../lib/helpers";
import { formatDate } from "../lib/utils";
import dotenv from "dotenv";
import { ONE_TIME_NOTIF_TOKEN, USER_ID } from "../api";

dotenv.config();

const PAGE_VERIFICATION_TOKEN = process.env.PAGE_VERIFICATION_TOKEN;

export function verifyToken(req: Request, res: Response) {
  let VERIFY_TOKEN = PAGE_VERIFICATION_TOKEN;

  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
}

export async function webhookCallback(req: Request, res: Response) {
  const body = req.body;
  console.log(body);
  try {
    if (body.object === "page") {
      const entry = body.entry[0];
      const webhook_event = entry.messaging[0];

      if (webhook_event.optin && webhook_event.optin.one_time_notif_token) {
        const otn_token = webhook_event.optin.one_time_notif_token;
        const user_id = webhook_event.sender.id;
        const payload = webhook_event.optin.payload;

        // Log or store the OTN token along with the user ID
        console.log("Received OTN Token:", otn_token);
        console.log("For user:", user_id);

        const _data = {
          USER_ID: user_id,
          ONE_TIME_NOTIF_TOKEN: otn_token,
          PAYLOAD: payload,
          updated_at: new Date().toUTCString(),
        };

        try {
          console.log("UPDATING CONFIG", JSON.stringify(_data));
          const _configRes = await setConfig(_data);
          console.log("UPDATED CONFIG", _configRes);
        } catch (error) {
          await sendFacebookMessage(
            ONE_TIME_NOTIF_TOKEN,
            "Error updating config. Please try again later. Error: " + error
          );
          console.log("ERROR UPDATING CONFIG", error);
          res.sendStatus(500);
          return;
        }

        const updatedConfig = await getConfig();

        // Store in your database for future use
        await sendFacebookMessage(
          user_id,
          `Your OTN is: "${updatedConfig.ONE_TIME_NOTIF_TOKEN}" and your payload is: "${updatedConfig.PAYLOAD}". Please don't share it with anyone!`
        );
        res.status(200);
        return;
      }
      res.sendStatus(200);
      return;
    }

    if (USER_ID) {
      sendFacebookMessage(USER_ID, "Request unkown. Please try again later.");
      res.sendStatus(200);
      return;
    }
    res.sendStatus(404);
  } catch (error) {
    console.log("Callback error: ", error);
    res.sendStatus(500);
    return;
  }
}

export async function smokeDetected(req: Request, res: Response) {
  const text = "Smoke detected! at " + formatDate(new Date());
  const body = req.body;
  const otn = await getConfig();
  // Handle ESP32 smoke detection payload
  if (body.event === "smoke_detected" && otn) {
    const { error } = await sendFacebookMessage(otn.ONE_TIME_NOTIF_TOKEN, text);
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
}

export async function otnRequest(req: Request, res: Response) {
  const text = "Click below to receive a one-time notification.";

  if (!USER_ID) {
    const data = await getConfig();
    if (data.USER_ID) {
      const { error } = await sendFacebookMessageTag(data.USER_ID, text);
      res.status(200).send({
        status: "EVENT_RECEIVED",
        error: error ? error : null,
      });
      return;
    }

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
}

export async function sendMessage(req: Request, res: Response) {
  const body = req.body;

  const config = await getConfig();
  const id =
    body.recipientID === "user_id"
      ? config.USER_ID
      : body.recipientID === "otn_token"
      ? config.ONE_TIME_NOTIF_TOKEN
      : body.recipientID;

  const { error } = await sendFacebookMessage(id, body.text);
  res.status(200).send({
    status: "EVENT_RECEIVED",
    error: error ? error : null,
  });
}
