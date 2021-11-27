import {join} from 'path';
import {homedir} from 'os';
import {readdir, access} from 'fs/promises';
import {R_OK} from 'constants';

export type LogFile = {
  path: string,
  name: string,
}

export class ChiaLogFileDetector {
  async detect(): Promise<LogFile[]> {
    const possibleDirectoryNames = await this.getPossibleDirectoryNames();
    const possibleLogFiles = possibleDirectoryNames.map(directoryName => {
      const name = directoryName.replace('.', '');
      const capitalizedName = name[0].toUpperCase() + name.slice(1);

      return {
        path: join(this.baseDirectory, directoryName, 'mainnet', 'log', 'debug.log'),
        name: capitalizedName,
        accessible: false,
      };
    });
    const populatedLogFiles = await Promise.all(possibleLogFiles.map(async logFile => {
      try {
        await access(logFile.path, R_OK);
        logFile.accessible = true;
      } catch(err) {}

      return logFile;
    }));

    return populatedLogFiles
      .filter(logFile => logFile.accessible)
      .map(logFile => ({
        path: logFile.path,
        name: logFile.name,
      }));
  }

  async getPossibleDirectoryNames(): Promise<string[]> {
    const directoryEntries = await readdir(this.baseDirectory, { withFileTypes: true });

    return directoryEntries
      .filter(entry => entry.isDirectory() && entry.name.startsWith('.'))
      .map(entry => entry.name);
  }

  private get baseDirectory(): string {
    return homedir();
  }
}
