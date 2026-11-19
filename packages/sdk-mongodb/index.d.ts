export class RecoveraError extends Error {
  status: number;
  code: string;
}
export interface RecoveraOptions {
  apiKey: string;
  baseURL?: string;
  timeout?: number;
}
export class Recovera {
  constructor(options: RecoveraOptions);
  registerBackup(data: object): Promise<any>;
  listBackups(): Promise<any>;
  getBackup(id: string): Promise<any>;
  getApplication(): Promise<any>;
  verifyBackup(id: string, options?: object): Promise<any>;
  listVerificationJobs(): Promise<any>;
  getVerificationJob(id: string): Promise<any>;
  getVerificationReport(id: string): Promise<any>;
  recordDeletion(data: {
    collection: string;
    recordId: string;
    identifierType?: "string" | "objectId";
    deletedAt?: Date;
    metadata?: object;
  }): Promise<any>;
  listDeletionRecords(query?: object): Promise<any>;
  listReports(query?: object): Promise<any>;
  getReport(id: string): Promise<any>;
  getStatistics(): Promise<any>;
}
export function createDeletionTrackingPlugin(
  recovera: Recovera,
  options: { collection: string; identifierType?: "string" | "objectId" },
): Function;
