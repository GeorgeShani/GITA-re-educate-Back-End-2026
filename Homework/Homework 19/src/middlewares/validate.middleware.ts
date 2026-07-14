import type { NextFunction, Request, Response } from "express";
import type { ObjectSchema } from "joi";

export function validate(
  schema: ObjectSchema,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      res.status(400).json({
        message: "Validation error",
        details: error.details.map((detail) => detail.message),
      });
      return;
    }

    req.body = value;
    next();
  };
}
