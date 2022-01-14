import {EventEmitter} from 'events';

import {ChiaLogObserver} from '../chia-log-observer';
import {ChiaLogSubscriber, State} from './chia-log-subscriber';

export type PlotScanDurationStateChangedEvent = {
  state: State,
  from: number,
  to: number,
};

export class PlotScanDurationSubscriber implements ChiaLogSubscriber {
  private readonly regex = /Found ([0-9]*) proofs. Time: ([0-9.]*) s/;
  private readonly emitter = new EventEmitter();
  private state: State = State.normal;
  private lastPlotScanDurations: number[] = [0];

  public subscribeTo(observer: ChiaLogObserver): void {
    observer.onLogLine(this.handleLogLine.bind(this));
  }

  public onChange(cb: (event: PlotScanDurationStateChangedEvent) => void): void {
    this.emitter.on('change', cb);
  }

  private get firstPlotScanDuration(): number {
    return this.lastPlotScanDurations[0];
  }

  private handleLogLine(line: string): void {
    const matches = line.match(this.regex);
    if (!matches) {
      return;
    }

    const firstPlotScanDuration = this.firstPlotScanDuration;
    const previousState = this.state;
    this.recordPlotScanDuration(parseFloat(matches[2]));
    const newState = this.determineState();
    if (previousState !== newState) {
      this.state = newState;
      this.emitter.emit('change', {
        state: this.state,
        from: firstPlotScanDuration,
        to: this.firstPlotScanDuration,
      });
    }
  }

  private recordPlotScanDuration(lastPlotScanDuration: number) {
    this.lastPlotScanDurations.push(lastPlotScanDuration);
    this.lastPlotScanDurations = this.lastPlotScanDurations.slice(-3);
  }

  private determineState(): State {
    if (this.lastPlotScanDurations.every(lastPlotScanDuration => lastPlotScanDuration >= 25)) {
      return State.degraded;
    }
    if (this.lastPlotScanDurations.every(lastPlotScanDuration => lastPlotScanDuration < 25)) {
      return State.normal;
    }

    return this.state;
  }
}
