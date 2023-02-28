import {filter, Observable, share} from 'rxjs'

import {LogLevel, LogLine} from '../log-line-mapper'

export interface ErrorEvent {
  message: string,
}

const defaultBlacklist = [
  'Failed to fetch block',
  'Proof of space has required iters',
  'Partial not good enough',
  'Error using prover object',
  'File: ',
]

export const makeErrorEventObservable = (logLines: Observable<LogLine>, blacklist: string[] = []): Observable<ErrorEvent> => {
  const mergedBlacklist = defaultBlacklist.concat(blacklist)

  return logLines.pipe(
    filter(logLine => logLine.logLevel === LogLevel.error),
    filter(logLine => mergedBlacklist.every(partialMatch => logLine.message.indexOf(partialMatch) === -1)),
    share(),
  )
}
