import Config from "./Config";
import dotenv from "dotenv";
dotenv.config();

export default class FacebookAPI {
  private static PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
  private static PAGE_ID = process.env.PAGE_ID;
  private static FACEBOOK_GRAPH_URL = `https://graph.facebook.com/v21.0/${this.PAGE_ID}/messages`;

  public static async sendMessage(
    text: string,
    config: Config,
    recipientID: string,
    forceUserID = false
  ): Promise<{
    error: Record<string, string> | string | null;
    response: Record<string, string> | null;
  }> {
    const userConfig = config.getUserByID(recipientID);

    if (!userConfig) {
      console.warn("No user found: ", recipientID);
    }

    // const recipient =
    //   forceUserID && userConfig
    //     ? { id: userConfig.id }
    //     : userConfig
    //     ? config.getUserRecipientID(userConfig)
    //     : {
    //         id: recipientID,
    //       };

    const recipient =
      forceUserID && userConfig
        ? { id: userConfig.id }
        : userConfig && config.getUserRecipientID(userConfig);

    const messageData = {
      recipient,
      messaging_type: "RESPONSE",
      message: { text: text },
      access_token: this.PAGE_ACCESS_TOKEN,
    };

    try {
      console.log("Sending message: ", messageData);
      const response = await fetch(this.FACEBOOK_GRAPH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messageData),
        cache: "no-cache",
      });

      const body = await response.json();

      if (!response.ok) {
        console.error("Unable to send message:", body.error);

        console.log("Retrying with user_id");
        const _user_id = recipientID ? recipientID : userConfig!.id;
        await this.sendMessage(
          text,
          config,
          config.getUserByID(_user_id)?.id!,
          true
        );
        return { error: body.error, response: null };
      }

      console.log("Message sent");
      return { error: null, response: body };
    } catch (error: any) {
      console.error("Error sending message to graph.facebook", error);
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
            payload: "USER_ALLOW_NOTIFICATION_MESSAGES",
            notification_messages_cta_text: "ALLOW",
          },
        },
      },
      access_token: this.PAGE_ACCESS_TOKEN,
    };

    try {
      console.log("Sending notification message request: ", messageData);
      const response = await fetch(this.FACEBOOK_GRAPH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messageData),
      });

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

  public static async sendQuickReply(
    text: string,
    quickReplies: string[],
    config: Config,
    recipientID: string,
    forceUserID = false
  ): Promise<{
    error: Record<string, string> | string | null;
    response: Record<string, string> | null;
  }> {
    const userConfig = config.getUserByID(recipientID);

    if (!userConfig) {
      console.warn("No user found: ", recipientID);
    }

    const recipient =
      forceUserID && userConfig
        ? { id: userConfig.id }
        : userConfig
        ? config.getUserRecipientID(userConfig)
        : {
            id: recipientID,
          };

    const _quickReplies: {
      content_type: string;
      title: string;
      payload: string;
    }[] = quickReplies.map((qr) => {
      if (typeof qr !== "string") {
        throw new Error(`Quick reply must be a string: ${qr}`);
      }

      return {
        content_type: "text",
        title: qr,
        payload: qr.toUpperCase().replace(/\s+/g, ""),
      };
    });

    const messageData = {
      recipient,
      messaging_type: "RESPONSE",
      message: {
        text,
        quick_replies: _quickReplies,
      },
      access_token: this.PAGE_ACCESS_TOKEN,
    };

    try {
      console.log("Sending quick reply: ", messageData);
      const response = await fetch(this.FACEBOOK_GRAPH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messageData),
        cache: "no-cache",
      });

      const body = await response.json();

      if (!response.ok) {
        console.error("Unable to send message:", body.error);

        console.log("Retrying with user_id");
        const _user_id = recipientID ? recipientID : userConfig!.id;
        await this.sendMessage(
          text,
          config,
          config.getUserByID(_user_id)?.id!,
          true
        );
        return { error: body.error, response: null };
      }

      console.log("Quick reply message sent");
      return { error: null, response: body };
    } catch (error: any) {
      console.error("Error sending quick reply to graph.facebook: ", error);
      return { error: error, response: null };
    }
  }
}
