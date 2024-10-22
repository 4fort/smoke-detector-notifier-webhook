import IUser from "./user";

export default interface IConfig {
  current_user_id?: string;
  users: IUser[];
  updated_at: string;
}
