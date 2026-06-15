import type { NextFunction, Request, Response } from "express";

type Validator = (value: unknown) => string | null;

export function optional(validator: Validator): Validator {
  return (value) => {
    if (value === undefined || value === null || value === "") return null;
    return validator(value);
  };
}

export function stringField(maxLength = 500): Validator {
  return (value) => {
    if (typeof value !== "string") return "must be a string";
    if (value.length > maxLength) return `must be ${maxLength} characters or less`;
    return null;
  };
}

export function booleanField(): Validator {
  return (value) => (typeof value === "boolean" ? null : "must be true or false");
}

export function isoDateField(): Validator {
  return (value) => {
    if (typeof value !== "string") return "must be an ISO date string";
    return Number.isNaN(Date.parse(value)) ? "must be valid ISO date" : null;
  };
}

export function enumField(values: readonly string[]): Validator {
  return (value) => {
    if (typeof value !== "string") return `must be one of: ${values.join(", ")}`;
    return values.includes(value) ? null : `must be one of: ${values.join(", ")}`;
  };
}

export function validateBody(schema: Record<string, Validator>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const fields: Record<string, string> = {};

    for (const [key, validator] of Object.entries(schema)) {
      const error = validator(req.body?.[key]);
      if (error) fields[key] = error;
    }

    if (Object.keys(fields).length) {
      return res.status(400).json({
        ok: false,
        error: "Please check the highlighted fields and try again.",
        fields,
      });
    }

    next();
  };
}

export function validateQuery(schema: Record<string, Validator>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const fields: Record<string, string> = {};

    for (const [key, validator] of Object.entries(schema)) {
      const error = validator(req.query?.[key]);
      if (error) fields[key] = error;
    }

    if (Object.keys(fields).length) {
      return res.status(400).json({
        ok: false,
        error: "Please check the request and try again.",
        fields,
      });
    }

    next();
  };
}