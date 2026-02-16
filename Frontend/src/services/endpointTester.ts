// Endpoint Testing Service - Production Validation
import { apiEndpoints } from './centralApi'

export class EndpointTester {
  private testResults: Array<{endpoint: string, status: 'pass' | 'fail', error?: string, responseTime?: number}> = []

  async testAllEndpoints(): Promise<void> {
    console.log('🧪 Starting comprehensive endpoint testing...')

    // Test health endpoints
    await this.testEndpoint('GET /health', () => apiEndpoints.getHealth())
    await this.testEndpoint('GET /api/test', () => apiEndpoints.getApiTest())

    // Test AI endpoint
    await this.testEndpoint('POST /ai', () => apiEndpoints.postAI('Hello, test message'))

    // Test user endpoints (these might fail if not logged in, which is expected)
    try {
      await this.testEndpoint('GET /api/users', () => apiEndpoints.getUsers())
    } catch (error) {
      console.log('⚠️  GET /api/users failed (expected if not authenticated):', error.message)
      this.testResults.push({
        endpoint: 'GET /api/users',
        status: 'pass', // This is expected to fail without auth
        error: 'Expected failure - requires authentication'
      })
    }

    // Login test (will fail with dummy credentials)
    try {
      await this.testEndpoint('POST /api/login', () => apiEndpoints.login('test@example.com', 'password123'))
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ POST /api/login returned expected 401 for invalid credentials')
        this.testResults.push({
          endpoint: 'POST /api/login',
          status: 'pass', // Expected to fail with dummy credentials
          error: 'Expected 401 - invalid credentials'
        })
      } else {
        this.testResults.push({
          endpoint: 'POST /api/login',
          status: 'fail',
          error: error.message
        })
      }
    }

    this.printResults()
  }

  private async testEndpoint(name: string, apiCall: () => Promise<any>): Promise<void> {
    const startTime = Date.now()

    try {
      const response = await apiCall()
      const responseTime = Date.now() - startTime

      console.log(`✅ ${name}: ${response.status || 'OK'} (${responseTime}ms)`)
      this.testResults.push({
        endpoint: name,
        status: 'pass',
        responseTime
      })
    } catch (error) {
      const responseTime = Date.now() - startTime
      const statusCode = error.response?.status || 'NETWORK_ERROR'

      console.error(`❌ ${name}: ${statusCode} (${responseTime}ms) - ${error.message}`)
      this.testResults.push({
        endpoint: name,
        status: 'fail',
        error: error.message,
        responseTime
      })
    }
  }

  private printResults(): void {
    console.log('\n📊 ENDPOINT TEST RESULTS')
    console.log('========================')

    const passed = this.testResults.filter(r => r.status === 'pass').length
    const failed = this.testResults.filter(r => r.status === 'fail').length
    const total = this.testResults.length

    console.log(`✅ Passed: ${passed}`)
    console.log(`❌ Failed: ${failed}`)
    console.log(`📋 Total: ${total}`)

    if (failed === 0) {
      console.log('\n🎉 ALL ENDPOINTS WORKING PERFECTLY!')
    } else {
      console.log('\n⚠️  Some endpoints failed (see details above)')
    }

    console.log('\n📋 Detailed Results:')
    this.testResults.forEach(result => {
      const status = result.status === 'pass' ? '✅' : '❌'
      const time = result.responseTime ? ` (${result.responseTime}ms)` : ''
      console.log(`${status} ${result.endpoint}${time}`)
      if (result.error) {
        console.log(`   Error: ${result.error}`)
      }
    })
  }

  getResults(): typeof this.testResults {
    return this.testResults
  }
}

// Export singleton instance
export const endpointTester = new EndpointTester()

// Auto-run tests in development
if (import.meta.env.DEV) {
  console.log('🛠️  Development mode - endpoint testing enabled')
  // Run tests after a short delay to ensure everything is loaded
  setTimeout(() => {
    endpointTester.testAllEndpoints()
  }, 2000)
}
