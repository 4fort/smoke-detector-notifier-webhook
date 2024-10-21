import dotenv from "dotenv";
import { ONE_TIME_NOTIF_TOKEN } from "../api";
import IConfig from "../types/config";

dotenv.config();

const PAGE_ID = process.env.PAGE_ID;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const PAGE_VERIFICATION_TOKEN = process.env.PAGE_VERIFICATION_TOKEN;

export async function handleMessage(senderID: string, messageText: string) {
  if (messageText === PAGE_VERIFICATION_TOKEN) {
    sendOptInMessage(senderID);
    await sendFacebookMessage(
      senderID,
      "You entered the correct verification token."
    );
  }

  await sendFacebookMessage(
    senderID,
    "Please provide the correct verification token."
  );
}

export async function sendOptInMessage(recipientId: string) {
  const configData = {
    user_id: recipientId,
  };

  const { error } = await setConfig(configData);
  if (error) {
    console.error("Error setting user ID in config: ", error);
  }
}

export async function getConfig(): Promise<IConfig | undefined | null> {
  const CONFIG_URL = process.env.CONFIGURATION_URL;
  const CONFIG_KEY = process.env.CONFIGURATION_KEY;
  const URI = `${CONFIG_URL}${CONFIG_KEY}`;

  try {
    if (CONFIG_URL && CONFIG_KEY) {
      const response = await fetch(URI, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data: IConfig = await response.json();

        console.log("Config Data: ", data);

        return data;
      } else {
        console.error("Error fetching user ID from config: ", response);
        return null;
      }
    }
  } catch (error) {
    console.error("Error fetching config: ", error);
    return null;
  }
}

export async function setConfig(_data: Record<string, string | number>) {
  const CONFIG_URL = process.env.CONFIGURATION_URL;
  const CONFIG_KEY = process.env.CONFIGURATION_KEY;
  const URI = `${CONFIG_URL}${CONFIG_KEY}`;

  // console.log("URI: ", URI);

  try {
    if (!CONFIG_URL || !CONFIG_KEY) {
      throw new Error("Missing CONFIG_URL or CONFIG_KEY");
    }

    console.log("Setting config: ", _data);

    const response = await fetch(URI, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(_data),
    });

    const data = await response.json();
    if (response.ok) {
      console.log("Successfully set config", data);
      return { data, error: null };
    } else {
      console.error("Error response from server: ", data);
      return { error: data };
    }
  } catch (error) {
    console.error("Error during fetch:", error);
    return { error };
  }
}

export async function sendFacebookMessage(text: string, recipientID?: string) {
  const config = await getConfig();

  if (!config) {
    console.error("No config found");
    return { error: "No config found" };
  }

  const {
    user_id,
    notification_messages_token,
    notification_token_expiry_timestamp,
  } = config;

  const recipient =
    validateToken(notification_token_expiry_timestamp) &&
    notification_messages_token !== ""
      ? { notification_messages_token }
      : recipientID
      ? { id: recipientID }
      : { id: user_id };

  const messageData = {
    recipient,
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
        cache: "no-cache",
      }
    );

    if (!response.ok) {
      const errorBody = await response.json();
      console.error("Unable to send message:", errorBody.error);
      return { error: errorBody.error };
    }

    console.log("Message sent");
    return { error: null };
  } catch (error) {
    console.error("Fetch error:", error);
    return { error: error };
  }
}

export async function sendFacebookMessageTag(
  recipientId: string,
  text: string
) {
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

export async function sendFacebookMessageNotifMsgReq(recipientId: string) {
  const messageData = {
    recipient: { id: recipientId },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "notification_messages",
          notification_messages_timezone: "UTC",
          title: "Get notified when smoke is detected",
          payload: "ADDITIONAL-WEBHOOK-INFORMATION",
          notification_messages_cta_text: "ALLOW",
        },
      },
    },
    access_token: PAGE_ACCESS_TOKEN,
  };

  try {
    console.log("Sending notification message request: ", messageData);
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
      console.log("Notification Message Request sent");
      return { error: null, response: await response.json() };
    } else {
      const errorBody = await response.json();
      console.error(
        "Unable to send notification message request:",
        errorBody.error
      );
      return { error: errorBody.error, response: null };
    }
  } catch (error) {
    console.error("Fetch error:", error);
    return { error: error, response: null };
  }
}

export function validateToken(timestamp: string) {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const expiryTimestamp = parseInt(timestamp, 10);
  return currentTimestamp < expiryTimestamp;
}
