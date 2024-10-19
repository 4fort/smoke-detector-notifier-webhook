import express, { Request, Response } from "express";
import { formatDate, statusCodeDecorator } from "./lib/utils";

const logger = express().use((req: Request, res: Response, next) => {
  const { method, url } = req;
  const timestamp = formatDate(new Date(new Date().toISOString()));

  res.on("finish", () => {
    const statusCode = res.statusCode;
    let { status, emoji } = statusCodeDecorator(statusCode);

    console.log(
      `${emoji}[${timestamp}]:\x1b[1m ${status} ${method} \x1b[0m${url}`
    );
  });

  next();
});

export default logger;
