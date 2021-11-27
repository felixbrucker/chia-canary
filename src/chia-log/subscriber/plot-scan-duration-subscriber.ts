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
  private lastPlotScanDuration = 0;

  public subscribeTo(observer: ChiaLogObserver): void {
    observer.onLogLine(this.handleLogLine.bind(this));
  }

  public get state(): State {
    return this.lastPlotScanDuration >= 25 ? State.degraded : State.normal;
  }

  public onChange(cb: (event: PlotScanDurationStateChangedEvent) => void): void {
    this.emitter.on('change', cb);
  }

  private handleLogLine(line: string): void {
    const matches = line.match(this.regex);
    if (!matches) {
      return;
    }

    const lastPlotScanDuration = this.lastPlotScanDuration;
    const previousState = this.state;
    this.lastPlotScanDuration = parseFloat(matches[2]);
    if (this.state !== previousState) {
      this.emitter.emit('change', {
        state: this.state,
        from: lastPlotScanDuration,
        to: this.lastPlotScanDuration,
      });
    }
  }
}
