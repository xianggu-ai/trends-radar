import { cli, Strategy } from '@jackwener/opencli/registry';
import * as command from './src/command';
import type { RunConfig } from './src/types';

export const collectOpenTrendsTabsCommand = cli({
  site: 'google',
  name: 'collect-open-trends-tabs',
  description: 'Collect rising related queries from manually opened Google Trends compare tabs',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    {
      name: 'min-rise',
      type: 'int',
      default: 2000,
      help: 'Minimum rising percentage to keep',
    },
  ],
  func: async (_page, kwargs) => command.runCollectOpenTrendsTabs(toRunConfig(kwargs)),
});

function toRunConfig(kwargs: Record<string, unknown>): RunConfig {
  return {
    minRise: Number(kwargs['min-rise'] ?? 2000),
  };
}
