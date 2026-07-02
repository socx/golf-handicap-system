export type ImportJobType = 'players' | 'rounds';
export type ImportJobStatus = 'queued' | 'in_progress' | 'completed' | 'failed';

export interface ImportJob {
  jobId: string;
  type: ImportJobType;
  status: ImportJobStatus;
  totalRows: number;
  processedRows: number;
  importedRows: number;
  failedRows: number;
  errors: string[];
  adminUserId: string;
  adminEmail: string;
  startedAt: string;
  completedAt: string | null;
}

const importJobs = new Map<string, ImportJob>();

function generateImportJobId(type: ImportJobType): string {
  return `import_${type}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function createImportJob(params: {
  type: ImportJobType;
  totalRows: number;
  adminUserId: string;
  adminEmail: string;
}): ImportJob {
  const jobId = generateImportJobId(params.type);
  const job: ImportJob = {
    jobId,
    type: params.type,
    status: 'queued',
    totalRows: params.totalRows,
    processedRows: 0,
    importedRows: 0,
    failedRows: 0,
    errors: [],
    adminUserId: params.adminUserId,
    adminEmail: params.adminEmail,
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
  importJobs.set(jobId, job);
  return job;
}

export function getImportJob(jobId: string): ImportJob | null {
  return importJobs.get(jobId) ?? null;
}

export function listImportJobs(): ImportJob[] {
  return Array.from(importJobs.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
}
