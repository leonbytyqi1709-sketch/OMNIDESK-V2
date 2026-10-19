var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/db/schema/appointments.ts
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
var appointments;
var init_appointments = __esm({
  "src/db/schema/appointments.ts"() {
    appointments = pgTable(
      "appointments",
      {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: text("user_id").notNull(),
        title: text("title").notNull(),
        description: text("description").notNull().default(""),
        location: text("location").notNull().default(""),
        priority: text("priority").$type().notNull().default("medium"),
        startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
        endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
      },
      (t) => [index("appointments_user_id_idx").on(t.userId)]
    );
  }
});

// src/db/schema/booking.ts
import {
  boolean,
  integer,
  jsonb,
  pgTable as pgTable2,
  text as text2,
  timestamp as timestamp2,
  uniqueIndex
} from "drizzle-orm/pg-core";
var bookingSettings;
var init_booking = __esm({
  "src/db/schema/booking.ts"() {
    bookingSettings = pgTable2(
      "booking_settings",
      {
        /** Clerk-User-ID – eine Booking-Konfiguration pro Benutzer */
        userId: text2("user_id").primaryKey(),
        /** Öffentlicher URL-Teil: /book/<slug> */
        slug: text2("slug").notNull(),
        /** Buchungsseite aktiv? */
        active: boolean("active").notNull().default(false),
        /** Slot-Länge in Minuten */
        slotMinutes: integer("slot_minutes").notNull().default(30),
        availability: jsonb("availability").$type().notNull(),
        createdAt: timestamp2("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp2("updated_at", { withTimezone: true }).notNull().defaultNow()
      },
      (t) => [uniqueIndex("booking_settings_slug_idx").on(t.slug)]
    );
  }
});

// src/db/schema/commands.ts
import { index as index2, pgTable as pgTable3, text as text3, timestamp as timestamp3, uuid as uuid2 } from "drizzle-orm/pg-core";
var commands;
var init_commands = __esm({
  "src/db/schema/commands.ts"() {
    commands = pgTable3(
      "commands",
      {
        id: uuid2("id").primaryKey().defaultRandom(),
        userId: text3("user_id").notNull(),
        /** Kurzbeschreibung, z.B. "Alle offenen Ports anzeigen" */
        title: text3("title").notNull(),
        /** Der eigentliche Befehl */
        command: text3("command").notNull(),
        /** Kategorie, z.B. Linux, PowerShell, Cisco, Docker */
        category: text3("category").notNull().default("Allgemein"),
        createdAt: timestamp3("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp3("updated_at", { withTimezone: true }).notNull().defaultNow()
      },
      (t) => [index2("commands_user_id_idx").on(t.userId)]
    );
  }
});

// src/db/schema/contacts.ts
import { index as index3, pgTable as pgTable4, text as text4, timestamp as timestamp4, uuid as uuid3 } from "drizzle-orm/pg-core";
var contacts;
var init_contacts = __esm({
  "src/db/schema/contacts.ts"() {
    contacts = pgTable4(
      "contacts",
      {
        id: uuid3("id").primaryKey().defaultRandom(),
        userId: text4("user_id").notNull(),
        firstName: text4("first_name").notNull(),
        lastName: text4("last_name").notNull().default(""),
        email: text4("email").notNull().default(""),
        phone: text4("phone").notNull().default(""),
        company: text4("company").notNull().default(""),
        notes: text4("notes").notNull().default(""),
        createdAt: timestamp4("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp4("updated_at", { withTimezone: true }).notNull().defaultNow()
      },
      (t) => [index3("contacts_user_id_idx").on(t.userId)]
    );
  }
});

// src/db/schema/links.ts
import { index as index4, pgTable as pgTable5, text as text5, timestamp as timestamp5, uuid as uuid4 } from "drizzle-orm/pg-core";
var links;
var init_links = __esm({
  "src/db/schema/links.ts"() {
    links = pgTable5(
      "links",
      {
        id: uuid4("id").primaryKey().defaultRandom(),
        /** Clerk-User-ID des Besitzers */
        userId: text5("user_id").notNull(),
        title: text5("title").notNull(),
        url: text5("url").notNull(),
        category: text5("category"),
        /** Icon-Name (Lucide) oder Favicon-URL */
        icon: text5("icon"),
        createdAt: timestamp5("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp5("updated_at", { withTimezone: true }).notNull().defaultNow()
      },
      (t) => [index4("links_user_id_idx").on(t.userId)]
    );
  }
});

// src/db/schema/notes.ts
import { index as index5, pgTable as pgTable6, text as text6, timestamp as timestamp6, uuid as uuid5 } from "drizzle-orm/pg-core";
var notes;
var init_notes = __esm({
  "src/db/schema/notes.ts"() {
    notes = pgTable6(
      "notes",
      {
        id: uuid5("id").primaryKey().defaultRandom(),
        /** Clerk-User-ID des Besitzers */
        userId: text6("user_id").notNull(),
        title: text6("title").notNull().default("Unbenannte Notiz"),
        /** Markdown-Inhalt */
        content: text6("content").notNull().default(""),
        createdAt: timestamp6("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp6("updated_at", { withTimezone: true }).notNull().defaultNow()
      },
      (t) => [index5("notes_user_id_idx").on(t.userId)]
    );
  }
});

// src/db/schema/projects.ts
import {
  boolean as boolean2,
  index as index6,
  jsonb as jsonb2,
  pgTable as pgTable7,
  text as text7,
  timestamp as timestamp7,
  uuid as uuid6
} from "drizzle-orm/pg-core";
var PROJECT_STATUSES, PROJECT_TASK_STATUSES, projects, projectTasks, milestones;
var init_projects = __esm({
  "src/db/schema/projects.ts"() {
    PROJECT_STATUSES = ["active", "paused", "done"];
    PROJECT_TASK_STATUSES = [
      "backlog",
      "todo",
      "in_progress",
      "done"
    ];
    projects = pgTable7(
      "projects",
      {
        id: uuid6("id").primaryKey().defaultRandom(),
        userId: text7("user_id").notNull(),
        name: text7("name").notNull(),
        description: text7("description").notNull().default(""),
        priority: text7("priority").$type().notNull().default("medium"),
        status: text7("status").$type().notNull().default("active"),
        tags: jsonb2("tags").$type().default([]),
        createdAt: timestamp7("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp7("updated_at", { withTimezone: true }).notNull().defaultNow()
      },
      (t) => [index6("projects_user_id_idx").on(t.userId)]
    );
    projectTasks = pgTable7(
      "project_tasks",
      {
        id: uuid6("id").primaryKey().defaultRandom(),
        userId: text7("user_id").notNull(),
        projectId: uuid6("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
        title: text7("title").notNull(),
        status: text7("status").$type().notNull().default("backlog"),
        priority: text7("priority").$type().notNull().default("medium"),
        createdAt: timestamp7("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp7("updated_at", { withTimezone: true }).notNull().defaultNow()
      },
      (t) => [
        index6("project_tasks_user_id_idx").on(t.userId),
        index6("project_tasks_project_id_idx").on(t.projectId)
      ]
    );
    milestones = pgTable7(
      "milestones",
      {
        id: uuid6("id").primaryKey().defaultRandom(),
        userId: text7("user_id").notNull(),
        projectId: uuid6("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
        title: text7("title").notNull(),
        dueDate: timestamp7("due_date", { withTimezone: true }),
        done: boolean2("done").notNull().default(false),
        createdAt: timestamp7("created_at", { withTimezone: true }).notNull().defaultNow()
      },
      (t) => [index6("milestones_project_id_idx").on(t.projectId)]
    );
  }
});

// src/db/schema/tasks.ts
import { index as index7, jsonb as jsonb3, pgTable as pgTable8, text as text8, timestamp as timestamp8, uuid as uuid7 } from "drizzle-orm/pg-core";
var TASK_PRIORITIES, TASK_STATUSES, tasks;
var init_tasks = __esm({
  "src/db/schema/tasks.ts"() {
    TASK_PRIORITIES = ["high", "medium", "low"];
    TASK_STATUSES = ["todo", "in_progress", "done"];
    tasks = pgTable8(
      "tasks",
      {
        id: uuid7("id").primaryKey().defaultRandom(),
        userId: text8("user_id").notNull(),
        title: text8("title").notNull(),
        description: text8("description").notNull().default(""),
        priority: text8("priority").$type().notNull().default("medium"),
        status: text8("status").$type().notNull().default("todo"),
        dueDate: timestamp8("due_date", { withTimezone: true }),
        tags: jsonb3("tags").$type().default([]),
        subtasks: jsonb3("subtasks").$type().default([]),
        createdAt: timestamp8("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp8("updated_at", { withTimezone: true }).notNull().defaultNow()
      },
      (t) => [index7("tasks_user_id_idx").on(t.userId)]
    );
  }
});

// src/db/schema/vault.ts
import { index as index8, pgTable as pgTable9, text as text9, timestamp as timestamp9, uuid as uuid8 } from "drizzle-orm/pg-core";
var VAULT_CATEGORIES, vaults, vaultEntries;
var init_vault = __esm({
  "src/db/schema/vault.ts"() {
    VAULT_CATEGORIES = ["privat", "familie", "kunden"];
    vaults = pgTable9("vaults", {
      /** Clerk-User-ID – ein Vault pro Benutzer */
      userId: text9("user_id").primaryKey(),
      /** PBKDF2-Salt (Base64) */
      salt: text9("salt").notNull(),
      /** Verschlüsselter Prüfwert zum Validieren des Master-Passworts (JSON: iv+ct, Base64) */
      verifier: text9("verifier").notNull(),
      createdAt: timestamp9("created_at", { withTimezone: true }).notNull().defaultNow()
    });
    vaultEntries = pgTable9(
      "vault_entries",
      {
        id: uuid8("id").primaryKey().defaultRandom(),
        userId: text9("user_id").notNull(),
        category: text9("category").$type().notNull().default("privat"),
        /** AES-256-GCM-Ciphertext (Base64) über das JSON des Eintrags */
        ciphertext: text9("ciphertext").notNull(),
        /** GCM-IV (Base64), pro Eintrag einmalig */
        iv: text9("iv").notNull(),
        createdAt: timestamp9("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp9("updated_at", { withTimezone: true }).notNull().defaultNow()
      },
      (t) => [index8("vault_entries_user_id_idx").on(t.userId)]
    );
  }
});

// src/db/schema/integrations.ts
import {
  index as index9,
  jsonb as jsonb4,
  pgTable as pgTable10,
  text as text10,
  timestamp as timestamp10,
  uuid as uuid9
} from "drizzle-orm/pg-core";
var INTEGRATION_PROVIDERS, connectedAccounts;
var init_integrations = __esm({
  "src/db/schema/integrations.ts"() {
    INTEGRATION_PROVIDERS = ["google", "mega", "microsoft"];
    connectedAccounts = pgTable10(
      "connected_accounts",
      {
        id: uuid9("id").primaryKey().defaultRandom(),
        userId: text10("user_id").notNull(),
        provider: text10("provider").$type().notNull(),
        email: text10("email").notNull(),
        label: text10("label").notNull().default(""),
        avatarUrl: text10("avatar_url"),
        accessToken: text10("access_token"),
        refreshToken: text10("refresh_token"),
        tokenExpiry: timestamp10("token_expiry", { withTimezone: true }),
        scopes: text10("scopes"),
        storageUsedBytes: text10("storage_used_bytes").notNull().default("0"),
        storageTotalBytes: text10("storage_total_bytes").notNull().default("0"),
        metadata: jsonb4("metadata").$type().default({}),
        createdAt: timestamp10("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp10("updated_at", { withTimezone: true }).notNull().defaultNow()
      },
      (t) => [
        index9("connected_accounts_user_id_idx").on(t.userId),
        index9("connected_accounts_provider_idx").on(t.provider)
      ]
    );
  }
});

// src/db/schema/uptime.ts
import {
  boolean as boolean3,
  index as index10,
  integer as integer2,
  pgTable as pgTable11,
  text as text11,
  timestamp as timestamp11,
  uuid as uuid10
} from "drizzle-orm/pg-core";
var MONITOR_TYPES, CHECK_STATUSES, uptimeMonitors, uptimeChecks;
var init_uptime = __esm({
  "src/db/schema/uptime.ts"() {
    MONITOR_TYPES = ["http", "tcp"];
    CHECK_STATUSES = ["up", "down"];
    uptimeMonitors = pgTable11(
      "uptime_monitors",
      {
        id: uuid10("id").primaryKey().defaultRandom(),
        userId: text11("user_id").notNull(),
        name: text11("name").notNull(),
        type: text11("type").$type().notNull().default("http"),
        url: text11("url").notNull(),
        port: integer2("port"),
        expectedStatus: integer2("expected_status").notNull().default(200),
        timeoutMs: integer2("timeout_ms").notNull().default(1e4),
        active: boolean3("active").notNull().default(true),
        createdAt: timestamp11("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp11("updated_at", { withTimezone: true }).notNull().defaultNow()
      },
      (t) => [index10("uptime_monitors_user_id_idx").on(t.userId)]
    );
    uptimeChecks = pgTable11(
      "uptime_checks",
      {
        id: uuid10("id").primaryKey().defaultRandom(),
        monitorId: uuid10("monitor_id").notNull().references(() => uptimeMonitors.id, { onDelete: "cascade" }),
        status: text11("status").$type().notNull(),
        responseTimeMs: integer2("response_time_ms"),
        statusCode: integer2("status_code"),
        sslDaysLeft: integer2("ssl_days_left"),
        error: text11("error"),
        checkedAt: timestamp11("checked_at", { withTimezone: true }).notNull().defaultNow()
      },
      (t) => [
        index10("uptime_checks_monitor_id_idx").on(t.monitorId),
        index10("uptime_checks_monitor_checked_idx").on(t.monitorId, t.checkedAt)
      ]
    );
  }
});

// src/db/schema/chat.ts
import { index as index11, pgTable as pgTable12, text as text12, timestamp as timestamp12, uuid as uuid11 } from "drizzle-orm/pg-core";
var CHAT_ROLES, chatSessions, chatMessages;
var init_chat = __esm({
  "src/db/schema/chat.ts"() {
    CHAT_ROLES = ["user", "assistant", "system"];
    chatSessions = pgTable12(
      "chat_sessions",
      {
        id: uuid11("id").primaryKey().defaultRandom(),
        userId: text12("user_id").notNull(),
        title: text12("title").notNull().default("Neuer Chat"),
        createdAt: timestamp12("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp12("updated_at", { withTimezone: true }).notNull().defaultNow()
      },
      (t) => [index11("chat_sessions_user_id_idx").on(t.userId)]
    );
    chatMessages = pgTable12(
      "chat_messages",
      {
        id: uuid11("id").primaryKey().defaultRandom(),
        sessionId: uuid11("session_id").notNull().references(() => chatSessions.id, { onDelete: "cascade" }),
        role: text12("role").$type().notNull(),
        content: text12("content").notNull(),
        createdAt: timestamp12("created_at", { withTimezone: true }).notNull().defaultNow()
      },
      (t) => [index11("chat_messages_session_id_idx").on(t.sessionId)]
    );
  }
});

// src/db/schema/neon-monitoring.ts
import { boolean as boolean4, check, index as index12, integer as integer3, jsonb as jsonb5, pgTable as pgTable13, text as text13, timestamp as timestamp13, uniqueIndex as uniqueIndex2, uuid as uuid12 } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
var neonMonitoringConfig, neonMonitoringSamples, neonMonitoringAlerts;
var init_neon_monitoring = __esm({
  "src/db/schema/neon-monitoring.ts"() {
    init_projects();
    neonMonitoringConfig = pgTable13("v2_neon_config", {
      projectId: uuid12("project_id").primaryKey().references(() => projects.id, { onDelete: "cascade" }),
      userId: text13("user_id").notNull(),
      resourceKey: text13("resource_key").notNull(),
      settings: jsonb5("settings").$type().notNull(),
      lastAttemptAt: timestamp13("last_attempt_at", { withTimezone: true }),
      lastSuccessAt: timestamp13("last_success_at", { withTimezone: true }),
      lastSchedulerAt: timestamp13("last_scheduler_at", { withTimezone: true }),
      lastSnapshot: jsonb5("last_snapshot").$type(),
      lastSql: jsonb5("last_sql").$type(),
      failures: integer3("failures").notNull().default(0),
      leaseToken: uuid12("lease_token"),
      leaseUntil: timestamp13("lease_until", { withTimezone: true }),
      updatedAt: timestamp13("updated_at", { withTimezone: true }).notNull().defaultNow()
    });
    neonMonitoringSamples = pgTable13("v2_neon_samples", {
      id: uuid12("id").primaryKey().defaultRandom(),
      projectId: uuid12("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
      userId: text13("user_id").notNull(),
      resourceKey: text13("resource_key").notNull(),
      checkedAt: timestamp13("checked_at", { withTimezone: true }).notNull(),
      bucket: timestamp13("bucket", { withTimezone: true }).notNull(),
      source: text13("source").notNull(),
      snapshot: jsonb5("snapshot").$type(),
      sqlCheck: jsonb5("sql_check").$type(),
      complete: boolean4("complete").notNull()
    }, (t) => [check("v2_neon_samples_source_check", sql`${t.source} IN ('manual','scheduler')`), uniqueIndex2("v2_neon_samples_unique").on(t.projectId, t.userId, t.resourceKey, t.bucket), index12("v2_neon_samples_lookup").on(t.projectId, t.userId, t.resourceKey, t.checkedAt)]);
    neonMonitoringAlerts = pgTable13("v2_neon_alerts", {
      id: uuid12("id").primaryKey().defaultRandom(),
      projectId: uuid12("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
      userId: text13("user_id").notNull(),
      resourceKey: text13("resource_key").notNull(),
      code: text13("code").notNull(),
      message: text13("message").notNull(),
      severity: text13("severity").notNull(),
      startedAt: timestamp13("started_at", { withTimezone: true }).notNull().defaultNow(),
      resolvedAt: timestamp13("resolved_at", { withTimezone: true }),
      acknowledgedAt: timestamp13("acknowledged_at", { withTimezone: true })
    }, (t) => [uniqueIndex2("v2_neon_alerts_open").on(t.projectId, t.userId, t.resourceKey, t.code).where(sql`${t.resolvedAt} IS NULL`)]);
  }
});

// src/db/schema/github.ts
import { pgTable as pgTable14, text as text14, timestamp as timestamp14, uuid as uuid13 } from "drizzle-orm/pg-core";
var githubProjectLinks;
var init_github = __esm({
  "src/db/schema/github.ts"() {
    init_projects();
    githubProjectLinks = pgTable14("v2_github_links", {
      projectId: uuid13("project_id").primaryKey().references(() => projects.id, { onDelete: "cascade" }),
      userId: text14("user_id").notNull(),
      repository: text14("repository").notNull(),
      updatedAt: timestamp14("updated_at", { withTimezone: true }).notNull().defaultNow()
    });
  }
});

// src/db/schema/index.ts
var schema_exports = {};
__export(schema_exports, {
  CHAT_ROLES: () => CHAT_ROLES,
  CHECK_STATUSES: () => CHECK_STATUSES,
  INTEGRATION_PROVIDERS: () => INTEGRATION_PROVIDERS,
  MONITOR_TYPES: () => MONITOR_TYPES,
  PROJECT_STATUSES: () => PROJECT_STATUSES,
  PROJECT_TASK_STATUSES: () => PROJECT_TASK_STATUSES,
  TASK_PRIORITIES: () => TASK_PRIORITIES,
  TASK_STATUSES: () => TASK_STATUSES,
  VAULT_CATEGORIES: () => VAULT_CATEGORIES,
  appointments: () => appointments,
  bookingSettings: () => bookingSettings,
  chatMessages: () => chatMessages,
  chatSessions: () => chatSessions,
  commands: () => commands,
  connectedAccounts: () => connectedAccounts,
  contacts: () => contacts,
  githubProjectLinks: () => githubProjectLinks,
  links: () => links,
  milestones: () => milestones,
  neonMonitoringAlerts: () => neonMonitoringAlerts,
  neonMonitoringConfig: () => neonMonitoringConfig,
  neonMonitoringSamples: () => neonMonitoringSamples,
  notes: () => notes,
  projectTasks: () => projectTasks,
  projects: () => projects,
  tasks: () => tasks,
  uptimeChecks: () => uptimeChecks,
  uptimeMonitors: () => uptimeMonitors,
  vaultEntries: () => vaultEntries,
  vaults: () => vaults
});
var init_schema = __esm({
  "src/db/schema/index.ts"() {
    init_appointments();
    init_booking();
    init_commands();
    init_contacts();
    init_links();
    init_notes();
    init_projects();
    init_tasks();
    init_vault();
    init_integrations();
    init_uptime();
    init_chat();
    init_neon_monitoring();
    init_github();
  }
});

// src/db/client.ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
function getDb() {
  if (cachedDb) return cachedDb;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("ENV_FEHLT: DATABASE_URL ist auf Vercel nicht gesetzt");
  }
  cachedDb = drizzle(neon(databaseUrl), { schema: schema_exports });
  return cachedDb;
}
var cachedDb, db;
var init_client = __esm({
  "src/db/client.ts"() {
    init_schema();
    if ("window" in globalThis) {
      throw new Error("db/client.ts darf nicht im Browser importiert werden.");
    }
    cachedDb = null;
    db = new Proxy({}, {
      get(_target, prop, receiver) {
        return Reflect.get(getDb(), prop, receiver);
      }
    });
  }
});

// server/uptime-check.ts
var uptime_check_exports = {};
__export(uptime_check_exports, {
  checkSingleMonitor: () => checkSingleMonitor,
  refreshAllMonitors: () => refreshAllMonitors
});
import net from "node:net";
import tls from "node:tls";
import { and as and15, eq as eq17 } from "drizzle-orm";
function getSslDaysRemaining(hostname, port = 443, timeoutMs = 5e3) {
  return new Promise((resolve) => {
    try {
      const socket = tls.connect(
        {
          host: hostname,
          port,
          servername: hostname,
          rejectUnauthorized: false,
          timeout: timeoutMs
        },
        () => {
          try {
            const cert = socket.getPeerCertificate();
            socket.destroy();
            if (cert && cert.valid_to) {
              const expireDate = new Date(cert.valid_to).getTime();
              const now = Date.now();
              const days = Math.floor((expireDate - now) / (1e3 * 60 * 60 * 24));
              resolve(days);
            } else {
              resolve(null);
            }
          } catch {
            socket.destroy();
            resolve(null);
          }
        }
      );
      socket.on("error", () => {
        socket.destroy();
        resolve(null);
      });
      socket.on("timeout", () => {
        socket.destroy();
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}
async function checkHttp(url2, expectedStatus = 200, timeoutMs = 1e4) {
  const start = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let statusCode = null;
  let sslDaysLeft = null;
  try {
    const normalizedUrl = url2.startsWith("http://") || url2.startsWith("https://") ? url2 : `https://${url2}`;
    const parsedUrl = new URL(normalizedUrl);
    if (parsedUrl.protocol === "https:") {
      const sslPort = parsedUrl.port ? parseInt(parsedUrl.port, 10) : 443;
      sslDaysLeft = await getSslDaysRemaining(
        parsedUrl.hostname,
        sslPort,
        Math.min(timeoutMs, 5e3)
      );
    }
    const res = await fetch(normalizedUrl, {
      signal: controller.signal,
      method: "GET",
      headers: {
        "User-Agent": "OmniDesk-Uptime-Monitor/1.0"
      }
    });
    clearTimeout(timeoutId);
    const duration = Math.round(performance.now() - start);
    statusCode = res.status;
    if (res.status === expectedStatus) {
      return {
        status: "up",
        responseTimeMs: duration,
        statusCode,
        sslDaysLeft,
        error: null
      };
    } else {
      return {
        status: "down",
        responseTimeMs: duration,
        statusCode,
        sslDaysLeft,
        error: `Status ${res.status} (erwartet: ${expectedStatus})`
      };
    }
  } catch (err) {
    clearTimeout(timeoutId);
    const duration = Math.round(performance.now() - start);
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: "down",
      responseTimeMs: duration,
      statusCode,
      sslDaysLeft,
      error: message.includes("aborted") ? `Timeout (${timeoutMs}ms)` : message
    };
  }
}
function checkTcp(host, port, timeoutMs = 1e4) {
  return new Promise((resolve) => {
    const start = performance.now();
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.connect(port, host, () => {
      const duration = Math.round(performance.now() - start);
      socket.destroy();
      resolve({
        status: "up",
        responseTimeMs: duration,
        statusCode: null,
        sslDaysLeft: null,
        error: null
      });
    });
    socket.on("error", (err) => {
      const duration = Math.round(performance.now() - start);
      socket.destroy();
      resolve({
        status: "down",
        responseTimeMs: duration,
        statusCode: null,
        sslDaysLeft: null,
        error: err.message
      });
    });
    socket.on("timeout", () => {
      const duration = Math.round(performance.now() - start);
      socket.destroy();
      resolve({
        status: "down",
        responseTimeMs: duration,
        statusCode: null,
        sslDaysLeft: null,
        error: `Timeout (${timeoutMs}ms)`
      });
    });
  });
}
async function checkSingleMonitor(monitor) {
  let result;
  if (monitor.type === "tcp") {
    const port = monitor.port || 80;
    result = await checkTcp(monitor.url, port, monitor.timeoutMs);
  } else {
    result = await checkHttp(monitor.url, monitor.expectedStatus, monitor.timeoutMs);
  }
  const [row] = await db.insert(uptimeChecks).values({
    monitorId: monitor.id,
    status: result.status,
    responseTimeMs: result.responseTimeMs,
    statusCode: result.statusCode,
    sslDaysLeft: result.sslDaysLeft,
    error: result.error
  }).returning();
  return row;
}
async function refreshAllMonitors(userId) {
  const query = userId ? and15(eq17(uptimeMonitors.active, true), eq17(uptimeMonitors.userId, userId)) : eq17(uptimeMonitors.active, true);
  const monitors = await db.select().from(uptimeMonitors).where(query);
  if (monitors.length === 0) return [];
  const results = await Promise.allSettled(
    monitors.map((m) => checkSingleMonitor(m))
  );
  return results;
}
var init_uptime_check = __esm({
  "server/uptime-check.ts"() {
    init_client();
    init_schema();
  }
});

// server/neon-monitor.ts
import { z as z14 } from "zod";
function readNeonLinks() {
  const value = process.env.NEON_MONITOR_LINKS;
  if (!value?.trim()) return [];
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new NeonConfigurationError("NEON_MONITOR_LINKS enth\xE4lt ung\xFCltiges JSON. In Vercel die vollst\xE4ndige Liste von [ bis ] ohne Markdown-Codezeichen und ohne zus\xE4tzliche \xE4u\xDFere Anf\xFChrungszeichen eintragen und neu deployen.");
  }
  const result = z14.array(neonLinkSchema).max(100).safeParse(parsed);
  if (!result.success) {
    const path = result.error.issues[0]?.path;
    const field = path?.length ? path.join(".") : "Liste";
    throw new NeonConfigurationError(`Neon-Zuordnung ist ung\xFCltig: Feld ${field} in NEON_MONITOR_LINKS pr\xFCfen. projectId muss eine OMNIDESK-Projekt-UUID sein; Neon-IDs d\xFCrfen nur Kleinbuchstaben, Ziffern und Bindestriche enthalten.`);
  }
  const identities = result.data.map((link) => `${link.userId}:${link.projectId}`);
  if (new Set(identities).size !== identities.length) {
    throw new NeonConfigurationError("Neon-Zuordnung ist ung\xFCltig: Mehrere Eintr\xE4ge f\xFCr denselben Benutzer und dasselbe OMNIDESK-Projekt in NEON_MONITOR_LINKS.");
  }
  return result.data;
}
async function neonGet(path) {
  const key = process.env.NEON_API_KEY?.trim();
  if (!key) throw new Error("Neon ist noch nicht eingerichtet: NEON_API_KEY fehlt.");
  const response = await fetch(`https://console.neon.tech/api/v2${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(12e3)
  });
  if (!response.ok) throw new Error(`Neon-Abfrage fehlgeschlagen (HTTP ${response.status}). Berechtigungen, Projektzuordnung oder API-Limit pr\xFCfen.`);
  return response.json();
}
async function fetchNeonSnapshot(link) {
  const root = `/projects/${encodeURIComponent(link.neonProjectId)}`;
  const results = await Promise.allSettled([
    neonGet(root).then((body) => projectSchema.parse(body).project),
    neonGet(`${root}/branches/${encodeURIComponent(link.branchId)}`).then((body) => branchSchema.parse(body).branch),
    neonGet(`${root}/endpoints`).then((body) => endpointSchema.parse(body).endpoints)
  ]);
  const [projectResult, branchResult, endpointsResult] = results;
  if (projectResult.status === "fulfilled" && projectResult.value.id !== link.neonProjectId) throw new Error("Neon-Projektzuordnung stimmt nicht mit der Antwort \xFCberein.");
  if (branchResult.status === "fulfilled" && (branchResult.value.id !== link.branchId || branchResult.value.project_id !== link.neonProjectId)) throw new Error("Neon-Branchzuordnung stimmt nicht mit der Antwort \xFCberein.");
  if (results.every((result) => result.status === "rejected")) throw new Error("Neon ist derzeit nicht abrufbar. API-Schl\xFCssel, Freigaben und Zuordnung pr\xFCfen.");
  const project2 = projectResult.status === "fulfilled" ? projectResult.value : null;
  const branch = branchResult.status === "fulfilled" ? branchResult.value : null;
  const endpoints = endpointsResult.status === "fulfilled" ? endpointsResult.value.filter((endpoint) => endpoint.branch_id === link.branchId && endpoint.project_id === link.neonProjectId) : null;
  return {
    checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
    project: project2 ? {
      id: project2.id,
      name: project2.name,
      region: project2.region_id ?? null,
      postgresVersion: project2.pg_version ?? null
    } : null,
    branch: branch ? {
      id: branch.id,
      name: branch.name,
      state: branch.current_state,
      logicalSizeBytes: branch.logical_size ?? null
    } : null,
    endpoints: endpoints?.map((endpoint) => ({
      id: endpoint.id,
      state: endpoint.current_state,
      pendingState: endpoint.pending_state ?? null,
      type: endpoint.type,
      disabled: endpoint.disabled,
      lastActive: endpoint.last_active ?? null,
      minCu: endpoint.autoscaling_limit_min_cu ?? null,
      maxCu: endpoint.autoscaling_limit_max_cu ?? null
    })) ?? null,
    consumption: project2 ? {
      projectStorageBytes: project2.synthetic_storage_size ?? null,
      computeCuSeconds: project2.compute_time_seconds ?? null,
      activeSeconds: project2.active_time_seconds ?? null,
      transferBytes: project2.data_transfer_bytes ?? null,
      periodStart: project2.consumption_period_start ?? null,
      periodEnd: project2.consumption_period_end ?? null
    } : null,
    unavailable: results.flatMap((result, index13) => result.status === "rejected" ? [["Projektwerte", "Branchwerte", "Compute-Status"][index13]] : [])
  };
}
var neonId, neonLinkSchema, NeonConfigurationError, metric, projectSchema, branchSchema, endpointSchema;
var init_neon_monitor = __esm({
  "server/neon-monitor.ts"() {
    neonId = z14.string().regex(/^[a-z0-9-]{1,60}$/);
    neonLinkSchema = z14.object({
      userId: z14.string().min(1),
      projectId: z14.uuid(),
      neonProjectId: neonId,
      branchId: neonId
    });
    NeonConfigurationError = class extends Error {
      constructor(message) {
        super(message);
        this.name = "NeonConfigurationError";
      }
    };
    metric = z14.number().finite().nonnegative().optional().nullable();
    projectSchema = z14.object({ project: z14.object({
      id: z14.string(),
      name: z14.string(),
      region_id: z14.string().optional(),
      pg_version: z14.number().optional(),
      synthetic_storage_size: metric,
      compute_time_seconds: metric,
      active_time_seconds: metric,
      data_transfer_bytes: metric,
      consumption_period_start: z14.string().optional(),
      consumption_period_end: z14.string().optional()
    }) });
    branchSchema = z14.object({ branch: z14.object({
      id: z14.string(),
      project_id: z14.string(),
      name: z14.string(),
      current_state: z14.string(),
      logical_size: metric
    }) });
    endpointSchema = z14.object({ endpoints: z14.array(z14.object({
      id: z14.string(),
      branch_id: z14.string(),
      project_id: z14.string(),
      current_state: z14.string(),
      pending_state: z14.string().optional(),
      type: z14.string(),
      disabled: z14.boolean(),
      last_active: z14.string().optional(),
      autoscaling_limit_min_cu: metric,
      autoscaling_limit_max_cu: metric
    })) });
  }
});

// server/neon-policy.ts
import { z as z15 } from "zod";
function evaluateNeonAlerts(settings, snapshot, failures, sql2) {
  const over = (value, limit, divisor = 1) => limit === null ? false : value == null ? null : value / divisor >= limit;
  const conditions = [
    { code: "api_failures", active: failures >= settings.failureThreshold, severity: "critical", message: `Neon-Daten sind seit mindestens ${settings.failureThreshold} Pr\xFCfungen unvollst\xE4ndig oder nicht abrufbar.` },
    { code: "storage", active: over(snapshot?.consumption?.projectStorageBytes, settings.storageLimitGiB, 1024 ** 3), severity: "warning", message: "Der konfigurierte Projektspeicher-Grenzwert wurde erreicht." },
    { code: "compute", active: over(snapshot?.consumption?.computeCuSeconds, settings.computeLimitHours, 3600), severity: "warning", message: "Der konfigurierte Compute-Verbrauch wurde erreicht (CU-h im Neon-Verbrauchszeitraum)." },
    { code: "transfer", active: over(snapshot?.consumption?.transferBytes, settings.transferLimitGiB, 1024 ** 3), severity: "warning", message: "Der konfigurierte Daten\xFCbertragungs-Grenzwert wurde erreicht." },
    { code: "compute_disabled", active: snapshot?.endpoints == null ? null : snapshot.endpoints.some((endpoint) => endpoint.disabled), severity: "warning", message: "Ein zugeordneter Compute-Endpunkt ist deaktiviert." },
    { code: "sql_failure", active: !settings.sqlEnabled ? false : sql2 == null ? null : sql2.status !== "up", severity: "critical", message: "Der SQL-Funktionstest ist fehlgeschlagen oder nicht ausf\xFChrbar." },
    { code: "sql_latency", active: !settings.sqlEnabled ? false : sql2?.status !== "up" ? null : over(sql2.latencyMs, settings.sqlLatencyLimitMs), severity: "warning", message: "Die Laufzeit des SQL-Funktionstests \xFCberschreitet den eingestellten Grenzwert." }
  ];
  return conditions;
}
function schedulerInterval() {
  const value = Number(process.env.NEON_SCHEDULER_INTERVAL_MINUTES ?? 1440);
  return Number.isInteger(value) && value >= 5 && value <= 1440 ? value : 1440;
}
var threshold, neonSettingsSchema, defaultNeonSettings;
var init_neon_policy = __esm({
  "server/neon-policy.ts"() {
    threshold = z15.number().finite().positive().max(1e9).nullable();
    neonSettingsSchema = z15.object({
      enabled: z15.boolean(),
      intervalMinutes: z15.union([z15.literal(5), z15.literal(15), z15.literal(60)]),
      retentionDays: z15.union([z15.literal(7), z15.literal(30), z15.literal(90)]),
      storageLimitGiB: threshold,
      computeLimitHours: threshold,
      transferLimitGiB: threshold,
      failureThreshold: z15.number().int().min(1).max(10),
      sqlEnabled: z15.boolean(),
      sqlIntervalMinutes: z15.union([z15.literal(15), z15.literal(60), z15.literal(240)]),
      sqlLatencyLimitMs: threshold,
      monitorIds: z15.array(z15.uuid()).max(3)
    }).strict().refine((value) => !value.sqlEnabled || value.sqlIntervalMinutes >= value.intervalMinutes, "SQL-Intervall muss mindestens dem Neon-Pr\xFCfintervall entsprechen").refine((value) => new Set(value.monitorIds).size === value.monitorIds.length, "Doppelte Monitorzuordnung");
    defaultNeonSettings = {
      enabled: true,
      intervalMinutes: 15,
      retentionDays: 30,
      storageLimitGiB: null,
      computeLimitHours: null,
      transferLimitGiB: null,
      failureThreshold: 2,
      sqlEnabled: false,
      sqlIntervalMinutes: 60,
      sqlLatencyLimitMs: null,
      monitorIds: []
    };
  }
});

// server/neon-sql.ts
import { neon as neon2 } from "@neondatabase/serverless";
import { z as z16 } from "zod";
function targetUrl(link) {
  const targets = targetSchema.parse(JSON.parse(process.env.NEON_SQL_TARGETS || "[]"));
  const matches = targets.filter((target) => target.neonProjectId === link.neonProjectId && target.branchId === link.branchId);
  if (matches.length !== 1) throw new Error("SQL target missing or ambiguous");
  const raw = process.env[matches[0].env];
  if (!raw) throw new Error("SQL secret missing");
  const url2 = new URL(raw);
  if (!["postgres:", "postgresql:"].includes(url2.protocol) || !url2.hostname.endsWith(".neon.tech") || !url2.username || !url2.password || !["require", "verify-full"].includes(url2.searchParams.get("sslmode") ?? "")) throw new Error("SQL target invalid");
  return { raw, url: url2 };
}
function isNeonSqlConfigured(link) {
  try {
    targetUrl(link);
    return true;
  } catch {
    return false;
  }
}
async function checkNeonSql(link, snapshot) {
  const checkedAt = (/* @__PURE__ */ new Date()).toISOString();
  try {
    const { raw, url: url2 } = targetUrl(link);
    const hostname = url2.hostname.split(".")[0];
    if (!snapshot?.endpoints?.some((endpoint) => hostname === endpoint.id || hostname === `${endpoint.id}-pooler`)) throw new Error("Endpoint mismatch");
    const sql2 = neon2(raw, { fetchOptions: { signal: AbortSignal.timeout(8e3) } });
    const started = performance.now();
    const [rows] = await sql2.transaction([sql2`select 1 as omnidesk_probe`], { readOnly: true, isolationLevel: "ReadCommitted" });
    if (rows[0]?.omnidesk_probe !== 1) throw new Error("Probe result invalid");
    return { checkedAt, status: "up", latencyMs: Math.round(performance.now() - started), message: null };
  } catch {
    return {
      checkedAt,
      status: isNeonSqlConfigured(link) ? "down" : "unavailable",
      latencyMs: null,
      message: "SQL-Pr\xFCfung nicht erfolgreich. Serverseitige Zielzuordnung, Branch und Leseberechtigungen pr\xFCfen."
    };
  }
}
var targetSchema;
var init_neon_sql = __esm({
  "server/neon-sql.ts"() {
    targetSchema = z16.array(z16.object({ neonProjectId: z16.string(), branchId: z16.string(), env: z16.string().regex(/^NEON_SQL_[A-Z0-9_]+_URL$/) })).max(100);
  }
});

// server/neon-storage.ts
import { neon as neon3 } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
function monitoringSql() {
  if (!process.env.DATABASE_URL) throw new Error("Monitoring-Speicher: DATABASE_URL fehlt.");
  return neon3(process.env.DATABASE_URL, { fetchOptions: { signal: AbortSignal.timeout(15e3) } });
}
async function initializeNeonStorage() {
  const sql2 = monitoringSql();
  const [existing] = await sql2`SELECT to_regclass('v2_neon_config') IS NOT NULL AND to_regclass('v2_neon_samples') IS NOT NULL
    AND to_regclass('v2_neon_alerts') IS NOT NULL AND to_regclass('v2_neon_samples_unique') IS NOT NULL
    AND to_regclass('v2_neon_alerts_open') IS NOT NULL AS ready`;
  if (existing?.ready === true) return;
  await sql2.transaction([sql2`SELECT pg_advisory_xact_lock(184730019)`, ...neonDdl.map((statement) => sql2.query(statement))]);
}
function missingNeonStorage(error) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "42P01";
}
async function loadNeonConfig(link) {
  const sql2 = monitoringSql();
  const [config] = await sql2`SELECT * FROM v2_neon_config WHERE project_id=${link.projectId} AND user_id=${link.userId} AND resource_key=${resourceKey(link)}`;
  return config ?? null;
}
async function saveNeonSettings(link, settings) {
  const sql2 = monitoringSql();
  const [config] = await sql2`INSERT INTO v2_neon_config (project_id,user_id,resource_key,settings)
    VALUES (${link.projectId},${link.userId},${resourceKey(link)},${JSON.stringify(settings)}::jsonb)
    ON CONFLICT (project_id) DO UPDATE SET user_id=EXCLUDED.user_id, resource_key=EXCLUDED.resource_key,
      settings=EXCLUDED.settings, updated_at=now(), lease_token=NULL, lease_until=NULL,
      last_attempt_at=CASE WHEN v2_neon_config.resource_key=EXCLUDED.resource_key AND v2_neon_config.user_id=EXCLUDED.user_id THEN v2_neon_config.last_attempt_at END,
      last_success_at=CASE WHEN v2_neon_config.resource_key=EXCLUDED.resource_key AND v2_neon_config.user_id=EXCLUDED.user_id THEN v2_neon_config.last_success_at END,
      last_snapshot=CASE WHEN v2_neon_config.resource_key=EXCLUDED.resource_key AND v2_neon_config.user_id=EXCLUDED.user_id THEN v2_neon_config.last_snapshot END,
      last_sql=CASE WHEN v2_neon_config.resource_key=EXCLUDED.resource_key AND v2_neon_config.user_id=EXCLUDED.user_id THEN v2_neon_config.last_sql END,
      last_scheduler_at=CASE WHEN v2_neon_config.resource_key=EXCLUDED.resource_key AND v2_neon_config.user_id=EXCLUDED.user_id THEN v2_neon_config.last_scheduler_at END,
      failures=CASE WHEN v2_neon_config.resource_key=EXCLUDED.resource_key AND v2_neon_config.user_id=EXCLUDED.user_id THEN v2_neon_config.failures ELSE 0 END
    RETURNING *`;
  return config;
}
async function claimNeonCheck(link, source) {
  const sql2 = monitoringSql();
  const token = randomUUID();
  const [config] = await sql2`UPDATE v2_neon_config SET lease_token=${token}, lease_until=now()+interval '90 seconds'
    WHERE project_id=${link.projectId} AND user_id=${link.userId} AND resource_key=${resourceKey(link)}
      AND (lease_until IS NULL OR lease_until<now())
      AND (${source}='manual' OR (settings->>'enabled')::boolean)
      AND (last_attempt_at IS NULL OR last_attempt_at<now()-
        (CASE WHEN ${source}='manual' THEN 60 ELSE (settings->>'intervalMinutes')::int*60 END)*interval '1 second')
    RETURNING *`;
  return config ? { config, token } : null;
}
async function completeNeonCheck(link, token, snapshot, sqlCheck, conditions, source, checkedAt) {
  const sql2 = monitoringSql();
  const complete = Boolean(snapshot && !snapshot.unavailable.length);
  const key = resourceKey(link);
  const guard = sql2`SELECT 1 FROM v2_neon_config WHERE project_id=${link.projectId} AND user_id=${link.userId} AND resource_key=${key} AND lease_token=${token}`;
  const statements = [
    // Lock the lease row for the full transaction so settings changes cannot race a completed sample.
    sql2`SELECT project_id FROM v2_neon_config WHERE project_id=${link.projectId} AND user_id=${link.userId} AND lease_token=${token} FOR UPDATE`,
    sql2`INSERT INTO v2_neon_samples (project_id,user_id,resource_key,checked_at,bucket,source,snapshot,sql_check,complete)
      SELECT ${link.projectId},${link.userId},${key},${checkedAt}::timestamptz,date_trunc('minute',${checkedAt}::timestamptz),${source},
      ${snapshot ? JSON.stringify(snapshot) : null}::jsonb,${sqlCheck ? JSON.stringify(sqlCheck) : null}::jsonb,${complete}
      WHERE EXISTS (${guard}) ON CONFLICT (project_id,user_id,resource_key,bucket) DO NOTHING`,
    ...conditions.filter((condition) => condition.active !== null).map((condition) => condition.active ? sql2`INSERT INTO v2_neon_alerts (project_id,user_id,resource_key,code,message,severity)
          SELECT ${link.projectId},${link.userId},${key},${condition.code},${condition.message},${condition.severity} WHERE EXISTS (${guard})
          ON CONFLICT (project_id,user_id,resource_key,code) WHERE resolved_at IS NULL DO NOTHING` : sql2`UPDATE v2_neon_alerts SET resolved_at=now() WHERE project_id=${link.projectId} AND user_id=${link.userId} AND resource_key=${key}
          AND code=${condition.code} AND resolved_at IS NULL AND EXISTS (${guard})`),
    sql2`DELETE FROM v2_neon_samples WHERE project_id=${link.projectId} AND user_id=${link.userId}
      AND checked_at<now()-(SELECT (settings->>'retentionDays')::int FROM v2_neon_config WHERE project_id=${link.projectId})*interval '1 day' AND EXISTS (${guard})`,
    sql2`DELETE FROM v2_neon_alerts WHERE project_id=${link.projectId} AND user_id=${link.userId} AND resolved_at IS NOT NULL
      AND resolved_at<now()-(SELECT (settings->>'retentionDays')::int FROM v2_neon_config WHERE project_id=${link.projectId})*interval '1 day' AND EXISTS (${guard})`,
    sql2`UPDATE v2_neon_config SET last_attempt_at=${checkedAt}::timestamptz,
      last_success_at=CASE WHEN ${complete} THEN ${checkedAt}::timestamptz ELSE last_success_at END,
      last_scheduler_at=CASE WHEN ${source}='scheduler' THEN now() ELSE last_scheduler_at END,
      last_snapshot=COALESCE(${snapshot ? JSON.stringify(snapshot) : null}::jsonb,last_snapshot),
      last_sql=COALESCE(${sqlCheck ? JSON.stringify(sqlCheck) : null}::jsonb,last_sql), failures=CASE WHEN ${complete} THEN 0 ELSE failures+1 END,
      lease_token=NULL, lease_until=NULL WHERE project_id=${link.projectId} AND user_id=${link.userId} AND resource_key=${key} AND lease_token=${token}`
  ];
  await sql2.transaction(statements);
}
async function monitoringMonitors(link, settings) {
  const sql2 = monitoringSql();
  const rows = await sql2`SELECT m.id,m.name,m.active,c.status,c.response_time_ms,c.checked_at FROM uptime_monitors m
    LEFT JOIN LATERAL (SELECT status,response_time_ms,checked_at FROM uptime_checks WHERE monitor_id=m.id ORDER BY checked_at DESC LIMIT 1) c ON true
    WHERE m.user_id=${link.userId} ORDER BY m.name LIMIT 500`;
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    active: Boolean(row.active),
    linked: settings.monitorIds.includes(String(row.id)),
    status: row.status,
    responseTimeMs: row.response_time_ms,
    checkedAt: row.checked_at
  }));
}
async function readNeonMonitoring(link, days) {
  const sql2 = monitoringSql();
  let config = null;
  let setupRequired = false;
  try {
    config = await loadNeonConfig(link);
  } catch (error) {
    if (!missingNeonStorage(error)) throw error;
    setupRequired = true;
  }
  const settings = config?.settings ?? defaultNeonSettings;
  const monitors = await monitoringMonitors(link, settings);
  const base = {
    setupRequired: setupRequired || !config,
    settings,
    lastAttemptAt: config?.last_attempt_at ?? null,
    lastSuccessAt: config?.last_success_at ?? null,
    lastSchedulerAt: config?.last_scheduler_at ?? null,
    snapshot: config?.last_snapshot ?? null,
    lastSql: config?.last_sql ?? null,
    schedulerIntervalMinutes: schedulerInterval(),
    sqlConfigured: isNeonSqlConfigured(link),
    monitors,
    historyDays: days
  };
  if (!config) return { ...base, history: [], alerts: [] };
  const key = resourceKey(link);
  const bucketSeconds = days === 1 ? 300 : days === 7 ? 3600 : days === 30 ? 21600 : 86400;
  const [history, alerts] = await Promise.all([
    sql2`SELECT to_timestamp(floor(extract(epoch FROM checked_at)/${bucketSeconds})*${bucketSeconds}) AS at, snapshot->'consumption'->>'periodStart' AS "periodStart",
      avg((snapshot->'consumption'->>'projectStorageBytes')::double precision)/1073741824 AS "storageGiB",
      avg((snapshot->'branch'->>'logicalSizeBytes')::double precision)/1073741824 AS "branchGiB",
      max((snapshot->'consumption'->>'computeCuSeconds')::double precision)/3600 AS "computeHours",
      max((snapshot->'consumption'->>'transferBytes')::double precision)/1073741824 AS "transferGiB",
      avg((sql_check->>'latencyMs')::double precision) AS "sqlLatencyMs", count(*)::int AS samples,
      count(*) FILTER (WHERE NOT complete)::int AS failures
      FROM v2_neon_samples WHERE project_id=${link.projectId} AND user_id=${link.userId} AND resource_key=${key}
      AND checked_at>=now()-${days}*interval '1 day' GROUP BY 1,2 ORDER BY 1 LIMIT 800`,
    sql2`SELECT id,code,message,severity,started_at AS "startedAt",resolved_at AS "resolvedAt",acknowledged_at AS "acknowledgedAt"
      FROM v2_neon_alerts WHERE project_id=${link.projectId} AND user_id=${link.userId} AND resource_key=${key}
      ORDER BY (resolved_at IS NULL) DESC,started_at DESC LIMIT 100`
  ]);
  return { ...base, history, alerts };
}
async function acknowledgeNeonAlert(link, id) {
  const sql2 = monitoringSql();
  const rows = await sql2`UPDATE v2_neon_alerts SET acknowledged_at=COALESCE(acknowledged_at,now())
    WHERE id=${id} AND project_id=${link.projectId} AND user_id=${link.userId} AND resource_key=${resourceKey(link)} RETURNING id`;
  return rows.length > 0;
}
var resourceKey, neonDdl;
var init_neon_storage = __esm({
  "server/neon-storage.ts"() {
    init_neon_policy();
    init_neon_sql();
    resourceKey = (link) => `${link.neonProjectId}:${link.branchId}`;
    neonDdl = [
      `CREATE TABLE IF NOT EXISTS v2_neon_config (
    project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    user_id text NOT NULL, resource_key text NOT NULL, settings jsonb NOT NULL,
    last_attempt_at timestamptz, last_success_at timestamptz, last_scheduler_at timestamptz,
    last_snapshot jsonb, last_sql jsonb, failures integer NOT NULL DEFAULT 0,
    lease_token uuid, lease_until timestamptz, updated_at timestamptz NOT NULL DEFAULT now())`,
      `CREATE TABLE IF NOT EXISTS v2_neon_samples (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id text NOT NULL, resource_key text NOT NULL, checked_at timestamptz NOT NULL, bucket timestamptz NOT NULL,
    source text NOT NULL CHECK (source IN ('manual','scheduler')), snapshot jsonb, sql_check jsonb,
    complete boolean NOT NULL)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS v2_neon_samples_unique ON v2_neon_samples(project_id, user_id, resource_key, bucket)`,
      `CREATE INDEX IF NOT EXISTS v2_neon_samples_lookup ON v2_neon_samples(project_id, user_id, resource_key, checked_at)`,
      `CREATE TABLE IF NOT EXISTS v2_neon_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id text NOT NULL, resource_key text NOT NULL, code text NOT NULL, message text NOT NULL,
    severity text NOT NULL, started_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz, acknowledged_at timestamptz)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS v2_neon_alerts_open ON v2_neon_alerts(project_id, user_id, resource_key, code) WHERE resolved_at IS NULL`
    ];
  }
});

// server/neon-runner.ts
var neon_runner_exports = {};
__export(neon_runner_exports, {
  createNeonRunner: () => createNeonRunner,
  runNeonCheck: () => runNeonCheck,
  runNeonScheduler: () => runNeonScheduler
});
import { and as and17, eq as eq19, inArray } from "drizzle-orm";
async function ownsProject(link) {
  const [project2] = await db.select({ id: projects.id }).from(projects).where(and17(eq19(projects.id, link.projectId), eq19(projects.userId, link.userId)));
  return Boolean(project2);
}
async function refreshLinkedMonitors(link, ids) {
  if (!ids.length) return { unavailable: false, down: false };
  const monitors = await db.select().from(uptimeMonitors).where(and17(eq19(uptimeMonitors.userId, link.userId), inArray(uptimeMonitors.id, ids)));
  const results = await Promise.allSettled(monitors.filter((monitor) => monitor.active).map((monitor) => checkSingleMonitor({ ...monitor, timeoutMs: Math.min(monitor.timeoutMs, 8e3) })));
  const unavailable = monitors.length !== ids.length || results.some((result) => result.status === "rejected");
  return { unavailable, down: results.some((result) => result.status === "fulfilled" && result.value.status === "down") ? true : unavailable || monitors.some((monitor) => !monitor.active) ? null : false };
}
function createNeonRunner(dependencies = { ownsProject, claimNeonCheck, fetchNeonSnapshot, checkNeonSql, completeNeonCheck, refreshLinkedMonitors }) {
  return async (link, source) => {
    if (!await dependencies.ownsProject(link)) return { outcome: "not_owned" };
    const claim = await dependencies.claimNeonCheck(link, source);
    if (!claim) return { outcome: "not_due_or_running" };
    const { config, token } = claim;
    const checkedAt = (/* @__PURE__ */ new Date()).toISOString();
    let snapshot = null;
    try {
      snapshot = await dependencies.fetchNeonSnapshot(link);
    } catch {
    }
    const sqlDue = config.settings.sqlEnabled && (!config.last_sql || Date.now() - Date.parse(config.last_sql.checkedAt) >= config.settings.sqlIntervalMinutes * 6e4);
    const [sqlCheck, monitorResult] = await Promise.all([
      sqlDue ? dependencies.checkNeonSql(link, snapshot) : Promise.resolve(null),
      dependencies.refreshLinkedMonitors(link, config.settings.monitorIds).catch(() => ({ unavailable: true, down: false }))
    ]);
    const complete = Boolean(snapshot && !snapshot.unavailable.length);
    const failures = complete ? 0 : config.failures + 1;
    const conditions = evaluateNeonAlerts(config.settings, snapshot, failures, sqlCheck ?? config.last_sql);
    if (monitorResult.unavailable) conditions.push({ code: "monitor_check", active: true, severity: "warning", message: "Mindestens eine verkn\xFCpfte Monitorpr\xFCfung konnte nicht gespeichert werden." });
    else conditions.push({ code: "monitor_check", active: false, severity: "warning", message: "" });
    conditions.push({ code: "monitor_down", active: monitorResult.down ? true : monitorResult.unavailable || monitorResult.down === null ? null : false, severity: "critical", message: "Ein verkn\xFCpfter Website-/API-/TCP-Monitor meldet eine St\xF6rung." });
    await dependencies.completeNeonCheck(link, token, snapshot, sqlCheck, conditions, source, checkedAt);
    return { outcome: complete ? "recorded" : "recorded_with_errors" };
  };
}
async function runNeonScheduler(projectId) {
  const sql2 = monitoringSql();
  const links2 = readNeonLinks();
  const permitted = JSON.stringify(links2);
  let rows;
  try {
    await sql2`UPDATE v2_neon_config c SET last_scheduler_at=now() FROM projects p
      WHERE p.id=c.project_id AND p.user_id=c.user_id AND (c.settings->>'enabled')::boolean
      AND (${projectId ?? null}::uuid IS NULL OR c.project_id=${projectId ?? null}::uuid)
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(${permitted}::jsonb) l WHERE l->>'projectId'=c.project_id::text AND l->>'userId'=c.user_id
        AND (l->>'neonProjectId')||':'||(l->>'branchId')=c.resource_key)`;
    rows = await sql2`SELECT c.project_id,c.user_id,c.resource_key FROM v2_neon_config c
      JOIN projects p ON p.id=c.project_id AND p.user_id=c.user_id
      WHERE (c.settings->>'enabled')::boolean AND (${projectId ?? null}::uuid IS NULL OR c.project_id=${projectId ?? null}::uuid)
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(${permitted}::jsonb) l WHERE l->>'projectId'=c.project_id::text AND l->>'userId'=c.user_id
        AND (l->>'neonProjectId')||':'||(l->>'branchId')=c.resource_key)
      AND (c.lease_until IS NULL OR c.lease_until<now())
      AND (c.last_attempt_at IS NULL OR c.last_attempt_at<now()-(c.settings->>'intervalMinutes')::int*interval '1 minute')
      ORDER BY c.last_attempt_at ASC NULLS FIRST LIMIT 4`;
  } catch (error) {
    if (missingNeonStorage(error)) return { setupRequired: true, processed: 0, pending: false, failures: 0 };
    throw error;
  }
  const eligible = rows.slice(0, 3).flatMap((row) => {
    const link = links2.find((candidate) => candidate.userId === row.user_id && candidate.projectId === row.project_id && `${candidate.neonProjectId}:${candidate.branchId}` === row.resource_key);
    return link ? [link] : [];
  });
  const results = await Promise.allSettled(eligible.map((link) => runNeonCheck(link, "scheduler")));
  await sql2.transaction([
    sql2`DELETE FROM v2_neon_samples s USING v2_neon_config c WHERE s.project_id=c.project_id AND s.checked_at<now()-(c.settings->>'retentionDays')::int*interval '1 day'`,
    sql2`DELETE FROM v2_neon_alerts a USING v2_neon_config c WHERE a.project_id=c.project_id AND a.resolved_at IS NOT NULL AND a.resolved_at<now()-(c.settings->>'retentionDays')::int*interval '1 day'`
  ]);
  return {
    setupRequired: false,
    processed: eligible.length,
    pending: rows.length > 3,
    failures: results.filter((result) => result.status === "rejected" || result.value.outcome === "recorded_with_errors").length
  };
}
var runNeonCheck;
var init_neon_runner = __esm({
  "server/neon-runner.ts"() {
    init_client();
    init_schema();
    init_neon_monitor();
    init_uptime_check();
    init_neon_policy();
    init_neon_sql();
    init_neon_storage();
    runNeonCheck = createNeonRunner();
  }
});

// server/vercel-entry.ts
import { handle } from "hono/vercel";

// server/app.ts
import { Hono as Hono21 } from "hono";
import { z as z22 } from "zod";

// server/auth.ts
import { createRemoteJWKSet, jwtVerify } from "jose";
var cachedIssuer = null;
var cachedJwks = null;
function getClerkConfig() {
  if (cachedIssuer && cachedJwks) return { issuer: cachedIssuer, jwks: cachedJwks };
  const publishableKey = process.env.VITE_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) {
    throw new Error("ENV_FEHLT: VITE_CLERK_PUBLISHABLE_KEY ist auf Vercel nicht gesetzt");
  }
  const domain = Buffer.from(
    publishableKey.replace(/^pk_(test|live)_/, ""),
    "base64"
  ).toString("utf-8").replace(/\$$/, "");
  const issuer = `https://${domain}`;
  cachedIssuer = issuer;
  cachedJwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  return { issuer, jwks: cachedJwks };
}
async function requireAuth(c, next) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Nicht authentifiziert" }, 401);
  }
  try {
    const { issuer, jwks } = getClerkConfig();
    const { payload } = await jwtVerify(header.slice("Bearer ".length), jwks, {
      issuer
    });
    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      return c.json({ error: "Ung\xFCltiges Token" }, 401);
    }
    c.set("userId", payload.sub);
    return await next();
  } catch {
    return c.json({ error: "Ung\xFCltiges oder abgelaufenes Token" }, 401);
  }
}

// server/routes/links.ts
init_client();
init_schema();
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
var linkInput = z.object({
  title: z.string().trim().min(1, "Titel fehlt").max(200),
  url: z.url("Ung\xFCltige URL").max(2048),
  category: z.string().trim().max(100).nullish(),
  icon: z.string().trim().max(2048).nullish()
});
var linksRoute = new Hono();
linksRoute.get("/", async (c) => {
  const rows = await db.select().from(links).where(eq(links.userId, c.get("userId"))).orderBy(desc(links.createdAt));
  return c.json(rows);
});
linksRoute.post("/", async (c) => {
  const parsed = linkInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z.prettifyError(parsed.error) }, 400);
  }
  const [row] = await db.insert(links).values({ ...parsed.data, userId: c.get("userId") }).returning();
  return c.json(row, 201);
});
linksRoute.put("/:id", async (c) => {
  const parsed = linkInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z.prettifyError(parsed.error) }, 400);
  }
  const [row] = await db.update(links).set({ ...parsed.data, updatedAt: /* @__PURE__ */ new Date() }).where(and(eq(links.id, c.req.param("id")), eq(links.userId, c.get("userId")))).returning();
  if (!row) return c.json({ error: "Link nicht gefunden" }, 404);
  return c.json(row);
});
linksRoute.delete("/:id", async (c) => {
  const [row] = await db.delete(links).where(and(eq(links.id, c.req.param("id")), eq(links.userId, c.get("userId")))).returning({ id: links.id });
  if (!row) return c.json({ error: "Link nicht gefunden" }, 404);
  return c.json({ ok: true });
});

// server/routes/notes.ts
init_client();
init_schema();
import { and as and2, desc as desc2, eq as eq2 } from "drizzle-orm";
import { Hono as Hono2 } from "hono";
import { z as z2 } from "zod";
var noteInput = z2.object({
  title: z2.string().trim().min(1, "Titel fehlt").max(300),
  content: z2.string().max(1e5)
});
var notesRoute = new Hono2();
notesRoute.get("/", async (c) => {
  const rows = await db.select().from(notes).where(eq2(notes.userId, c.get("userId"))).orderBy(desc2(notes.updatedAt));
  return c.json(rows);
});
notesRoute.post("/", async (c) => {
  const [row] = await db.insert(notes).values({ userId: c.get("userId") }).returning();
  return c.json(row, 201);
});
notesRoute.put("/:id", async (c) => {
  const parsed = noteInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z2.prettifyError(parsed.error) }, 400);
  }
  const [row] = await db.update(notes).set({ ...parsed.data, updatedAt: /* @__PURE__ */ new Date() }).where(and2(eq2(notes.id, c.req.param("id")), eq2(notes.userId, c.get("userId")))).returning();
  if (!row) return c.json({ error: "Notiz nicht gefunden" }, 404);
  return c.json(row);
});
notesRoute.delete("/:id", async (c) => {
  const [row] = await db.delete(notes).where(and2(eq2(notes.id, c.req.param("id")), eq2(notes.userId, c.get("userId")))).returning({ id: notes.id });
  if (!row) return c.json({ error: "Notiz nicht gefunden" }, 404);
  return c.json({ ok: true });
});

// server/routes/tasks.ts
init_client();
init_schema();
import { and as and3, desc as desc3, eq as eq3 } from "drizzle-orm";
import { Hono as Hono3 } from "hono";
import { z as z3 } from "zod";
var subtaskInput = z3.object({
  id: z3.string().trim().min(1),
  title: z3.string().trim().min(1, "Unteraufgabe darf nicht leer sein").max(300),
  done: z3.boolean()
});
var taskInput = z3.object({
  title: z3.string().trim().min(1, "Titel fehlt").max(300),
  description: z3.string().max(1e4),
  priority: z3.enum(TASK_PRIORITIES),
  status: z3.enum(TASK_STATUSES),
  /** ISO-Datum oder null (keine Fälligkeit) */
  dueDate: z3.iso.datetime({ offset: true }).nullable(),
  tags: z3.array(z3.string().trim().max(50)).optional(),
  subtasks: z3.array(subtaskInput).optional()
});
var tasksRoute = new Hono3();
tasksRoute.get("/", async (c) => {
  const rows = await db.select().from(tasks).where(eq3(tasks.userId, c.get("userId"))).orderBy(desc3(tasks.createdAt));
  return c.json(rows);
});
tasksRoute.post("/", async (c) => {
  const parsed = taskInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z3.prettifyError(parsed.error) }, 400);
  }
  const { dueDate, ...rest } = parsed.data;
  const [row] = await db.insert(tasks).values({
    ...rest,
    dueDate: dueDate ? new Date(dueDate) : null,
    userId: c.get("userId")
  }).returning();
  return c.json(row, 201);
});
tasksRoute.put("/:id", async (c) => {
  const parsed = taskInput.partial().safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z3.prettifyError(parsed.error) }, 400);
  }
  const { dueDate, ...rest } = parsed.data;
  const [row] = await db.update(tasks).set({
    ...rest,
    ...dueDate !== void 0 ? { dueDate: dueDate ? new Date(dueDate) : null } : {},
    updatedAt: /* @__PURE__ */ new Date()
  }).where(and3(eq3(tasks.id, c.req.param("id")), eq3(tasks.userId, c.get("userId")))).returning();
  if (!row) return c.json({ error: "Aufgabe nicht gefunden" }, 404);
  return c.json(row);
});
tasksRoute.delete("/:id", async (c) => {
  const [row] = await db.delete(tasks).where(and3(eq3(tasks.id, c.req.param("id")), eq3(tasks.userId, c.get("userId")))).returning({ id: tasks.id });
  if (!row) return c.json({ error: "Aufgabe nicht gefunden" }, 404);
  return c.json({ ok: true });
});

