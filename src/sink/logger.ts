import {TotalPlotsChangedEvent, TotalPlotsSubscriber} from '../chia-log/subscriber/total-plots-subscriber';
import {ChiaLogSubscriber, State} from '../chia-log/subscriber/chia-log-subscriber';
import {
  SignagePointSubscriber,
  SkippedSignagePointsEvent,
  StateChangedEvent
} from '../chia-log/subscriber/signage-point-subscriber';
import {make} from '../logging/logger';
import {
  PlotScanDurationStateChangedEvent,
  PlotScanDurationSubscriber
} from '../chia-log/subscriber/plot-scan-duration-subscriber';
import {Sink} from './sink';
import {ErrorEvent, ErrorSubscriber} from '../chia-log/subscriber/error-subscriber';

export class Logger implements Sink {
  private readonly totalPlotsLogger = make({ name: `${this.name} | Total Plots` });
  private readonly signagePointsLogger = make({ name: `${this.name} | Signage Points` });
  private readonly plotScanDurationLogger = make({ name: `${this.name} | Plot scan duration` });
  private readonly errorLogLogger = make({ name: `${this.name} | Error Log` });

  constructor(private readonly name: string) {}

  subscribeTo(source: ChiaLogSubscriber): void {
    if (source instanceof TotalPlotsSubscriber) {
      source.onChange(this.handleTotalPlotsChangedEvent.bind(this));
    } else if (source instanceof SignagePointSubscriber) {
      source.onChange(this.handleSignagePointStateChangedEvent.bind(this));
      source.onSkippedSignagePoints(this.handleSignagePointSkippedEvent.bind(this));
    } else if (source instanceof PlotScanDurationSubscriber) {
      source.onChange(this.handlePlotScanDurationStateChangedEvent.bind(this));
    } else if (source instanceof ErrorSubscriber) {
      source.onError(this.handleErrorEvent.bind(this));
    }
  }

  private handleTotalPlotsChangedEvent(event: TotalPlotsChangedEvent): void {
    switch (event.state) {
      case State.normal:
        this.totalPlotsLogger.info(`✔ Recovered from ${event.from} plots to ${event.to} plots.`);
        break;
      case State.degraded:
        if (event.from > event.to) {
          this.totalPlotsLogger.error(`❌ Degraded from ${event.from} plots to ${event.to} plots.`);
        } else {
          this.totalPlotsLogger.info(`❌ Increased from ${event.from} plots to ${event.to} plots.`);
        }
        break;
    }
  }

  private handleSignagePointStateChangedEvent(event: StateChangedEvent): void {
    switch (event.state) {
      case State.normal:
        this.signagePointsLogger.info(`✔ Signage points are being received normally again.`);
        break;
      case State.degraded:
        this.signagePointsLogger.error(`❌ No signage point received since ${event.lastSignagePoint.receivedAt.fromNow()}.`);
        break;
    }
  }

  private handleSignagePointSkippedEvent(event: SkippedSignagePointsEvent): void {
    this.signagePointsLogger.error(`❌ Skipped ${event.skipped} signage points from ${event.from.number} to ${event.to.number}. Took ${event.to.receivedAt.from(event.from.receivedAt, true)}.`);
  }

  private handlePlotScanDurationStateChangedEvent(event: PlotScanDurationStateChangedEvent): void {
    switch (event.state) {
      case State.normal:
        this.plotScanDurationLogger.info(`✔ Recovered from ${event.from.toFixed(3)} sec to ${event.to.toFixed(3)} sec.`);
        break;
      case State.degraded:
        this.plotScanDurationLogger.error(`❌ Degraded from ${event.from.toFixed(3)} sec to ${event.to.toFixed(3)} sec.`);
        break;
    }
  }

  private handleErrorEvent(event: ErrorEvent): void {
    this.errorLogLogger.error(`❌ Found error log entry: ${event.message}`);
  }
}
