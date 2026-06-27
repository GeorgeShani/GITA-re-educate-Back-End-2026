export function randomBlock(req, res, next) {
  const shouldBlock = Math.random() < 0.5;

  if (shouldBlock) {
    return res.status(403).json({
      message: "Request blocked randomly",
    });
  }

  next();
}
