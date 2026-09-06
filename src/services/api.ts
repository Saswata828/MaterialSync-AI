import { Material, MatchCandidate, CommonCodeMapping, AuditLogEntry, DashboardStats } from '../types';
import { HarmonizationEngine, EngineState } from '../engine/harmonizer';

const LOCAL_STORAGE_KEY = 'materialsync_ai_state_v1';

// Create a client-side engine initialized from localStorage if available
function createClientEngine(): HarmonizationEngine {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsedState = JSON.parse(saved) as Partial<EngineState>;
        if (parsedState.materials && parsedState.materials.length > 0) {
          const engine = new HarmonizationEngine(parsedState);
          return engine;
        }
      }
    } catch (e) {
      console.warn('[DataService] LocalStorage load failed, initializing default engine', e);
    }
  }
  const engine = new HarmonizationEngine();
  engine.initialize();
  return engine;
}

const clientEngine = createClientEngine();

function persistLocalState() {
  if (typeof window !== 'undefined') {
    try {
      const state = clientEngine.getState();
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[DataService] LocalStorage persist failed', e);
    }
  }
}

async function tryFetchJson<T>(url: string, options?: RequestInit): Promise<{ success: boolean; data?: T }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s timeout for fast fallback
    
    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const contentType = res.headers.get('content-type');
    if (res.ok && contentType && contentType.includes('application/json')) {
      const data = await res.json();
      return { success: true, data };
    }
  } catch (err) {
    // Network error or timeout: fall back gracefully
  }
  return { success: false };
}

export interface InitialDataPayload {
  materials: Material[];
  matches: MatchCandidate[];
  mappings: CommonCodeMapping[];
  auditLogs: AuditLogEntry[];
  stats: DashboardStats;
}

export async function fetchAllData(): Promise<InitialDataPayload> {
  // Try fetching all from server first
  try {
    const [matRes, matchRes, mapRes, auditRes, statsRes] = await Promise.all([
      tryFetchJson<Material[]>('/api/materials'),
      tryFetchJson<MatchCandidate[]>('/api/matches'),
      tryFetchJson<CommonCodeMapping[]>('/api/common-mappings'),
      tryFetchJson<AuditLogEntry[]>('/api/audit-log'),
      tryFetchJson<DashboardStats>('/api/stats')
    ]);

    if (matRes.success && matchRes.success && mapRes.success && auditRes.success && statsRes.success) {
      // Sync client engine with backend state
      clientEngine.initFromState({
        materials: matRes.data,
        matches: matchRes.data,
        mappings: mapRes.data,
        auditLogs: auditRes.data
      });
      persistLocalState();

      return {
        materials: matRes.data!,
        matches: matchRes.data!,
        mappings: mapRes.data!,
        auditLogs: auditRes.data!,
        stats: statsRes.data!
      };
    }
  } catch (err) {
    console.warn('[DataService] API fetch failed, falling back to embedded harmonization engine');
  }

  // Graceful fallback to client harmonization engine
  return {
    materials: clientEngine.getMaterials(),
    matches: clientEngine.getMatches(),
    mappings: clientEngine.getMappings(),
    auditLogs: clientEngine.getAuditLogs(),
    stats: clientEngine.getStats()
  };
}

export async function sendReviewDecision(params: {
  matchId: string;
  action: 'APPROVE' | 'REJECT' | 'NEEDS_INFO';
  reason?: string;
  user?: string;
}): Promise<{ success: boolean; commonCode?: string | null; error?: string }> {
  // Try backend first
  const serverResult = await tryFetchJson<{ success: boolean; commonCode?: string | null; error?: string }>('/api/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });

  if (serverResult.success && serverResult.data?.success) {
    return serverResult.data;
  }

  // Fallback to local engine
  const localResult = clientEngine.reviewDecision(params.matchId, params.action, params.reason, params.user);
  persistLocalState();
  return localResult;
}

export async function sendCsvUpload(csvContent: string): Promise<{ success: boolean; addedCount?: number; totalMaterials?: number; error?: string }> {
  // Try backend first
  const serverResult = await tryFetchJson<{ success: boolean; addedCount?: number; totalMaterials?: number; error?: string }>('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csvContent })
  });

  if (serverResult.success && serverResult.data?.success) {
    return serverResult.data;
  }

  // Fallback to local engine
  const localResult = clientEngine.uploadCsv(csvContent);
  persistLocalState();
  return localResult;
}

export async function sendBulkApprove(minConfidence: number = 85): Promise<{ success: boolean; approvedCount: number; error?: string }> {
  // Try backend first
  const serverResult = await tryFetchJson<{ success: boolean; approvedCount: number; error?: string }>('/api/admin/bulk-approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ minConfidence })
  });

  if (serverResult.success && serverResult.data?.success) {
    return serverResult.data;
  }

  // Fallback to local engine
  const localResult = clientEngine.bulkApprove(minConfidence);
  persistLocalState();
  return localResult;
}

export async function sendResetDatabase(): Promise<{ success: boolean }> {
  // Try backend first
  await tryFetchJson<{ success: boolean }>('/api/reset', {
    method: 'POST'
  });

  // Always reset local engine and clear localStorage
  clientEngine.reset();
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      persistLocalState();
    } catch (e) {}
  }

  return { success: true };
}
