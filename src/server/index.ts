/**
 * Express server with Socket.io for real-time dashboard
 */
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { database } from '../core/database.js';
import { Orchestrator } from '../core/orchestrator.js';
import { defaultConfig } from '../core/config.js';
import { log } from '../core/logger.js';

export class DashboardServer {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;
  private orchestrator: Orchestrator;
  private port: number;

  constructor(port: number = 3000) {
    this.port = port;
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    this.orchestrator = new Orchestrator(defaultConfig);
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(process.cwd(), 'public')));
  }

  private setupRoutes(): void {
    // Get all URLs
    this.app.get('/api/urls', async (req, res) => {
      try {
        const urls = await database.getAllURLs();
        res.json(urls);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch URLs' });
      }
    });

    // Get statistics
    this.app.get('/api/stats', async (req, res) => {
      try {
        const stats = await database.getStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
      }
    });

    // Get config
    this.app.get('/api/config', async (req, res) => {
      try {
        const config = await database.getConfig();
        res.json(config);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch config' });
      }
    });

    // Update config
    this.app.post('/api/config', async (req, res) => {
      try {
        await database.updateConfig(req.body);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: 'Failed to update config' });
      }
    });

    // Start scan
    this.app.post('/api/scan/start', async (req, res) => {
      try {
        this.orchestrator.scan().catch((err) => log.error('Scan error:', err));
        res.json({ success: true, message: 'Scan started' });
      } catch (error) {
        res.status(500).json({ error: 'Failed to start scan' });
      }
    });

    // Start monitoring
    this.app.post('/api/monitoring/start', async (req, res) => {
      try {
        const { interval } = req.body;
        await this.orchestrator.startMonitoring(interval || 5);
        res.json({ success: true, message: 'Monitoring started' });
      } catch (error) {
        res.status(500).json({ error: 'Failed to start monitoring' });
      }
    });

    // Stop monitoring
    this.app.post('/api/monitoring/stop', async (req, res) => {
      try {
        await this.orchestrator.stopMonitoring();
        res.json({ success: true, message: 'Monitoring stopped' });
      } catch (error) {
        res.status(500).json({ error: 'Failed to stop monitoring' });
      }
    });

    // Exclude/include URL
    this.app.post('/api/url/exclude', async (req, res) => {
      try {
        const { url, excluded } = req.body;
        await this.orchestrator.setURLExcluded(url, excluded);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: 'Failed to update URL' });
      }
    });

    // Delete single URL
    this.app.delete('/api/url/:url', async (req, res) => {
      try {
        const url = decodeURIComponent(req.params.url);
        await database.deleteURL(url);

        // Broadcast update
        const urls = await database.getAllURLs();
        this.io.emit('urls:update', urls);

        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: 'Failed to delete URL' });
      }
    });

    // Bulk delete URLs
    this.app.post('/api/urls/delete', async (req, res) => {
      try {
        const { urls } = req.body;

        if (!Array.isArray(urls)) {
          return res.status(400).json({ error: 'urls must be an array' });
        }

        await database.deleteURLs(urls);

        // Broadcast update
        const remainingUrls = await database.getAllURLs();
        this.io.emit('urls:update', remainingUrls);

        res.json({ success: true, deleted: urls.length });
      } catch (error) {
        res.status(500).json({ error: 'Failed to delete URLs' });
      }
    });

    // Get history
    this.app.get('/api/history', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit as string) || 20;
        const history = await database.getHistory(limit);
        res.json(history);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch history' });
      }
    });
  }

  private setupWebSocket(): void {
    this.io.on('connection', (socket) => {
      log.info('Client connected to WebSocket');

      // Send current state
      database.getAllURLs().then((urls) => {
        socket.emit('urls:update', urls);
      });

      database.getConfig().then((config) => {
        socket.emit('config:update', config);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        log.info('Client disconnected from WebSocket');
      });
    });

    // Forward orchestrator events to all clients
    this.orchestrator.on('scan:started', () => {
      this.io.emit('scan:started');
    });

    this.orchestrator.on('scan:progress', (data) => {
      this.io.emit('scan:progress', data);
    });

    this.orchestrator.on('scan:completed', (data) => {
      this.io.emit('scan:completed', data);
      // Send updated URLs
      database.getAllURLs().then((urls) => {
        this.io.emit('urls:update', urls);
      });
    });

    this.orchestrator.on('page:analyzed', (data) => {
      this.io.emit('page:analyzed', data);
    });

    this.orchestrator.on('url:excluded', (data) => {
      this.io.emit('url:excluded', data);
      database.getAllURLs().then((urls) => {
        this.io.emit('urls:update', urls);
      });
    });
  }

  async start(): Promise<void> {
    await database.init();

    this.server.listen(this.port, () => {
      log.info(`Dashboard server running at http://localhost:${this.port}`);
      console.log(`\n🚀 CSS Intelligence Platform Dashboard`);
      console.log(`   Open: http://localhost:${this.port}`);
      console.log(`\n   Press Ctrl+C to stop\n`);
    });
  }
}
