import argon2 from "argon2";

/**
 * Parol hash — argon2id (argon2 kutubxonasining default'i). Qollanma
 * bo'lim 3: "Session cookie + argon2 (JWT kerak emas)".
 */
export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    // Buzilgan/eski formatdagi hash — xato tashlamay false qaytaramiz.
    return false;
  }
}