// server/routes/contacts.ts
init_client();
init_schema();
import { and as and4, asc, eq as eq4 } from "drizzle-orm";
import { Hono as Hono4 } from "hono";
import { z as z4 } from "zod";
var contactInput = z4.object({
  firstName: z4.string().trim().min(1, "Vorname fehlt").max(100),
  lastName: z4.string().trim().max(100).default(""),
  email: z4.email("Ung\xFCltige E-Mail").or(z4.literal("")).default(""),
  phone: z4.string().trim().max(50).default(""),
  company: z4.string().trim().max(200).default(""),
  notes: z4.string().max(1e4).default("")
});
var contactsRoute = new Hono4();
contactsRoute.get("/", async (c) => {
  const rows = await db.select().from(contacts).where(eq4(contacts.userId, c.get("userId"))).orderBy(asc(contacts.firstName), asc(contacts.lastName));
  return c.json(rows);
});
contactsRoute.post("/", async (c) => {
  const parsed = contactInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z4.prettifyError(parsed.error) }, 400);
  }
  const [row] = await db.insert(contacts).values({ ...parsed.data, userId: c.get("userId") }).returning();
  return c.json(row, 201);
});
contactsRoute.put("/:id", async (c) => {
  const parsed = contactInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z4.prettifyError(parsed.error) }, 400);
  }
  const [row] = await db.update(contacts).set({ ...parsed.data, updatedAt: /* @__PURE__ */ new Date() }).where(
    and4(eq4(contacts.id, c.req.param("id")), eq4(contacts.userId, c.get("userId")))
  ).returning();
  if (!row) return c.json({ error: "Kontakt nicht gefunden" }, 404);
  return c.json(row);
});
contactsRoute.delete("/:id", async (c) => {
  const [row] = await db.delete(contacts).where(
    and4(eq4(contacts.id, c.req.param("id")), eq4(contacts.userId, c.get("userId")))
  ).returning({ id: contacts.id });
  if (!row) return c.json({ error: "Kontakt nicht gefunden" }, 404);
  return c.json({ ok: true });
});

