import {LogLevel, LogLine} from '../log-line-mapper'
import {State} from '../state'
import {filter, map, Observable, share} from 'rxjs'

export interface PlotScanDurationStateChangedEvent {
  state: State,
  from: number,
  to: number,
}

const regex = /Found ([0-9]*) proofs. Time: ([0-9.]*) s/

export const makePlotScanDurationStateChangedEventObservable = (logLines: Observable<LogLine>): Observable<PlotScanDurationStateChangedEvent> => {
  let currentStates: State = State.normal
  let lastPlotScanDurations: number[] = [0]

  const recordPlotScanDuration = (lastPlotScanDuration: number) => {
    lastPlotScanDurations.push(lastPlotScanDuration)
    lastPlotScanDurations = lastPlotScanDurations.slice(-3)
  }
  const determineState = (): State => {
    if (lastPlotScanDurations.every(lastPlotScanDuration => lastPlotScanDuration >= 25)) {
      return State.degraded
    }
    if (lastPlotScanDurations.every(lastPlotScanDuration => lastPlotScanDuration < 25)) {
      return State.normal
    }

    return currentStates
  }

  return logLines.pipe(
    filter(logLine => logLine.logLevel === LogLevel.info),
    map((logLine): PlotScanDurationStateChangedEvent|undefined => {
      const matches = logLine.message.match(regex)
      if (matches === null) {
        return
      }

      const firstPlotScanDuration = lastPlotScanDurations[0]
      const previousState = currentStates
      recordPlotScanDuration(parseFloat(matches[2]))
      const newState = determineState()
      if (previousState !== newState) {
        currentStates = newState

        return {
          state: currentStates,
          from: firstPlotScanDuration,
          to: lastPlotScanDurations[0],
        }
      }
    }),
    filter(event => event !== undefined),
    share(),
  )
}
