import { useState } from 'react'
import ConnectionForm from './components/ConnectionForm'
import Dashboard from './components/Dashboard'
import type { ConnectionConfig } from './types'
import './index.css'

function App() {
  const [isConnected, setIsConnected] = useState(false)
  const [config, setConfig] = useState<ConnectionConfig | null>(null)

  const handleConnect = (newConfig: ConnectionConfig) => {
    setConfig(newConfig)
    setIsConnected(true)
  }

  const handleDisconnect = () => {
    setIsConnected(false)
    setConfig(null)
  }

  if (!isConnected) {
    return <ConnectionForm onConnect={handleConnect} />
  }

  if (config) {
    return <Dashboard config={config} onDisconnect={handleDisconnect} />
  }

  return null
}

export default App
