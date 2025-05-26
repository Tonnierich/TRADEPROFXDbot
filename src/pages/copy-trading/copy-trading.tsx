"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { observer } from "mobx-react-lite"
import "./copy-trading.scss"

interface ClientConnection {
  id: string
  token: string
  ws: WebSocket | null
  status: "connecting" | "connected" | "disconnected" | "error"
  balance: number
  accountInfo: any
  lastTrade: any
  totalCopiedTrades: number
  totalProfit: number
}

interface TradeSignal {
  contract_type: string
  symbol: string
  amount: number
  duration: number
  duration_unit: string
  barrier?: string
  prediction?: number
}

const CopyTrading: React.FC = observer(() => {
  const [isActive, setIsActive] = useState(false)
  const [clientToken, setClientToken] = useState("")
  const [masterToken, setMasterToken] = useState("")
  const [clients, setClients] = useState<ClientConnection[]>([])
  const [masterWs, setMasterWs] = useState<WebSocket | null>(null)
  const [masterBalance, setMasterBalance] = useState(0)
  const [masterAccount, setMasterAccount] = useState("")
  const [isDemo, setIsDemo] = useState(true)
  const [logs, setLogs] = useState<string[]>([])
  const [copySettings, setCopySettings] = useState({
    copyRatio: 1, // 1:1 ratio by default
    maxAmount: 100, // Maximum amount per trade
    minAmount: 1, // Minimum amount per trade
    allowedSymbols: [] as string[], // Empty means all symbols allowed
    stopLoss: false,
    takeProfit: false,
  })

  const masterWsRef = useRef<WebSocket | null>(null)
  const clientsRef = useRef<ClientConnection[]>([])

  // Update refs when state changes
  useEffect(() => {
    masterWsRef.current = masterWs
  }, [masterWs])

  useEffect(() => {
    clientsRef.current = clients
  }, [clients])

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev.slice(0, 99)]) // Keep last 100 logs
  }

  // Connect to master account
  const connectMaster = async () => {
    if (!masterToken) {
      addLog("❌ Please enter master API token")
      return
    }

    try {
      const ws = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089")

      ws.onopen = () => {
        addLog("🔗 Connected to Deriv API")
        // Authorize master account
        ws.send(
          JSON.stringify({
            authorize: masterToken,
          }),
        )
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        handleMasterMessage(data)
      }

      ws.onerror = (error) => {
        addLog("❌ Master connection error")
        console.error("Master WebSocket error:", error)
      }

      ws.onclose = () => {
        addLog("🔌 Master connection closed")
        setMasterWs(null)
      }

      setMasterWs(ws)
    } catch (error) {
      addLog("❌ Failed to connect master account")
      console.error("Master connection error:", error)
    }
  }

  // Handle master account messages
  const handleMasterMessage = (data: any) => {
    if (data.error) {
      addLog(`❌ Master error: ${data.error.message}`)
      return
    }

    switch (data.msg_type) {
      case "authorize":
        setMasterAccount(data.authorize.loginid)
        setMasterBalance(data.authorize.balance)
        addLog(`✅ Master authorized: ${data.authorize.loginid}`)

        // Subscribe to balance updates
        if (masterWsRef.current) {
          masterWsRef.current.send(
            JSON.stringify({
              balance: 1,
              subscribe: 1,
            }),
          )

          // Subscribe to transaction stream to catch new trades
          masterWsRef.current.send(
            JSON.stringify({
              transaction: 1,
              subscribe: 1,
            }),
          )
        }
        break

      case "balance":
        setMasterBalance(data.balance.balance)
        break

      case "transaction":
        // This fires when master makes a trade
        if (data.transaction.action === "buy" && isActive) {
          addLog(`📈 Master trade detected: ${data.transaction.contract_type}`)
          replicateTradeToClients(data.transaction)
        }
        break

      case "buy":
        // Master trade executed
        if (isActive) {
          addLog(`🎯 Master trade executed: ${data.buy.contract_id}`)
          const tradeSignal: TradeSignal = {
            contract_type: data.echo_req.contract_type,
            symbol: data.echo_req.symbol,
            amount: data.echo_req.amount,
            duration: data.echo_req.duration,
            duration_unit: data.echo_req.duration_unit,
            barrier: data.echo_req.barrier,
            prediction: data.echo_req.prediction,
          }
          replicateTradeToClients(tradeSignal)
        }
        break
    }
  }

  // Add client connection
  const addClient = async () => {
    if (!clientToken.trim()) {
      addLog("❌ Please enter client token")
      return
    }

    if (clients.find((c) => c.token === clientToken.trim())) {
      addLog("❌ Client already added")
      return
    }

    const clientId = `client_${Date.now()}`
    const newClient: ClientConnection = {
      id: clientId,
      token: clientToken.trim(),
      ws: null,
      status: "connecting",
      balance: 0,
      accountInfo: null,
      lastTrade: null,
      totalCopiedTrades: 0,
      totalProfit: 0,
    }

    setClients((prev) => [...prev, newClient])
    setClientToken("")

    // Connect client
    connectClient(newClient)
  }

  // Connect individual client
  const connectClient = async (client: ClientConnection) => {
    try {
      const ws = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089")

      ws.onopen = () => {
        addLog(`🔗 Connecting client: ${client.id}`)
        ws.send(
          JSON.stringify({
            authorize: client.token,
          }),
        )
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        handleClientMessage(client.id, data)
      }

      ws.onerror = (error) => {
        addLog(`❌ Client ${client.id} connection error`)
        updateClientStatus(client.id, "error")
      }

      ws.onclose = () => {
        addLog(`🔌 Client ${client.id} disconnected`)
        updateClientStatus(client.id, "disconnected")
      }

      // Update client with WebSocket
      setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, ws } : c)))
    } catch (error) {
      addLog(`❌ Failed to connect client ${client.id}`)
      updateClientStatus(client.id, "error")
    }
  }

  // Handle client messages
  const handleClientMessage = (clientId: string, data: any) => {
    if (data.error) {
      addLog(`❌ Client ${clientId} error: ${data.error.message}`)
      updateClientStatus(clientId, "error")
      return
    }

    switch (data.msg_type) {
      case "authorize":
        updateClient(clientId, {
          status: "connected",
          balance: data.authorize.balance,
          accountInfo: data.authorize,
        })
        addLog(`✅ Client ${clientId} authorized: ${data.authorize.loginid}`)
        break

      case "balance":
        updateClient(clientId, {
          balance: data.balance.balance,
        })
        break

      case "buy":
        // Client trade executed
        updateClient(clientId, {
          lastTrade: data.buy,
          totalCopiedTrades: (clients.find((c) => c.id === clientId)?.totalCopiedTrades || 0) + 1,
        })
        addLog(`✅ Trade copied to client ${clientId}: ${data.buy.contract_id}`)
        break
    }
  }

  // Update client status
  const updateClientStatus = (clientId: string, status: ClientConnection["status"]) => {
    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, status } : c)))
  }

  // Update client data
  const updateClient = (clientId: string, updates: Partial<ClientConnection>) => {
    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, ...updates } : c)))
  }

  // Replicate trade to all connected clients
  const replicateTradeToClients = (tradeSignal: TradeSignal) => {
    const connectedClients = clientsRef.current.filter((c) => c.status === "connected" && c.ws)

    if (connectedClients.length === 0) {
      addLog("⚠️ No connected clients to replicate trade")
      return
    }

    addLog(`📤 Replicating trade to ${connectedClients.length} clients`)

    connectedClients.forEach((client) => {
      try {
        // Calculate amount based on copy ratio and client balance
        let amount = tradeSignal.amount * copySettings.copyRatio

        // Apply min/max limits
        amount = Math.max(copySettings.minAmount, Math.min(copySettings.maxAmount, amount))

        // Check if client has sufficient balance
        if (amount > client.balance) {
          addLog(`⚠️ Client ${client.id} insufficient balance for trade`)
          return
        }

        // Check if symbol is allowed
        if (copySettings.allowedSymbols.length > 0 && !copySettings.allowedSymbols.includes(tradeSignal.symbol)) {
          addLog(`⚠️ Symbol ${tradeSignal.symbol} not allowed for copying`)
          return
        }

        // Send trade to client
        const tradeRequest = {
          buy: 1,
          price: amount,
          parameters: {
            contract_type: tradeSignal.contract_type,
            symbol: tradeSignal.symbol,
            duration: tradeSignal.duration,
            duration_unit: tradeSignal.duration_unit,
            ...(tradeSignal.barrier && { barrier: tradeSignal.barrier }),
            ...(tradeSignal.prediction && { prediction: tradeSignal.prediction }),
          },
        }

        client.ws?.send(JSON.stringify(tradeRequest))
        addLog(`📈 Trade sent to client ${client.id}`)
      } catch (error) {
        addLog(`❌ Failed to replicate trade to client ${client.id}`)
        console.error("Trade replication error:", error)
      }
    })
  }

  // Remove client
  const removeClient = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId)
    if (client?.ws) {
      client.ws.close()
    }
    setClients((prev) => prev.filter((c) => c.id !== clientId))
    addLog(`🗑️ Client ${clientId} removed`)
  }

  // Start/Stop copy trading
  const toggleCopyTrading = () => {
    if (!masterWs) {
      addLog("❌ Master account not connected")
      return
    }

    if (clients.filter((c) => c.status === "connected").length === 0) {
      addLog("❌ No connected clients")
      return
    }

    setIsActive(!isActive)
    addLog(isActive ? "⏹️ Copy trading stopped" : "▶️ Copy trading started")
  }

  // Sync all clients
  const syncClients = () => {
    addLog("🔄 Syncing all clients...")
    clients.forEach((client) => {
      if (client.status === "disconnected" || client.status === "error") {
        connectClient(client)
      }
    })
  }

  // Disconnect all
  const disconnectAll = () => {
    if (masterWs) {
      masterWs.close()
    }
    clients.forEach((client) => {
      if (client.ws) {
        client.ws.close()
      }
    })
    setIsActive(false)
    addLog("🔌 All connections closed")
  }

  return (
    <div className="copy-trading">
      {/* Header Controls */}
      <div className="copy-trading__header">
        <div className="copy-trading__mode-toggle">
          <button className={`copy-trading__mode-btn ${isDemo ? "active" : ""}`} onClick={() => setIsDemo(true)}>
            📊 Demo Trading
          </button>
          <button className={`copy-trading__mode-btn ${!isDemo ? "active" : ""}`} onClick={() => setIsDemo(false)}>
            💰 Real Trading
          </button>
        </div>

        <div className="copy-trading__status">
          <span className={`copy-trading__status-indicator ${isActive ? "active" : "inactive"}`}>
            {isActive ? "🟢 ACTIVE" : "🔴 INACTIVE"}
          </span>
        </div>
      </div>

      {/* Master Account Setup */}
      <div className="copy-trading__master-section">
        <h3>🎯 Master Account (Signal Provider)</h3>
        <div className="copy-trading__master-setup">
          <input
            type="password"
            placeholder="Enter Master API Token"
            value={masterToken}
            onChange={(e) => setMasterToken(e.target.value)}
            className="copy-trading__token-input"
          />
          <button onClick={connectMaster} className="copy-trading__connect-btn" disabled={!masterToken || !!masterWs}>
            {masterWs ? "✅ Connected" : "🔗 Connect"}
          </button>
        </div>

        {masterWs && (
          <div className="copy-trading__master-info">
            <div className="copy-trading__account-card">
              <div className="copy-trading__account-id">📋 {masterAccount}</div>
              <div className="copy-trading__balance">💰 ${masterBalance.toFixed(2)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Copy Settings */}
      <div className="copy-trading__settings">
        <h3>⚙️ Copy Settings</h3>
        <div className="copy-trading__settings-grid">
          <div className="copy-trading__setting">
            <label>Copy Ratio</label>
            <input
              type="number"
              min="0.1"
              max="10"
              step="0.1"
              value={copySettings.copyRatio}
              onChange={(e) =>
                setCopySettings((prev) => ({
                  ...prev,
                  copyRatio: Number.parseFloat(e.target.value),
                }))
              }
            />
          </div>
          <div className="copy-trading__setting">
            <label>Max Amount ($)</label>
            <input
              type="number"
              min="1"
              value={copySettings.maxAmount}
              onChange={(e) =>
                setCopySettings((prev) => ({
                  ...prev,
                  maxAmount: Number.parseFloat(e.target.value),
                }))
              }
            />
          </div>
          <div className="copy-trading__setting">
            <label>Min Amount ($)</label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={copySettings.minAmount}
              onChange={(e) =>
                setCopySettings((prev) => ({
                  ...prev,
                  minAmount: Number.parseFloat(e.target.value),
                }))
              }
            />
          </div>
        </div>
      </div>

      {/* Client Management */}
      <div className="copy-trading__clients-section">
        <h3>👥 Client Accounts (Signal Receivers)</h3>

        <div className="copy-trading__add-client">
          <input
            type="password"
            placeholder="Enter Client API Token"
            value={clientToken}
            onChange={(e) => setClientToken(e.target.value)}
            className="copy-trading__token-input"
            onKeyPress={(e) => e.key === "Enter" && addClient()}
          />
          <button onClick={addClient} className="copy-trading__add-btn">
            ➕ Add Client
          </button>
          <button onClick={syncClients} className="copy-trading__sync-btn">
            🔄 Sync All
          </button>
        </div>

        <div className="copy-trading__clients-list">
          <div className="copy-trading__clients-header">
            <h4>
              Connected Clients: {clients.filter((c) => c.status === "connected").length}/{clients.length}
            </h4>
          </div>

          {clients.length === 0 ? (
            <div className="copy-trading__no-clients">
              No clients added yet. Add client API tokens to start copy trading.
            </div>
          ) : (
            clients.map((client) => (
              <div key={client.id} className="copy-trading__client-card">
                <div className="copy-trading__client-info">
                  <div className="copy-trading__client-header">
                    <span className="copy-trading__client-id">{client.accountInfo?.loginid || client.id}</span>
                    <span className={`copy-trading__client-status copy-trading__client-status--${client.status}`}>
                      {client.status}
                    </span>
                  </div>
                  <div className="copy-trading__client-details">
                    <span>💰 Balance: ${client.balance.toFixed(2)}</span>
                    <span>📈 Trades: {client.totalCopiedTrades}</span>
                    <span>💵 P&L: ${client.totalProfit.toFixed(2)}</span>
                  </div>
                </div>
                <button onClick={() => removeClient(client.id)} className="copy-trading__remove-btn">
                  🗑️
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Control Panel */}
      <div className="copy-trading__controls">
        <button
          onClick={toggleCopyTrading}
          className={`copy-trading__main-btn ${isActive ? "stop" : "start"}`}
          disabled={!masterWs || clients.filter((c) => c.status === "connected").length === 0}
        >
          {isActive ? "⏹️ Stop Copy Trading" : "▶️ Start Copy Trading"}
        </button>

        <button onClick={disconnectAll} className="copy-trading__disconnect-btn">
          🔌 Disconnect All
        </button>
      </div>

      {/* Activity Log */}
      <div className="copy-trading__logs">
        <h3>📋 Activity Log</h3>
        <div className="copy-trading__logs-container">
          {logs.length === 0 ? (
            <div className="copy-trading__no-logs">No activity yet...</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="copy-trading__log-entry">
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Risk Warning */}
      <div className="copy-trading__warning">
        ⚠️ <strong>Risk Warning:</strong> Copy trading involves significant risk. Past performance does not guarantee
        future results. Only trade with money you can afford to lose.
      </div>
    </div>
  )
})

export default CopyTrading
