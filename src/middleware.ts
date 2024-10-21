import express, { Request, Response } from "express";
import { formatDate, statusCodeDecorator } from "./lib/utils";

const logger = express().use((req: Request, res: Response, next) => {
  const { method, url, headers } = req;
  const timestamp = formatDate(new Date(new Date().toISOString()));

  res.on("finish", () => {
    const statusCode = res.statusCode;
    let { status, emoji } = statusCodeDecorator(statusCode);

    console.log(
      `${emoji}[${timestamp}]: ${status} ${method} ${url} - ${headers["user-agent"]}`
    );
  });

  next();
});

export default logger;
