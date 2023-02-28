import {make} from '../logging/logger'
import {Observable, Subscription} from 'rxjs'
import {ErrorEvent} from '../chia-log/stream-factory/error-event-factory'
import {
  PlotScanDurationStateChangedEvent
} from '../chia-log/stream-factory/plot-scan-duration-state-changed-event-factory'
import {TotalPlotsChangedEvent} from '../chia-log/stream-factory/total-plots-changed-event-factory'
import {State} from '../chia-log/state'
import {DriveErrorEvent} from '../chia-log/stream-factory/drive-error-event-factory'
import {Subscriber} from './subscriber'

export class Logger implements Subscriber {
  private readonly totalPlotsLogger = make({ name: `${this.name} | Total Plots` })
  private readonly plotScanDurationLogger = make({ name: `${this.name} | Plot scan duration` })
  private readonly errorLogLogger = make({ name: `${this.name} | Error Log` })
  private readonly driveErrorLogger = make({ name: `${this.name} | Drive error` })

  private readonly subscriptions: Subscription[]

  public constructor(
    private readonly name: string,
    errorEventStream: Observable<ErrorEvent>,
    plotScanDurationStateChangedEvents: Observable<PlotScanDurationStateChangedEvent>,
    totalPlotsChangedEvents: Observable<TotalPlotsChangedEvent>,
    driveErrorEvents: Observable<DriveErrorEvent>,
  ) {
    this.subscriptions = [
      errorEventStream.subscribe(this.handleErrorEvent.bind(this)),
      plotScanDurationStateChangedEvents.subscribe(this.handlePlotScanDurationStateChangedEvent.bind(this)),
      totalPlotsChangedEvents.subscribe(this.handleTotalPlotsChangedEvent.bind(this)),
      driveErrorEvents.subscribe(this.handleDriveErrorEvent.bind(this)),
    ]
  }

  public shutdown() {
    this.subscriptions.forEach(subscription => subscription.unsubscribe())
  }

  private handleDriveErrorEvent(event: DriveErrorEvent): void {
    this.driveErrorLogger.error(`❌ Drive ${event.drivePath} encountered multiple errors.`)
  }

  private handleTotalPlotsChangedEvent(event: TotalPlotsChangedEvent): void {
    switch (event.state) {
      case State.normal:
        this.totalPlotsLogger.info(`✔ Recovered from ${event.from} plots to ${event.to} plots.`)
        break
      case State.degraded:
        if (event.from > event.to) {
          this.totalPlotsLogger.error(`❌ Degraded from ${event.from} plots to ${event.to} plots.`)
        } else {
          this.totalPlotsLogger.info(`❌ Increased from ${event.from} plots to ${event.to} plots.`)
        }
        break
    }
  }

  private handlePlotScanDurationStateChangedEvent(event: PlotScanDurationStateChangedEvent): void {
    switch (event.state) {
      case State.normal:
        this.plotScanDurationLogger.info(`✔ Recovered from ${event.from.toFixed(3)} sec to ${event.to.toFixed(3)} sec.`)
        break
      case State.degraded:
        this.plotScanDurationLogger.error(`❌ Degraded from ${event.from.toFixed(3)} sec to ${event.to.toFixed(3)} sec.`)
        break
    }
  }

  private handleErrorEvent(event: ErrorEvent): void {
    this.errorLogLogger.error(`❌ Found error log entry: ${event.message}`)
  }
}
