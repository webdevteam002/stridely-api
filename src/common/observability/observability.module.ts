import { Global, Module } from '@nestjs/common';
import {
  CRASH_REPORTER,
  METRICS_SINK,
  TRACER,
  NoopCrashReporter,
  NoopMetricsSink,
  NoopTracer,
} from './observability.tokens';

@Global()
@Module({
  providers: [
    { provide: CRASH_REPORTER, useClass: NoopCrashReporter },
    { provide: METRICS_SINK, useClass: NoopMetricsSink },
    { provide: TRACER, useClass: NoopTracer },
  ],
  exports: [CRASH_REPORTER, METRICS_SINK, TRACER],
})
export class ObservabilityModule {}
