import Config from "./Config";
import dotenv from "dotenv";
dotenv.config();

export default class FacebookAPI {
  private static PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
  private static PAGE_ID = process.env.PAGE_ID;

  public static async sendMessage(
    text: string,
    config: Config,
    recipientID: string,
    forceUseParamRecipientID = false
  ): Promise<{
    error: Record<string, string> | string | null;
    response: Record<string, string> | null;
  }> {
    const userConfig = config.getUserByID(recipientID);

    if (!userConfig) {
      console.warn("No user found: ", recipientID);
    }

    const recipient =
      forceUseParamRecipientID || !userConfig
        ? { id: recipientID }
        : { id: config.getUserRecipientID(userConfig) };

    const messageData = {
      recipient,
      messaging_type: "RESPONSE",
      message: { text: text },
      access_token: this.PAGE_ACCESS_TOKEN,
    };

    try {
      console.log("Sending message: ", messageData);
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${this.PAGE_ID}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(messageData),
          cache: "no-cache",
        }
      );

      const body = await response.json();

      if (!response.ok) {
        console.error("Unable to send message:", body.error);

        console.log("Retrying with user_id");
        const _user_id = recipientID ? recipientID : userConfig!.id;
        await this.sendMessage(text, config, _user_id, true);
        return { error: body.error, response: null };
      }

      console.log("Message sent");
      return { error: null, response: body };
    } catch (error: any) {
      console.error("Fetch error:", error);
      return { error: error, response: null };
    }
  }

  public static async sendNotifMessageReq(recipientID: string) {
    const messageData = {
      recipient: { id: recipientID },
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
      access_token: this.PAGE_ACCESS_TOKEN,
    };

    try {
      console.log("Sending notification message request: ", messageData);
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${this.PAGE_ID}/messages`,
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
}
