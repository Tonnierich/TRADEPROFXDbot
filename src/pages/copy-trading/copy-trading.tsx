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

interface TradeParams {
  contract_type: string
  symbol: string
  amount: number
  duration: number
  duration_unit: string
  basis: string
  currency: string
  barrier?: string
  barrier2?: string
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
  const [showLogs, setShowLogs] = useState(true) // Show logs by default for debugging
  const [copySettings, setCopySettings] = useState({
    copyRatio: 1,
    maxAmount: 100,
    minAmount: 1,
  })

  const masterWsRef = useRef<WebSocket | null>(null)
  const clientsRef = useRef<ClientConnection[]>([])
  const isActiveRef = useRef(false)
  const lastBalanceRef = useRef<number>(0)
  const processedContractsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    masterWsRef.current = masterWs
  }, [masterWs])

  useEffect(() => {
    clientsRef.current = clients
  }, [clients])

  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  const addLog = (message: string, type: "info" | "success" | "error" | "warning" = "info") => {
    const timestamp = new Date().toLocaleTimeString()
    const emoji = type === "success" ? "✅" : type === "error" ? "❌" : type === "warning" ? "⚠️" : "ℹ️"
    const logMessage = `[${timestamp}] ${emoji} ${message}`
    setLogs((prev) => [logMessage, ...prev.slice(0, 49)]) // Keep last 50 logs
    console.log(`[CopyTrading] ${message}`)
  }

  const connectMaster = async () => {
    if (!masterToken) {
      addLog("Please enter master API token", "error")
      return
    }

    try {
      addLog("Connecting to master account...")
      const ws = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089")

      ws.onopen = () => {
        addLog("Master WebSocket connected, authorizing...")
        ws.send(
          JSON.stringify({
            authorize: masterToken,
            req_id: 1,
          }),
        )
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        handleMasterMessage(data)
      }

      ws.onerror = (error) => {
        addLog("Master WebSocket connection error", "error")
        console.error("Master WebSocket error:", error)
      }

      ws.onclose = () => {
        addLog("Master WebSocket connection closed", "warning")
        setMasterWs(null)
      }

      setMasterWs(ws)
    } catch (error) {
      addLog("Failed to connect master account", "error")
      console.error("Master connection error:", error)
    }
  }

  const handleMasterMessage = (data: any) => {
    console.log("🔍 Master message:", data)

    if (data.error) {
      addLog(`Master API error: ${data.error.message}`, "error")
      return
    }

    switch (data.msg_type) {
      case "authorize":
        setMasterAccount(data.authorize.loginid)
        setMasterBalance(data.authorize.balance)
        lastBalanceRef.current = data.authorize.balance
        addLog(`Master authorized: ${data.authorize.loginid} ($${data.authorize.balance})`, "success")

        // Subscribe to essential streams
        if (masterWsRef.current) {
          // Portfolio for new contracts
          masterWsRef.current.send(
            JSON.stringify({
              portfolio: 1,
              subscribe: 1,
              req_id: 2,
            }),
          )

          // Balance changes
          masterWsRef.current.send(
            JSON.stringify({
              balance: 1,
              subscribe: 1,
              req_id: 3,
            }),
          )

          addLog("Subscribed to master portfolio and balance streams", "success")
        }
        break

      case "balance":
        const newBalance = data.balance.balance
        const balanceChange = newBalance - lastBalanceRef.current

        if (Math.abs(balanceChange) > 0.01 && isActiveRef.current) {
          setMasterBalance(newBalance)
          lastBalanceRef.current = newBalance

          if (balanceChange < 0) {
            addLog(`Trade detected! Balance: $${lastBalanceRef.current.toFixed(2)} → $${newBalance.toFixed(2)}`, "info")
            // Get portfolio to find the new trade
            if (masterWsRef.current) {
              masterWsRef.current.send(
                JSON.stringify({
                  portfolio: 1,
                  req_id: 4,
                }),
              )
            }
          }
        }
        break

      case "portfolio":
        if (data.portfolio && data.portfolio.contracts && isActiveRef.current) {
          const contracts = data.portfolio.contracts

          // Find the most recent contract (within last 30 seconds)
          const recentContracts = contracts.filter((contract: any) => {
            const contractTime = new Date(contract.date_start * 1000)
            const now = new Date()
            const timeDiff = now.getTime() - contractTime.getTime()
            return timeDiff < 30000 && !processedContractsRef.current.has(contract.contract_id.toString())
          })

          if (recentContracts.length > 0) {
            const latestContract = recentContracts[0] // Get the most recent
            const contractId = latestContract.contract_id.toString()

            processedContractsRef.current.add(contractId)
            addLog(`New contract found: ${latestContract.contract_type} on ${latestContract.symbol}`, "info")

            // Extract trade parameters
            const tradeParams: TradeParams = {
              contract_type: latestContract.contract_type,
              symbol: latestContract.symbol,
              amount: latestContract.buy_price,
              duration: latestContract.duration || 5,
              duration_unit: latestContract.duration_unit || "t",
              basis: "stake",
              currency: latestContract.currency || "USD",
            }

            // Add optional parameters
            if (latestContract.barrier) tradeParams.barrier = latestContract.barrier
            if (latestContract.barrier2) tradeParams.barrier2 = latestContract.barrier2
            if (latestContract.prediction !== undefined) tradeParams.prediction = latestContract.prediction

            // CRITICAL FIX: For digit contracts, ensure prediction is included
            if (
              latestContract.contract_type &&
              (latestContract.contract_type.includes("DIGIT") ||
                latestContract.contract_type.includes("MATCH") ||
                latestContract.contract_type.includes("DIFF"))
            ) {
              // If prediction is missing, try to extract from contract details
              if (tradeParams.prediction === undefined) {
                // Try to get prediction from contract shortcode or other fields
                if (latestContract.shortcode) {
                  const shortcodeParts = latestContract.shortcode.split("_")
                  const predictionPart = shortcodeParts.find((part) => /^\d$/.test(part))
                  if (predictionPart) {
                    tradeParams.prediction = Number.parseInt(predictionPart)
                    addLog(`Extracted prediction from shortcode: ${tradeParams.prediction}`, "info")
                  }
                }

                // If still no prediction, use a default based on contract type
                if (tradeParams.prediction === undefined) {
                  tradeParams.prediction = latestContract.contract_type.includes("UNDER") ? 4 : 6
                  addLog(
                    `Using default prediction for ${latestContract.contract_type}: ${tradeParams.prediction}`,
                    "warning",
                  )
                }
              }
            }

            addLog(`Replicating trade: ${JSON.stringify(tradeParams)}`, "info")
            replicateTradeToClients(tradeParams)
          }
        }
        break

      case "buy":
        // Direct buy confirmation from master
        if (data.buy && isActiveRef.current) {
          addLog(`Master trade executed: ${data.buy.contract_id}`, "success")
        }
        break
    }
  }

  const addClient = async () => {
    if (!clientToken.trim()) {
      addLog("Please enter client token", "error")
      return
    }

    if (clients.find((c) => c.token === clientToken.trim())) {
      addLog("Client already added", "warning")
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
      addLog(`Connecting client ${client.id}...`)
      const ws = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089")

      ws.onopen = () => {
        addLog(`Client ${client.id} WebSocket connected, authorizing...`)
        ws.send(
          JSON.stringify({
            authorize: client.token,
            req_id: Math.floor(Math.random() * 1000000),
          }),
        )
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        handleClientMessage(client.id, data)
      }

      ws.onerror = (error) => {
        addLog(`Client ${client.id} WebSocket error`, "error")
        updateClientStatus(client.id, "error")
        console.error(`Client ${client.id} error:`, error)
      }

      ws.onclose = () => {
        addLog(`Client ${client.id} WebSocket closed`, "warning")
        updateClientStatus(client.id, "disconnected")
      }

      setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, ws } : c)))
    } catch (error) {
      addLog(`Failed to connect client ${client.id}`, "error")
      updateClientStatus(client.id, "error")
    }
  }

  const handleClientMessage = (clientId: string, data: any) => {
    console.log(`👤 Client ${clientId} message:`, data)

    if (data.error) {
      addLog(`Client ${clientId} error: ${data.error.message}`, "error")
      if (data.error.code === "InvalidToken") {
        updateClientStatus(clientId, "error")
      }
      return
    }

    switch (data.msg_type) {
      case "authorize":
        updateClient(clientId, {
          status: "connected",
          balance: data.authorize.balance,
          accountInfo: data.authorize,
        })
        addLog(`Client ${clientId} authorized: ${data.authorize.loginid} ($${data.authorize.balance})`, "success")

        // Subscribe to balance updates
        const client = clientsRef.current.find((c) => c.id === clientId)
        if (client?.ws) {
          client.ws.send(
            JSON.stringify({
              balance: 1,
              subscribe: 1,
              req_id: Math.floor(Math.random() * 1000000),
            }),
          )
        }
        break

      case "balance":
        updateClient(clientId, { balance: data.balance.balance })
        addLog(`Client ${clientId} balance updated: $${data.balance.balance.toFixed(2)}`)
        break

      case "proposal":
        if (data.proposal && data.proposal.id) {
          const client = clientsRef.current.find((c) => c.id === clientId)
          if (client?.ws) {
            addLog(`Client ${clientId} proposal received, executing buy...`)
            client.ws.send(
              JSON.stringify({
                buy: data.proposal.id,
                price: data.proposal.ask_price,
                req_id: Math.floor(Math.random() * 1000000),
              }),
            )
          }
        } else if (data.proposal && data.proposal.error) {
          addLog(`Client ${clientId} proposal error: ${data.proposal.error}`, "error")
        }
        break

      case "buy":
        if (data.buy) {
          updateClient(clientId, {
            lastTrade: data.buy,
            totalCopiedTrades: (clients.find((c) => c.id === clientId)?.totalCopiedTrades || 0) + 1,
          })
          addLog(`TRADE COPIED to client ${clientId}: ${data.buy.contract_id}`, "success")
        } else if (data.buy && data.buy.error) {
          addLog(`Client ${clientId} buy error: ${data.buy.error}`, "error")
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

  const replicateTradeToClients = (tradeParams: TradeParams) => {
    const connectedClients = clientsRef.current.filter((c) => c.status === "connected" && c.ws)

    if (connectedClients.length === 0) {
      addLog("No connected clients to replicate trade", "warning")
      return
    }

    addLog(`Replicating trade to ${connectedClients.length} client(s)`, "info")

    connectedClients.forEach((client, index) => {
      setTimeout(() => {
        try {
          // Calculate amount with copy ratio and limits
          let amount = tradeParams.amount * copySettings.copyRatio
          amount = Math.max(copySettings.minAmount, Math.min(copySettings.maxAmount, amount))

          // Check client balance (leave 20% buffer)
          if (amount > client.balance * 0.8) {
            addLog(`Client ${client.id} insufficient balance for $${amount} trade`, "warning")
            return
          }

          // Create proposal request
          const proposalRequest: any = {
            proposal: 1,
            amount: amount,
            basis: tradeParams.basis,
            contract_type: tradeParams.contract_type,
            currency: tradeParams.currency,
            symbol: tradeParams.symbol,
            duration: tradeParams.duration,
            duration_unit: tradeParams.duration_unit,
            req_id: Math.floor(Math.random() * 1000000),
          }

          // Add optional parameters
          if (tradeParams.barrier) proposalRequest.barrier = tradeParams.barrier
          if (tradeParams.barrier2) proposalRequest.barrier2 = tradeParams.barrier2
          if (tradeParams.prediction !== undefined) {
            proposalRequest.prediction = tradeParams.prediction
            addLog(`Including prediction in proposal: ${tradeParams.prediction}`)
          }

          // Additional validation for digit contracts
          if (
            tradeParams.contract_type &&
            (tradeParams.contract_type.includes("DIGIT") ||
              tradeParams.contract_type.includes("MATCH") ||
              tradeParams.contract_type.includes("DIFF")) &&
            tradeParams.prediction === undefined
          ) {
            addLog(`ERROR: Digit contract ${tradeParams.contract_type} missing prediction parameter`, "error")
            return
          }

          addLog(`Sending proposal to client ${client.id}: ${tradeParams.contract_type} $${amount}`)
          console.log(`📤 Proposal for client ${client.id}:`, proposalRequest)

          client.ws?.send(JSON.stringify(proposalRequest))
        } catch (error) {
          addLog(`Failed to replicate trade to client ${client.id}: ${error.message}`, "error")
          console.error(`Replication error for client ${client.id}:`, error)
        }
      }, index * 300) // 300ms delay between clients to avoid rate limiting
    })
  }

  const sendTestTrade = () => {
    if (!isActive) {
      addLog("Copy trading not active", "error")
      return
    }

    const testTrade: TradeParams = {
      contract_type: "CALL",
      symbol: "R_50",
      amount: 1,
      duration: 5,
      duration_unit: "t",
      basis: "stake",
      currency: "USD",
    }

    addLog("Sending test trade...", "info")
    replicateTradeToClients(testTrade)
  }

  const removeClient = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId)
    if (client?.ws) {
      client.ws.close()
    }
    setClients((prev) => prev.filter((c) => c.id !== clientId))
    addLog(`Client ${clientId} removed`)
  }

  const toggleCopyTrading = () => {
    if (!masterWs) {
      addLog("Master account not connected", "error")
      return
    }

    if (clients.filter((c) => c.status === "connected").length === 0) {
      addLog("No connected clients", "error")
      return
    }

    setIsActive(!isActive)
    if (!isActive) {
      addLog("COPY TRADING STARTED - Monitoring master trades...", "success")
      processedContractsRef.current.clear()

      // Get initial portfolio state
      if (masterWsRef.current) {
        masterWsRef.current.send(
          JSON.stringify({
            portfolio: 1,
            req_id: 5,
          }),
        )
      }
    } else {
      addLog("COPY TRADING STOPPED", "warning")
    }
  }

  const syncClients = () => {
    addLog("Syncing all clients...")
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
    addLog("All connections closed")
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
        <div className={`ct-status ${isActive ? "active" : "inactive"}`}>
          {isActive ? "🟢 MONITORING TRADES" : "🔴 INACTIVE"}
        </div>
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
          {isActive ? "⏹️ Stop Monitoring" : "▶️ Start Copy Trading"}
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

      {/* Activity Log (Always visible for debugging) */}
      {showLogs && (
        <div className="ct-section">
          <h3>📋 Activity Log (Debug Mode)</h3>
          <div className="ct-logs">
            {logs.length === 0 ? (
              <div className="ct-no-logs">No activity yet...</div>
            ) : (
              logs.slice(0, 30).map((log, index) => (
                <div key={index} className="ct-log-entry">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Debug Info */}
      <div className="ct-section">
        <h3>🔧 Debug Info</h3>
        <div style={{ fontSize: "0.8rem", fontFamily: "monospace" }}>
          <p>Master WS: {masterWs ? "✅ Connected" : "❌ Disconnected"}</p>
          <p>Active Monitoring: {isActive ? "✅ Yes" : "❌ No"}</p>
          <p>Connected Clients: {clients.filter((c) => c.status === "connected").length}</p>
          <p>Processed Contracts: {processedContractsRef.current.size}</p>
        </div>
      </div>

      {/* Instructions */}
      <div className="ct-section">
        <h3>📖 How to Use</h3>
        <div style={{ fontSize: "0.8rem", lineHeight: "1.4" }}>
          <p>
            <strong>1.</strong> Connect Master account ✅
          </p>
          <p>
            <strong>2.</strong> Add Client accounts ✅
          </p>
          <p>
            <strong>3.</strong> Start Copy Trading ✅
          </p>
          <p>
            <strong>4.</strong> Execute trades on Master → Watch Activity Log for replication
          </p>
          <p>
            <strong>5.</strong> Check client "trades" count to confirm copying
          </p>
        </div>
      </div>

      {/* Risk Warning */}
      <div className="ct-warning">
        ⚠️ <strong>Risk Warning:</strong> Copy trading involves significant risk. Only trade with money you can afford to
        lose. Test with small amounts first!
      </div>
    </div>
  )
})

export default CopyTrading
