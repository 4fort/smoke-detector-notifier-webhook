import app from "./api/index";
import serverless from "serverless-http";

module.exports = serverless(app);
