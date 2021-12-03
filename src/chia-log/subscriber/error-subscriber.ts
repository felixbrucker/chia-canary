import {EventEmitter} from 'events';
import moment from 'moment';

import {ChiaLogObserver} from '../chia-log-observer';
import {ChiaLogSubscriber} from './chia-log-subscriber';

export type ErrorEvent = {
  date: moment.Moment,
  message: string,
};

export class ErrorSubscriber implements ChiaLogSubscriber {
  private readonly regex = /([0-9-]+T[0-9:.]+) .*\s?: ERROR\s*(.*)/;
  private readonly emitter = new EventEmitter();

  private readonly blacklist = [
    'Failed to fetch block',
    'Proof of space has required iters',
    'Partial not good enough',
  ];

  public subscribeTo(observer: ChiaLogObserver): void {
    observer.onLogLine(this.handleLogLine.bind(this));
  }

  public onError(cb: (event: ErrorEvent) => void): void {
    this.emitter.on('message', cb);
  }

  private handleLogLine(line: string): void {
    const matches = line.match(this.regex);
    if (!matches) {
      return;
    }
    const message = matches[2];
    if (this.blacklist.some(partialMatch => message.indexOf(partialMatch) !== -1)) {
      return;
    }

    this.emitter.emit('message', {
      date: moment(matches[1]),
      message,
    });
  }
}
