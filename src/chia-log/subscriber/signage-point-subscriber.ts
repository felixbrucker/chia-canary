import {EventEmitter} from 'events'
import moment from 'moment'
import {setTimeout, clearTimeout} from 'timers'

import {ChiaLogObserver} from '../chia-log-observer'
import {ChiaLogSubscriber, State} from './chia-log-subscriber'

export type StateChangedEvent = {
  state: State,
  lastSignagePoint: SignagePoint,
};

export type SkippedSignagePointsEvent = {
  from: SignagePoint,
  to: SignagePoint,
  skipped: number,
};

export class SignagePointSubscriber implements ChiaLogSubscriber {
  private readonly regex = /([0-9-]+T[0-9:.]+) full_node .*full_node.full_node\s?: INFO\s*(?:⏲️|.)[a-z A-Z,]* ([0-9]{1,2})\/64[:,]\s*(?:CC:\s*)?([a-f0-9]+)[\w\s,:\d-]*RC(?:\shash)*:\s*([a-f0-9]+)/
  private readonly emitter = new EventEmitter()
  private readonly maxLastSignagePoints = 128
  private lastSignagePoints: SignagePoint[] = []

  public subscribeTo(observer: ChiaLogObserver): void {
    observer.onLogLine(this.handleLogLine.bind(this))
  }

  public get state(): State {
    if (!this.lastSignagePoint) {
      return State.notRunning
    }

    return moment().diff(this.lastSignagePoint.receivedAt, 'seconds') < 60 ? State.normal : State.degraded
  }

  public get lastSignagePoint(): SignagePoint {
    if (this.lastSignagePoints.length === 0) {
      return null
    }

    return this.lastSignagePoints[this.lastSignagePoints.length - 1]
  }

  public set lastSignagePoint(signagePoint: SignagePoint) {
    this.lastSignagePoints.push(signagePoint)
    if (this.lastSignagePoints.length > this.maxLastSignagePoints) {
      this.lastSignagePoints = this.lastSignagePoints.slice(-this.maxLastSignagePoints)
    }
  }

  public onChange(cb: (event: StateChangedEvent) => void): void {
    this.emitter.on('change', cb)
  }

  public onSkippedSignagePoints(cb: (event: SkippedSignagePointsEvent) => void): void {
    this.emitter.on('skippedSignagePoints', cb)
  }

  private handleLogLine(line: string): void {
    const matches = line.match(this.regex)
    if (!matches) {
      return
    }

    const lastSignagePoint = new SignagePoint(
      parseInt(matches[2], 10),
      moment(matches[1]),
      matches[3],
      matches[4],
    )
    if (lastSignagePoint.isInDistantPast) {
      return
    }
    const previousState = this.state
    lastSignagePoint.onceExpired(() => {
      if (this.lastSignagePoint !== lastSignagePoint) {
        return
      }

      this.emitter.emit('change', {
        state: this.state,
        lastSignagePoint,
      })
    })
    if (!this.lastSignagePoint) {
      this.lastSignagePoint = lastSignagePoint

      return
    }

    if (!lastSignagePoint.isConsecutiveTo(this.lastSignagePoint) && !this.wasRolledBack(lastSignagePoint)) {
      this.emitter.emit('skippedSignagePoints', {
        from: this.lastSignagePoint,
        to: lastSignagePoint,
        skipped: lastSignagePoint.distanceTo(this.lastSignagePoint),
      })
    }

    this.lastSignagePoint.cancelTimer()
    this.lastSignagePoint = lastSignagePoint
    if (this.state !== previousState) {
      this.emitter.emit('change', {
        state: this.state,
        lastSignagePoint,
      })
    }
  }

  private wasRolledBack(signagePoint: SignagePoint): boolean {
    return this.lastSignagePoints.some(pastSignagePoint => (
      pastSignagePoint.number === signagePoint.number
      && pastSignagePoint.ccHash === signagePoint.ccHash
      && pastSignagePoint.rcHash !== signagePoint.rcHash
    ))
  }
}

class SignagePoint {
  public get isInDistantPast(): boolean {
    return this.receivedAt.isBefore(moment().subtract(10, 'minutes'))
  }

  private _timer: NodeJS.Timeout

  constructor(
    public readonly number: number,
    public readonly receivedAt: moment.Moment,
    public readonly ccHash: string,
    public readonly rcHash: string
  ) {}

  public isConsecutiveTo(other: SignagePoint, allowedDistanceToBeConsecutive = 2): boolean {
    return this.distanceTo(other) < allowedDistanceToBeConsecutive
  }

  public distanceTo(other: SignagePoint): number {
    if (this.number >= other.number) {
      return this.number - other.number
    }
    const scaledNumber = this.number + 64

    return scaledNumber - other.number
  }

  public onceExpired(cb: () => void): void {
    const diffInMs = this.receivedAt.clone().add(60, 'seconds').diff(moment())
    const timeoutInMs = diffInMs >= 0 ? diffInMs : 0
    this._timer = setTimeout(cb, timeoutInMs)
  }

  public cancelTimer(): void {
    if (!this._timer) {
      return
    }

    clearTimeout(this._timer)
  }
}
