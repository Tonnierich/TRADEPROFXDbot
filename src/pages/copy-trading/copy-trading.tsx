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

interface TradeDetails {
  contract_type: string
  symbol: string
  amount: number
  duration: number
  duration_unit: string
  barrier?: string
  barrier2?: string
  prediction?: number
  basis: string
  currency: string
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
  const lastProcessedTradeRef = useRef<string>("")

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
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev.slice(0, 99)])
    console.log(`[CopyTrading] ${message}`)
  }

  const connectMaster = async () => {
    if (!masterToken) {
      addLog("❌ Please enter master API token")
      return
    }

    try {
      const ws = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089")

      ws.onopen = () => {
        addLog("🔗 Connected to Deriv API for Master")
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

  const handleMasterMessage = (data: any) => {
    console.log("🔍 Master message:", data)

    if (data.error) {
      addLog(`❌ Master error: ${data.error.message}`)
      return
    }

    switch (data.msg_type) {
      case "authorize":
        setMasterAccount(data.authorize.loginid)
        setMasterBalance(data.authorize.balance)
        addLog(`✅ Master authorized: ${data.authorize.loginid}`)

        // Subscribe to critical streams for trade detection
        if (masterWsRef.current) {
          // Subscribe to portfolio changes (most reliable for trade detection)
          masterWsRef.current.send(
            JSON.stringify({
              portfolio: 1,
              subscribe: 1,
              req_id: 2,
            }),
          )

          // Subscribe to balance changes
          masterWsRef.current.send(
            JSON.stringify({
              balance: 1,
              subscribe: 1,
              req_id: 3,
            }),
          )

          // Subscribe to transaction stream (catches all buy/sell activities)
          masterWsRef.current.send(
            JSON.stringify({
              transaction: 1,
              subscribe: 1,
              req_id: 4,
            }),
          )

          addLog("📡 Subscribed to master account streams")
        }
        break

      case "balance":
        const newBalance = data.balance.balance
        if (newBalance !== masterBalance) {
          setMasterBalance(newBalance)
          addLog(`💰 Master balance updated: $${newBalance.toFixed(2)}`)
        }
        break

      case "portfolio":
        // Portfolio changes indicate new trades
        if (data.portfolio && data.portfolio.contracts && isActiveRef.current) {
          const contracts = data.portfolio.contracts

          // Look for new contracts (recently opened)
          contracts.forEach((contract: any) => {
            const contractId = contract.contract_id.toString()

            // Skip if we already processed this trade
            if (lastProcessedTradeRef.current === contractId) {
              return
            }

            // Check if this is a new trade (within last 60 seconds)
            const contractTime = new Date(contract.date_start * 1000)
            const now = new Date()
            const timeDiff = now.getTime() - contractTime.getTime()

            if (timeDiff < 60000 && contract.contract_type) {
              lastProcessedTradeRef.current = contractId
              addLog(`🎯 NEW TRADE DETECTED: ${contract.contract_type} on ${contract.symbol}`)

              // Get full contract details and replicate
              getContractDetailsAndReplicate(contract)
            }
          })
        }
        break

      case "transaction":
        // Transaction stream catches buy activities
        if (data.transaction && data.transaction.action === "buy" && isActiveRef.current) {
          const transaction = data.transaction
          addLog(`💳 Transaction detected: ${transaction.contract_type} - $${transaction.amount}`)

          // Extract trade details from transaction
          const tradeDetails: TradeDetails = {
            contract_type: transaction.contract_type,
            symbol: transaction.symbol,
            amount: transaction.amount,
            duration: transaction.duration || 5,
            duration_unit: transaction.duration_unit || "t",
            barrier: transaction.barrier,
            barrier2: transaction.barrier2,
            prediction: transaction.prediction,
            basis: "stake",
            currency: transaction.currency || "USD",
          }

          replicateTradeToClients(tradeDetails)
        }
        break

      case "buy":
        // Direct buy response from master (when master executes trade)
        if (data.buy && isActiveRef.current) {
          const buyData = data.buy
          const echoReq = data.echo_req

          addLog(`🚀 Master trade executed: ${buyData.contract_id}`)

          const tradeDetails: TradeDetails = {
            contract_type: echoReq.contract_type,
            symbol: echoReq.symbol,
            amount: echoReq.amount || echoReq.price,
            duration: echoReq.duration,
            duration_unit: echoReq.duration_unit,
            barrier: echoReq.barrier,
            barrier2: echoReq.barrier2,
            prediction: echoReq.prediction,
            basis: echoReq.basis || "stake",
            currency: echoReq.currency || "USD",
          }

          replicateTradeToClients(tradeDetails)
        }
        break
    }
  }

  const getContractDetailsAndReplicate = (contract: any) => {
    // Extract comprehensive trade details from portfolio contract
    const tradeDetails: TradeDetails = {
      contract_type: contract.contract_type,
      symbol: contract.symbol,
      amount: contract.buy_price,
      duration: contract.duration || 5,
      duration_unit: contract.duration_unit || "t",
      barrier: contract.barrier,
      barrier2: contract.barrier2,
      prediction: contract.prediction,
      basis: "stake",
      currency: contract.currency || "USD",
    }

    addLog(`📋 Extracted trade details: ${JSON.stringify(tradeDetails)}`)
    replicateTradeToClients(tradeDetails)
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
        addLog(`❌ Client ${client.id} connection error`)
        updateClientStatus(client.id, "error")
        console.error(`Client ${client.id} error:`, error)
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
    console.log(`👤 Client ${clientId} message:`, data)

    if (data.error) {
      addLog(`❌ Client ${clientId} error: ${data.error.message}`)
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
        addLog(`✅ Client ${clientId} authorized: ${data.authorize.loginid}`)

        // Subscribe to balance updates for this client
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
        addLog(`💰 Client ${clientId} balance: $${data.balance.balance.toFixed(2)}`)
        break

      case "proposal":
        // Proposal response - now we can buy
        if (data.proposal && data.proposal.id) {
          const client = clientsRef.current.find((c) => c.id === clientId)
          if (client?.ws) {
            // Execute the buy with the proposal ID
            client.ws.send(
              JSON.stringify({
                buy: data.proposal.id,
                price: data.proposal.ask_price,
                req_id: `client_${clientId}_buy`,
              }),
            )
            addLog(`💸 Executing buy for client ${clientId} with proposal ${data.proposal.id}`)
          }
        }
        break

      case "buy":
        // Client trade executed successfully
        updateClient(clientId, {
          lastTrade: data.buy,
          totalCopiedTrades: (clients.find((c) => c.id === clientId)?.totalCopiedTrades || 0) + 1,
        })
        addLog(`✅ TRADE COPIED to client ${clientId}: ${data.buy.contract_id}`)
        break
    }
  }

  const updateClientStatus = (clientId: string, status: ClientConnection["status"]) => {
    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, status } : c)))
  }

  const updateClient = (clientId: string, updates: Partial<ClientConnection>) => {
    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, ...updates } : c)))
  }

  const replicateTradeToClients = (tradeDetails: TradeDetails) => {
    const connectedClients = clientsRef.current.filter((c) => c.status === "connected" && c.ws)

    if (connectedClients.length === 0) {
      addLog("⚠️ No connected clients to replicate trade")
      return
    }

    addLog(`📤 REPLICATING TRADE to ${connectedClients.length} clients`)
    addLog(`📋 Trade details: ${tradeDetails.contract_type} on ${tradeDetails.symbol}`)

    connectedClients.forEach((client, index) => {
      setTimeout(() => {
        try {
          // Calculate amount based on copy ratio and limits
          let amount = tradeDetails.amount * copySettings.copyRatio
          amount = Math.max(copySettings.minAmount, Math.min(copySettings.maxAmount, amount))

          // Check client balance (leave 20% buffer)
          if (amount > client.balance * 0.8) {
            addLog(`⚠️ Client ${client.id} insufficient balance for $${amount} trade`)
            return
          }

          // Create proposal request first (Deriv API requires proposal before buy)
          const proposalRequest = {
            proposal: 1,
            amount: amount,
            basis: tradeDetails.basis,
            contract_type: tradeDetails.contract_type,
            currency: tradeDetails.currency,
            symbol: tradeDetails.symbol,
            duration: tradeDetails.duration,
            duration_unit: tradeDetails.duration_unit,
            req_id: Math.floor(Math.random() * 1000000),
          }

          // Add optional parameters
          if (tradeDetails.barrier) {
            proposalRequest.barrier = tradeDetails.barrier
          }
          if (tradeDetails.barrier2) {
            proposalRequest.barrier2 = tradeDetails.barrier2
          }
          if (tradeDetails.prediction !== undefined) {
            proposalRequest.prediction = tradeDetails.prediction
          }

          console.log(`📤 Sending proposal to client ${client.id}:`, proposalRequest)

          client.ws?.send(JSON.stringify(proposalRequest))
          addLog(`📋 Proposal sent to client ${client.id}: ${tradeDetails.contract_type} $${amount}`)
        } catch (error) {
          addLog(`❌ Failed to replicate trade to client ${client.id}`)
          console.error(`Replication error for client ${client.id}:`, error)
        }
      }, index * 100) // Stagger requests to avoid rate limiting
    })
  }

  // Test trade function
  const sendTestTrade = () => {
    if (!isActive) {
      addLog("❌ Copy trading not active")
      return
    }

    const testTrade: TradeDetails = {
      contract_type: "CALL",
      symbol: "R_50",
      amount: 1,
      duration: 5,
      duration_unit: "t",
      basis: "stake",
      currency: "USD",
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
    addLog(isActive ? "⏹️ COPY TRADING STOPPED" : "▶️ COPY TRADING STARTED - Monitoring master trades...")
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

      {/* Activity Log (Collapsible) */}
      {showLogs && (
        <div className="ct-section">
          <h3>📋 Activity Log</h3>
          <div className="ct-logs">
            {logs.length === 0 ? (
              <div className="ct-no-logs">No activity yet...</div>
            ) : (
              logs.slice(0, 20).map((log, index) => (
                <div key={index} className="ct-log-entry">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="ct-section">
        <h3>📖 How to Use</h3>
        <div style={{ fontSize: "0.8rem", lineHeight: "1.4" }}>
          <p>
            <strong>1.</strong> Connect your Master account (the account you'll trade from)
          </p>
          <p>
            <strong>2.</strong> Add Client accounts (accounts that will copy the trades)
          </p>
          <p>
            <strong>3.</strong> Start Copy Trading to begin monitoring
          </p>
          <p>
            <strong>4.</strong> Execute trades on Master account - they'll auto-copy to clients!
          </p>
          <p>
            <strong>5.</strong> Monitor the Activity Log to see trade replication in real-time
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
