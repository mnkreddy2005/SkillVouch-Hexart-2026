// Backend status monitoring service
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

class BackendStatusService {
  constructor() {
    this.isChecking = false;
    this.lastStatus = null;
    this.checkInterval = null;
  }

  // Check backend status once
  async checkStatus() {
    try {
      console.log('🔍 Checking backend status...');
      const response = await fetch(`${API_URL}/api/status`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const status = await response.json();
      this.lastStatus = status;
      
      console.log('📊 Backend Status Response:', status);
      console.log(`✅ Backend Status: ${status.status}`);
      console.log(`📈 Uptime: ${status.uptime}`);
      console.log(`🗄️  Database: ${status.services.database.connected ? '✅ Connected' : '❌ Disconnected'}`);
      console.log(`🤖 Mistral AI: ${status.services.mistral.connected ? '✅ Connected' : '❌ Disconnected'}`);
      console.log(`💾 Memory Usage: ${status.memory.used}MB / ${status.memory.total}MB`);
      
      return status;
    } catch (error) {
      console.error('❌ Backend status check failed:', error.message);
      console.log('🔗 Backend URL:', API_URL);
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Quick health check
  async checkHealth() {
    try {
      const response = await fetch(`${API_URL}/api/health`);
      const health = await response.json();
      
      console.log(`🏥 Backend Health: ${health.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
      console.log('📋 Health Checks:', health.checks);
      
      return health;
    } catch (error) {
      console.error('❌ Backend health check failed:', error.message);
      return { healthy: false, error: error.message };
    }
  }

  // Start continuous monitoring
  startMonitoring(intervalMs = 30000) {
    if (this.isChecking) {
      console.log('⚠️  Backend monitoring already active');
      return;
    }

    console.log(`🔄 Starting backend status monitoring (every ${intervalMs / 1000}s)`);
    this.isChecking = true;
    
    // Initial check
    this.checkStatus();
    
    // Set up interval
    this.checkInterval = setInterval(() => {
      this.checkStatus();
    }, intervalMs);
  }

  // Stop monitoring
  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      this.isChecking = false;
      console.log('⏹️  Backend status monitoring stopped');
    }
  }

  // Get last known status
  getLastStatus() {
    return this.lastStatus;
  }
}

// Export singleton instance
export const backendStatus = new BackendStatusService();

// Auto-start monitoring in development
if (import.meta.env.DEV) {
  console.log('🛠️  Development mode detected - starting backend monitoring');
  backendStatus.startMonitoring(30000); // Check every 30 seconds
}

// Export for manual usage
export default backendStatus;
