import IConfig from "../types/config";
import IUser from "../types/user";
import dotenv from "dotenv";
dotenv.config();

export default class Config {
  private users: IUser[] = [];
  private updated_at: string = new Date().toISOString();
  private URI = `${process.env.CONFIGURATION_URL}${process.env.CONFIGURATION_KEY}`;

  public async fetchGetConfig() {
    try {
      if (!this.URI) {
        throw new Error("Missing CONFIG_URL or CONFIG_KEY");
      }
      const response = await fetch(this.URI, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.error("Error fetching user ID from config: ", response);
        return;
      }

      const data: IConfig = await response.json();

      console.log("Fetched config: ", data);

      this.users = data.users;
      this.updated_at = data.updated_at;
      return data;
    } catch (error) {
      console.error("Error fetching config: ", error);

      this.users = [];
      this.updated_at = new Date().toISOString();

      return;
    }
  }

  public async fetchSetConfig(_data: IConfig) {
    try {
      if (!this.URI) {
        throw new Error("Missing CONFIG_URL or CONFIG_KEY");
      }

      console.log("Setting config: ", _data);

      const response = await fetch(this.URI, {
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
      console.error("Error setting config:", error);
      return { error };
    }
  }

  public getConfig() {
    return {
      users: this.users,
      updated_at: this.updated_at,
    };
  }

  public isEmpty() {
    return this.users.length === 0;
  }

  public setUsers(users: IUser[]) {
    this.users = users;
    this.updated_at = new Date().toISOString();
  }

  public getUsers() {
    return this.users.map((user) => user);
  }

  public getUserByID(id: string) {
    return this.users.find((user) => user.id === id);
  }

  public getUserRecipientID(user: IUser) {
    return this.validateUserNotificationMessages(user)
      ? { notification_messages_token: user.notification_messages!.token }
      : { id: user.id };
  }

  public validateUserNotificationMessages(user: IUser) {
    if (!user.notification_messages) {
      return false;
    }
    return true;
  }

  public async saveUserToConfig(
    id: string
  ): Promise<"ALREADY_EXISTS" | "ADDED" | "FAILED"> {
    if (this.getUserByID(id)) {
      return "ALREADY_EXISTS";
    }

    const userConfig: IUser = {
      id,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    this.users.push(userConfig);
    this.updated_at = new Date().toISOString();

    const data: IConfig = {
      users: this.users,
      updated_at: this.updated_at,
    };

    // Update the config
    const { error } = await this.fetchSetConfig(data);
    if (error) {
      return "FAILED";
    }

    return "ADDED";
  }

  public async addUserNotificationMessages(event: {
    sender: { id: string };
    optin: {
      notification_messages_token: string;
      token_expiry_timestamp: string;
      payload: string;
    };
  }) {
    const currentConfig = this.getConfig();
    const updatedConfigUsers = currentConfig.users.map((user) => {
      if (user.id === event.sender.id) {
        return {
          ...user,
          notification_messages: {
            token: event.optin.notification_messages_token,
            expiry_timestamp: event.optin.token_expiry_timestamp,
            payload: event.optin.payload,
          },
        };
      }
      return user;
    });

    const data: IConfig = {
      ...currentConfig,
      users: updatedConfigUsers,
      updated_at: new Date().toISOString(),
    };

    // Update the config
    await this.fetchSetConfig(data);
    return;
  }

  public async removeUserFromConfig(id: string) {
    const updatedConfigUsers = this.users.filter((user) => user.id !== id);
    const data: IConfig = {
      users: updatedConfigUsers,
      updated_at: new Date().toISOString(),
    };
    return await this.fetchSetConfig(data);
  }
}
