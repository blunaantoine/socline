import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

// Database client with two interchangeable backends:
//
//   1. LOCAL / SANDBOX (default): the classic SQLite file from DATABASE_URL
//      (file:/home/z/my-project/db/custom.db). Zero behavior change.
//
//   2. TURSO (Vercel demo): when TURSO_DATABASE_URL is set, Prisma runs on
//      the remote libSQL database through the official driver adapter.
//      Required on Vercel, where the filesystem is ephemeral — a SQLite
//      file would be wiped between serverless invocations.
//      See VERCEL_DEPLOY.md for the setup steps.
//
// A single global instance is reused in dev to avoid connection exhaustion.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createDb(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim()

  if (tursoUrl) {
    const libsql = createClient({
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined,
    })
    return new PrismaClient({
      adapter: new PrismaLibSQL(libsql),
      log: ['error'],
    })
  }

  return new PrismaClient({
    log: ['query'],
  })
}

export const db = globalForPrisma.prisma ?? createDb()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
