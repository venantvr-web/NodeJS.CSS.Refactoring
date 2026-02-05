#!/usr/bin/env node
/**
 * CLI Entry Point
 */
import { Command } from 'commander';
import { DashboardServer } from './server/index.js';
import { database } from './core/database.js';
import { log } from './core/logger.js';

const program = new Command();

program
  .name('css-audit')
  .description('CSS Intelligence Platform - Real-time CSS monitoring and analysis')
  .version('0.1.0');

program
  .command('serve')
  .description('Start the dashboard server')
  .option('-p, --port <port>', 'Port to run server on', '3000')
  .option('-u, --url <url>', 'Base URL to monitor')
  .action(async (options) => {
    try {
      await database.init();

      // Set base URL if provided
      if (options.url) {
        await database.setBaseUrl(options.url);
        log.info(`Base URL set to: ${options.url}`);
      }

      const port = parseInt(options.port);
      const server = new DashboardServer(port);
      await server.start();
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  });

program.parse();
