import multer from "multer";

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3 MB — matches src/utils/validateAvatarFile.js
const ALLOWED_TYPES = ["image/jpeg", "image/png"]; // no webp — matches the frontend's accepted types

const storage = multer.memoryStorage();

// Reuses the frontend's exact copy (src/utils/validateAvatarFile.js) so a
// rejection reads the same whether the client or server caught it.
function fileFilter(req, file, cb) {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file type. Please upload a PNG or JPEG"), false);
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
            .json({ message: "File is too large. Max size is 3MB." });
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
