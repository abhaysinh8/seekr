export interface HealthDependency {
  ping(): Promise<void>;
  close(): Promise<void>;
}
