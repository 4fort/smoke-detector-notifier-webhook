import dotenv from "dotenv";
import { ONE_TIME_NOTIF_TOKEN } from "../api";

dotenv.config();

const PAGE_ID = process.env.PAGE_ID;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

export async function getConfig() {
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
        const data = await response.json();

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

  console.log("URI: ", URI);

  try {
    if (!CONFIG_URL || !CONFIG_KEY) {
      throw new Error("Missing CONFIG_URL or CONFIG_KEY");
    }

    console.log("Setting config: ", _data);

    const response = await fetch(`${CONFIG_URL}${CONFIG_KEY}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(_data),
    });

    console.log("Response status:", response.status);
    const responseBody = await response.text();
    console.log("Response body:", responseBody);

    if (response.ok) {
      const data = await response.json();
      console.log("Successfully set config", data);
      return { data, error: null };
    } else {
      console.error("Error response from server: ", responseBody);
      return { error: responseBody };
    }
  } catch (error) {
    console.error("Error during fetch:", error);
    return { error };
  }
}

// export async function setConfig(_data: Record<string, string | number>) {
//   const CONFIG_URL = process.env.CONFIGURATION_URL;
//   const CONFIG_KEY = process.env.CONFIGURATION_KEY;
//   const URI = `${CONFIG_URL}`;

//   console.log(URI);

//   try {
//     if (CONFIG_URL && CONFIG_KEY) {
//       const response = await fetch(URI, {
//         method: "PUT",
//         headers: {
//           "Content-Type": "application/json",
//           "Security-key": CONFIG_KEY,
//         },
//         body: JSON.stringify(_data),
//       });

//       console.log("Request: ", response);

//       const data = await response.json();
//       console.log("Response status:", response.status);
//       console.log("Response body:", await response.text());

//       if (response.ok) {
//         console.log("Successfully set config", data);
//         return { data, error: null };
//       } else {
//         console.error("Error setting config: ", response);
//         return { error: data };
//       }
//     } else {
//       console.error("Missing configuration URL or key");
//       return { error: "Missing configuration URL or key" };
//     }
//   } catch (error) {
//     console.error("Error fetching config: ", error);
//     return { error };
//   }
// }

export async function sendFacebookMessage(recipientId: string, text: string) {
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
