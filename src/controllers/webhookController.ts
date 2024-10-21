import { Request, Response } from "express";
import {
  getConfig,
  sendFacebookMessage,
  sendFacebookMessageNotifMsgReq,
  sendFacebookMessageTag,
  setConfig,
  validateToken,
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
            "Error updating config. Please try again later. Error: " + error,
            user_id
          );
          console.log("ERROR UPDATING CONFIG", error);
          res.sendStatus(500);
          return;
        }

        const updatedConfig = await getConfig();

        // Store in your database for future use
        await sendFacebookMessage(
          `Your OTN is: "${updatedConfig?.one_time_notif_token}" and your payload is: "${updatedConfig?.otn_payload}". Please don't share it with anyone!`,
          user_id
        );
        res.status(200);
        return;
      } else if (
        webhook_event.optin &&
        webhook_event.optin.notification_messages_token
      ) {
        console.log("Received optin", webhook_event);

        const _data = {
          user_id: webhook_event.sender.id,
          notification_messages_token:
            webhook_event.optin.notification_messages_token,
          nmt_payload: webhook_event.optin.payload,
          notification_token_expiry_timestamp:
            webhook_event.optin.token_expiry_timestamp,
          updated_at: new Date().toUTCString(),
        };

        if (
          webhook_event.optin.notification_messages_status !==
          "STOP_NOTIFICATIONS"
        ) {
          console.log("UPDATING CONFIG", JSON.stringify(_data));
          const _configRes = await setConfig(_data);
          console.log("UPDATED CONFIG", _configRes);

          const updatedConfig = await getConfig();

          await sendFacebookMessage(
            `Your notification messages token is: "${updatedConfig?.notification_messages_token}"`,
            webhook_event.sender.id
          );
        } else {
          await sendFacebookMessage(
            "You have stopped receiving notification messages.",
            webhook_event.sender.id
          );
        }

        res.sendStatus(200);
        return;
      }
      res.sendStatus(200);
      return;
    }

    sendFacebookMessage("Request unkown. Please try again later.");
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
  const config = await getConfig();
  // Handle ESP32 smoke detection payload
  if (body.event === "smoke_detected" && config) {
    const { error } = await sendFacebookMessage(text);
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
    if (data && data.user_id) {
      const { error } = await sendFacebookMessageTag(data?.user_id, text);
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

export async function notifMsgRequest(req: Request, res: Response) {
  const config = await getConfig();
  const id = config!.user_id;

  const { error, response } = await sendFacebookMessageNotifMsgReq(id);
  if (!error && response) {
    console.log(response);
  } else {
    console.error(error);
  }
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
      ? config!.user_id
      : body.recipientID === "otn_token"
      ? config!.one_time_notif_token
      : body.recipientID === "notification_messages_token"
      ? config!.notification_messages_token
      : body.recipientID;

  const { error } = await sendFacebookMessage(body.text, id);
  res.status(200).send({
    status: "EVENT_RECEIVED",
    error: error ? error : null,
  });
}
