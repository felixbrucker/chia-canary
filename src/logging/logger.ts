import {Logger, ISettingsParam} from 'tslog'

export function make(options: ISettingsParam = {}): Logger {
  return new Logger({
    ...options,
    displayFunctionName: false,
    displayFilePath: 'hidden',
  })
}

export const defaultLogger = make()
