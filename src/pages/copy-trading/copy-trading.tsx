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
  const [showLogs, setShowLogs] = useState(false)
  const [copySettings, setCopySettings] = useState({
    copyRatio: 1,
    maxAmount: 100,
    minAmount: 1,
  })

  const masterWsRef = useRef<WebSocket | null>(null)
  const clientsRef = useRef<ClientConnection[]>([])

  useEffect(() => {
    masterWsRef.current = masterWs
  }, [masterWs])

  useEffect(() => {
    clientsRef.current = clients
  }, [clients])

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)])
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
    if (data.error) {
      addLog(`❌ Master error: ${data.error.message}`)
      return
    }

    switch (data.msg_type) {
      case "authorize":
        setMasterAccount(data.authorize.loginid)
        setMasterBalance(data.authorize.balance)
        addLog(`✅ Master authorized: ${data.authorize.loginid}`)

        if (masterWsRef.current) {
          masterWsRef.current.send(JSON.stringify({ balance: 1, subscribe: 1 }))
          masterWsRef.current.send(JSON.stringify({ transaction: 1, subscribe: 1 }))
        }
        break

      case "balance":
        setMasterBalance(data.balance.balance)
        break

      case "transaction":
        if (data.transaction.action === "buy" && isActive) {
          addLog(`📈 Master trade detected: ${data.transaction.contract_type}`)
          replicateTradeToClients(data.transaction)
        }
        break

      case "buy":
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
        updateClient(clientId, { balance: data.balance.balance })
        break

      case "buy":
        updateClient(clientId, {
          lastTrade: data.buy,
          totalCopiedTrades: (clients.find((c) => c.id === clientId)?.totalCopiedTrades || 0) + 1,
        })
        addLog(`✅ Trade copied to client ${clientId}: ${data.buy.contract_id}`)
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
        let amount = tradeSignal.amount * copySettings.copyRatio
        amount = Math.max(copySettings.minAmount, Math.min(copySettings.maxAmount, amount))

        if (amount > client.balance) {
          addLog(`⚠️ Client ${client.id} insufficient balance for trade`)
          return
        }

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
      }
    })
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
              logs.slice(0, 10).map((log, index) => (
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

