import type { MissionSnapshot } from '../../src/types/mission-control'
import { defaultNeonSettings } from '../../server/neon-policy'
export const missionProjectId = '7860bb51-2bf3-427b-bdec-0ed7b3ef3cda'
export const missionOtherId = 'b4ae6b4f-2026-450e-9e8e-9c10bb6ff25b'
export function missionFixture(now = Date.now()): MissionSnapshot {
  const at = new Date(now).toISOString(),
    earlier = new Date(now - 600_000).toISOString(),
    sha = 'a'.repeat(40)
  const snapshot: MissionSnapshot = {
    uptime: { state: 'missing', message: '', data: null },
    fetchedAt: at,
    project: {
      id: missionProjectId,
      name: 'OMNIDESK Testprojekt',
      description: 'Simulierte Projektdaten für lokale Prüfungen.',
      status: 'active',
      updatedAt: at,
    },
    tasks: {
      state: 'ready',
      message: '',
      data: [
        {
          id: missionOtherId,
          title: 'Produktionsprüfung vorbereiten',
          status: 'todo',
          priority: 'medium',
          updatedAt: earlier,
        },
      ],
    },
    github: {
      state: 'ready',
      message: '',
      data: {
        checkedAt: at,
        repository: {
          id: 1,
          fullName: 'example/omnidesk',
          name: 'omnidesk',
          private: true,
          defaultBranch: 'main',
          updatedAt: at,
          url: 'https://github.com/example/omnidesk',
        },
        branches: [],
        commits: [
          {
            id: sha,
            sha,
            branch: 'main',
            title: 'Cockpit ergänzen',
            url: 'https://github.com/example/omnidesk/commit/' + sha,
            status: 'committed',
            updatedAt: earlier,
          },
        ],
        issues: [],
        pulls: [],
        releases: [],
        runs: [
          {
            id: '1',
            title: 'CI',
            url: 'https://github.com/example/omnidesk/actions/runs/1',
            status: 'success',
            sha,
            branch: 'main',
            updatedAt: earlier,
          },
        ],
        unavailable: [],
        limit: 20,
      },
    },
    deployment: {
      state: 'ready',
      message: '',
      data: {
        checkedAt: at,
        githubRepository: 'example/omnidesk',
        project: { id: 'prj-test', name: 'omnidesk' },
        production: {
          id: 'dpl-test',
          state: 'READY',
          target: 'production',
          createdAt: now - 900_000,
          url: 'https://example.vercel.app',
          commit: { sha, message: 'Cockpit ergänzen', branch: 'main' },
        },
        deployments: [],
        unavailable: [],
        historyLimit: 20,
      },
    },
    neon: {
      state: 'ready',
      message: '',
      data: {
        checkedAt: at,
        project: {
          id: 'neon-test',
          name: 'Testdatenbank',
          region: 'eu',
          postgresVersion: 17,
        },
        branch: {
          id: 'br-test',
          name: 'main',
          state: 'ready',
          logicalSizeBytes: 1024 ** 3,
        },
        endpoints: [
          {
            id: 'ep-test',
            state: 'idle',
            type: 'read_write',
            disabled: false,
            pendingState: null,
            lastActive: earlier,
            minCu: 0.25,
            maxCu: 1,
          },
        ],
        consumption: null,
        unavailable: [],
      },
    },
    monitoring: {
      state: 'ready',
      message: '',
      data: {
        setupRequired: false,
        settings: {
          ...defaultNeonSettings,
          enabled: true,
          monitorIds: [missionOtherId],
        },
        lastAttemptAt: at,
        lastSuccessAt: at,
        lastSchedulerAt: at,
        lastSql: null,
        snapshot: null,
        alerts: [],
        history: [],
        historyDays: 1,
        schedulerIntervalMinutes: 15,
        sqlConfigured: false,
        monitors: [
          {
            id: missionOtherId,
            name: 'Website',
            active: true,
            linked: true,
            status: 'up',
            responseTimeMs: 125,
            checkedAt: at,
          },
        ],
      },
    },
  }
  snapshot.uptime = {
    state: 'ready',
    message: '',
    data: {
      origin: 'neon',
      version: 0,
      missingMonitors: 0,
      monitors: snapshot.monitoring.data!.monitors.map((m) => ({
        ...m,
        recentChecks: [{ at, status: 'up', responseTimeMs: 125 }],
        sampleCount: 1,
        upCount: 1,
      })),
    },
  }
  snapshot.deployment.data!.deployments = [
    snapshot.deployment.data!.production!,
  ]
  return snapshot
}
