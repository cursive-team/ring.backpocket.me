import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/server/prisma";
import { boolean, object, string } from "yup";
import { ErrorResponse } from "@/types";
import { sign } from "@/lib/shared/signature";
import { getCounterMessage } from "babyjubjub-ecdsa";
import { verifyCmac } from "@/lib/server/cmac";
const crypto = require("crypto");

export enum TapResponseCode {
  CMAC_INVALID = "CMAC_INVALID",
  PERSON_NOT_REGISTERED = "PERSON_NOT_REGISTERED",
  LOCATION_NOT_REGISTERED = "LOCATION_NOT_REGISTERED",
  VALID_PERSON = "VALID_PERSON",
  VALID_LOCATION = "VALID_LOCATION",
  CHIP_KEY_NOT_FOUND = "CHIP_KEY_NOT_FOUND",
}

export type PersonTapResponse = {
  displayName: string;
  encryptionPublicKey: string;
  psiPublicKeysLink: string;
  pkId: string;
  twitter?: string;
  telegram?: string;
  bio?: string;
  isUserSpeaker: boolean;
  signaturePublicKey: string;
  signatureMessage: string;
  signature: string;
};

export const personTapResponseSchema = object({
  displayName: string().required(),
  encryptionPublicKey: string().required(),
  psiPublicKeysLink: string().required(),
  pkId: string().required(),
  twitter: string().optional().default(undefined),
  telegram: string().optional().default(undefined),
  bio: string().optional().default(undefined),
  isUserSpeaker: boolean().required(),
  signaturePublicKey: string().required(),
  signatureMessage: string().required(),
  signature: string().required(),
});

export type LocationTapResponse = {
  id: string;
  name: string;
  stage: string;
  speaker: string;
  description: string;
  startTime: string;
  endTime: string;
  signaturePublicKey: string;
  signatureMessage: string;
  signature: string;
};

export const locationTapResponseSchema = object({
  id: string().required(),
  name: string().required(),
  stage: string().required(),
  speaker: string().required(),
  description: string().required(),
  startTime: string().required(),
  endTime: string().required(),
  signaturePublicKey: string().required(),
  signatureMessage: string().required(),
  signature: string().required(),
});

export type TapResponse = {
  code: TapResponseCode;
  person?: PersonTapResponse;
  location?: LocationTapResponse;
};

export const tapResponseSchema = object({
  code: string().oneOf(Object.values(TapResponseCode)),
  person: personTapResponseSchema.optional().default(undefined),
  location: locationTapResponseSchema.optional().default(undefined),
});

/**
 * Returns a signature for a given chip
 * Mirrors Arx card signature generation
 * First 4 bytes of message are an incrementing counter
 * Remaining 28 bytes are random
 * @param chipId The id of the chip for which to generate a signature
 */
export const generateChipSignature = async (
  chipId: string
): Promise<{ message: string; signature: string }> => {
  const chipKey = await prisma.chipKey.findFirst({
    where: {
      chipId,
    },
  });
  if (!chipKey) {
    throw new Error("Chip key not found");
  }

  const { signaturePrivateKey, numPreviousTaps } = chipKey;
  const msgNonce = numPreviousTaps + 1; // Incrementing counter
  const randomBytes = crypto.randomBytes(28); // 28 random bytes
  const message = getCounterMessage(msgNonce, randomBytes.toString("hex"));
  const signature = sign(signaturePrivateKey, message);

  await prisma.chipKey.update({
    where: {
      chipId,
    },
    data: {
      numPreviousTaps: numPreviousTaps + 1,
    },
  });

  return { message, signature };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ url: string } | ErrorResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // chipEnc must be provided
  const chipEnc = req.query.chipEnc;
  if (!chipEnc || typeof chipEnc !== "string") {
    return res.status(400).json({ error: "Invalid chipEnc provided" });
  }

  // verify encryption
  const chipId = verifyCmac(chipEnc);
  console.log("ChipId", chipId);
  return res
    .status(200)
    .json({ url: `https://connections.cursive.team/tap?chipId=${chipId}` });
}
