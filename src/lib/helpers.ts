import dotenv from "dotenv";
import IConfig from "../types/config";

dotenv.config();

const PAGE_ID = process.env.PAGE_ID;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const PAGE_VERIFICATION_TOKEN = process.env.PAGE_VERIFICATION_TOKEN;

async function promptUserIsAlreadyOptedIn(senderID: string) {
  await sendFacebookMessage(
    "You are already receiving alerts of smoke detection.",
    senderID
  );
  return;
}

export async function handleMessage(senderID: string, messageText: string) {
  const config = await getConfig();
  if (!config) {
    console.error("No config found");
    return;
  }

  if (messageText === PAGE_VERIFICATION_TOKEN) {
    if (config.user_id === senderID) {
      await promptUserIsAlreadyOptedIn(senderID);
      return;
    }

    await sendFacebookMessage(
      "You entered the correct verification token.",
      senderID,
      true
    );
    await sendFacebookMessage(
      "Your account has been unbound from receiving alerts of smoke detection. If you would like to receive alerts again, please provide the verification token below.",
      config.user_id,
      true
    );
    await sendOptInMessage(senderID);
  }
  if (config.user_id === senderID) {
    // Make a sendQuickReply() function where user can pick between ""
    await promptUserIsAlreadyOptedIn(senderID);
    return;
  }

  await sendFacebookMessage(
    "Please provide the correct verification token to receive alerts.",
    senderID
  );
  return;
}

export async function sendOptInMessage(senderID: string) {
  const configData = {
    user_id: senderID,
  };

  const { error } = await setConfig(configData);
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

export async function sendFacebookMessage(
  text: string,
  recipientID?: string,
  force_userID = false
) {
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

  const recipient = force_userID
    ? { id: recipientID }
    : validateToken(notification_token_expiry_timestamp) &&
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

      console.log("Retrying with user_id");
      const _user_id = recipientID ? recipientID : user_id;
      return await sendFacebookMessage(text, _user_id, true);
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
