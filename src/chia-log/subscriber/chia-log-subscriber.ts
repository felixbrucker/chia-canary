import {ChiaLogObserver} from '../chia-log-observer'

export interface ChiaLogSubscriber {
  subscribeTo(observer: ChiaLogObserver): void
}

export enum State {
  normal,
  degraded,
  notRunning,
}
