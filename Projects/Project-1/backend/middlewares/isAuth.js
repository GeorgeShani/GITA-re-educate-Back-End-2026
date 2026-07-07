import { verifyToken } from "../config/jwt.js";

function getToken(headers) {
  if (!headers.authorization) return null;

  const [type, token] = headers.authorization.split(" ");
  return type === "Bearer" ? token : null;
}

export function isAuth(req, res, next) {
  const token = getToken(req.headers);

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const payload = verifyToken(token);
    req.userId = payload.id;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
}
