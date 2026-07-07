// Shared by Onboarding and the Profile Update Modal — both use the same
// "Image Upload [1.0]" Figma component (473:7134 error state) and the same
// Max 250KB, PNG or JPEG constraint advertised in their hint copy.
const ACCEPTED_TYPES = ["image/png", "image/jpeg"];
const MAX_FILE_SIZE = 250 * 1024;

export function validateAvatarFile(file) {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "Unsupported file type. Please upload a PNG or JPEG";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "File is too large. Max size is 250KB.";
  }
  return null;
}