// server/routes/appointments.ts
init_client();
init_schema();
import { and as and5, asc as asc2, eq as eq5 } from "drizzle-orm";
import { Hono as Hono5 } from "hono";
import { z as z5 } from "zod";
var appointmentInput = z5.object({
  title: z5.string().trim().min(1, "Titel fehlt").max(300),
  description: z5.string().max(1e4).default(""),
  location: z5.string().trim().max(300).default(""),
  priority: z5.enum(TASK_PRIORITIES).default("medium"),
  startsAt: z5.iso.datetime({ offset: true }),
  endsAt: z5.iso.datetime({ offset: true })
}).refine((v) => new Date(v.endsAt) > new Date(v.startsAt), {
  message: "Ende muss nach dem Beginn liegen",
  path: ["endsAt"]
});
var appointmentsRoute = new Hono5();
appointmentsRoute.get("/", async (c) => {
  const rows = await db.select().from(appointments).where(eq5(appointments.userId, c.get("userId"))).orderBy(asc2(appointments.startsAt));
  return c.json(rows);
});
appointmentsRoute.post("/", async (c) => {
  const parsed = appointmentInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z5.prettifyError(parsed.error) }, 400);
  }
  const { startsAt, endsAt, ...rest } = parsed.data;
  const [row] = await db.insert(appointments).values({
    ...rest,
    startsAt: new Date(startsAt),
    endsAt: new Date(endsAt),
    userId: c.get("userId")
  }).returning();
  return c.json(row, 201);
});
appointmentsRoute.put("/:id", async (c) => {
  const parsed = appointmentInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z5.prettifyError(parsed.error) }, 400);
  }
  const { startsAt, endsAt, ...rest } = parsed.data;
  const [row] = await db.update(appointments).set({
    ...rest,
    startsAt: new Date(startsAt),
    endsAt: new Date(endsAt),
    updatedAt: /* @__PURE__ */ new Date()
  }).where(
    and5(
      eq5(appointments.id, c.req.param("id")),
      eq5(appointments.userId, c.get("userId"))
    )
  ).returning();
  if (!row) return c.json({ error: "Termin nicht gefunden" }, 404);
  return c.json(row);
});
appointmentsRoute.delete("/:id", async (c) => {
  const [row] = await db.delete(appointments).where(
    and5(
      eq5(appointments.id, c.req.param("id")),
      eq5(appointments.userId, c.get("userId"))
    )
  ).returning({ id: appointments.id });
  if (!row) return c.json({ error: "Termin nicht gefunden" }, 404);
  return c.json({ ok: true });
});

