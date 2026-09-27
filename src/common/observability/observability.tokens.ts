/**
 * Observability integration points (S6-T08).
 * Wire Crashlytics / OpenTelemetry / Datadog later without changing call sites.
 */

export type MetricLabels = Record<string, string | number | boolean>;

export interface CrashReporter {
  recordError(error: unknown, context?: Record<string, unknown>): void;
  setUser(userId: string | null): void;
}

export interface MetricsSink {
  increment(name: string, labels?: MetricLabels): void;
  timing(name: string, ms: number, labels?: MetricLabels): void;
  gauge(name: string, value: number, labels?: MetricLabels): void;
}

export interface TracerSpan {
  setAttribute(key: string, value: string | number | boolean): void;
  end(): void;
}

export interface Tracer {
  startSpan(name: string, attrs?: MetricLabels): TracerSpan;
}

/** No-op defaults — safe in all environments. */
export class NoopCrashReporter implements CrashReporter {
  recordError(): void {}
  setUser(): void {}
}

export class NoopMetricsSink implements MetricsSink {
  increment(): void {}
  timing(): void {}
  gauge(): void {}
}

export class NoopTracer implements Tracer {
  startSpan(): TracerSpan {
    return { setAttribute() {}, end() {} };
  }
}

export const CRASH_REPORTER = Symbol('CRASH_REPORTER');
export const METRICS_SINK = Symbol('METRICS_SINK');
export const TRACER = Symbol('TRACER');
