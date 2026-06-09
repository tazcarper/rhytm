// Back-compat alias: adventure image upload IS the generic public-image
// upload (validation + random path), with the destination bucket chosen by
// the caller's injected storage adapter. See upload-public-image.ts for the
// implementation. Kept so the adventure action reads in its own domain terms.

export {
  uploadPublicImage as uploadAdventureImage,
  type UploadPublicImageInput as UploadAdventureImageInput,
  type UploadPublicImageResult as UploadAdventureImageResult,
} from "./upload-public-image";