// server/routes/commands.ts
init_client();
init_schema();
import { and as and6, asc as asc3, eq as eq6 } from "drizzle-orm";
import { Hono as Hono6 } from "hono";
import { z as z6 } from "zod";
var commandInput = z6.object({
  title: z6.string().trim().min(1, "Beschreibung fehlt").max(300),
  command: z6.string().trim().min(1, "Befehl fehlt").max(5e3),
  category: z6.string().trim().min(1).max(100)
});
var commandsRoute = new Hono6();
commandsRoute.get("/", async (c) => {
  const rows = await db.select().from(commands).where(eq6(commands.userId, c.get("userId"))).orderBy(asc3(commands.category), asc3(commands.title));
  return c.json(rows);
});
commandsRoute.post("/", async (c) => {
  const parsed = commandInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z6.prettifyError(parsed.error) }, 400);
  }
  const [row] = await db.insert(commands).values({ ...parsed.data, userId: c.get("userId") }).returning();
  return c.json(row, 201);
});
commandsRoute.post("/bulk", async (c) => {
  const parsed = z6.array(commandInput).max(200).safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z6.prettifyError(parsed.error) }, 400);
  }
  if (parsed.data.length === 0) return c.json([]);
  const rows = await db.insert(commands).values(parsed.data.map((d) => ({ ...d, userId: c.get("userId") }))).returning();
  return c.json(rows, 201);
});
commandsRoute.put("/:id", async (c) => {
  const parsed = commandInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z6.prettifyError(parsed.error) }, 400);
  }
  const [row] = await db.update(commands).set({ ...parsed.data, updatedAt: /* @__PURE__ */ new Date() }).where(
    and6(eq6(commands.id, c.req.param("id")), eq6(commands.userId, c.get("userId")))
  ).returning();
  if (!row) return c.json({ error: "Befehl nicht gefunden" }, 404);
  return c.json(row);
});
commandsRoute.delete("/:id", async (c) => {
  const [row] = await db.delete(commands).where(
    and6(eq6(commands.id, c.req.param("id")), eq6(commands.userId, c.get("userId")))
  ).returning({ id: commands.id });
  if (!row) return c.json({ error: "Befehl nicht gefunden" }, 404);
  return c.json({ ok: true });
});

// server/routes/projects.ts
init_client();
init_schema();
import { and as and7, asc as asc4, desc as desc4, eq as eq7 } from "drizzle-orm";
import { Hono as Hono7 } from "hono";
import { z as z7 } from "zod";
var projectInput = z7.object({
  name: z7.string().trim().min(1, "Name fehlt").max(300),
  description: z7.string().max(1e4),
  priority: z7.enum(TASK_PRIORITIES),
  status: z7.enum(PROJECT_STATUSES),
  tags: z7.array(z7.string().trim().max(50)).optional()
});
var projectTaskInput = z7.object({
  title: z7.string().trim().min(1, "Titel fehlt").max(300),
  status: z7.enum(PROJECT_TASK_STATUSES),
  priority: z7.enum(TASK_PRIORITIES)
});
var milestoneInput = z7.object({
  title: z7.string().trim().min(1, "Titel fehlt").max(300),
  dueDate: z7.iso.datetime({ offset: true }).nullable(),
  done: z7.boolean()
});
var projectsRoute = new Hono7();
projectsRoute.get("/", async (c) => {
  const rows = await db.select().from(projects).where(eq7(projects.userId, c.get("userId"))).orderBy(desc4(projects.createdAt));
  return c.json(rows);
});
projectsRoute.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const [project2] = await db.select().from(projects).where(and7(eq7(projects.id, id), eq7(projects.userId, userId)));
  if (!project2) return c.json({ error: "Projekt nicht gefunden" }, 404);
  const [tasks2, projectMilestones] = await Promise.all([
    db.select().from(projectTasks).where(and7(eq7(projectTasks.projectId, id), eq7(projectTasks.userId, userId))).orderBy(asc4(projectTasks.createdAt)),
    db.select().from(milestones).where(and7(eq7(milestones.projectId, id), eq7(milestones.userId, userId))).orderBy(asc4(milestones.dueDate))
  ]);
  return c.json({ project: project2, tasks: tasks2, milestones: projectMilestones });
});
projectsRoute.post("/", async (c) => {
  const parsed = projectInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z7.prettifyError(parsed.error) }, 400);
  }
  const [row] = await db.insert(projects).values({ ...parsed.data, userId: c.get("userId") }).returning();
  return c.json(row, 201);
});
projectsRoute.put("/:id", async (c) => {
  const parsed = projectInput.partial().safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z7.prettifyError(parsed.error) }, 400);
  }
  const [row] = await db.update(projects).set({ ...parsed.data, updatedAt: /* @__PURE__ */ new Date() }).where(
    and7(eq7(projects.id, c.req.param("id")), eq7(projects.userId, c.get("userId")))
  ).returning();
  if (!row) return c.json({ error: "Projekt nicht gefunden" }, 404);
  return c.json(row);
});
projectsRoute.delete("/:id", async (c) => {
  const [row] = await db.delete(projects).where(
    and7(eq7(projects.id, c.req.param("id")), eq7(projects.userId, c.get("userId")))
  ).returning({ id: projects.id });
  if (!row) return c.json({ error: "Projekt nicht gefunden" }, 404);
  return c.json({ ok: true });
});
projectsRoute.post("/:id/tasks", async (c) => {
  const parsed = projectTaskInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z7.prettifyError(parsed.error) }, 400);
  }
  const userId = c.get("userId");
  const projectId = c.req.param("id");
  const [project2] = await db.select({ id: projects.id }).from(projects).where(and7(eq7(projects.id, projectId), eq7(projects.userId, userId)));
  if (!project2) return c.json({ error: "Projekt nicht gefunden" }, 404);
  const [row] = await db.insert(projectTasks).values({ ...parsed.data, projectId, userId }).returning();
  return c.json(row, 201);
});
projectsRoute.put("/tasks/:taskId", async (c) => {
  const parsed = projectTaskInput.partial().safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z7.prettifyError(parsed.error) }, 400);
  }
  const [row] = await db.update(projectTasks).set({ ...parsed.data, updatedAt: /* @__PURE__ */ new Date() }).where(
    and7(
      eq7(projectTasks.id, c.req.param("taskId")),
      eq7(projectTasks.userId, c.get("userId"))
    )
  ).returning();
  if (!row) return c.json({ error: "Aufgabe nicht gefunden" }, 404);
  return c.json(row);
});
projectsRoute.delete("/tasks/:taskId", async (c) => {
  const [row] = await db.delete(projectTasks).where(
    and7(
      eq7(projectTasks.id, c.req.param("taskId")),
      eq7(projectTasks.userId, c.get("userId"))
    )
  ).returning({ id: projectTasks.id });
  if (!row) return c.json({ error: "Aufgabe nicht gefunden" }, 404);
  return c.json({ ok: true });
});
projectsRoute.post("/:id/milestones", async (c) => {
  const parsed = milestoneInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z7.prettifyError(parsed.error) }, 400);
  }
  const userId = c.get("userId");
  const projectId = c.req.param("id");
  const [project2] = await db.select({ id: projects.id }).from(projects).where(and7(eq7(projects.id, projectId), eq7(projects.userId, userId)));
  if (!project2) return c.json({ error: "Projekt nicht gefunden" }, 404);
  const { dueDate, ...rest } = parsed.data;
  const [row] = await db.insert(milestones).values({
    ...rest,
    dueDate: dueDate ? new Date(dueDate) : null,
    projectId,
    userId
  }).returning();
  return c.json(row, 201);
});
projectsRoute.put("/milestones/:milestoneId", async (c) => {
  const parsed = milestoneInput.partial().safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z7.prettifyError(parsed.error) }, 400);
  }
  const { dueDate, ...rest } = parsed.data;
  const [row] = await db.update(milestones).set({
    ...rest,
    ...dueDate !== void 0 ? { dueDate: dueDate ? new Date(dueDate) : null } : {}
  }).where(
    and7(
      eq7(milestones.id, c.req.param("milestoneId")),
      eq7(milestones.userId, c.get("userId"))
    )
  ).returning();
  if (!row) return c.json({ error: "Meilenstein nicht gefunden" }, 404);
  return c.json(row);
});
projectsRoute.delete("/milestones/:milestoneId", async (c) => {
  const [row] = await db.delete(milestones).where(
    and7(
      eq7(milestones.id, c.req.param("milestoneId")),
      eq7(milestones.userId, c.get("userId"))
    )
  ).returning({ id: milestones.id });
  if (!row) return c.json({ error: "Meilenstein nicht gefunden" }, 404);
  return c.json({ ok: true });
});

// server/routes/vault.ts
init_client();
init_schema();
import { and as and8, desc as desc5, eq as eq8 } from "drizzle-orm";
import { Hono as Hono8 } from "hono";
import { z as z8 } from "zod";
var base64 = z8.string().min(1).max(1e5).regex(/^[A-Za-z0-9+/=]+$/, "Kein g\xFCltiges Base64");
var metaInput = z8.object({
  salt: base64,
  verifier: base64
});
var entryInput = z8.object({
  category: z8.enum(VAULT_CATEGORIES),
  ciphertext: base64,
  iv: base64
});
var vaultRoute = new Hono8();
vaultRoute.get("/meta", async (c) => {
  const [row] = await db.select().from(vaults).where(eq8(vaults.userId, c.get("userId")));
  return c.json(row ?? null);
});
vaultRoute.post("/meta", async (c) => {
  const parsed = metaInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z8.prettifyError(parsed.error) }, 400);
  }
  const userId = c.get("userId");
  const [existing] = await db.select({ userId: vaults.userId }).from(vaults).where(eq8(vaults.userId, userId));
  if (existing) {
    return c.json({ error: "Vault existiert bereits" }, 409);
  }
  const [row] = await db.insert(vaults).values({ ...parsed.data, userId }).returning();
  return c.json(row, 201);
});
vaultRoute.get("/entries", async (c) => {
  const rows = await db.select().from(vaultEntries).where(eq8(vaultEntries.userId, c.get("userId"))).orderBy(desc5(vaultEntries.updatedAt));
  return c.json(rows);
});
vaultRoute.post("/entries", async (c) => {
  const parsed = entryInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z8.prettifyError(parsed.error) }, 400);
  }
  const [row] = await db.insert(vaultEntries).values({ ...parsed.data, userId: c.get("userId") }).returning();
  return c.json(row, 201);
});
vaultRoute.put("/entries/:id", async (c) => {
  const parsed = entryInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z8.prettifyError(parsed.error) }, 400);
  }
  const [row] = await db.update(vaultEntries).set({ ...parsed.data, updatedAt: /* @__PURE__ */ new Date() }).where(
    and8(
      eq8(vaultEntries.id, c.req.param("id")),
      eq8(vaultEntries.userId, c.get("userId"))
    )
  ).returning();
  if (!row) return c.json({ error: "Eintrag nicht gefunden" }, 404);
  return c.json(row);
});
vaultRoute.delete("/entries/:id", async (c) => {
  const [row] = await db.delete(vaultEntries).where(
    and8(
      eq8(vaultEntries.id, c.req.param("id")),
      eq8(vaultEntries.userId, c.get("userId"))
    )
  ).returning({ id: vaultEntries.id });
  if (!row) return c.json({ error: "Eintrag nicht gefunden" }, 404);
  return c.json({ ok: true });
});

// server/routes/booking.ts
init_client();
init_schema();
import { eq as eq9 } from "drizzle-orm";
import { Hono as Hono9 } from "hono";
import { z as z9 } from "zod";
var timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
var dayAvailability = z9.object({
  enabled: z9.boolean(),
  from: z9.string().regex(timePattern),
  to: z9.string().regex(timePattern)
});
var settingsInput = z9.object({
  slug: z9.string().trim().toLowerCase().regex(/^[a-z0-9-]{3,50}$/, "Slug: 3\u201350 Zeichen, nur a-z, 0-9 und Bindestrich"),
  active: z9.boolean(),
  slotMinutes: z9.number().int().min(10).max(240),
  availability: z9.object({
    mon: dayAvailability,
    tue: dayAvailability,
    wed: dayAvailability,
    thu: dayAvailability,
    fri: dayAvailability,
    sat: dayAvailability,
    sun: dayAvailability
  })
});
var bookingRoute = new Hono9();
bookingRoute.get("/settings", async (c) => {
  const [row] = await db.select().from(bookingSettings).where(eq9(bookingSettings.userId, c.get("userId")));
  return c.json(row ?? null);
});
bookingRoute.put("/settings", async (c) => {
  const parsed = settingsInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z9.prettifyError(parsed.error) }, 400);
  }
  const userId = c.get("userId");
  const [taken] = await db.select({ userId: bookingSettings.userId }).from(bookingSettings).where(eq9(bookingSettings.slug, parsed.data.slug));
  if (taken && taken.userId !== userId) {
    return c.json({ error: "Dieser Slug ist bereits vergeben" }, 409);
  }
  const [row] = await db.insert(bookingSettings).values({ ...parsed.data, userId }).onConflictDoUpdate({
    target: bookingSettings.userId,
    set: { ...parsed.data, updatedAt: /* @__PURE__ */ new Date() }
  }).returning();
  return c.json(row);
});

// server/routes/public-booking.ts
init_client();
init_schema();
import { and as and9, eq as eq10, gte, lt } from "drizzle-orm";
import { Hono as Hono10 } from "hono";
import { z as z10 } from "zod";

// server/timezone.ts
var BOOKING_TIMEZONE = "Europe/Berlin";
var offsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BOOKING_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
});
function timezoneOffsetMs(t) {
  const parts = Object.fromEntries(
    offsetFormatter.formatToParts(t).map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    // Intl liefert für Mitternacht je nach Runtime "24" – normalisieren
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - t.getTime();
}
function zonedDateTime(dateStr, minutes) {
  const utcGuess = (/* @__PURE__ */ new Date(`${dateStr}T00:00:00Z`)).getTime() + minutes * 6e4;
  const offset = timezoneOffsetMs(new Date(utcGuess));
  let result = utcGuess - offset;
  const offsetAfter = timezoneOffsetMs(new Date(result));
  if (offsetAfter !== offset) result = utcGuess - offsetAfter;
  return new Date(result);
}
function weekdayOfDate(dateStr) {
  return (/* @__PURE__ */ new Date(`${dateStr}T12:00:00Z`)).getUTCDay();
}
function nextDate(dateStr) {
  const d = /* @__PURE__ */ new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// server/routes/public-booking.ts
var WEEKDAY_KEYS = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat"
];
var datePattern = /^\d{4}-\d{2}-\d{2}$/;
async function activeSettingsBySlug(slug) {
  const [settings] = await db.select().from(bookingSettings).where(eq10(bookingSettings.slug, slug));
  if (!settings || !settings.active) return null;
  return settings;
}
function daySlots(availability, slotMinutes, dateStr) {
  const day = availability[WEEKDAY_KEYS[weekdayOfDate(dateStr)]];
  if (!day.enabled) return [];
  const [fromH, fromM] = day.from.split(":").map(Number);
  const [toH, toM] = day.to.split(":").map(Number);
  const from = fromH * 60 + fromM;
  const to = toH * 60 + toM;
  const slots = [];
  for (let t = from; t + slotMinutes <= to; t += slotMinutes) {
    slots.push(t);
  }
  return slots;
}
function minutesToTime(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
var publicBookingRoute = new Hono10();
publicBookingRoute.get("/:slug", async (c) => {
  const settings = await activeSettingsBySlug(c.req.param("slug"));
  if (!settings) return c.json({ error: "Buchungsseite nicht gefunden" }, 404);
  return c.json({
    slug: settings.slug,
    slotMinutes: settings.slotMinutes,
    availability: settings.availability
  });
});
publicBookingRoute.get("/:slug/slots", async (c) => {
  const settings = await activeSettingsBySlug(c.req.param("slug"));
  if (!settings) return c.json({ error: "Buchungsseite nicht gefunden" }, 404);
  const dateStr = c.req.query("date");
  if (!dateStr || !datePattern.test(dateStr)) {
    return c.json({ error: "Parameter date (YYYY-MM-DD) fehlt" }, 400);
  }
  const dayStart = zonedDateTime(dateStr, 0);
  const dayEnd = zonedDateTime(nextDate(dateStr), 0);
  const busy = await db.select({ startsAt: appointments.startsAt, endsAt: appointments.endsAt }).from(appointments).where(
    and9(
      eq10(appointments.userId, settings.userId),
      gte(appointments.startsAt, dayStart),
      lt(appointments.startsAt, dayEnd)
    )
  );
  const now = /* @__PURE__ */ new Date();
  const free = daySlots(
    settings.availability,
    settings.slotMinutes,
    dateStr
  ).filter((minutes) => {
    const slotStart = zonedDateTime(dateStr, minutes);
    const slotEnd = new Date(slotStart.getTime() + settings.slotMinutes * 6e4);
    if (slotStart <= now) return false;
    return !busy.some((b) => slotStart < b.endsAt && slotEnd > b.startsAt);
  });
  return c.json({ date: dateStr, slots: free.map(minutesToTime) });
});
var bookInput = z10.object({
  date: z10.string().regex(datePattern),
  time: z10.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  name: z10.string().trim().min(1, "Name fehlt").max(200),
  email: z10.email("Ung\xFCltige E-Mail"),
  topic: z10.string().trim().max(1e3).optional().default("")
});
publicBookingRoute.post("/:slug/book", async (c) => {
  const settings = await activeSettingsBySlug(c.req.param("slug"));
  if (!settings) return c.json({ error: "Buchungsseite nicht gefunden" }, 404);
  const parsed = bookInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z10.prettifyError(parsed.error) }, 400);
  }
  const { date, time, name, email, topic } = parsed.data;
  const [h, m] = time.split(":").map(Number);
  const startsAt = zonedDateTime(date, h * 60 + m);
  const endsAt = new Date(startsAt.getTime() + settings.slotMinutes * 6e4);
  const dayStart = zonedDateTime(date, 0);
  const validSlot = daySlots(
    settings.availability,
    settings.slotMinutes,
    date
  ).includes(h * 60 + m);
  if (!validSlot || startsAt <= /* @__PURE__ */ new Date()) {
    return c.json({ error: "Dieser Slot ist nicht buchbar" }, 400);
  }
  const busy = await db.select({ startsAt: appointments.startsAt, endsAt: appointments.endsAt }).from(appointments).where(
    and9(
      eq10(appointments.userId, settings.userId),
      gte(appointments.startsAt, dayStart),
      lt(appointments.startsAt, zonedDateTime(nextDate(date), 0))
    )
  );
  if (busy.some((b) => startsAt < b.endsAt && endsAt > b.startsAt)) {
    return c.json({ error: "Dieser Slot wurde gerade vergeben" }, 409);
  }
  await db.insert(appointments).values({
    userId: settings.userId,
    title: `Buchung: ${name}`,
    description: `Extern gebucht \xFCber /book/${settings.slug}
E-Mail: ${email}${topic ? `
Anliegen: ${topic}` : ""}`,
    location: "",
    priority: "medium",
    startsAt,
    endsAt
  });
  return c.json({ ok: true, date, time }, 201);
});

// server/routes/google-callback.ts
init_client();
init_schema();
import { and as and10, eq as eq12 } from "drizzle-orm";
import { Hono as Hono11 } from "hono";

// server/google-auth.ts
init_client();
init_schema();
import { eq as eq11 } from "drizzle-orm";
var GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/drive.metadata.readonly"
];
function getGoogleOAuthUrl(userId, returnTo = "/settings") {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:8787/api/integrations/google/callback";
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID ist nicht in .env.local konfiguriert.");
  }
  const state = Buffer.from(JSON.stringify({ userId, returnTo })).toString("base64url");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
