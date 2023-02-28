import {ChiaLogObserver} from './chia-log/chia-log-observer'
import {makeErrorEventObservable} from './chia-log/stream-factory/error-event-factory'
import {
  makePlotScanDurationStateChangedEventObservable
} from './chia-log/stream-factory/plot-scan-duration-state-changed-event-factory'
import {makeTotalPlotsChangedEventObservable} from './chia-log/stream-factory/total-plots-changed-event-factory'
import {Config} from './config/config'
import {Logger} from './subscriber/logger'
import {LogFile} from './chia-log/chia-log-file-detector'
import {Discord} from './subscriber/discord'
import {hostname} from 'os'
import {Client} from 'discord.js'
import {makeDriveErrorEventObservable} from './chia-log/stream-factory/drive-error-event-factory'
import {Subscriber} from './subscriber/subscriber'

export class Canary {
  public static makeForLogFile(logFile: LogFile, config: Config, client: Client|undefined): Canary {
    const chiaLogObserver = ChiaLogObserver.makeForLogFile(logFile.path)
    const errorEvents = makeErrorEventObservable(chiaLogObserver.logLines, config.errorLogBlacklist)
    const plotScanDurationStateChangedEvents = makePlotScanDurationStateChangedEventObservable(chiaLogObserver.logLines)
    const totalPlotsChangedEvents = makeTotalPlotsChangedEventObservable(chiaLogObserver.logLines)
    const driveErrorEvents = makeDriveErrorEventObservable(chiaLogObserver.logLines)

    const consumer: Subscriber[] = [
      new Logger(
        logFile.name,
        errorEvents,
        plotScanDurationStateChangedEvents,
        totalPlotsChangedEvents,
        driveErrorEvents,
      ),
    ]
    if (client !== undefined && config.discordNotificationUserId) {
      consumer.push(new Discord(
        client,
        config.discordNotificationUserId,
        logFile.name,
        config.machineName || hostname(),
        errorEvents,
        plotScanDurationStateChangedEvents,
        totalPlotsChangedEvents,
        driveErrorEvents,
      ))
    }

    return new Canary(consumer)
  }

  private constructor(private readonly consumer: Subscriber[]) {}

  public shutdown() {
    this.consumer.forEach(consumer => consumer.shutdown())
  }
}
