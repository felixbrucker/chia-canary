import moment, {Moment} from 'moment'

export enum LogLevel {
  debug = 'DEBUG',
  info = 'INFO',
  warning = 'WARNING',
  error = 'ERROR',
  critical = 'CRITICAL',
}

export interface LogLine {
  date: Moment,
  service: string,
  file: string,
  logLevel: LogLevel,
  message: string,
}

const logLineRegex = /^([0-9-]+T[0-9:.]+) ([a-z]+) ([a-z.]+): ([A-Z]+) \s*(.*)$/
export const mapToLogLine = (line: string): LogLine|undefined => {
  const matches = line.match(logLineRegex)
  if (matches === null || matches.length !== 6) {
    return
  }

  return {
    date: moment(matches[1]),
    service: matches[2],
    file: matches[3],
    logLevel: matches[4] as LogLevel,
    message: matches[5],
  }
}
