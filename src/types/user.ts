export default interface IUser {
  id: string;
  notification_messages?: {
    token: string;
    expiry_timestamp: string;
    payload: string;
  };
  created_at: string;
  updated_at: string;
}