async function exchangeGoogleCode(code) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:8787/api/integrations/google/callback";
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth-Zugangsdaten fehlen in .env.local.");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Code-Austausch mit Google fehlgeschlagen (${res.status}): ${errText}`);
  }
  return await res.json();
}
async function getValidGoogleAccessToken(account) {
  const now = Date.now();
  const expiryTime = account.tokenExpiry ? new Date(account.tokenExpiry).getTime() : 0;
  const isExpired = !account.accessToken || expiryTime - now < 5 * 60 * 1e3;
  if (!isExpired && account.accessToken) {
    return account.accessToken;
  }
  if (!account.refreshToken) {
    if (account.accessToken) return account.accessToken;
    throw new Error(`Konto ${account.email} hat kein Refresh-Token. Bitte erneut autorisieren.`);
  }
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth-Zugangsdaten fehlen in .env.local.");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: account.refreshToken,
      grant_type: "refresh_token"
    })
  });
  if (!res.ok) {
    throw new Error(`Google Token-Erneuerung f\xFCr ${account.email} fehlgeschlagen.`);
  }
  const data = await res.json();
  const newExpiry = new Date(Date.now() + data.expires_in * 1e3);
  await db.update(connectedAccounts).set({
    accessToken: data.access_token,
    tokenExpiry: newExpiry,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq11(connectedAccounts.id, account.id));
  return data.access_token;
}

// server/routes/google-callback.ts
var googleCallbackRoute = new Hono11();
googleCallbackRoute.get("/callback", async (c) => {
  const code = c.req.query("code");
  const stateRaw = c.req.query("state");
  const errorParam = c.req.query("error");
  const frontendUrl = process.env.APP_URL || process.env.FRONTEND_URL || "http://localhost:5173";
  if (errorParam) {
    return c.redirect(
      `${frontendUrl}/settings?error=${encodeURIComponent(`Google-Anmeldung abgebrochen: ${errorParam}`)}`
    );
  }
  if (!code || !stateRaw) {
    return c.redirect(
      `${frontendUrl}/settings?error=${encodeURIComponent("Ung\xFCltige Antwort von Google erhalten.")}`
    );
  }
  try {
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf-8"));
    } catch {
      return c.redirect(
        `${frontendUrl}/settings?error=${encodeURIComponent("Ung\xFCltiger State-Parameter.")}`
      );
    }
    const { userId, returnTo = "/settings" } = stateData;
    if (!userId) {
      return c.redirect(
        `${frontendUrl}/settings?error=${encodeURIComponent("Benutzer-ID im State fehlt.")}`
      );
    }
    const tokens = await exchangeGoogleCode(code);
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    if (!profileRes.ok) {
      throw new Error("Google-Nutzerprofil konnte nicht abgerufen werden.");
    }
    const profile = await profileRes.json();
    let storageUsed = "0";
    let storageTotal = (15 * 1024 * 1024 * 1024).toString();
    let driveMeta = {};
    try {
      const driveRes = await fetch(
        "https://www.googleapis.com/drive/v3/about?fields=storageQuota,user",
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
      );
      if (driveRes.ok) {
        const driveData = await driveRes.json();
        if (driveData.storageQuota) {
          storageUsed = driveData.storageQuota.usage ?? storageUsed;
          storageTotal = driveData.storageQuota.limit ?? storageTotal;
          driveMeta = {
            driveUsage: driveData.storageQuota.usageInDrive,
            trashUsage: driveData.storageQuota.usageInDriveTrash,
            lastSyncedAt: (/* @__PURE__ */ new Date()).toISOString()
          };
        }
      }
    } catch {
    }
    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1e3);
    const [existing] = await db.select().from(connectedAccounts).where(
      and10(
        eq12(connectedAccounts.userId, userId),
        eq12(connectedAccounts.email, profile.email),
        eq12(connectedAccounts.provider, "google")
      )
    );
    if (existing) {
      await db.update(connectedAccounts).set({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? existing.refreshToken,
        tokenExpiry,
        avatarUrl: profile.picture ?? existing.avatarUrl,
        label: existing.label || profile.name || "Google-Konto",
        storageUsedBytes: storageUsed,
        storageTotalBytes: storageTotal,
        metadata: {
          ...existing.metadata ?? {},
          ...driveMeta
        },
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq12(connectedAccounts.id, existing.id));
    } else {
      await db.insert(connectedAccounts).values({
        userId,
        provider: "google",
        email: profile.email,
        label: profile.name || "Google-Konto",
        avatarUrl: profile.picture ?? null,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        tokenExpiry,
        scopes: tokens.scope,
        storageUsedBytes: storageUsed,
        storageTotalBytes: storageTotal,
        metadata: driveMeta
      });
    }
    const destination = returnTo.startsWith("/") ? returnTo : "/settings";
    return c.redirect(`${frontendUrl}${destination}?connected=google&email=${encodeURIComponent(profile.email)}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unerwarteter Fehler bei der Google-Verbindung.";
    return c.redirect(`${frontendUrl}/settings?error=${encodeURIComponent(msg)}`);
  }
});

// server/routes/integrations.ts
import { and as and12, desc as desc6, eq as eq14 } from "drizzle-orm";
import { Hono as Hono12 } from "hono";
import { setCookie } from "hono/cookie";

// server/microsoft-auth.ts
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z as z11 } from "zod";
var MICROSOFT_COOKIE = "omnidesk-ms-oauth";
var MICROSOFT_COOKIE_PATH = "/api/integrations/microsoft";
var MICROSOFT_SCOPES = ["offline_access", "User.Read", "Files.Read"];
var OAUTH_MAX_AGE = 600;
function microsoftConfig() {
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  const secret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI?.trim();
  if (!clientId || !secret || !redirectUri) {
    throw new Error("OneDrive ist noch nicht eingerichtet. MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET und MICROSOFT_REDIRECT_URI fehlen oder sind unvollst\xE4ndig.");
  }
  const redirect = new URL(redirectUri);
  if (redirect.username || redirect.password || redirect.search || redirect.hash || redirect.pathname !== `${MICROSOFT_COOKIE_PATH}/callback` || redirect.protocol !== "https:" && !(redirect.protocol === "http:" && ["localhost", "127.0.0.1"].includes(redirect.hostname))) {
    throw new Error("MICROSOFT_REDIRECT_URI muss auf den OneDrive-Callback dieser App zeigen (HTTPS; lokal HTTP erlaubt).");
  }
  const tenant = process.env.MICROSOFT_TENANT || "common";
  if (!["consumers", "organizations", "common"].includes(tenant)) throw new Error("MICROSOFT_TENANT muss consumers, organizations oder common sein.");
  return { clientId, secret, redirectUri, origin: redirect.origin, secure: redirect.protocol === "https:", tenant };
}
function sealMicrosoftValue(value, purpose) {
  const key = createHash("sha256").update(`omnidesk-microsoft-${purpose}\0`).update(microsoftConfig().secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `ms1.${Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url")}`;
}
function openMicrosoftValue(value, purpose) {
  if (!value.startsWith("ms1.")) throw new Error("OneDrive-Verbindung ung\xFCltig. Bitte erneut verbinden.");
  const buffer = Buffer.from(value.slice(4), "base64url");
  if (buffer.length < 29) throw new Error("OneDrive-Verbindung ung\xFCltig. Bitte erneut verbinden.");
  const key = createHash("sha256").update(`omnidesk-microsoft-${purpose}\0`).update(microsoftConfig().secret).digest();
  const decipher = createDecipheriv("aes-256-gcm", key, buffer.subarray(0, 12));
  decipher.setAuthTag(buffer.subarray(12, 28));
  return Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]).toString("utf8");
}
var transactionSchema = z11.object({
  userId: z11.string().min(1),
  state: z11.string().min(32),
  verifier: z11.string().min(43),
  returnTo: z11.enum(["/settings", "/cloud-monitor"]),
  createdAt: z11.number()
});
function startMicrosoftAuthorization(userId, returnTo) {
  const config = microsoftConfig();
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const transaction = transactionSchema.parse({
    userId,
    state,
    verifier,
    returnTo: returnTo === "/cloud-monitor" ? returnTo : "/settings",
    createdAt: Date.now()
  });
  const url2 = new URL(`https://login.microsoftonline.com/${config.tenant}/oauth2/v2.0/authorize`);
  url2.search = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirectUri,
    response_mode: "query",
    scope: MICROSOFT_SCOPES.join(" "),
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account"
  }).toString();
  return { url: url2.toString(), cookie: sealMicrosoftValue(JSON.stringify(transaction), "transaction") };
}
function readMicrosoftTransaction(cookie, state) {
  if (!cookie || !state) throw new Error("OneDrive-Anmeldung fehlt oder ist abgelaufen. Bitte erneut starten.");
  const transaction = transactionSchema.parse(JSON.parse(openMicrosoftValue(cookie, "transaction")));
  const expected = Buffer.from(transaction.state);
  const supplied = Buffer.from(state);
  const age = Date.now() - transaction.createdAt;
  if (age < 0 || age > OAUTH_MAX_AGE * 1e3 || expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    throw new Error("OneDrive-Anmeldung ung\xFCltig oder abgelaufen. Bitte erneut starten.");
  }
  return transaction;
}
var tokenSchema = z11.object({
  access_token: z11.string().min(1),
  refresh_token: z11.string().min(1).optional(),
  expires_in: z11.number().positive(),
  scope: z11.string().optional()
});
async function requestTokens(parameters) {
  const config = microsoftConfig();
  const response = await fetch(`https://login.microsoftonline.com/${config.tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.secret,
      redirect_uri: config.redirectUri,
      ...parameters
    }),
    signal: AbortSignal.timeout(15e3)
  });
  if (!response.ok) throw new Error(`Microsoft-Anmeldung fehlgeschlagen (HTTP ${response.status}). Bitte Konto erneut verbinden und die App-Konfiguration pr\xFCfen.`);
  return tokenSchema.parse(await response.json());
}
var exchangeMicrosoftCode = (code, verifier) => requestTokens({ grant_type: "authorization_code", code, code_verifier: verifier });
var refreshMicrosoftTokens = (refreshToken) => requestTokens({ grant_type: "refresh_token", refresh_token: refreshToken, scope: MICROSOFT_SCOPES.join(" ") });
var bytes = z11.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
var driveSchema = z11.object({ id: z11.string().min(1), driveType: z11.string(), quota: z11.object({
  used: bytes,
  total: bytes.positive(),
  deleted: bytes.optional(),
  remaining: bytes.optional(),
  state: z11.string().optional()
}) });
var profileSchema = z11.object({
  id: z11.string().min(1),
  displayName: z11.string().optional(),
  mail: z11.string().nullable().optional(),
  userPrincipalName: z11.string().optional()
});
async function getMicrosoftStorage(accessToken) {
  const response = await fetch("https://graph.microsoft.com/v1.0/me/drive?$select=id,driveType,quota", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15e3)
  });
  if (!response.ok) throw new Error(`OneDrive-Speicher konnte nicht abgerufen werden (HTTP ${response.status}). Bitte Berechtigungen pr\xFCfen oder Konto erneut verbinden.`);
  const parsed = driveSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("Microsoft liefert derzeit keine vollst\xE4ndige unterst\xFCtzte Speicherquote. Es werden keine Ersatzwerte gespeichert.");
  const { id, driveType, quota } = parsed.data;
  return { storageUsedBytes: String(quota.used), storageTotalBytes: String(quota.total), metadata: {
    driveId: id,
    driveType,
    quotaState: quota.state,
    trashUsage: String(quota.deleted ?? 0),
    quotaScope: driveType === "personal" ? "microsoft-unified" : "drive",
    lastSyncedAt: (/* @__PURE__ */ new Date()).toISOString(),
    liveConnected: true
  } };
}
async function getMicrosoftProfile(accessToken) {
  const response = await fetch("https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15e3)
  });
  if (!response.ok) throw new Error("Microsoft-Kontoprofil konnte nicht abgerufen werden.");
  const profile = profileSchema.parse(await response.json());
  const email = profile.mail || profile.userPrincipalName;
  if (!email) throw new Error("Microsoft hat keine Konto-Adresse zur\xFCckgegeben.");
  return { ...profile, email };
}

// server/microsoft-account.ts
init_client();
init_integrations();
import { and as and11, eq as eq13 } from "drizzle-orm";
async function syncMicrosoftAccount(account, persist = async (fields) => {
  const [updated] = await db.update(connectedAccounts).set(fields).where(and11(
    eq13(connectedAccounts.id, account.id),
    eq13(connectedAccounts.userId, account.userId)
  )).returning();
  return updated;
}) {
  let accessToken;
  if (account.accessToken && account.tokenExpiry && account.tokenExpiry.getTime() > Date.now() + 3e5) {
    accessToken = openMicrosoftValue(account.accessToken, "token");
  } else {
    if (!account.refreshToken) throw new Error("OneDrive-Anmeldung abgelaufen. Bitte Konto erneut verbinden.");
    const tokens = await refreshMicrosoftTokens(openMicrosoftValue(account.refreshToken, "token"));
    accessToken = tokens.access_token;
    const refreshed = await persist({
      accessToken: sealMicrosoftValue(accessToken, "token"),
      refreshToken: tokens.refresh_token ? sealMicrosoftValue(tokens.refresh_token, "token") : account.refreshToken,
      tokenExpiry: new Date(Date.now() + tokens.expires_in * 1e3),
      scopes: tokens.scope ?? account.scopes
    });
    if (!refreshed) throw new Error("OneDrive-Konto wurde zwischenzeitlich getrennt.");
  }
  const storage = await getMicrosoftStorage(accessToken);
  const updated = await persist({
    storageUsedBytes: storage.storageUsedBytes,
    storageTotalBytes: storage.storageTotalBytes,
    metadata: { ...account.metadata, ...storage.metadata },
    updatedAt: /* @__PURE__ */ new Date()
  });
  if (!updated) throw new Error("OneDrive-Konto wurde zwischenzeitlich getrennt.");
  return updated;
}

// server/public-account.ts
function publicAccount(account) {
  return {
    id: account.id,
    userId: account.userId,
    provider: account.provider,
    email: account.email,
    label: account.label,
    avatarUrl: account.avatarUrl,
    storageUsedBytes: account.storageUsedBytes,
    storageTotalBytes: account.storageTotalBytes,
    metadata: account.metadata,
    hasRefreshToken: Boolean(account.refreshToken),
    createdAt: account.createdAt,
    updatedAt: account.updatedAt
  };
}

// server/routes/integrations.ts
init_client();
init_schema();
import { z as z12 } from "zod";

// server/mega-auth.ts
import { Storage } from "megajs";
async function connectMegaAccount(email, password) {
  try {
    const storage = await new Storage({
      email,
      password,
      keepalive: false
    }).ready;
    const info = await storage.getAccountInfo();
    const sessionData = storage.toJSON();
    const filesCount = storage.root?.children ? storage.root.children.length : 0;
    storage.close();
    return {
      sessionJson: JSON.stringify(sessionData),
      spaceUsed: (info.spaceUsed ?? 0).toString(),
      spaceTotal: (info.spaceTotal ?? 20 * 1024 * 1024 * 1024).toString(),
      filesCount
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "MEGA-Authentifizierung fehlgeschlagen";
    throw new Error(`MEGA-Login fehlgeschlagen: ${msg}`);
  }
}
async function syncMegaAccount(sessionJson) {
  try {
    const sessionData = JSON.parse(sessionJson);
    const storage = Storage.fromJSON(sessionData);
    await storage.ready;
    const info = await storage.getAccountInfo();
    const filesCount = storage.root?.children ? storage.root.children.length : 0;
    storage.close();
    return {
      spaceUsed: (info.spaceUsed ?? 0).toString(),
      spaceTotal: (info.spaceTotal ?? 20 * 1024 * 1024 * 1024).toString(),
      filesCount
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "MEGA-Synchronisation fehlgeschlagen";
    throw new Error(`MEGA-Sync fehlgeschlagen: ${msg}`);
  }
}

// server/routes/integrations.ts
var createAccountInput = z12.object({
  provider: z12.enum(["google", "mega"]),
  email: z12.string().trim().email("Ung\xFCltige E-Mail-Adresse").max(255),
  password: z12.string().optional(),
  // Für Live-MEGA-Login
  label: z12.string().trim().max(100).optional(),
  accessToken: z12.string().trim().optional(),
  refreshToken: z12.string().trim().optional(),
  storageUsedBytes: z12.string().optional(),
  storageTotalBytes: z12.string().optional(),
  metadata: z12.record(z12.string(), z12.unknown()).optional()
});
var updateAccountInput = z12.object({
  label: z12.string().trim().max(100).optional(),
  metadata: z12.record(z12.string(), z12.unknown()).optional()
});
var integrationsRoute = new Hono12();
integrationsRoute.get("/microsoft/auth-url", (c) => {
  c.header("Cache-Control", "no-store");
  try {
    const config = microsoftConfig();
    if (new URL(c.req.url).origin !== config.origin) {
      return c.json({ error: "Bitte OneDrive auf der in MICROSOFT_REDIRECT_URI konfigurierten App-Adresse verbinden." }, 400);
    }
    const authorization = startMicrosoftAuthorization(c.get("userId"), c.req.query("returnTo"));
    setCookie(c, MICROSOFT_COOKIE, authorization.cookie, {
      path: MICROSOFT_COOKIE_PATH,
      httpOnly: true,
      secure: config.secure,
      sameSite: "Lax",
      maxAge: OAUTH_MAX_AGE
    });
    return c.json({ url: authorization.url });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "OneDrive-Anmeldung konnte nicht gestartet werden." }, 503);
  }
});
integrationsRoute.get("/google/auth-url", (c) => {
  const returnTo = c.req.query("returnTo") || "/settings";
  try {
    const url2 = getGoogleOAuthUrl(c.get("userId"), returnTo);
    return c.json({ url: url2 });
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Google OAuth URL konnte nicht generiert werden." },
      400
    );
  }
});
integrationsRoute.get("/accounts", async (c) => {
  const rows = await db.select({
    id: connectedAccounts.id,
    userId: connectedAccounts.userId,
    provider: connectedAccounts.provider,
    email: connectedAccounts.email,
    label: connectedAccounts.label,
    avatarUrl: connectedAccounts.avatarUrl,
    storageUsedBytes: connectedAccounts.storageUsedBytes,
    storageTotalBytes: connectedAccounts.storageTotalBytes,
    metadata: connectedAccounts.metadata,
    hasRefreshToken: connectedAccounts.refreshToken,
    createdAt: connectedAccounts.createdAt,
    updatedAt: connectedAccounts.updatedAt
  }).from(connectedAccounts).where(eq14(connectedAccounts.userId, c.get("userId"))).orderBy(desc6(connectedAccounts.createdAt));
  const sanitized = rows.map((r) => ({
    ...r,
    hasRefreshToken: Boolean(r.hasRefreshToken)
  }));
  return c.json(sanitized);
});
integrationsRoute.post("/accounts", async (c) => {
  const parsed = createAccountInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z12.prettifyError(parsed.error) }, 400);
  }
  const {
    provider,
    email,
    password,
    label,
    accessToken,
    refreshToken,
    storageUsedBytes,
    storageTotalBytes,
    metadata
  } = parsed.data;
  let finalAccessToken = accessToken ?? null;
  let finalUsed = storageUsedBytes;
  let finalTotal = storageTotalBytes;
  let finalMetadata = metadata ?? {};
  if (provider === "mega" && password) {
    try {
      const megaInfo = await connectMegaAccount(email, password);
      finalAccessToken = megaInfo.sessionJson;
      finalUsed = megaInfo.spaceUsed;
      finalTotal = megaInfo.spaceTotal;
      finalMetadata = {
        ...finalMetadata,
        filesCount: megaInfo.filesCount,
        lastSyncedAt: (/* @__PURE__ */ new Date()).toISOString(),
        liveConnected: true
      };
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : "MEGA-Verbindung fehlgeschlagen." },
        400
      );
    }
  }
  const defaultTotal = provider === "google" ? (15 * 1024 * 1024 * 1024).toString() : (20 * 1024 * 1024 * 1024).toString();
  const defaultUsed = provider === "google" ? (Math.floor(Math.random() * 8 + 3) * 1024 * 1024 * 1024).toString() : (Math.floor(Math.random() * 10 + 2) * 1024 * 1024 * 1024).toString();
  const [row] = await db.insert(connectedAccounts).values({
    userId: c.get("userId"),
    provider,
    email,
    label: label || (provider === "google" ? "Google Drive" : "MEGA Cloud"),
    accessToken: finalAccessToken,
    refreshToken: refreshToken ?? null,
    storageUsedBytes: finalUsed ?? defaultUsed,
    storageTotalBytes: finalTotal ?? defaultTotal,
    metadata: finalMetadata
  }).returning({
    id: connectedAccounts.id,
    userId: connectedAccounts.userId,
    provider: connectedAccounts.provider,
    email: connectedAccounts.email,
    label: connectedAccounts.label,
    avatarUrl: connectedAccounts.avatarUrl,
    storageUsedBytes: connectedAccounts.storageUsedBytes,
    storageTotalBytes: connectedAccounts.storageTotalBytes,
    metadata: connectedAccounts.metadata,
    createdAt: connectedAccounts.createdAt,
    updatedAt: connectedAccounts.updatedAt
  });
  return c.json(row, 201);
});
integrationsRoute.put("/accounts/:id", async (c) => {
  const parsed = updateAccountInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z12.prettifyError(parsed.error) }, 400);
  }
  const [row] = await db.update(connectedAccounts).set({
    ...parsed.data,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(
    and12(
      eq14(connectedAccounts.id, c.req.param("id")),
      eq14(connectedAccounts.userId, c.get("userId"))
    )
  ).returning({
    id: connectedAccounts.id,
    provider: connectedAccounts.provider,
    email: connectedAccounts.email,
    label: connectedAccounts.label,
    avatarUrl: connectedAccounts.avatarUrl,
    storageUsedBytes: connectedAccounts.storageUsedBytes,
    storageTotalBytes: connectedAccounts.storageTotalBytes,
    metadata: connectedAccounts.metadata,
    updatedAt: connectedAccounts.updatedAt
  });
  if (!row) return c.json({ error: "Konto nicht gefunden" }, 404);
  return c.json(row);
});
integrationsRoute.delete("/accounts/:id", async (c) => {
  const [row] = await db.delete(connectedAccounts).where(
    and12(
      eq14(connectedAccounts.id, c.req.param("id")),
      eq14(connectedAccounts.userId, c.get("userId"))
    )
  ).returning({ id: connectedAccounts.id });
  if (!row) return c.json({ error: "Konto nicht gefunden" }, 404);
  return c.json({ ok: true });
});
integrationsRoute.post("/accounts/:id/sync", async (c) => {
  const [account] = await db.select().from(connectedAccounts).where(
    and12(
      eq14(connectedAccounts.id, c.req.param("id")),
      eq14(connectedAccounts.userId, c.get("userId"))
    )
  );
  if (!account) return c.json({ error: "Konto nicht gefunden" }, 404);
  if (account.provider === "microsoft") {
    try {
      return c.json(publicAccount(await syncMicrosoftAccount(account)));
    } catch {
      return c.json({ error: "OneDrive-Synchronisation fehlgeschlagen. Die bisherigen Messwerte bleiben erhalten. Bitte Microsoft-Berechtigungen pr\xFCfen oder das Konto erneut verbinden." }, 502);
    }
  }
  if (account.provider === "google" && (account.accessToken || account.refreshToken)) {
    try {
      const validToken = await getValidGoogleAccessToken(account);
      const res = await fetch("https://www.googleapis.com/drive/v3/about?fields=storageQuota,user", {
        headers: { Authorization: `Bearer ${validToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.storageQuota) {
          const used = data.storageQuota.usage ?? account.storageUsedBytes;
          const total = data.storageQuota.limit ?? account.storageTotalBytes;
          const [updated2] = await db.update(connectedAccounts).set({
            storageUsedBytes: used,
            storageTotalBytes: total,
            avatarUrl: data.user?.photoLink ?? account.avatarUrl,
            metadata: {
              ...account.metadata ?? {},
              driveUsage: data.storageQuota.usageInDrive,
              trashUsage: data.storageQuota.usageInDriveTrash,
              lastSyncedAt: (/* @__PURE__ */ new Date()).toISOString(),
              liveConnected: true
            },
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq14(connectedAccounts.id, account.id)).returning();
          return c.json(publicAccount(updated2));
        }
      }
    } catch {
    }
  }
  if (account.provider === "mega" && account.accessToken) {
    try {
      const megaSync = await syncMegaAccount(account.accessToken);
      const [updated2] = await db.update(connectedAccounts).set({
        storageUsedBytes: megaSync.spaceUsed,
        storageTotalBytes: megaSync.spaceTotal,
        metadata: {
          ...account.metadata ?? {},
          filesCount: megaSync.filesCount,
          lastSyncedAt: (/* @__PURE__ */ new Date()).toISOString(),
          liveConnected: true
        },
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq14(connectedAccounts.id, account.id)).returning();
      return c.json(publicAccount(updated2));
    } catch {
    }
  }
  const [updated] = await db.update(connectedAccounts).set({
    metadata: {
      ...account.metadata ?? {},
      lastSyncedAt: (/* @__PURE__ */ new Date()).toISOString()
    },
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq14(connectedAccounts.id, account.id)).returning();
  return c.json(publicAccount(updated));
});

