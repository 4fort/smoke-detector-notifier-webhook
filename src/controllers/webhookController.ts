import { Request, Response } from "express";
import {
  getConfig,
  handleMessage,
  sendFacebookMessage,
  sendFacebookMessageNotifMsgReq,
  setConfig,
  validateToken,
} from "../lib/helpers";
import { formatDate, getUserByID, getUserRecipientID } from "../lib/utils";
import dotenv from "dotenv";
import IConfig from "../types/config";

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
      const config = await getConfig();
      if (!config) {
        console.error("No config found");
        console.log("Creating new config");
        const newConfig = {
          users: [],
          updated_at: new Date().toISOString(),
        };
        const { error } = await setConfig(newConfig);
        if (error) {
          console.error("Error creating new config", error);
          return;
        }
        console.log("Try again");
        return;
      }

      const entry = body.entry[0];
      const webhook_event = entry.messaging[0];

      if (
        webhook_event.optin &&
        webhook_event.optin.notification_messages_token
      ) {
        console.log("Received optin for notification_messages", webhook_event);

        const updatedConfigUsers = config.users.map((user) => {
          if (user.id === webhook_event.sender.id) {
            return {
              ...user,
              notification_messages: {
                token: webhook_event.optin.notification_messages_token,
                expiry_timestamp: webhook_event.optin.token_expiry_timestamp,
                payload: webhook_event.optin.payload,
              },
            };
          }
          return user;
        });

        const _data: IConfig = {
          ...config,
          users: [...updatedConfigUsers],
          updated_at: new Date().toUTCString(),
        };

        if (
          webhook_event.optin.notification_messages_status !==
          "STOP_NOTIFICATIONS"
        ) {
          console.log("UPDATING CONFIG", _data);
          const _configRes = await setConfig(_data);
          console.log("UPDATED CONFIG", _configRes);

          const updatedConfig = await getConfig();
          if (!updatedConfig) {
            console.error("No config found");
            return;
          }

          const userConfig = getUserByID(
            updatedConfig.users,
            webhook_event.sender.id
          );

          if (!userConfig) {
            console.error("No user found");
            return;
          }

          if (userConfig.notification_messages) {
            await sendFacebookMessage(
              "You need to allow messages to receive further alerts.",
              webhook_event.sender.id
            );
            await sendFacebookMessageNotifMsgReq(webhook_event.sender.id);
            return;
          }

          await sendFacebookMessage(
            `Your notification messages token is: "${
              userConfig.notification_messages!.token
            }". Please don't share it with anyone!\n\nYou will now receive notification alerts from smoke detection.`,
            userConfig.id
          );
        } else {
          const filteredUsers = config?.users.filter(
            (user) => user.id !== webhook_event.sender.id
          );
          await setConfig({
            current_user_id: "",
            users: filteredUsers,
            updated_at: new Date().toUTCString(),
          });

          await sendFacebookMessage(
            "You have stopped receiving notification messages. If you would like to receive notification messages again, please opt-in again.",
            webhook_event.sender.id,
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
    for (const user of config.users) {
      const { error } = await sendFacebookMessage(
        text,
        getUserRecipientID(user)
      );

      if (error) {
        console.error(error);
        res.status(500).send({
          status: "EVENT_RECEIVED",
          error: { message: "Unknown event", body },
        });
        return;
      }

      console.log("Sent message to user: ", user.id);
      res.status(200).send({
        status: "EVENT_RECEIVED",
        error: error ? error : null,
      });
      return;
    }
  }

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
