import { Request, Response } from "express";
import {
  getConfig,
  handleMessage,
  sendFacebookMessage,
  sendFacebookMessageNotifMsgReq,
  setConfig,
} from "../lib/helpers";
import { formatDate, getUserByID, getUserRecipientID } from "../lib/utils";
import dotenv from "dotenv";
import IConfig from "../types/config";
import Config from "../models/Config";
import FacebookAPI from "../models/FacebookAPI";

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
  const config = new Config();
  await config.fetchGetConfig();
  if (config.isEmpty()) {
    console.error("No config found");
    res.sendStatus(500);
    return;
  }
  console.log(body);
  try {
    if (body.object === "page") {
      const entry = body.entry[0];
      const webhook_event = entry.messaging[0];

      // Check if optin is about notification messages
      if (
        webhook_event.optin &&
        webhook_event.optin.notification_messages_token
      ) {
        console.log("Received optin for notification_messages", webhook_event);

        if (
          webhook_event.optin.notification_messages_status ===
          "STOP_NOTIFICATIONS"
        ) {
          config.removeUserFromConfig(webhook_event.sender.id);

          await FacebookAPI.sendMessage(
            "You have stopped receiving notification messages. If you would like to receive notification messages again, please opt-in again.",
            config,
            webhook_event.sender.id,
            true
          );
        } else {
          console.log("UPDATING CONFIG", config.getConfig());
          config.addUserNotificationMessages;

          await config.fetchGetConfig();
          console.log("UPDATED CONFIG", config.getConfig());

          const userConfig = config.getUserByID(webhook_event.sender.id);

          if (!userConfig) {
            console.warn("No user found");
            res.sendStatus(500);
            return;
          }

          if (!config.validateUserNotificationMessages(userConfig)) {
            await FacebookAPI.sendMessage(
              "You need to allow messages to receive further alerts.",
              config,
              webhook_event.sender.id,
              true
            );
            await FacebookAPI.sendNotifMessageReq(webhook_event.sender.id);

            res.sendStatus(200);
            return;
          }

          await FacebookAPI.sendMessage(
            `Your notification messages token is: "${
              userConfig.notification_messages!.token
            }". Please don't share it with anyone!\n\nYou will now receive notification alerts from smoke detection.`,
            config,
            config.getUserRecipientID(userConfig),
            true
          );
        }
        res.sendStatus(200);
        return;
      } else if (webhook_event.message && webhook_event.sender.id) {
        console.log("Received message", webhook_event);
        if (webhook_event.message.text) {
          await handleMessage(
            webhook_event.sender.id,
            webhook_event.message.text,
            config
          );
        }

        res.sendStatus(200);
        return;
      }

      console.log("Webhook received unknown event: ", webhook_event);
      res.sendStatus(200);
      return;
    }

    console.log("Request unkown. Please try again later.");
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
    const errors = [];

    for (const user of config.users) {
      const { error } = await sendFacebookMessage(
        text,
        getUserRecipientID(user)
      );

      if (error) {
        console.error(`Error sending message to user ${user.id}: `, error);
        errors.push({ user: user.id, error });
      } else {
        console.log("Sent message to user: ", user.id);
      }
    }

    if (errors.length) {
      // Respond with an error if any message failed
      res.status(500).send({
        status: "EVENT_RECEIVED",
        errors,
      });
      return;
    }

    // All messages sent successfully
    res.status(200).send({
      status: "EVENT_RECEIVED",
      error: null,
    });
    return;
  }

  // Handle unknown event
  res.status(200).send({
    status: "EVENT_RECEIVED",
    error: { message: "Unknown event", body },
  });
  return;
}

export async function notifMsgRequest(req: Request, res: Response) {
  const user_id = req.body.user_id;

  const { error, response } = await sendFacebookMessageNotifMsgReq(user_id);
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

  const id = body.recipient_id;

  const { error } = await sendFacebookMessage(body.text, id, true);
  res.status(200).send({
    status: "EVENT_RECEIVED",
    error: error ? error : null,
  });
}

export async function getConfigController(req: Request, res: Response) {
  const config = new Config();
  config.fetchGetConfig();
  res.send(config.getConfig()).status(200);
  return;
}
