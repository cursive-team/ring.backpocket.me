import { keyUids } from "@/shared/keygen";
const aesjs = require("aes-js");

export const verifyCmac = (hexData: string): string | undefined => {
  if (hexData.startsWith("CURSIVE")) {
    const lastTwoChars = hexData.slice(-2);
    const num = parseInt(lastTwoChars, 10);
    if (isNaN(num) || num < 1 || num > 50) return undefined;
    return hexData;
  }

  if (hexData.startsWith("TALK")) {
    const lastTwoChars = hexData.slice(-2);
    const num = parseInt(lastTwoChars, 10);
    if (isNaN(num) || num < 1 || num > 10) return undefined;
    return hexData;
  }

  const cardKeys = process.env.CARD_KEYS!.split(",");

  for (const key of cardKeys) {
    const keyBytes = aesjs.utils.hex.toBytes(key);
    const iv = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    var encryptedBytes = aesjs.utils.hex.toBytes(hexData);
    const aesCbc = new aesjs.ModeOfOperation.cbc(keyBytes, iv);
    const decryptedBytes = aesCbc.decrypt(encryptedBytes);
    // Assuming decryptedBytes is a Uint8Array or similar
    const p_stream = new Uint8Array(decryptedBytes);
    // Read the first byte as picc_data_tag
    const picc_data_tag = p_stream[0];
    // Bitwise operations for flags
    const uid_mirroring_en = (picc_data_tag & 0x80) === 0x80;
    const uid_length = picc_data_tag & 0x0f;
    // Error handling for unsupported UID length
    if (uid_length !== 0x07) {
      continue;
    }
    // Read UID if mirroring is enabled
    if (uid_mirroring_en) {
      let uid = Buffer.from(p_stream.slice(1, 1 + uid_length))
        .toString("hex")
        .toUpperCase();
      console.log(uid);
      if (keyUids.includes(uid)) {
        return uid;
      }
    }
  }

  return undefined;
};
