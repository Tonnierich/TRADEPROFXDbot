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
  basis?: string
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
  const [showLogs, setShowLogs] = useState(false)
  const [copySettings, setCopySettings] = useState({
    copyRatio: 1,
    maxAmount: 100,
    minAmount: 1,
  })

  const masterWsRef = useRef<WebSocket | null>(null)
  const clientsRef = useRef<ClientConnection[]>([])
  const isActiveRef = useRef(false)

  useEffect(() => {
    masterWsRef.current = masterWs
  }, [masterWs])

  useEffect(() => {
    clientsRef.current = clients
  }, [clients])

  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)])
    console.log(`[CopyTrading] ${message}`) // Also log to console for debugging
  }

  const connectMaster = async () => {
    if (!masterToken) {
      addLog("❌ Please enter master API token")
      return
    }

    try {
      const ws = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089")

      ws.onopen = () => {
        addLog("🔗 Connected to Deriv API")
        ws.send(JSON.stringify({ authorize: masterToken }))
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        handleMasterMessage(data)
      }

      ws.onerror = () => {
        addLog("❌ Master connection error")
      }

      ws.onclose = () => {
        addLog("🔌 Master connection closed")
        setMasterWs(null)
      }

      setMasterWs(ws)
    } catch (error) {
      addLog("❌ Failed to connect master account")
    }
  }

  const handleMasterMessage = (data: any) => {
    console.log("Master message received:", data) // Debug log

    if (data.error) {
      addLog(`❌ Master error: ${data.error.message}`)
      return
    }

    switch (data.msg_type) {
      case "authorize":
        setMasterAccount(data.authorize.loginid)
        setMasterBalance(data.authorize.balance)
        addLog(`✅ Master authorized: ${data.authorize.loginid}`)

        // Subscribe to portfolio to monitor trades
        if (masterWsRef.current) {
          masterWsRef.current.send(
            JSON.stringify({
              portfolio: 1,
              subscribe: 1,
            }),
          )

          // Subscribe to balance updates
          masterWsRef.current.send(
            JSON.stringify({
              balance: 1,
              subscribe: 1,
            }),
          )

          // Subscribe to proposal_open_contract for real-time trade monitoring
          masterWsRef.current.send(
            JSON.stringify({
              proposal_open_contract: 1,
              subscribe: 1,
            }),
          )
        }
        break

      case "balance":
        setMasterBalance(data.balance.balance)
        break

      case "portfolio":
        // This fires when master's portfolio changes (new trades)
        if (data.portfolio && data.portfolio.contracts && isActiveRef.current) {
          const newContracts = data.portfolio.contracts.filter((contract: any) => {
            // Look for recently opened contracts (within last 30 seconds)
            const contractTime = new Date(contract.date_start * 1000)
            const now = new Date()
            const timeDiff = now.getTime() - contractTime.getTime()
            return timeDiff < 30000 && contract.contract_type // Recently opened
          })

          if (newContracts.length > 0) {
            newContracts.forEach((contract: any) => {
              addLog(`📈 Master trade detected: ${contract.contract_type} on ${contract.symbol}`)
              replicateTradeFromContract(contract)
            })
          }
        }
        break

      case "buy":
        // Direct buy response from master
        if (isActiveRef.current && data.buy) {
          addLog(`🎯 Master trade executed: ${data.buy.contract_id}`)
          const tradeSignal: TradeSignal = {
            contract_type: data.echo_req.contract_type,
            symbol: data.echo_req.symbol,
            amount: data.echo_req.amount || data.echo_req.price,
            duration: data.echo_req.duration,
            duration_unit: data.echo_req.duration_unit,
            barrier: data.echo_req.barrier,
            prediction: data.echo_req.prediction,
            basis: data.echo_req.basis || "stake",
          }
          replicateTradeToClients(tradeSignal)
        }
        break

      case "proposal_open_contract":
        // Monitor open contracts for new trades
        if (data.proposal_open_contract && isActiveRef.current) {
          const contract = data.proposal_open_contract
          if (contract.is_sold === 0) {
            // New open contract detected
            addLog(`📊 New contract opened: ${contract.contract_type} on ${contract.symbol}`)
          }
        }
        break
    }
  }

  const replicateTradeFromContract = (contract: any) => {
    const tradeSignal: TradeSignal = {
      contract_type: contract.contract_type,
      symbol: contract.symbol,
      amount: contract.buy_price,
      duration: contract.duration || 5, // Default duration if not available
      duration_unit: contract.duration_unit || "t", // Default to ticks
      barrier: contract.barrier,
      prediction: contract.prediction,
      basis: "stake",
    }

    replicateTradeToClients(tradeSignal)
  }

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
    connectClient(newClient)
  }

  const connectClient = async (client: ClientConnection) => {
    try {
      const ws = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089")

      ws.onopen = () => {
        addLog(`🔗 Connecting client: ${client.id}`)
        ws.send(JSON.stringify({ authorize: client.token }))
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        handleClientMessage(client.id, data)
      }

      ws.onerror = () => {
        addLog(`❌ Client ${client.id} connection error`)
        updateClientStatus(client.id, "error")
      }

      ws.onclose = () => {
        addLog(`🔌 Client ${client.id} disconnected`)
        updateClientStatus(client.id, "disconnected")
      }

      setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, ws } : c)))
    } catch (error) {
      addLog(`❌ Failed to connect client ${client.id}`)
      updateClientStatus(client.id, "error")
    }
  }

  const handleClientMessage = (clientId: string, data: any) => {
    console.log(`Client ${clientId} message:`, data) // Debug log

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

        // Subscribe to balance updates for this client
        const client = clientsRef.current.find((c) => c.id === clientId)
        if (client?.ws) {
          client.ws.send(
            JSON.stringify({
              balance: 1,
              subscribe: 1,
            }),
          )
        }
        break

      case "balance":
        updateClient(clientId, { balance: data.balance.balance })
        break

      case "buy":
        // Client trade executed successfully
        updateClient(clientId, {
          lastTrade: data.buy,
          totalCopiedTrades: (clients.find((c) => c.id === clientId)?.totalCopiedTrades || 0) + 1,
        })
        addLog(`✅ Trade copied to client ${clientId}: ${data.buy.contract_id}`)
        break

      case "buy_contract_for_multiple_accounts":
        // Handle multiple account buy response
        if (data.buy_contract_for_multiple_accounts) {
          addLog(`✅ Multi-account trade executed for client ${clientId}`)
        }
        break
    }
  }

  const updateClientStatus = (clientId: string, status: ClientConnection["status"]) => {
    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, status } : c)))
  }

  const updateClient = (clientId: string, updates: Partial<ClientConnection>) => {
    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, ...updates } : c)))
  }

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

        // Check if client has sufficient balance (with 10% buffer)
        if (amount > client.balance * 0.9) {
          addLog(`⚠️ Client ${client.id} insufficient balance for trade`)
          return
        }

        // Create the trade request with proper Deriv API format
        const tradeRequest = {
          buy: 1,
          price: amount,
          parameters: {
            contract_type: tradeSignal.contract_type,
            symbol: tradeSignal.symbol,
            duration: tradeSignal.duration,
            duration_unit: tradeSignal.duration_unit,
            basis: tradeSignal.basis || "stake",
            amount: amount,
            ...(tradeSignal.barrier && { barrier: tradeSignal.barrier }),
            ...(tradeSignal.prediction !== undefined && { prediction: tradeSignal.prediction }),
          },
        }

        console.log(`Sending trade to client ${client.id}:`, tradeRequest) // Debug log

        client.ws?.send(JSON.stringify(tradeRequest))
        addLog(`📈 Trade sent to client ${client.id}: ${tradeSignal.contract_type} $${amount}`)
      } catch (error) {
        addLog(`❌ Failed to replicate trade to client ${client.id}`)
        console.error("Trade replication error:", error)
      }
    })
  }

  // Test trade function for debugging
  const sendTestTrade = () => {
    if (!isActive) {
      addLog("❌ Copy trading not active")
      return
    }

    const testTrade: TradeSignal = {
      contract_type: "CALL",
      symbol: "R_50",
      amount: 1,
      duration: 5,
      duration_unit: "t",
      basis: "stake",
    }

    addLog("🧪 Sending test trade...")
    replicateTradeToClients(testTrade)
  }

  const removeClient = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId)
    if (client?.ws) {
      client.ws.close()
    }
    setClients((prev) => prev.filter((c) => c.id !== clientId))
    addLog(`🗑️ Client ${clientId} removed`)
  }

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

  const syncClients = () => {
    addLog("🔄 Syncing all clients...")
    clients.forEach((client) => {
      if (client.status === "disconnected" || client.status === "error") {
        connectClient(client)
      }
    })
  }

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
    <div className="copy-trading-compact">
      {/* Header */}
      <div className="ct-header">
        <div className="ct-mode-toggle">
          <button className={`ct-mode-btn ${isDemo ? "active" : ""}`} onClick={() => setIsDemo(true)}>
            📊 Demo
          </button>
          <button className={`ct-mode-btn ${!isDemo ? "active" : ""}`} onClick={() => setIsDemo(false)}>
            💰 Real
          </button>
        </div>
        <div className={`ct-status ${isActive ? "active" : "inactive"}`}>{isActive ? "🟢 ACTIVE" : "🔴 INACTIVE"}</div>
      </div>

      {/* Master Account */}
      <div className="ct-section">
        <h3>🎯 Master Account</h3>
        <div className="ct-input-row">
          <input
            type="password"
            placeholder="Master API Token"
            value={masterToken}
            onChange={(e) => setMasterToken(e.target.value)}
            className="ct-input"
          />
          <button onClick={connectMaster} className="ct-btn ct-btn-primary" disabled={!masterToken || !!masterWs}>
            {masterWs ? "✅ Connected" : "🔗 Connect"}
          </button>
        </div>
        {masterWs && (
          <div className="ct-account-info">
            <span>📋 {masterAccount}</span>
            <span>💰 ${masterBalance.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Copy Settings */}
      <div className="ct-section">
        <h3>⚙️ Copy Settings</h3>
        <div className="ct-settings-row">
          <div className="ct-setting">
            <label>Ratio</label>
            <input
              type="number"
              min="0.1"
              max="10"
              step="0.1"
              value={copySettings.copyRatio}
              onChange={(e) => setCopySettings((prev) => ({ ...prev, copyRatio: Number.parseFloat(e.target.value) }))}
              className="ct-input-small"
            />
          </div>
          <div className="ct-setting">
            <label>Max $</label>
            <input
              type="number"
              min="1"
              value={copySettings.maxAmount}
              onChange={(e) => setCopySettings((prev) => ({ ...prev, maxAmount: Number.parseFloat(e.target.value) }))}
              className="ct-input-small"
            />
          </div>
          <div className="ct-setting">
            <label>Min $</label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={copySettings.minAmount}
              onChange={(e) => setCopySettings((prev) => ({ ...prev, minAmount: Number.parseFloat(e.target.value) }))}
              className="ct-input-small"
            />
          </div>
        </div>
      </div>

      {/* Client Management */}
      <div className="ct-section">
        <h3>
          👥 Clients ({clients.filter((c) => c.status === "connected").length}/{clients.length})
        </h3>
        <div className="ct-input-row">
          <input
            type="password"
            placeholder="Client API Token"
            value={clientToken}
            onChange={(e) => setClientToken(e.target.value)}
            className="ct-input"
            onKeyPress={(e) => e.key === "Enter" && addClient()}
          />
          <button onClick={addClient} className="ct-btn ct-btn-secondary">
            ➕ Add
          </button>
          <button onClick={syncClients} className="ct-btn ct-btn-secondary">
            🔄 Sync
          </button>
        </div>

        {clients.length > 0 && (
          <div className="ct-clients-list">
            {clients.map((client) => (
              <div key={client.id} className="ct-client-item">
                <div className="ct-client-info">
                  <span className="ct-client-id">{client.accountInfo?.loginid || client.id.slice(-6)}</span>
                  <span className={`ct-client-status ct-status-${client.status}`}>
                    {client.status === "connected" ? "✅" : client.status === "connecting" ? "🔄" : "❌"}
                  </span>
                </div>
                <div className="ct-client-details">
                  <span>${client.balance.toFixed(2)}</span>
                  <span>{client.totalCopiedTrades} trades</span>
                </div>
                <button onClick={() => removeClient(client.id)} className="ct-btn-remove">
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="ct-controls">
        <button
          onClick={toggleCopyTrading}
          className={`ct-main-btn ${isActive ? "stop" : "start"}`}
          disabled={!masterWs || clients.filter((c) => c.status === "connected").length === 0}
        >
          {isActive ? "⏹️ Stop Copy Trading" : "▶️ Start Copy Trading"}
        </button>
        <button onClick={sendTestTrade} className="ct-btn ct-btn-secondary" disabled={!isActive}>
          🧪 Test Trade
        </button>
        <button onClick={() => setShowLogs(!showLogs)} className="ct-btn ct-btn-secondary">
          📋 {showLogs ? "Hide" : "Show"} Logs
        </button>
        <button onClick={disconnectAll} className="ct-btn ct-btn-danger">
          🔌 Disconnect
        </button>
      </div>

      {/* Activity Log (Collapsible) */}
      {showLogs && (
        <div className="ct-section">
          <h3>📋 Activity Log</h3>
          <div className="ct-logs">
            {logs.length === 0 ? (
              <div className="ct-no-logs">No activity yet...</div>
            ) : (
              logs.slice(0, 15).map((log, index) => (
                <div key={index} className="ct-log-entry">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Risk Warning */}
      <div className="ct-warning">
        ⚠️ <strong>Risk Warning:</strong> Copy trading involves significant risk. Only trade with money you can afford to
        lose.
      </div>
    </div>
  )
})

export default CopyTrading
