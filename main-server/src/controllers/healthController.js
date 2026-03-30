/**
 * Health Check Controller
 * 
 * Provides health check and server status endpoints.
 */

const os = require('os');

/**
 * Get server health status
 * GET /health
 */
async function getHealth(req, res) {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  const cpuLoad = os.loadavg();

  res.json({
    status: 'ok',
    message: 'Server is running',
    port: process.env.PORT,
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(uptime / 60)} minutes ${Math.floor(uptime % 60)} seconds`,
    memory: {
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`
    },
    system: {
      cpuLoad: cpuLoad.map(load => load.toFixed(2)),
      freeMemory: `${Math.round(os.freemem() / 1024 / 1024)} MB`,
      totalMemory: `${Math.round(os.totalmem() / 1024 / 1024)} MB`
    }
  });
}

module.exports = {
  getHealth
};
