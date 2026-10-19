import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { publicAccount } from '../public-account'
import { db } from '../../src/db/client'
import { connectedAccounts } from '../../src/db/schema/index'

export const cloudMonitorRoute = new Hono()

/** Standard-Demokonten bereitstellen, falls der Nutzer noch keine angelegt hat */
const defaultDemoAccounts = [
  {
    provider: 'google' as const,
    email: 'leon.privat@gmail.com',
    label: 'Google Drive (Privat #1)',
    storageUsedBytes: (12.4 * 1024 * 1024 * 1024).toString(),
    storageTotalBytes: (15 * 1024 * 1024 * 1024).toString(),
    metadata: {
      driveUsage: (11.1 * 1024 * 1024 * 1024).toString(),
      trashUsage: (1.3 * 1024 * 1024 * 1024).toString(),
      filesCount: 1420,
      lastSyncedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    },
  },
  {
    provider: 'google' as const,
    email: 'leon.work@gmail.com',
    label: 'Google Drive (Arbeit & FiSi)',
    storageUsedBytes: (9.8 * 1024 * 1024 * 1024).toString(),
    storageTotalBytes: (15 * 1024 * 1024 * 1024).toString(),
    metadata: {
      driveUsage: (9.5 * 1024 * 1024 * 1024).toString(),
      trashUsage: (0.3 * 1024 * 1024 * 1024).toString(),
      filesCount: 840,
      lastSyncedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    },
  },
  {
    provider: 'google' as const,
    email: 'leon.backup.archive@gmail.com',
    label: 'Google Drive (Archiv & ISOS)',
    storageUsedBytes: (14.2 * 1024 * 1024 * 1024).toString(),
    storageTotalBytes: (15 * 1024 * 1024 * 1024).toString(),
    metadata: {
      driveUsage: (14.0 * 1024 * 1024 * 1024).toString(),
      trashUsage: (0.2 * 1024 * 1024 * 1024).toString(),
      filesCount: 45,
      lastSyncedAt: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
    },
  },
  {
    provider: 'mega' as const,
    email: 'leon.cloud@mega.nz',
    label: 'MEGA Cloud (Offsite Backup)',
    storageUsedBytes: (16.8 * 1024 * 1024 * 1024).toString(),
    storageTotalBytes: (20 * 1024 * 1024 * 1024).toString(),
    metadata: {
      filesCount: 320,
      lastSyncedAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    },
  },
]

/** Übersicht aller Cloud-Speicher für das Dashboard und das Monitoring-Modul. */
cloudMonitorRoute.get('/overview', async (c) => {
  const userId = c.get('userId')

  // Alle verbundenen Konten aus der DB abrufen
  let accounts = await db
    .select({
      id: connectedAccounts.id,
      provider: connectedAccounts.provider,
      email: connectedAccounts.email,
      label: connectedAccounts.label,
      avatarUrl: connectedAccounts.avatarUrl,
      storageUsedBytes: connectedAccounts.storageUsedBytes,
      storageTotalBytes: connectedAccounts.storageTotalBytes,
      metadata: connectedAccounts.metadata,
      createdAt: connectedAccounts.createdAt,
      updatedAt: connectedAccounts.updatedAt,
    })
    .from(connectedAccounts)
    .where(eq(connectedAccounts.userId, userId))
    .orderBy(desc(connectedAccounts.createdAt))

  // Falls der Nutzer noch keine Konten angelegt hat, erzeugen wir automatisch die Starter-Konten
  if (accounts.length === 0) {
    const inserted = await db
      .insert(connectedAccounts)
      .values(
        defaultDemoAccounts.map((acc) => ({
          userId,
          provider: acc.provider,
          email: acc.email,
          label: acc.label,
          storageUsedBytes: acc.storageUsedBytes,
          storageTotalBytes: acc.storageTotalBytes,
          metadata: acc.metadata,
        })),
      )
      .returning({
        id: connectedAccounts.id,
        provider: connectedAccounts.provider,
        email: connectedAccounts.email,
        label: connectedAccounts.label,
        avatarUrl: connectedAccounts.avatarUrl,
        storageUsedBytes: connectedAccounts.storageUsedBytes,
        storageTotalBytes: connectedAccounts.storageTotalBytes,
        metadata: connectedAccounts.metadata,
        createdAt: connectedAccounts.createdAt,
        updatedAt: connectedAccounts.updatedAt,
      })

    accounts = inserted
  }

  // Aggregierte Statistiken berechnen
  let totalUsed = BigInt(0)
  let totalCapacity = BigInt(0)
  let googleUsed = BigInt(0)
  let googleCapacity = BigInt(0)
  let microsoftUsed = BigInt(0)
  let microsoftCapacity = BigInt(0)
  let megaUsed = BigInt(0)
  let megaCapacity = BigInt(0)

  for (const acc of accounts) {
    const used = BigInt(Math.round(parseFloat(acc.storageUsedBytes || '0')))
    const total = BigInt(Math.round(parseFloat(acc.storageTotalBytes || '0')))
    totalUsed += used
    totalCapacity += total

    if (acc.provider === 'google') {
      googleUsed += used
      googleCapacity += total
    } else if (acc.provider === 'microsoft') {
      microsoftUsed += used
      microsoftCapacity += total
    } else if (acc.provider === 'mega') {
      megaUsed += used
      megaCapacity += total
    }
  }

  return c.json({
    summary: {
      totalUsedBytes: totalUsed.toString(),
      totalCapacityBytes: totalCapacity.toString(),
      googleUsedBytes: googleUsed.toString(),
      googleCapacityBytes: googleCapacity.toString(),
      megaUsedBytes: megaUsed.toString(),
      megaCapacityBytes: megaCapacity.toString(),
      microsoftUsedBytes: microsoftUsed.toString(),
      microsoftCapacityBytes: microsoftCapacity.toString(),
      microsoftCount: accounts.filter((a) => a.provider === 'microsoft').length,
      accountsCount: accounts.length,
      googleCount: accounts.filter((a) => a.provider === 'google').length,
      megaCount: accounts.filter((a) => a.provider === 'mega').length,
    },
    accounts,
  })
})

/** Einzelnes Konto detailliert abrufen. */
cloudMonitorRoute.get('/account/:id', async (c) => {
  const [account] = await db
    .select()
    .from(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.id, c.req.param('id')),
        eq(connectedAccounts.userId, c.get('userId')),
      ),
    )

  if (!account) return c.json({ error: 'Konto nicht gefunden' }, 404)
  return c.json(publicAccount(account))
})