// server/routes/microsoft-callback.ts
init_client();
init_integrations();
import { and as and13, eq as eq15 } from "drizzle-orm";
import { Hono as Hono13 } from "hono";
import { deleteCookie, getCookie } from "hono/cookie";
async function persistMicrosoftConnection(connection) {
  const accounts = await db.select().from(connectedAccounts).where(and13(
    eq15(connectedAccounts.userId, connection.userId),
    eq15(connectedAccounts.provider, "microsoft")
  ));
  const existing = accounts.find((account) => account.metadata?.microsoftUserId === connection.metadata?.microsoftUserId);
  if (existing) {
    await db.update(connectedAccounts).set({
      ...connection,
      label: existing.label || connection.label,
      refreshToken: connection.refreshToken ?? existing.refreshToken
    }).where(and13(eq15(connectedAccounts.id, existing.id), eq15(connectedAccounts.userId, connection.userId)));
  } else {
    await db.insert(connectedAccounts).values(connection);
  }
}
function createMicrosoftCallbackRoute(persist = persistMicrosoftConnection) {
  const route = new Hono13();
  route.get("/callback", async (c) => {
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
    let origin;
    try {
      origin = microsoftConfig().origin;
    } catch {
      return c.json({ error: "OneDrive ist noch nicht vollst\xE4ndig konfiguriert." }, 503);
    }
    const redirect = (destination, key, value) => {
      const url2 = new URL(destination, origin);
      url2.searchParams.set(key, value);
      return c.redirect(url2.toString());
    };
    try {
      const transaction = readMicrosoftTransaction(getCookie(c, MICROSOFT_COOKIE), c.req.query("state"));
      deleteCookie(c, MICROSOFT_COOKIE, { path: MICROSOFT_COOKIE_PATH, secure: microsoftConfig().secure, httpOnly: true, sameSite: "Lax" });
      if (c.req.query("error")) return redirect(transaction.returnTo, "error", "Microsoft-Anmeldung abgebrochen oder nicht erlaubt.");
      const code = c.req.query("code");
      if (!code) return redirect(transaction.returnTo, "error", "Microsoft hat keinen Anmeldecode zur\xFCckgegeben.");
      const tokens = await exchangeMicrosoftCode(code, transaction.verifier);
      const [profile, storage] = await Promise.all([getMicrosoftProfile(tokens.access_token), getMicrosoftStorage(tokens.access_token)]);
      await persist({
        userId: transaction.userId,
        provider: "microsoft",
        email: profile.email,
        label: profile.displayName || "OneDrive",
        accessToken: sealMicrosoftValue(tokens.access_token, "token"),
        refreshToken: tokens.refresh_token ? sealMicrosoftValue(tokens.refresh_token, "token") : null,
        tokenExpiry: new Date(Date.now() + tokens.expires_in * 1e3),
        scopes: tokens.scope ?? null,
        storageUsedBytes: storage.storageUsedBytes,
        storageTotalBytes: storage.storageTotalBytes,
        metadata: { ...storage.metadata, microsoftUserId: profile.id },
        updatedAt: /* @__PURE__ */ new Date()
      });
      return redirect(transaction.returnTo, "connected", "microsoft");
    } catch {
      return redirect("/settings", "error", "OneDrive konnte nicht verbunden werden. Bitte Anmeldung erneut starten und Microsoft-Konfiguration sowie Speicherberechtigungen pr\xFCfen.");
    }
  });
  return route;
}
var microsoftCallbackRoute = createMicrosoftCallbackRoute();

// server/routes/cloud-monitor.ts
import { and as and14, desc as desc7, eq as eq16 } from "drizzle-orm";
import { Hono as Hono14 } from "hono";
init_client();
init_schema();
var cloudMonitorRoute = new Hono14();
var defaultDemoAccounts = [
  {
    provider: "google",
    email: "leon.privat@gmail.com",
    label: "Google Drive (Privat #1)",
    storageUsedBytes: (12.4 * 1024 * 1024 * 1024).toString(),
    storageTotalBytes: (15 * 1024 * 1024 * 1024).toString(),
    metadata: {
      driveUsage: (11.1 * 1024 * 1024 * 1024).toString(),
      trashUsage: (1.3 * 1024 * 1024 * 1024).toString(),
      filesCount: 1420,
      lastSyncedAt: new Date(Date.now() - 1e3 * 60 * 18).toISOString()
    }
  },
  {
    provider: "google",
    email: "leon.work@gmail.com",
    label: "Google Drive (Arbeit & FiSi)",
    storageUsedBytes: (9.8 * 1024 * 1024 * 1024).toString(),
    storageTotalBytes: (15 * 1024 * 1024 * 1024).toString(),
    metadata: {
      driveUsage: (9.5 * 1024 * 1024 * 1024).toString(),
      trashUsage: (0.3 * 1024 * 1024 * 1024).toString(),
      filesCount: 840,
      lastSyncedAt: new Date(Date.now() - 1e3 * 60 * 45).toISOString()
    }
  },
  {
    provider: "google",
    email: "leon.backup.archive@gmail.com",
    label: "Google Drive (Archiv & ISOS)",
    storageUsedBytes: (14.2 * 1024 * 1024 * 1024).toString(),
    storageTotalBytes: (15 * 1024 * 1024 * 1024).toString(),
    metadata: {
      driveUsage: (14 * 1024 * 1024 * 1024).toString(),
      trashUsage: (0.2 * 1024 * 1024 * 1024).toString(),
      filesCount: 45,
      lastSyncedAt: new Date(Date.now() - 1e3 * 60 * 110).toISOString()
    }
  },
  {
    provider: "mega",
    email: "leon.cloud@mega.nz",
    label: "MEGA Cloud (Offsite Backup)",
    storageUsedBytes: (16.8 * 1024 * 1024 * 1024).toString(),
    storageTotalBytes: (20 * 1024 * 1024 * 1024).toString(),
    metadata: {
      filesCount: 320,
      lastSyncedAt: new Date(Date.now() - 1e3 * 60 * 25).toISOString()
    }
  }
];
cloudMonitorRoute.get("/overview", async (c) => {
  const userId = c.get("userId");
  let accounts = await db.select({
    id: connectedAccounts.id,
    provider: connectedAccounts.provider,
    email: connectedAccounts.email,
    label: connectedAccounts.label,
    avatarUrl: connectedAccounts.avatarUrl,
    storageUsedBytes: connectedAccounts.storageUsedBytes,
    storageTotalBytes: connectedAccounts.storageTotalBytes,
    metadata: connectedAccounts.metadata,
    createdAt: connectedAccounts.createdAt,
    updatedAt: connectedAccounts.updatedAt
  }).from(connectedAccounts).where(eq16(connectedAccounts.userId, userId)).orderBy(desc7(connectedAccounts.createdAt));
  if (accounts.length === 0) {
    const inserted = await db.insert(connectedAccounts).values(
      defaultDemoAccounts.map((acc) => ({
        userId,
        provider: acc.provider,
        email: acc.email,
        label: acc.label,
        storageUsedBytes: acc.storageUsedBytes,
        storageTotalBytes: acc.storageTotalBytes,
        metadata: acc.metadata
      }))
    ).returning({
      id: connectedAccounts.id,
      provider: connectedAccounts.provider,
      email: connectedAccounts.email,
      label: connectedAccounts.label,
      avatarUrl: connectedAccounts.avatarUrl,
      storageUsedBytes: connectedAccounts.storageUsedBytes,
      storageTotalBytes: connectedAccounts.storageTotalBytes,
      metadata: connectedAccounts.metadata,
      createdAt: connectedAccounts.createdAt,
      updatedAt: connectedAccounts.updatedAt
    });
    accounts = inserted;
  }
  let totalUsed = BigInt(0);
  let totalCapacity = BigInt(0);
  let googleUsed = BigInt(0);
  let googleCapacity = BigInt(0);
  let microsoftUsed = BigInt(0);
  let microsoftCapacity = BigInt(0);
  let megaUsed = BigInt(0);
  let megaCapacity = BigInt(0);
  for (const acc of accounts) {
    const used = BigInt(Math.round(parseFloat(acc.storageUsedBytes || "0")));
    const total = BigInt(Math.round(parseFloat(acc.storageTotalBytes || "0")));
    totalUsed += used;
    totalCapacity += total;
    if (acc.provider === "google") {
      googleUsed += used;
      googleCapacity += total;
    } else if (acc.provider === "microsoft") {
      microsoftUsed += used;
      microsoftCapacity += total;
    } else if (acc.provider === "mega") {
      megaUsed += used;
      megaCapacity += total;
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
      microsoftCount: accounts.filter((a) => a.provider === "microsoft").length,
      accountsCount: accounts.length,
      googleCount: accounts.filter((a) => a.provider === "google").length,
      megaCount: accounts.filter((a) => a.provider === "mega").length
    },
    accounts
  });
});
cloudMonitorRoute.get("/account/:id", async (c) => {
  const [account] = await db.select().from(connectedAccounts).where(
    and14(
      eq16(connectedAccounts.id, c.req.param("id")),
      eq16(connectedAccounts.userId, c.get("userId"))
    )
  );
  if (!account) return c.json({ error: "Konto nicht gefunden" }, 404);
  return c.json(publicAccount(account));
});

// server/routes/uptime.ts
init_client();
init_schema();
init_uptime_check();
import { and as and16, desc as desc8, eq as eq18, gte as gte2 } from "drizzle-orm";
import { Hono as Hono15 } from "hono";
import { z as z13 } from "zod";
var monitorInput = z13.object({
  name: z13.string().trim().min(1, "Name ist erforderlich").max(100),
  type: z13.enum(MONITOR_TYPES).default("http"),
  url: z13.string().trim().min(1, "URL oder Host ist erforderlich").max(500),
  port: z13.number().int().min(1).max(65535).nullable().optional(),
  expectedStatus: z13.number().int().min(100).max(599).default(200),
  timeoutMs: z13.number().int().min(1e3).max(3e4).default(1e4),
  active: z13.boolean().default(true)
});
var uptimeRoute = new Hono15();
uptimeRoute.get("/", async (c) => {
  const userId = c.get("userId");
  const monitors = await db.select().from(uptimeMonitors).where(eq18(uptimeMonitors.userId, userId)).orderBy(desc8(uptimeMonitors.createdAt));
  if (monitors.length === 0) {
    return c.json([]);
  }
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1e3);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3);
  const allChecks = await db.select().from(uptimeChecks).where(gte2(uptimeChecks.checkedAt, thirtyDaysAgo)).orderBy(desc8(uptimeChecks.checkedAt));
  const checksByMonitor = /* @__PURE__ */ new Map();
  for (const chk of allChecks) {
    const list = checksByMonitor.get(chk.monitorId) || [];
    list.push(chk);
    checksByMonitor.set(chk.monitorId, list);
  }
  let needRefresh = false;
  for (const m of monitors) {
    if (!m.active) continue;
    const mChecks = checksByMonitor.get(m.id);
    if (!mChecks || mChecks.length === 0) {
      needRefresh = true;
      break;
    }
    const latest = mChecks[0];
    if (new Date(latest.checkedAt) < fiveMinutesAgo) {
      needRefresh = true;
      break;
    }
  }
  if (needRefresh) {
    await refreshAllMonitors(userId);
    const refreshedChecks = await db.select().from(uptimeChecks).where(gte2(uptimeChecks.checkedAt, thirtyDaysAgo)).orderBy(desc8(uptimeChecks.checkedAt));
    checksByMonitor.clear();
    for (const chk of refreshedChecks) {
      const list = checksByMonitor.get(chk.monitorId) || [];
      list.push(chk);
      checksByMonitor.set(chk.monitorId, list);
    }
  }
  const result = monitors.map((monitor) => {
    const mChecks = checksByMonitor.get(monitor.id) || [];
    const lastCheck = mChecks[0] || null;
    const totalChecks = mChecks.length;
    const upChecks = mChecks.filter((c2) => c2.status === "up").length;
    const uptime30d = totalChecks > 0 ? Number((upChecks / totalChecks * 100).toFixed(1)) : 100;
    const dailyBuckets = [];
    const today = /* @__PURE__ */ new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayChecks = mChecks.filter(
        (c2) => new Date(c2.checkedAt).toISOString().slice(0, 10) === dateStr
      );
      const dTotal = dayChecks.length;
      const dUp = dayChecks.filter((c2) => c2.status === "up").length;
      const dPct = dTotal > 0 ? Math.round(dUp / dTotal * 100) : 100;
      dailyBuckets.push({
        date: dateStr,
        up: dUp,
        total: dTotal,
        pct: dPct
      });
    }
    return {
      ...monitor,
      lastCheck,
      uptime30d,
      daily30d: dailyBuckets,
      totalChecks
    };
  });
  return c.json(result);
});
uptimeRoute.post("/", async (c) => {
  const userId = c.get("userId");
  const parsed = monitorInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z13.prettifyError(parsed.error) }, 400);
  }
  const [row] = await db.insert(uptimeMonitors).values({
    ...parsed.data,
    userId
  }).returning();
  try {
    await checkSingleMonitor(row);
  } catch (err) {
    console.error("Initial uptime check failed:", err);
  }
  return c.json(row, 201);
});
uptimeRoute.put("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const parsed = monitorInput.partial().safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z13.prettifyError(parsed.error) }, 400);
  }
  const [existing] = await db.select().from(uptimeMonitors).where(and16(eq18(uptimeMonitors.id, id), eq18(uptimeMonitors.userId, userId)));
  if (!existing) {
    return c.json({ error: "Monitor nicht gefunden" }, 404);
  }
  const [updated] = await db.update(uptimeMonitors).set({
    ...parsed.data,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(and16(eq18(uptimeMonitors.id, id), eq18(uptimeMonitors.userId, userId))).returning();
  return c.json(updated);
});
uptimeRoute.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const [deleted] = await db.delete(uptimeMonitors).where(and16(eq18(uptimeMonitors.id, id), eq18(uptimeMonitors.userId, userId))).returning();
  if (!deleted) {
    return c.json({ error: "Monitor nicht gefunden" }, 404);
  }
  return c.json({ success: true });
});
uptimeRoute.post("/refresh-all", async (c) => {
  const userId = c.get("userId");
  await refreshAllMonitors(userId);
  return c.json({ success: true });
});
uptimeRoute.post("/:id/check", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const [monitor] = await db.select().from(uptimeMonitors).where(and16(eq18(uptimeMonitors.id, id), eq18(uptimeMonitors.userId, userId)));
  if (!monitor) {
    return c.json({ error: "Monitor nicht gefunden" }, 404);
  }
  const check2 = await checkSingleMonitor(monitor);
  return c.json(check2);
});
uptimeRoute.get("/:id/checks", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const [monitor] = await db.select().from(uptimeMonitors).where(and16(eq18(uptimeMonitors.id, id), eq18(uptimeMonitors.userId, userId)));
  if (!monitor) {
    return c.json({ error: "Monitor nicht gefunden" }, 404);
  }
  const checks = await db.select().from(uptimeChecks).where(eq18(uptimeChecks.monitorId, id)).orderBy(desc8(uptimeChecks.checkedAt)).limit(20);
  return c.json(checks);
});

// server/routes/neon-history.ts
init_client();
init_schema();
init_neon_monitor();
init_neon_policy();
init_neon_sql();
init_neon_storage();
init_neon_runner();
import { and as and18, eq as eq20, inArray as inArray2 } from "drizzle-orm";
import { Hono as Hono16 } from "hono";
import { z as z17 } from "zod";
async function ownsProject2(link) {
  const [row] = await db.select({ id: projects.id }).from(projects).where(and18(eq20(projects.id, link.projectId), eq20(projects.userId, link.userId)));
  return Boolean(row);
}
async function ownsMonitors(link, ids) {
  if (!ids.length) return true;
  const rows = await db.select({ id: uptimeMonitors.id }).from(uptimeMonitors).where(and18(eq20(uptimeMonitors.userId, link.userId), inArray2(uptimeMonitors.id, ids)));
  return rows.length === ids.length;
}
function createNeonHistoryRoute(dependencies = { ownsProject: ownsProject2, ownsMonitors, initializeNeonStorage, saveNeonSettings, readNeonMonitoring, acknowledgeNeonAlert, runNeonCheck }) {
  const route = new Hono16();
  route.onError(() => new Response(JSON.stringify({ error: "Neon-Monitoring-Speicher nicht verf\xFCgbar. Datenbankrechte und Einrichtung pr\xFCfen." }), { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }));
  route.use("/:projectId/*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    try {
      const link = readNeonLinks().find((candidate) => candidate.userId === c.get("userId") && candidate.projectId === c.req.param("projectId"));
      if (!link || !await dependencies.ownsProject(link)) return c.json({ error: "Keine eigene Neon-Projektzuordnung vorhanden." }, 404);
      c.set("neonLink", link);
      await next();
    } catch (error) {
      return c.json({ error: error instanceof NeonConfigurationError ? error.message : "Neon-Monitoring-Speicher nicht verf\xFCgbar. Datenbank und Einrichtung pr\xFCfen." }, 503);
    }
  });
  route.get("/:projectId/monitoring", async (c) => {
    const days = Number(c.req.query("days") ?? 1);
    if (![1, 7, 30, 90].includes(days)) return c.json({ error: "Ung\xFCltiger Zeitraum." }, 400);
    return c.json(await dependencies.readNeonMonitoring(c.get("neonLink"), days));
  });
  route.put("/:projectId/monitoring/settings", async (c) => {
    const parsed = neonSettingsSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Ung\xFCltige Monitoring-Einstellungen. Intervalle, Grenzen und Monitorzuordnung pr\xFCfen." }, 400);
    const link = c.get("neonLink");
    if (!await dependencies.ownsMonitors(link, parsed.data.monitorIds)) return c.json({ error: "Mindestens ein Monitor geh\xF6rt nicht zu deinem Konto." }, 403);
    if (parsed.data.sqlEnabled && !isNeonSqlConfigured(link)) return c.json({ error: "Vor Aktivierung des SQL-Tests NEON_SQL_TARGETS und die zugeh\xF6rige geheime Verbindungsvariable einrichten." }, 400);
    await dependencies.initializeNeonStorage();
    await dependencies.saveNeonSettings(link, parsed.data);
    return c.json({ ok: true });
  });
  route.post("/:projectId/monitoring/check", async (c) => {
    try {
      return c.json(await dependencies.runNeonCheck(c.get("neonLink"), "manual"));
    } catch (error) {
      return c.json({ error: missingNeonStorage(error) ? "Monitoring zuerst \xFCber Einstellungen speichern einrichten." : "Pr\xFCfung konnte nicht gespeichert werden. Bitte erneut versuchen." }, 503);
    }
  });
  route.post("/:projectId/monitoring/alerts/:alertId/acknowledge", async (c) => {
    if (!z17.uuid().safeParse(c.req.param("alertId")).success) return c.json({ error: "Ung\xFCltige Warnungskennung." }, 400);
    if (!await dependencies.acknowledgeNeonAlert(c.get("neonLink"), c.req.param("alertId"))) return c.json({ error: "Warnung nicht gefunden." }, 404);
    return c.json({ ok: true });
  });
  return route;
}
var neonHistoryRoute = createNeonHistoryRoute();

