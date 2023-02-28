import {LogLevel, LogLine} from '../log-line-mapper'
import {State} from '../state'
import {filter, map, Observable, pairwise, share, startWith} from 'rxjs'

export interface TotalPlotsChangedEvent {
  state: State,
  from: number,
  to: number,
}

const regex = /Total ([0-9]*) plots/

export const makeTotalPlotsChangedEventObservable = (logLines: Observable<LogLine>): Observable<TotalPlotsChangedEvent> => {
  const pastTotalPlotsStack: number[] = []

  const getState = (): State => pastTotalPlotsStack.length > 0 ? State.degraded : State.normal
  const getTopmostLastTotalPlots = (): number => {
    if (pastTotalPlotsStack.length === 0) {
      return 0
    }

    return pastTotalPlotsStack[pastTotalPlotsStack.length - 1]
  }

  return logLines.pipe(
    filter(logLine => logLine.logLevel === LogLevel.info),
    map((logLine): number|undefined => {
      const matches = logLine.message.match(regex)
      if (matches === null) {
        return
      }

      return parseInt(matches[1], 10)
    }),
    filter(plotCount => plotCount !== undefined),
    startWith(0),
    pairwise(),
    map(([previousPlotCount, currentPlotCount]): TotalPlotsChangedEvent|undefined => {
      let event: TotalPlotsChangedEvent|undefined
      if (currentPlotCount < previousPlotCount) {
        pastTotalPlotsStack.push(previousPlotCount)
        event = {
          state: getState(),
          from: previousPlotCount,
          to: currentPlotCount,
        }
      } else if (getState() === State.degraded && currentPlotCount >= getTopmostLastTotalPlots()) {
        while (currentPlotCount >= getTopmostLastTotalPlots() && pastTotalPlotsStack.length > 0) {
          pastTotalPlotsStack.pop()
        }
        event = {
          state: getState(),
          from: previousPlotCount,
          to: currentPlotCount,
        }
      }

      return event
    }),
    filter(event => event !== undefined),
    share(),
  )
}
