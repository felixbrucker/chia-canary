import { Tail } from 'tail'
import {filter, map, Observable, share, Subject} from 'rxjs'
import {LogLine, mapToLogLine} from './log-line-mapper'

export class ChiaLogObserver {
  public static makeForLogFile(logFilePath: string): ChiaLogObserver {
    return new ChiaLogObserver(logFilePath)
  }

  public readonly logLines: Observable<LogLine>

  private readonly tail: Tail
  private readonly logLinesSubject: Subject<string> = new Subject()

  private constructor(logFilePath: string) {
    this.tail = new Tail(logFilePath)
    this.logLines = this.logLinesSubject.pipe(
      map(mapToLogLine),
      filter(logLine => logLine !== undefined),
      share(),
    )
    this.tail.on('line', this.logLinesSubject.next.bind(this.logLinesSubject))
  }
}
