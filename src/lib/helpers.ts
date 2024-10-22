import dotenv from "dotenv";
import IConfig from "../types/config";
import {
  promptUserIsAlreadyOptedIn,
  getUserByID,
  getUserRecipientID,
} from "./utils";

dotenv.config();

const PAGE_ID = process.env.PAGE_ID;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const PAGE_VERIFICATION_TOKEN = process.env.PAGE_VERIFICATION_TOKEN;

export async function handleMessage(senderID: string, messageText: string) {
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
  const userConfig = getUserByID(config.users, senderID);
  if (!userConfig) {
    console.error("User not found in config");
  }

  if (messageText === PAGE_VERIFICATION_TOKEN) {
    if (
      userConfig &&
      userConfig.notification_messages &&
      userConfig.notification_messages.token
    ) {
      await promptUserIsAlreadyOptedIn(senderID);
      return;
    }

    await sendFacebookMessage(
      "You entered the correct verification token.",
      senderID,
      true
    );
    await sendOptInMessage(senderID, config);
    return;
  }

  // Make a sendQuickReply() function where user can pick between "Refresh" and "Unbind"
  if (
    userConfig &&
    userConfig.notification_messages &&
    userConfig.notification_messages.token
  ) {
    await promptUserIsAlreadyOptedIn(senderID);
    return;
  }

  await sendFacebookMessage(
    "Please provide the correct verification token to receive alerts.",
    senderID
  );
  return;
}

export async function sendOptInMessage(senderID: string, config: IConfig) {
  const updatedConfig = {
    ...config,
    users: [
      ...config.users,
      {
        id: senderID,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    updated_at: new Date().toISOString(),
  };

  const { error } = await setConfig(updatedConfig);
  if (error) {
    await sendFacebookMessage(
      "An internal server error occurred. Please try again in a while.",
      senderID,
      true
    );
    console.error("Error setting user ID in config: ", error);
    return;
  }

  await sendFacebookMessageNotifMsgReq(senderID);
  return;
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

        console.log("Fetched config: ", data);

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

export async function setConfig(_data: IConfig) {
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
      method: "PUT",
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

export async function sendFacebookMessage(
  text: string,
  recipientID: string,
  forceUseParamRecipientID = false
) {
  const config = await getConfig();

  if (!config) {
    console.error("No config found");
    return { error: "No config found" };
  }

  const userConfig = getUserByID(config.users, recipientID);

  if (!userConfig) {
    console.error("No user found");
  }

  const recipient =
    forceUseParamRecipientID || !userConfig
      ? { id: recipientID }
      : { id: getUserRecipientID(userConfig) };

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

      console.log("Retrying with user_id");
      const _user_id = recipientID ? recipientID : userConfig!.id;
      return await sendFacebookMessage(text, _user_id, true);
    }

    console.log("Message sent");
    return { error: null };
  } catch (error) {
    console.error("Fetch error:", error);
    return { error: error };
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
          title: "Allow notifications to receive smoke detection alerts.",
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