// server/routes/neon-monitor.ts
init_client();
init_projects();
init_neon_monitor();
import { and as and19, eq as eq21 } from "drizzle-orm";
import { Hono as Hono17 } from "hono";
async function listOwnedProjects(userId) {
  return db.select({ id: projects.id, name: projects.name }).from(projects).where(eq21(projects.userId, userId));
}
async function ownsProject3(userId, projectId) {
  const [project2] = await db.select({ id: projects.id }).from(projects).where(and19(
    eq21(projects.id, projectId),
    eq21(projects.userId, userId)
  ));
  return Boolean(project2);
}
function createNeonMonitorRoute(dependencies = { listOwnedProjects, ownsProject: ownsProject3, fetchNeonSnapshot }) {
  const route = new Hono17();
  route.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    await next();
  });
  route.get("/", async (c) => {
    try {
      const userId = c.get("userId");
      const links2 = readNeonLinks().filter((link) => link.userId === userId);
      if (!links2.length) return c.json({ configured: false, userId, links: [] });
      const owned = await dependencies.listOwnedProjects(userId);
      return c.json({
        configured: Boolean(process.env.NEON_API_KEY?.trim()),
        userId,
        links: links2.flatMap((link) => {
          const project2 = owned.find((candidate) => candidate.id === link.projectId);
          return project2 ? [{
            projectId: project2.id,
            projectName: project2.name,
            neonProjectId: link.neonProjectId,
            branchId: link.branchId
          }] : [];
        })
      });
    } catch (error) {
      if (error instanceof NeonConfigurationError) {
        return c.json({ code: "NEON_CONFIG_INVALID", error: error.message }, 503);
      }
      return c.json({ code: "NEON_PROJECT_LOOKUP_FAILED", error: "Die OMNIDESK-Projekte konnten f\xFCr die Neon-Zuordnung nicht aus der Datenbank geladen werden. Bitte pr\xFCfen, ob Projektmanagement in V2 funktioniert und DATABASE_URL im aktuellen Vercel-Deployment gesetzt ist." }, 503);
    }
  });
  route.get("/:projectId", async (c) => {
    try {
      const userId = c.get("userId");
      const projectId = c.req.param("projectId");
      const link = readNeonLinks().find((candidate) => candidate.userId === userId && candidate.projectId === projectId);
      if (!link || !await dependencies.ownsProject(userId, projectId)) return c.json({ error: "Keine Neon-Zuordnung f\xFCr dieses Projekt vorhanden." }, 404);
      if (!process.env.NEON_API_KEY?.trim()) return c.json({ error: "Neon ist noch nicht eingerichtet: NEON_API_KEY fehlt." }, 503);
      return c.json(await dependencies.fetchNeonSnapshot(link));
    } catch (error) {
      if (error instanceof NeonConfigurationError) {
        return c.json({ code: "NEON_CONFIG_INVALID", error: error.message }, 503);
      }
      return c.json({ error: "Neon-Daten konnten nicht geladen werden. API-Zugang und Projekt-/Branchzuordnung pr\xFCfen und erneut versuchen." }, 502);
    }
  });
  return route;
}
var neonMonitorRoute = createNeonMonitorRoute();

// server/routes/github.ts
import { Hono as Hono18 } from "hono";
import { z as z19 } from "zod";

// server/github-monitor.ts
import { z as z18 } from "zod";
var githubOwner = z18.string().regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/);
var githubRepo = z18.string().regex(/^[A-Za-z0-9_.-]{1,100}$/).refine((value) => value !== "." && value !== "..");
var repositoryName = z18.string().refine((value) => {
  const parts = value.split("/");
  return parts.length === 2 && githubOwner.safeParse(parts[0]).success && githubRepo.safeParse(parts[1]).success;
});
var GitHubError = class extends Error {
  status;
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
};
var text15 = z18.string();
var nullableDate = z18.string().nullable().optional();
var repoSchema = z18.object({ id: z18.number(), full_name: text15, name: text15, private: z18.boolean(), default_branch: text15, updated_at: nullableDate, html_url: text15 });
function url(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname === "github.com" && !parsed.username && !parsed.password ? parsed.href : "";
  } catch {
    return "";
  }
}
function project(value) {
  if (!repositoryName.safeParse(value.full_name).success) throw new GitHubError("GitHub lieferte eine ung\xFCltige Repository-Kennung.");
  return { id: value.id, fullName: value.full_name, name: value.name, private: value.private, defaultBranch: value.default_branch, updatedAt: value.updated_at ?? null, url: url(value.html_url) };
}
async function githubGet(path, query = {}) {
  const token = process.env.GITHUB_API_TOKEN?.trim();
  if (!token) throw new GitHubError("GITHUB_API_TOKEN ist noch nicht eingerichtet.", 503);
  const endpoint = new URL(path, "https://api.github.com");
  if (endpoint.origin !== "https://api.github.com") throw new GitHubError("Ung\xFCltiger API-Pfad.", 400);
  for (const [key, value] of Object.entries(query)) endpoint.searchParams.set(key, value);
  let response;
  try {
    response = await fetch(endpoint, { method: "GET", redirect: "error", signal: AbortSignal.timeout(12e3), headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "OMNIDESK-V2"
    } });
  } catch {
    throw new GitHubError("GitHub ist derzeit nicht erreichbar.");
  }
  if (!response.ok) {
    const rateLimited = response.status === 429 || response.headers.get("x-ratelimit-remaining") === "0";
    throw new GitHubError(rateLimited ? "GitHub-API-Limit erreicht. Bitte sp\xE4ter aktualisieren." : `GitHub-Abfrage fehlgeschlagen (HTTP ${response.status}). Token und Repository-Berechtigungen pr\xFCfen.`, rateLimited ? 429 : response.status === 404 ? 404 : 502);
  }
  if (!response.body) throw new GitHubError("Leere GitHub-Antwort.");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2e6) {
        await reader.cancel();
        throw new GitHubError("GitHub-Antwort \xFCberschreitet die Gr\xF6\xDFenbegrenzung.");
      }
      ;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new GitHubError("GitHub-Antwort konnte nicht gelesen werden.");
  }
}
async function listGitHubRepositories() {
  const repositories = [];
  for (let page = 1; page <= 10; page++) {
    const items = z18.array(repoSchema).parse(await githubGet("/user/repos", { per_page: "100", page: String(page), sort: "updated", affiliation: "owner,collaborator,organization_member" }));
    for (const item of items) if (!repositories.some((repo) => repo.id === item.id)) repositories.push(project(item));
    if (items.length < 100) return { repositories, limited: false };
  }
  return { repositories, limited: true };
}
async function fetchGitHubSnapshot(name) {
  if (!repositoryName.safeParse(name).success) throw new GitHubError("Ung\xFCltiges Repository.", 400);
  const root = `/repos/${name.split("/").map(encodeURIComponent).join("/")}`;
  const repository = project(repoSchema.parse(await githubGet(root)));
  if (repository.fullName.toLowerCase() !== name.toLowerCase()) throw new GitHubError("Repository-Zuordnung stimmt nicht mit der GitHub-Antwort \xFCberein.");
  const item = (id, title, href, status, updatedAt, sha, branch) => ({ id: String(id), title: title.slice(0, 1e3), url: url(href), status, updatedAt: updatedAt ?? null, ...sha ? { sha } : {}, ...branch ? { branch } : {} });
  const issueSchema = z18.object({ id: z18.number(), number: z18.number(), title: text15, html_url: text15, state: text15, updated_at: nullableDate, draft: z18.boolean().optional(), pull_request: z18.unknown().optional() });
  const loaders = {
    branches: async () => z18.array(z18.object({ name: text15, protected: z18.boolean(), commit: z18.object({ sha: text15 }) })).parse(await githubGet(`${root}/branches`, { per_page: "20" })).map((b) => item(b.name, b.name, `https://github.com/${name}/tree/${encodeURIComponent(b.name)}`, b.protected ? "Gesch\xFCtzt" : "Branch", null, b.commit.sha, b.name)),
    commits: async () => z18.array(z18.object({ sha: text15, html_url: text15, commit: z18.object({ message: text15, committer: z18.object({ date: nullableDate }).nullable() }) })).parse(await githubGet(`${root}/commits`, { per_page: "20", sha: repository.defaultBranch })).map((c) => item(c.sha, c.commit.message, c.html_url, "Commit", c.commit.committer?.date, c.sha, repository.defaultBranch)),
    issues: async () => z18.array(issueSchema).parse(await githubGet(`${root}/issues`, { per_page: "20", state: "open", sort: "updated" })).filter((i) => !i.pull_request).map((i) => item(i.id, `#${i.number} ${i.title}`, i.html_url, i.state, i.updated_at)),
    pulls: async () => z18.array(issueSchema).parse(await githubGet(`${root}/pulls`, { per_page: "20", state: "open", sort: "updated" })).map((i) => item(i.id, `#${i.number} ${i.title}`, i.html_url, i.draft ? "Entwurf" : i.state, i.updated_at)),
    runs: async () => z18.object({ workflow_runs: z18.array(z18.object({ id: z18.number(), name: text15.nullable(), html_url: text15, status: text15, conclusion: text15.nullable(), updated_at: nullableDate, head_sha: text15, head_branch: text15.nullable() })) }).parse(await githubGet(`${root}/actions/runs`, { per_page: "20" })).workflow_runs.map((r) => item(r.id, r.name ?? "Workflow", r.html_url, r.conclusion ?? r.status, r.updated_at, r.head_sha, r.head_branch ?? void 0)),
    releases: async () => z18.array(z18.object({ id: z18.number(), name: text15.nullable(), tag_name: text15, html_url: text15, published_at: nullableDate, draft: z18.boolean(), prerelease: z18.boolean() })).parse(await githubGet(`${root}/releases`, { per_page: "20" })).map((r) => item(r.id, r.name || r.tag_name, r.html_url, r.draft ? "Entwurf" : r.prerelease ? "Vorabversion" : "Release", r.published_at))
  };
  const keys = Object.keys(loaders);
  const results = await Promise.allSettled(keys.map((key) => loaders[key]()));
  const values = Object.fromEntries(keys.map((key, i) => [key, results[i].status === "fulfilled" ? results[i].value : null]));
  return { repository, ...values, checkedAt: (/* @__PURE__ */ new Date()).toISOString(), unavailable: keys.filter((_key, i) => results[i].status === "rejected"), limit: 20 };
}

// server/github-links.ts
init_client();
init_projects();
init_neon_storage();
import { and as and20, eq as eq22 } from "drizzle-orm";
async function githubProjects(userId) {
  return db.select({ id: projects.id, name: projects.name }).from(projects).where(eq22(projects.userId, userId));
}
async function ownsGitHubProject(userId, projectId) {
  const [row] = await db.select({ id: projects.id }).from(projects).where(and20(eq22(projects.id, projectId), eq22(projects.userId, userId)));
  return Boolean(row);
}
async function listGitHubLinks(userId) {
  const sql2 = monitoringSql();
  try {
    const rows = await sql2`SELECT l.project_id AS "projectId", l.repository FROM v2_github_links l
      JOIN projects p ON p.id=l.project_id AND p.user_id=l.user_id WHERE l.user_id=${userId}`;
    return rows;
  } catch (error) {
    if (error.code === "42P01") return [];
    throw error;
  }
}
var githubLinksDdl = `CREATE TABLE IF NOT EXISTS v2_github_links (
  project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  user_id text NOT NULL, repository text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`;
async function saveGitHubLink(userId, projectId, repository) {
  const sql2 = monitoringSql();
  const [exists] = await sql2`SELECT to_regclass('v2_github_links') IS NOT NULL AS ready`;
  if (!exists?.ready) await sql2.transaction([sql2`SELECT pg_advisory_xact_lock(184730020)`, sql2.query(githubLinksDdl)]);
  const rows = await sql2`INSERT INTO v2_github_links(project_id,user_id,repository)
    SELECT id,user_id,${repository} FROM projects WHERE id=${projectId} AND user_id=${userId}
    ON CONFLICT(project_id) DO UPDATE SET user_id=EXCLUDED.user_id,repository=EXCLUDED.repository,updated_at=now() RETURNING project_id`;
  return rows.length > 0;
}
async function deleteGitHubLink(userId, projectId) {
  const sql2 = monitoringSql();
  await sql2`DELETE FROM v2_github_links l USING projects p WHERE l.project_id=${projectId} AND l.user_id=${userId} AND p.id=l.project_id AND p.user_id=${userId}`;
}

// server/routes/github.ts
function createGitHubRoute(dependencies = { fetchGitHubSnapshot, listGitHubRepositories, githubProjects, ownsGitHubProject, listGitHubLinks, saveGitHubLink, deleteGitHubLink }) {
  const route = new Hono18();
  route.onError((error, c) => c.json({ error: error instanceof GitHubError ? error.message : "GitHub-Daten konnten nicht geladen werden. Einrichtung und Datenbankrechte pr\xFCfen." }, error instanceof GitHubError ? error.status : 503));
  route.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    if (!process.env.GITHUB_ACCOUNT_USER_ID?.trim() || process.env.GITHUB_ACCOUNT_USER_ID.trim() !== c.get("userId")) return c.json({ error: "GitHub-Zentrale nicht freigeschaltet. GITHUB_ACCOUNT_USER_ID muss deine OMNIDESK-Benutzerkennung enthalten." }, 403);
    await next();
  });
  route.get("/", async (c) => {
    const userId = c.get("userId");
    if (!process.env.GITHUB_API_TOKEN?.trim()) return c.json({ configured: false, userId, repositories: [], limited: false, projects: [], links: [], mappingUnavailable: false });
    const catalogue = await dependencies.listGitHubRepositories();
    const [projects2, links2] = await Promise.allSettled([dependencies.githubProjects(userId), dependencies.listGitHubLinks(userId)]);
    return c.json({
      configured: true,
      userId,
      ...catalogue,
      projects: projects2.status === "fulfilled" ? projects2.value : [],
      links: links2.status === "fulfilled" ? links2.value : [],
      mappingUnavailable: projects2.status === "rejected" || links2.status === "rejected"
    });
  });
  route.get("/repositories/:owner/:repo", async (c) => c.json(await dependencies.fetchGitHubSnapshot(`${c.req.param("owner")}/${c.req.param("repo")}`)));
  route.put("/links/:projectId", async (c) => {
    const projectId = c.req.param("projectId");
    const userId = c.get("userId");
    const parsed = z19.object({ repository: repositoryName }).strict().safeParse(await c.req.json().catch(() => null));
    if (!z19.uuid().safeParse(projectId).success || !parsed.success) return c.json({ error: "Ung\xFCltige Projekt-/Repository-Zuordnung." }, 400);
    if (!await dependencies.ownsGitHubProject(userId, projectId)) return c.json({ error: "Eigenes OMNIDESK-Projekt nicht gefunden." }, 404);
    await dependencies.fetchGitHubSnapshot(parsed.data.repository);
    if (!await dependencies.saveGitHubLink(userId, projectId, parsed.data.repository)) return c.json({ error: "Projekt nicht mehr verf\xFCgbar." }, 404);
    return c.json({ ok: true });
  });
  route.delete("/links/:projectId", async (c) => {
    const id = c.req.param("projectId");
    const userId = c.get("userId");
    if (!z19.uuid().safeParse(id).success) return c.json({ error: "Ung\xFCltige Projektkennung." }, 400);
    if (!await dependencies.ownsGitHubProject(userId, id)) return c.json({ error: "Projekt nicht gefunden." }, 404);
    await dependencies.deleteGitHubLink(userId, id);
    return c.json({ ok: true });
  });
  return route;
}
var githubRoute = createGitHubRoute();

// server/routes/deployments.ts
init_client();
init_projects();
import { and as and21, eq as eq23 } from "drizzle-orm";
import { Hono as Hono19 } from "hono";

// server/vercel-monitor.ts
import { z as z20 } from "zod";
var identifier = z20.string().regex(/^[A-Za-z0-9_-]{1,150}$/);
var linkSchema = z20.object({
  userId: z20.string().min(1),
  projectId: z20.uuid(),
  vercelProjectId: identifier,
  teamId: identifier.optional()
});
var VercelMonitorError = class extends Error {
  code;
  status;
  constructor(code, message, status = 502) {
    super(message);
    this.name = "VercelMonitorError";
    this.code = code;
    this.status = status;
  }
};
function readVercelLinks() {
  const value = process.env.DEPLOYMENT_PROJECT_LINKS;
  if (!value?.trim()) return [];
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new VercelMonitorError("VERCEL_CONFIG_INVALID", "DEPLOYMENT_PROJECT_LINKS enth\xE4lt ung\xFCltiges JSON. Vollst\xE4ndige Liste von [ bis ] ohne Markdown-Codezeichen eintragen und neu deployen.", 503);
  }
  const result = z20.array(linkSchema).max(100).safeParse(parsed);
  if (!result.success) throw new VercelMonitorError("VERCEL_CONFIG_INVALID", `DEPLOYMENT_PROJECT_LINKS ist ung\xFCltig. Feld ${result.error.issues[0]?.path.join(".") || "Liste"} pr\xFCfen.`, 503);
  const identities = result.data.map((link) => `${link.userId}:${link.projectId}`);
  if (new Set(identities).size !== identities.length) throw new VercelMonitorError("VERCEL_CONFIG_INVALID", "Pro Benutzer und OMNIDESK-Projekt ist nur eine Vercel-Zuordnung erlaubt.", 503);
  return result.data;
}
async function boundedJson(response, maxBytes = 2e6) {
  if (!response.body) throw new Error("Empty response");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new VercelMonitorError("VERCEL_RESPONSE_TOO_LARGE", "Die Vercel-Antwort ist zu gro\xDF. Bitte die Logs direkt in Vercel pr\xFCfen.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
async function vercelGet(path, link, query = {}) {
  const token = process.env.DEPLOYMENT_API_TOKEN?.trim();
  if (!token) throw new VercelMonitorError("VERCEL_NOT_CONFIGURED", "Vercel ist noch nicht eingerichtet: DEPLOYMENT_API_TOKEN fehlt.", 503);
  const url2 = new URL(path, "https://api.vercel.com");
  for (const [key, value] of Object.entries(query)) url2.searchParams.set(key, value);
  if (link.teamId) url2.searchParams.set("teamId", link.teamId);
  let response;
  try {
    response = await fetch(url2, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(15e3)
    });
  } catch {
    throw new VercelMonitorError("VERCEL_UNREACHABLE", "Vercel ist derzeit nicht erreichbar. Bitte sp\xE4ter erneut versuchen.");
  }
  if (!response.ok) throw new VercelMonitorError("VERCEL_API_ERROR", `Vercel-Abfrage fehlgeschlagen (HTTP ${response.status}). Token, Team-Zuordnung, Zugriffsrechte oder API-Limit pr\xFCfen.`);
  return boundedJson(response);
}
var deploymentSchema = z20.object({
  id: z20.string().optional(),
  uid: z20.string().optional(),
  projectId: z20.string().optional(),
  url: z20.string().optional().nullable(),
  state: z20.string().optional(),
  readyState: z20.string().optional(),
  target: z20.string().optional().nullable(),
  createdAt: z20.number().optional(),
  created: z20.number().optional(),
  meta: z20.record(z20.string(), z20.unknown()).optional()
}).refine((value) => Boolean(value.id || value.uid), "Missing deployment identifier");
var projectSchema2 = z20.object({
  id: z20.string(),
  name: z20.string(),
  link: z20.object({ type: z20.string().optional(), org: z20.string().optional(), repo: z20.string().optional() }).nullable().optional(),
  targets: z20.object({ production: deploymentSchema.nullable().optional() }).optional()
});
function safeDeploymentUrl(value) {
  if (!value) return null;
  try {
    const url2 = new URL(value.startsWith("https://") ? value : `https://${value}`);
    return url2.protocol === "https:" && !url2.username && !url2.password && url2.hostname.endsWith(".vercel.app") ? url2.origin : null;
  } catch {
    return null;
  }
}
function publicDeployment(value) {
  const meta = value.meta ?? {};
  const text16 = (key) => typeof meta[key] === "string" ? String(meta[key]).slice(0, 1e3) : null;
  return {
    id: value.id || value.uid,
    url: safeDeploymentUrl(value.url),
    state: value.readyState || value.state || "UNKNOWN",
    target: value.target === "production" ? "production" : value.target == null ? "preview" : "other",
    createdAt: value.createdAt ?? value.created ?? null,
    commit: {
      sha: text16("githubCommitSha") || text16("gitlabCommitSha") || text16("bitbucketCommitSha"),
      message: text16("githubCommitMessage") || text16("gitlabCommitMessage") || text16("bitbucketCommitMessage"),
      branch: text16("githubCommitRef") || text16("gitlabCommitRef") || text16("bitbucketCommitRef")
    }
  };
}
async function fetchVercelSnapshot(link) {
  const [projectResult, deploymentsResult] = await Promise.allSettled([
    vercelGet(`/v9/projects/${encodeURIComponent(link.vercelProjectId)}`, link).then((value) => projectSchema2.parse(value)),
    vercelGet("/v7/deployments", link, { projectId: link.vercelProjectId, limit: "20" }).then((value) => z20.object({ deployments: z20.array(deploymentSchema) }).parse(value).deployments)
  ]);
  if (projectResult.status === "fulfilled" && projectResult.value.id !== link.vercelProjectId) {
    throw new VercelMonitorError("VERCEL_PROJECT_MISMATCH", "Die Vercel-Antwort passt nicht zur hinterlegten Projekt-ID.");
  }
  if (projectResult.status === "rejected" && deploymentsResult.status === "rejected") {
    if (projectResult.reason instanceof VercelMonitorError) throw projectResult.reason;
    throw new VercelMonitorError("VERCEL_RESPONSE_INVALID", "Die Vercel-Antwort konnte nicht ausgewertet werden.");
  }
  const project2 = projectResult.status === "fulfilled" ? projectResult.value : null;
  const production = project2?.targets?.production;
  if (production?.projectId && production.projectId !== link.vercelProjectId) throw new VercelMonitorError("VERCEL_PROJECT_MISMATCH", "Produktionszuordnung stimmt nicht mit dem Projekt \xFCberein.");
  const deployments = deploymentsResult.status === "fulfilled" ? deploymentsResult.value : null;
  if (deployments?.some((deployment) => deployment.projectId && deployment.projectId !== link.vercelProjectId)) throw new VercelMonitorError("VERCEL_PROJECT_MISMATCH", "Die Deployment-Liste enth\xE4lt eine fremde Projektzuordnung.");
  const linkedRepository = project2?.link?.type === "github" ? `${project2.link.org}/${project2.link.repo}` : null;
  return {
    githubRepository: linkedRepository && repositoryName.safeParse(linkedRepository).success ? linkedRepository : null,
    checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
    project: project2 ? { id: project2.id, name: project2.name } : null,
    production: production ? { ...publicDeployment(production), target: "production" } : null,
    deployments: deployments?.slice(0, 20).map(publicDeployment) ?? null,
    historyLimit: 20,
    unavailable: [
      projectResult.status === "rejected" ? "Projekt und Produktionszuordnung" : null,
      deploymentsResult.status === "rejected" ? "Deployment-Verlauf" : null
    ].filter((item) => Boolean(item))
  };
}
function redactBuildLog(text16) {
  const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, "g");
  let result = text16.replace(ansi, "").replace(/\p{Cc}/gu, (character) => ["\n", "\r", "	"].includes(character) ? character : "");
  for (const [name, value] of Object.entries(process.env)) {
    if (value && value.length >= 6 && /TOKEN|SECRET|PASSWORD|API_KEY|DATABASE_URL/i.test(name)) result = result.split(value).join("[ENTFERNT]");
  }
  result = result.replace(/(\b(?:password|token|secret|api[_-]?key|authorization|database_url)\b\s*[=:]\s*)(?:Bearer\s+)?[^\s,;]+/gi, "$1[ENTFERNT]").replace(/(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/gi, "$1[ENTFERNT]@").replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, "[PRIVATER SCHL\xDCSSEL ENTFERNT]");
  return result.slice(0, 8e3);
}
async function fetchVercelLogs(link, deploymentId) {
  if (!identifier.safeParse(deploymentId).success) throw new VercelMonitorError("VERCEL_DEPLOYMENT_INVALID", "Ung\xFCltige Deployment-ID.", 400);
  const detail = z20.object({ id: z20.string(), projectId: z20.string() }).parse(await vercelGet(`/v13/deployments/${encodeURIComponent(deploymentId)}`, link));
  if (detail.id !== deploymentId || detail.projectId !== link.vercelProjectId) throw new VercelMonitorError("VERCEL_DEPLOYMENT_FORBIDDEN", "Dieses Deployment geh\xF6rt nicht zum zugeordneten Projekt.", 404);
  const raw = await vercelGet(
    `/v3/deployments/${encodeURIComponent(deploymentId)}/events`,
    link,
    { follow: "0", builds: "1", direction: "backward", limit: "100" }
  );
  const parsedEvents = z20.array(z20.object({
    text: z20.string().nullable().optional(),
    type: z20.string().optional(),
    created: z20.number().optional(),
    date: z20.number().optional(),
    deploymentId: z20.string().optional()
  }).nullable()).parse(raw);
  const events = parsedEvents.filter((event) => event !== null);
  if (events.some((event) => event.deploymentId && event.deploymentId !== deploymentId)) throw new VercelMonitorError("VERCEL_DEPLOYMENT_FORBIDDEN", "Log-Zuordnung stimmt nicht mit dem Deployment \xFCberein.", 404);
  return {
    deploymentId,
    checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
    limit: 100,
    truncated: events.length >= 100 || events.some((event) => (event.text?.length ?? 0) > 8e3),
    entries: events.slice(0, 100).filter((event) => event.text).map((event) => ({ text: redactBuildLog(event.text), type: event.type ?? "log", timestamp: event.created ?? event.date ?? null })).reverse()
  };
}
async function fetchVercelProjects() {
  const projects2 = [];
  const unavailable = [];
  let limited = false;
  const pageSchema = z20.object({ pagination: z20.object({ next: z20.number().nullable().optional() }).optional() });
  async function pages(path, field, teamId) {
    const items = [];
    let until;
    for (let page = 0; page < 10; page++) {
      const raw = await vercelGet(path, { teamId }, { limit: "100", ...until ? { until } : {} });
      const parsed = pageSchema.parse(raw);
      items.push(...z20.array(z20.unknown()).parse(z20.record(z20.string(), z20.unknown()).parse(raw)[field]));
      const next = parsed.pagination?.next;
      if (next == null) return items;
      if (String(next) === until) {
        limited = true;
        return items;
      }
      until = String(next);
    }
    limited = true;
    return items;
  }
  const teams = [];
  try {
    teams.push(...z20.array(z20.object({ id: identifier, name: z20.string() })).parse(await pages("/v2/teams", "teams")));
  } catch {
    unavailable.push("Team-Liste");
  }
  if (teams.length > 30) limited = true;
  const scopes = [{ id: void 0, name: "Konto" }, ...teams.slice(0, 30)];
  for (let i = 0; i < scopes.length; i += 4) {
    await Promise.all(scopes.slice(i, i + 4).map(async (scope) => {
      try {
        const items = z20.array(z20.object({ id: identifier, name: z20.string(), accountId: identifier.optional() })).parse(await pages("/v10/projects", "projects", scope.id));
        for (const item of items) {
          const teamId = item.accountId?.startsWith("team_") ? item.accountId : scope.id ?? null;
          if (!projects2.some((project2) => project2.id === item.id && project2.teamId === teamId)) {
            projects2.push({ id: item.id, name: item.name, teamId, scope: teams.find((team) => team.id === teamId)?.name ?? scope.name });
          }
        }
      } catch {
        unavailable.push(scope.name);
      }
    }));
  }
  return { projects: projects2.sort((a, b) => a.name.localeCompare(b.name)), unavailable, limited };
}

