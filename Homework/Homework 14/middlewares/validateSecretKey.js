const SECRET_KEY = "random123";

export function validateSecretKey(req, res, next) {
  const secret = req.headers.secret;

  if (secret !== SECRET_KEY) {
    return res.status(403).json({
      message: "Invalid secret key",
    });
  }

  next();
}
