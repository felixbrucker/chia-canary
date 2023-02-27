import {ChiaLogSubscriber} from './chia-log/subscriber/chia-log-subscriber'
import {ChiaLogObserver} from './chia-log/chia-log-observer'
import {Sink} from './sink/sink'

export class Canary {
  public static makeForLogFile(logFilePath: string): Canary {
    const chiaLogObserver = ChiaLogObserver.makeForLogFile(logFilePath)

    return new Canary(chiaLogObserver)
  }

  private readonly logObserver: ChiaLogObserver
  private readonly subscriber: ChiaLogSubscriber[] = []
  private readonly sinks: Sink[] = []

  private constructor(logObserver) {
    this.logObserver = logObserver
  }

  public addChiaLogSubscriber(...subscribers: ChiaLogSubscriber[]): void {
    subscribers.forEach(subscriber => {
      subscriber.subscribeTo(this.logObserver)
      this.sinks.forEach(sink => sink.subscribeTo(subscriber))
      this.subscriber.push(subscriber)
    })
  }

  public addSink(...sinks: Sink[]): void {
    sinks.forEach(sink => {
      this.subscriber.forEach(subscriber => sink.subscribeTo(subscriber))
      this.sinks.push(sink)
    })
  }
}
