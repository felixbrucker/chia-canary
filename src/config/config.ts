import {access, readFile, writeFile} from 'fs/promises';
import {dump, load} from 'js-yaml';

export class Config {
  public discordBotToken: string;
  public discordNotificationUserId: string;
  public machineName: string;

  private readonly configPath = 'config.yaml';

  public async load(): Promise<void> {
    const yaml = await readFile(this.configPath, 'utf8');
    const config = load(yaml);

    this.discordBotToken = config.discordBotToken;
    this.discordNotificationUserId = config.discordNotificationUserId;
    this.machineName = config.machineName;
  }

  public async save(): Promise<void> {
    const yaml = dump({
      discordBotToken: this.discordBotToken || '',
      discordNotificationUserId: this.discordNotificationUserId || '',
      machineName: this.machineName,
    }, { lineWidth: 140 });
    await writeFile(this.configPath, yaml, 'utf8');
  }

  public async isAccessible(): Promise<boolean> {
    try {
      await access(this.configPath);

      return true;
    } catch(err) {}

    return false;
  }
}
