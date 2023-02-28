import {LogLevel, LogLine} from '../log-line-mapper'
import {filter, map, Observable, share} from 'rxjs'
import {TtlCache} from '../../caching/ttl-cache'

export interface DriveErrorEvent {
  drivePath: string,
}

interface PlotFileError {
  drivePath: string
  plotFile: string
}

const regex = /^File: (.+)[\/\\](plot.*\.plot).*$/
const plotFileErrorThreshold = 5

export const makeDriveErrorEventObservable = (logLines: Observable<LogLine>): Observable<DriveErrorEvent> => {
  const drivesWithErrors: TtlCache = new TtlCache(5 * 60)

  return logLines.pipe(
    filter(logLine => logLine.logLevel === LogLevel.error),
    map((logLine): PlotFileError|undefined => {
      const matches = logLine.message.match(regex)
      if (matches === null) {
        return
      }

      return {
        drivePath: matches[1],
        plotFile: matches[2],
      }
    }),
    filter(plotFileError => plotFileError !== undefined),
    map(plotFileError => {
      const driveErrorCount: number = drivesWithErrors.get(plotFileError.drivePath) ?? 0
      const newDriveErrorCount = driveErrorCount + 1
      drivesWithErrors.set(plotFileError.drivePath, newDriveErrorCount)
      if (newDriveErrorCount === plotFileErrorThreshold) {
        return {
          drivePath: plotFileError.drivePath,
        }
      }
    }),
    filter(driveErrorEvent => driveErrorEvent !== undefined),
    share(),
  )
}
