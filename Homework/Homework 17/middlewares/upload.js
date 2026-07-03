import multer from "multer";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, and WEBP images are allowed"), false);
  }
}

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

// Wraps multer's single-file middleware so upload errors (wrong file type,
// file too large) are turned into clean 400 responses instead of crashing.
export function uploadSingle(fieldName) {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (error) => {
      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          return res
            .status(400)
            .json({ message: "File is too large. Maximum size is 2MB" });
        }
        return res.status(400).json({ message: error.message });
      }
      if (error) {
        return res.status(400).json({ message: error.message });
      }
      next();
    });
  };
}

export default upload;