// server/routes/deployments.ts
async function listOwnedProjects2(userId) {
  return db.select({ id: projects.id, name: projects.name }).from(projects).where(eq23(projects.userId, userId));
}
async function ownsProject4(userId, projectId) {
  const [project2] = await db.select({ id: projects.id }).from(projects).where(and21(eq23(projects.id, projectId), eq23(projects.userId, userId)));
  return Boolean(project2);
}
function createDeploymentsRoute(dependencies = { listOwnedProjects: listOwnedProjects2, ownsProject: ownsProject4, fetchVercelSnapshot, fetchVercelLogs }) {
  const route = new Hono19();
  route.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    await next();
  });
  route.use("/account/*", async (c, next) => {
    const owner = process.env.DEPLOYMENT_ACCOUNT_USER_ID?.trim();
    if (!owner || owner !== c.get("userId")) return c.json({ error: "Vercel-Konto nicht freigeschaltet. DEPLOYMENT_ACCOUNT_USER_ID muss deine OMNIDESK-Benutzerkennung enthalten." }, 403);
    await next();
  });
  route.get("/account/projects", async (c) => {
    try {
      if (!process.env.DEPLOYMENT_API_TOKEN?.trim()) throw new VercelMonitorError("VERCEL_NOT_CONFIGURED", "DEPLOYMENT_API_TOKEN fehlt.", 503);
      return c.json(await fetchVercelProjects());
    } catch (error) {
      return c.json({ error: error instanceof VercelMonitorError ? error.message : "Vercel-Projekte konnten nicht geladen werden." }, 502);
    }
  });
  async function accountLink(userId, id, teamId) {
    const catalogue = await fetchVercelProjects();
    const project2 = catalogue.projects.find((item) => item.id === id && (item.teamId ?? "") === (teamId ?? ""));
    if (!project2) throw new VercelMonitorError("VERCEL_PROJECT_FORBIDDEN", "Dieses Vercel-Projekt ist f\xFCr dein Konto nicht verf\xFCgbar.", 404);
    return { userId, projectId: "00000000-0000-4000-8000-000000000000", vercelProjectId: project2.id, ...project2.teamId ? { teamId: project2.teamId } : {} };
  }
  route.get("/account/projects/:id", async (c) => {
    try {
      return c.json(await dependencies.fetchVercelSnapshot(await accountLink(c.get("userId"), c.req.param("id"), c.req.query("teamId"))));
    } catch (error) {
      return c.json({ error: error instanceof VercelMonitorError ? error.message : "Deployments konnten nicht geladen werden." }, error instanceof VercelMonitorError ? error.status : 502);
    }
  });
  route.get("/account/projects/:id/:deploymentId/logs", async (c) => {
    try {
      return c.json(await dependencies.fetchVercelLogs(await accountLink(c.get("userId"), c.req.param("id"), c.req.query("teamId")), c.req.param("deploymentId")));
    } catch (error) {
      return c.json({ error: error instanceof VercelMonitorError ? error.message : "Logs konnten nicht geladen werden." }, error instanceof VercelMonitorError ? error.status : 502);
    }
  });
  route.get("/", async (c) => {
    try {
      const userId = c.get("userId");
      const links2 = readVercelLinks().filter((link) => link.userId === userId);
      if (!links2.length) return c.json({ configured: false, userId, links: [] });
      const owned = await dependencies.listOwnedProjects(userId);
      return c.json({
        configured: Boolean(process.env.DEPLOYMENT_API_TOKEN?.trim()),
        userId,
        links: links2.flatMap((link) => {
          const project2 = owned.find((candidate) => candidate.id === link.projectId);
          return project2 ? [{
            projectId: project2.id,
            projectName: project2.name,
            vercelProjectId: link.vercelProjectId,
            teamId: link.teamId ?? null
          }] : [];
        })
      });
    } catch (error) {
      if (error instanceof VercelMonitorError) return c.json({ code: error.code, error: error.message }, error.status);
      return c.json({ code: "VERCEL_PROJECT_LOOKUP_FAILED", error: "OMNIDESK-Projekte konnten nicht geladen werden. Projektmanagement und Datenbankkonfiguration pr\xFCfen." }, 503);
    }
  });
  route.get("/:projectId", async (c) => {
    try {
      const link = readVercelLinks().find((candidate) => candidate.userId === c.get("userId") && candidate.projectId === c.req.param("projectId"));
      if (!link || !await dependencies.ownsProject(c.get("userId"), link.projectId)) return c.json({ error: "Keine Vercel-Zuordnung f\xFCr dieses Projekt vorhanden." }, 404);
      return c.json(await dependencies.fetchVercelSnapshot(link));
    } catch (error) {
      if (error instanceof VercelMonitorError) return c.json({ code: error.code, error: error.message }, error.status);
      return c.json({ error: "Deployment-Daten konnten nicht geladen werden. Bitte sp\xE4ter erneut versuchen." }, 502);
    }
  });
  route.get("/:projectId/:deploymentId/logs", async (c) => {
    try {
      const link = readVercelLinks().find((candidate) => candidate.userId === c.get("userId") && candidate.projectId === c.req.param("projectId"));
      if (!link || !await dependencies.ownsProject(c.get("userId"), link.projectId)) return c.json({ error: "Keine Vercel-Zuordnung f\xFCr dieses Projekt vorhanden." }, 404);
      return c.json(await dependencies.fetchVercelLogs(link, c.req.param("deploymentId")));
    } catch (error) {
      if (error instanceof VercelMonitorError) return c.json({ code: error.code, error: error.message }, error.status);
      return c.json({ error: "Build-Logs konnten nicht geladen werden. Zugriff und Verf\xFCgbarkeit bei Vercel pr\xFCfen." }, 502);
    }
  });
  return route;
}
var deploymentsRoute = createDeploymentsRoute();

// server/routes/chat.ts
init_client();
init_schema();
import { and as and22, asc as asc5, desc as desc9, eq as eq24 } from "drizzle-orm";
import { Hono as Hono20 } from "hono";
import { z as z21 } from "zod";
var chatRoute = new Hono20();
var preferredKeyIndex = 0;
function getApiKeys() {
  const keys = [
    process.env.OPENAI_API_KEY,
    ...(process.env.AI_API_KEYS || "").split(",")
  ].map((k) => k?.trim()).filter((k) => Boolean(k));
  return [...new Set(keys)];
}
function isFailoverStatus(status) {
  return status === 401 || status === 403 || status === 408 || status === 429 || status >= 500;
}
var createSessionSchema = z21.object({
  title: z21.string().trim().max(200).optional()
});
var updateSessionSchema = z21.object({
  title: z21.string().trim().min(1).max(200)
});
var sendMessageSchema = z21.object({
  content: z21.string().trim().min(1, "Nachricht darf nicht leer sein").max(2e4)
});
chatRoute.get("/sessions", async (c) => {
  const userId = c.get("userId");
  const rows = await db.select().from(chatSessions).where(eq24(chatSessions.userId, userId)).orderBy(desc9(chatSessions.updatedAt));
  return c.json(rows);
});
chatRoute.post("/sessions", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => ({}));
  const parsed = createSessionSchema.safeParse(body);
  const title = parsed.success && parsed.data.title ? parsed.data.title : "Neuer Chat";
  const [session] = await db.insert(chatSessions).values({
    userId,
    title
  }).returning();
  return c.json(session, 201);
});
chatRoute.put("/sessions/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const parsed = updateSessionSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z21.prettifyError(parsed.error) }, 400);
  }
  const [updated] = await db.update(chatSessions).set({
    title: parsed.data.title,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(and22(eq24(chatSessions.id, id), eq24(chatSessions.userId, userId))).returning();
  if (!updated) {
    return c.json({ error: "Chat nicht gefunden" }, 404);
  }
  return c.json(updated);
});
chatRoute.delete("/sessions/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const [deleted] = await db.delete(chatSessions).where(and22(eq24(chatSessions.id, id), eq24(chatSessions.userId, userId))).returning();
  if (!deleted) {
    return c.json({ error: "Chat nicht gefunden" }, 404);
  }
  return c.json({ success: true });
});
chatRoute.get("/sessions/:id/messages", async (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("id");
  const [session] = await db.select().from(chatSessions).where(and22(eq24(chatSessions.id, sessionId), eq24(chatSessions.userId, userId)));
  if (!session) {
    return c.json({ error: "Chat nicht gefunden" }, 404);
  }
  const messages = await db.select().from(chatMessages).where(eq24(chatMessages.sessionId, sessionId)).orderBy(asc5(chatMessages.createdAt));
  return c.json(messages);
});
chatRoute.post("/sessions/:id/messages", async (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("id");
  const [session] = await db.select().from(chatSessions).where(and22(eq24(chatSessions.id, sessionId), eq24(chatSessions.userId, userId)));
  if (!session) {
    return c.json({ error: "Chat nicht gefunden" }, 404);
  }
  const parsed = sendMessageSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z21.prettifyError(parsed.error) }, 400);
  }
  const userContent = parsed.data.content;
  const [userMsg] = await db.insert(chatMessages).values({
    sessionId,
    role: "user",
    content: userContent
  }).returning();
  if (session.title === "Neuer Chat") {
    const cleanTitle = userContent.length > 35 ? `${userContent.slice(0, 35).trim()}\u2026` : userContent;
    await db.update(chatSessions).set({ title: cleanTitle, updatedAt: /* @__PURE__ */ new Date() }).where(eq24(chatSessions.id, sessionId));
  } else {
    await db.update(chatSessions).set({ updatedAt: /* @__PURE__ */ new Date() }).where(eq24(chatSessions.id, sessionId));
  }
  const history = await db.select().from(chatMessages).where(eq24(chatMessages.sessionId, sessionId)).orderBy(asc5(chatMessages.createdAt)).limit(20);
  const baseUrl = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = process.env.AI_MODEL || "gpt-4o-mini";
  let assistantContent = "";
  let usage = null;
  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) {
    assistantContent = `\u{1F44B} **Hallo! Ich bin Omni, dein KI-Assistent.**

Aktuell ist noch kein \`OPENAI_API_KEY\` in der \`.env.local\` hinterlegt.

Um mich live zu nutzen, trage einfach folgendes in deine \`.env.local\` ein:
\`\`\`env
OPENAI_API_KEY=dein_api_schluessel_hier
# Optional: weitere Keys als Fallback (Reihenfolge = Priorit\xE4t)
# AI_API_KEYS=weiterer_key_1,weiterer_key_2
# Optional (z. B. f\xFCr OpenRouter, LM Studio, Ollama):
# AI_BASE_URL=https://openrouter.ai/api/v1
# AI_MODEL=meta-llama/llama-3-8b-instruct
\`\`\`

Deine Nachricht wurde dennoch erfolgreich im Chatverlauf gespeichert!`;
  } else {
    const messagesPayload = [
      {
        role: "system",
        content: 'Du bist Omni, der KI-Assistent von OmniDesk, einer modularen Produktivit\xE4tsplattform f\xFCr IT-Profis, Fachinformatiker (FiSi) und Power-User. Du h\xF6rst auf den Namen "Omni" \u2013 wenn dich jemand mit deinem Namen anspricht (z. B. "Omni, wie geht das?"), antwortest du selbstverst\xE4ndlich direkt. Antworte pr\xE4zise, hilfsbereit, auf Deutsch, nutze Markdown und hebe Codebl\xF6cke mit passendem Sprachbezeichner hervor.'
      },
      ...history.map((m) => ({
        role: m.role,
        content: m.content
      }))
    ];
    const order = [
      ...apiKeys.slice(preferredKeyIndex),
      ...apiKeys.slice(0, preferredKeyIndex)
    ];
    let lastStatus = null;
    let lastError = null;
    for (let i = 0; i < order.length; i++) {
      const apiKey = order[i];
      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages: messagesPayload,
            temperature: 0.7
          })
        });
        if (!response.ok) {
          lastStatus = response.status;
          lastError = (await response.text()).slice(0, 500);
          if (isFailoverStatus(response.status) && i < order.length - 1) {
            continue;
          }
          assistantContent = `\u26A0\uFE0F **Fehler bei der KI-Anfrage (HTTP ${response.status}):**
\`\`\`
${lastError}
\`\`\``;
          break;
        }
        const data = await response.json();
        assistantContent = data.choices?.[0]?.message?.content || "Es konnte keine Antwort vom Modell generiert werden.";
        preferredKeyIndex = apiKeys.indexOf(apiKey);
        const toInt = (value) => value === null ? null : Number.parseInt(value, 10);
        usage = {
          promptTokens: data.usage?.prompt_tokens ?? null,
          completionTokens: data.usage?.completion_tokens ?? null,
          totalTokens: data.usage?.total_tokens ?? null,
          ratelimit: response.headers.has("x-ratelimit-remaining-tokens") || response.headers.has("x-ratelimit-remaining-requests") ? {
            remainingRequests: toInt(
              response.headers.get("x-ratelimit-remaining-requests")
            ),
            remainingTokens: toInt(
              response.headers.get("x-ratelimit-remaining-tokens")
            ),
            resetRequests: response.headers.get("x-ratelimit-reset-requests"),
            resetTokens: response.headers.get("x-ratelimit-reset-tokens")
          } : null
        };
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        lastError = msg;
        if (i < order.length - 1) {
          continue;
        }
        assistantContent = `\u26A0\uFE0F **Verbindungsfehler zur KI-Schnittstelle:**
${msg}`;
      }
    }
    if (!assistantContent && lastStatus !== null && !lastError) {
      assistantContent = `\u26A0\uFE0F **Fehler bei der KI-Anfrage (HTTP ${lastStatus}).**`;
    } else if (!assistantContent && lastError && lastStatus === null) {
      assistantContent = `\u26A0\uFE0F **Verbindungsfehler zur KI-Schnittstelle:**
${lastError}`;
    }
  }
  const [assistantMsg] = await db.insert(chatMessages).values({
    sessionId,
    role: "assistant",
    content: assistantContent
  }).returning();
  return c.json({
    userMessage: userMsg,
    assistantMessage: assistantMsg,
    usage
  });
});

// server/app.ts
function createApp() {
  const app = new Hono21().basePath("/api");
  app.onError((err, c) => {
    console.error(`[API] Fehler in ${c.req.method} ${c.req.path}:`, err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("ENV_FEHLT:")) {
      return c.json({ error: msg }, 500);
    }
    return c.json({ error: "Interner Serverfehler" }, 500);
  });
  app.get("/health", (c) => c.json({ ok: true, ts: Date.now() }));
  app.route("/public/booking", publicBookingRoute);
  app.route("/integrations/google", googleCallbackRoute);
  app.route("/integrations/microsoft", microsoftCallbackRoute);
  app.get("/cron/uptime-refresh", async (c) => {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      return c.json({ error: "CRON_SECRET ist nicht konfiguriert" }, 403);
    }
    if (c.req.header("Authorization") !== `Bearer ${secret}`) {
      return c.json({ error: "Ung\xFCltiges Cron-Secret" }, 401);
    }
    try {
      const { refreshAllMonitors: refreshAllMonitors2 } = await Promise.resolve().then(() => (init_uptime_check(), uptime_check_exports));
      await refreshAllMonitors2();
      return c.json({ ok: true });
    } catch (err) {
      console.error("[Cron] Uptime-Refresh fehlgeschlagen:", err);
      return c.json({ error: "Uptime-Refresh fehlgeschlagen" }, 500);
    }
  });
  app.get("/cron/neon-refresh", async (c) => {
    c.header("Cache-Control", "no-store");
    const secret = process.env.CRON_SECRET;
    if (!secret || c.req.header("Authorization") !== `Bearer ${secret}`) return c.json({ error: "Scheduler nicht autorisiert." }, 401);
    const projectId = c.req.query("projectId");
    if (projectId && !z22.uuid().safeParse(projectId).success) return c.json({ error: "Ung\xFCltige Projektkennung." }, 400);
    try {
      const { runNeonScheduler: runNeonScheduler2 } = await Promise.resolve().then(() => (init_neon_runner(), neon_runner_exports));
      return c.json({ ok: true, ...await runNeonScheduler2(projectId) });
    } catch {
      return c.json({ error: "Neon-Hintergrundpr\xFCfung fehlgeschlagen. Speicher und Konfiguration pr\xFCfen." }, 503);
    }
  });
  app.use("*", requireAuth);
  app.route("/links", linksRoute);
  app.route("/notes", notesRoute);
  app.route("/tasks", tasksRoute);
  app.route("/contacts", contactsRoute);
  app.route("/appointments", appointmentsRoute);
  app.route("/commands", commandsRoute);
  app.route("/projects", projectsRoute);
  app.route("/vault", vaultRoute);
  app.route("/booking", bookingRoute);
  app.route("/integrations", integrationsRoute);
  app.route("/cloud-monitor", cloudMonitorRoute);
  app.route("/uptime", uptimeRoute);
  app.route("/neon", neonHistoryRoute);
  app.route("/neon", neonMonitorRoute);
  app.route("/deployments", deploymentsRoute);
  app.route("/github", githubRoute);
  app.route("/chat", chatRoute);
  return app;
}

// server/vercel-entry.ts
var handler = handle(createApp());
var runtime = "nodejs";
var maxDuration = 60;
var GET = handler;
var POST = handler;
var PUT = handler;
var PATCH = handler;
var DELETE = handler;
var OPTIONS = handler;
var HEAD = handler;
export {
  DELETE,
  GET,
  HEAD,
  OPTIONS,
  PATCH,
  POST,
  PUT,
  maxDuration,
  runtime
};
