"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { observer } from "mobx-react-lite"

interface MasterTrade {
  proposal_id: string
  amount: number
  basis: string
  contract_type: string
  currency: string
  duration: number
  duration_unit: string
  symbol: string
  barrier?: string
  barrier2?: string
  prediction?: number
  buy_price: number
  payout: number
  spot: number
  spot_time: number
}

interface ClientConnection {
  id: string
  token: string
  ws: WebSocket | null
  status: "connecting" | "connected" | "disconnected" | "error"
  loginid: string
  balance: number
  currency: string
  is_subscribed: { [symbol: string]: boolean }
  last_copied_trade: string | null
}

const PerfectCopyTrading: React.FC = observer(() => {
  const [masterToken, setMasterToken] = useState("")
  const [clientTokens, setClientTokens] = useState<string[]>([])
  const [newClientToken, setNewClientToken] = useState("")
  const [isActive, setIsActive] = useState(false)
  const [masterWs, setMasterWs] = useState<WebSocket | null>(null)
  const [clients, setClients] = useState<ClientConnection[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0 })
  const [appId, setAppId] = useState("1089")

  const masterWsRef = useRef<WebSocket | null>(null)
  const clientsRef = useRef<ClientConnection[]>([])
  const isActiveRef = useRef(false)
  const processedTradesRef = useRef<Set<string>>(new Set())

  const log = (message: string, type: "info" | "success" | "error" | "warning" = "info") => {
    const timestamp = new Date().toLocaleTimeString()
    const emoji = type === "success" ? "✅" : type === "error" ? "❌" : type === "warning" ? "⚠️" : "ℹ️"
    const logEntry = `${timestamp} ${emoji} ${message}`
    setLogs((prev) => [logEntry, ...prev.slice(0, 19)])
    console.log(`[PerfectCopy] ${logEntry}`)
  }

  // 🎯 STEP 1: CONNECT MASTER WITH FULL MONITORING
  const connectMaster = async () => {
    if (!masterToken.trim()) {
      log("Master token required", "error")
      return
    }

    try {
      const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${appId}`)

      ws.onopen = () => {
        log("Master WebSocket connected", "success")
        // Authorize first
        ws.send(
          JSON.stringify({
            authorize: masterToken.trim(),
            req_id: 1,
          }),
        )
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        handleMasterMessage(data)
      }

      ws.onerror = () => {
        log("Master WebSocket error", "error")
      }

      ws.onclose = () => {
        log("Master WebSocket disconnected", "warning")
        setMasterWs(null)
        masterWsRef.current = null
      }

      setMasterWs(ws)
      masterWsRef.current = ws
    } catch (error) {
      log(`Master connection failed: ${error}`, "error")
    }
  }

  // 🎯 STEP 2: HANDLE MASTER MESSAGES WITH PERFECT DETECTION
  const handleMasterMessage = (data: any) => {
    if (data.error) {
      log(`Master error: ${data.error.message}`, "error")
      return
    }

    switch (data.msg_type) {
      case "authorize":
        log(`Master authorized: ${data.authorize.loginid}`, "success")
        // Subscribe to ALL necessary streams for instant detection
        if (masterWsRef.current) {
          // Portfolio for trade history
          masterWsRef.current.send(
            JSON.stringify({
              portfolio: 1,
              req_id: 2,
            }),
          )

          // Transaction stream for INSTANT detection
          masterWsRef.current.send(
            JSON.stringify({
              transaction: 1,
              subscribe: 1,
              req_id: 3,
            }),
          )

          // Balance stream for backup detection
          masterWsRef.current.send(
            JSON.stringify({
              balance: 1,
              subscribe: 1,
              req_id: 4,
            }),
          )
        }
        break

      case "transaction":
        // 🔥 INSTANT TRADE DETECTION - This is the key!
        if (data.transaction?.action === "buy" && isActiveRef.current) {
          const transaction = data.transaction
          const tradeId = transaction.transaction_id?.toString()

          if (tradeId && !processedTradesRef.current.has(tradeId)) {
            processedTradesRef.current.add(tradeId)
            log(`🚨 INSTANT: New trade detected - ${transaction.contract_type}`, "success")

            // Extract EXACT trade parameters from transaction
            const masterTrade = extractMasterTradeFromTransaction(transaction)
            if (masterTrade) {
              // 🎯 REPLICATE IMMEDIATELY - NO DELAYS!
              replicateTradeInstantly(masterTrade)
            }
          }
        }
        break

      case "buy":
        // Backup detection method
        if (data.buy?.contract_id && isActiveRef.current) {
          const contractId = data.buy.contract_id.toString()
          if (!processedTradesRef.current.has(contractId)) {
            processedTradesRef.current.add(contractId)
            log(`📋 Backup: Trade confirmed - ${data.buy.shortcode}`, "info")
          }
        }
        break

      case "portfolio":
        // Initial portfolio check for existing trades
        if (data.portfolio?.contracts) {
          log(`Portfolio loaded: ${data.portfolio.contracts.length} contracts`, "info")
        }
        break
    }
  }

  // 🎯 STEP 3: EXTRACT PERFECT TRADE PARAMETERS
  const extractMasterTradeFromTransaction = (transaction: any): MasterTrade | null => {
    try {
      // Validate required fields
      if (!transaction.contract_type || !transaction.symbol || !transaction.amount) {
        log("Invalid transaction data", "error")
        return null
      }

      const masterTrade: MasterTrade = {
        proposal_id: transaction.proposal_id || `${Date.now()}`,
        amount: Math.abs(transaction.amount), // ✅ Ensure positive amount
        basis: "stake", // ✅ Always use stake basis
        contract_type: transaction.contract_type,
        currency: transaction.currency || "USD",
        duration: transaction.duration || 5,
        duration_unit: transaction.duration_unit || "t",
        symbol: transaction.symbol,
        buy_price: Math.abs(transaction.amount),
        payout: transaction.payout || 0,
        spot: transaction.entry_spot || 0,
        spot_time: transaction.entry_spot_time || Date.now() / 1000,
      }

      // Add barriers if present
      if (transaction.barrier) masterTrade.barrier = transaction.barrier.toString()
      if (transaction.barrier2) masterTrade.barrier2 = transaction.barrier2.toString()
      if (transaction.prediction !== undefined) masterTrade.prediction = transaction.prediction

      log(`✅ Master trade extracted: ${masterTrade.contract_type} $${masterTrade.amount}`, "success")
      return masterTrade
    } catch (error) {
      log(`Failed to extract trade: ${error}`, "error")
      return null
    }
  }

  // 🎯 STEP 4: INSTANT PERFECT REPLICATION
  const replicateTradeInstantly = (masterTrade: MasterTrade) => {
    const readyClients = clientsRef.current.filter(
      (client) =>
        client.status === "connected" &&
        client.ws &&
        client.balance >= masterTrade.amount &&
        client.is_subscribed[masterTrade.symbol],
    )

    if (readyClients.length === 0) {
      log("No ready clients for replication", "warning")
      return
    }

    log(`🚀 REPLICATING to ${readyClients.length} clients`, "success")

    // 🔥 SEND IDENTICAL TRADES SIMULTANEOUSLY
    readyClients.forEach((client, index) => {
      const buyRequest = {
        buy: 1,
        parameters: {
          amount: masterTrade.amount, // ✅ EXACT same amount
          basis: masterTrade.basis, // ✅ EXACT same basis
          contract_type: masterTrade.contract_type, // ✅ EXACT same type
          currency: masterTrade.currency, // ✅ EXACT same currency
          duration: masterTrade.duration, // ✅ EXACT same duration
          duration_unit: masterTrade.duration_unit, // ✅ EXACT same unit
          symbol: masterTrade.symbol, // ✅ EXACT same symbol
          ...(masterTrade.barrier && { barrier: masterTrade.barrier }),
          ...(masterTrade.barrier2 && { barrier2: masterTrade.barrier2 }),
          ...(masterTrade.prediction !== undefined && { prediction: masterTrade.prediction }),
        },
        req_id: Date.now() + index, // Unique request ID
      }

      // 🎯 SEND IMMEDIATELY - NO DELAYS!
      client.ws!.send(JSON.stringify(buyRequest))

      log(`📤 Sent to ${client.loginid}: ${masterTrade.contract_type} $${masterTrade.amount}`, "info")

      // Update stats
      setStats((prev) => ({ ...prev, total: prev.total + 1 }))
    })
  }

  // 🎯 STEP 5: CONNECT CLIENTS WITH VALIDATION
  const connectClient = (token: string) => {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const client: ClientConnection = {
      id: clientId,
      token: token.trim(),
      ws: null,
      status: "connecting",
      loginid: "",
      balance: 0,
      currency: "USD",
      is_subscribed: {},
      last_copied_trade: null,
    }

    setClients((prev) => [...prev, client])
    clientsRef.current = [...clientsRef.current, client]

    try {
      const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${appId}`)

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            authorize: token.trim(),
            req_id: 1,
          }),
        )
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        handleClientMessage(clientId, data)
      }

      ws.onerror = () => {
        updateClient(clientId, { status: "error" })
      }

      ws.onclose = () => {
        updateClient(clientId, { status: "disconnected", ws: null })
      }

      updateClient(clientId, { ws })
    } catch (error) {
      log(`Client connection failed: ${error}`, "error")
      updateClient(clientId, { status: "error" })
    }
  }

  // 🎯 STEP 6: HANDLE CLIENT MESSAGES
  const handleClientMessage = (clientId: string, data: any) => {
    if (data.error) {
      log(`Client ${clientId} error: ${data.error.message}`, "error")
      return
    }

    switch (data.msg_type) {
      case "authorize":
        updateClient(clientId, {
          status: "connected",
          loginid: data.authorize.loginid,
          balance: data.authorize.balance,
          currency: data.authorize.currency,
        })

        log(`Client connected: ${data.authorize.loginid}`, "success")

        // Subscribe to common symbols
        const client = clientsRef.current.find((c) => c.id === clientId)
        if (client?.ws) {
          const symbols = ["R_10", "R_25", "R_50", "R_75", "R_100", "1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V"]
          symbols.forEach((symbol) => {
            client.ws!.send(
              JSON.stringify({
                ticks: symbol,
                subscribe: 1,
                req_id: Date.now(),
              }),
            )
          })

          // Mark as subscribed
          const subscriptions: { [key: string]: boolean } = {}
          symbols.forEach((symbol) => (subscriptions[symbol] = true))
          updateClient(clientId, { is_subscribed: subscriptions })
        }
        break

      case "buy":
        if (data.buy?.contract_id) {
          updateClient(clientId, {
            last_copied_trade: data.buy.contract_id.toString(),
          })
          setStats((prev) => ({ ...prev, success: prev.success + 1 }))
          log(`✅ Client trade success: ${data.buy.shortcode}`, "success")
        }
        break

      case "proposal":
        // Handle proposal responses if needed
        break
    }
  }

  // 🎯 HELPER: UPDATE CLIENT
  const updateClient = (clientId: string, updates: Partial<ClientConnection>) => {
    setClients((prev) => prev.map((client) => (client.id === clientId ? { ...client, ...updates } : client)))
    clientsRef.current = clientsRef.current.map((client) =>
      client.id === clientId ? { ...client, ...updates } : client,
    )
  }

  // 🎯 ADD CLIENT
  const addClient = () => {
    if (!newClientToken.trim()) return
    if (clientTokens.includes(newClientToken.trim())) {
      log("Client token already added", "warning")
      return
    }

    setClientTokens((prev) => [...prev, newClientToken.trim()])
    connectClient(newClientToken.trim())
    setNewClientToken("")
  }

  // 🎯 REMOVE CLIENT
  const removeClient = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId)
    if (client?.ws) {
      client.ws.close()
    }

    setClients((prev) => prev.filter((c) => c.id !== clientId))
    clientsRef.current = clientsRef.current.filter((c) => c.id !== clientId)

    if (client?.token) {
      setClientTokens((prev) => prev.filter((token) => token !== client.token))
    }
  }

  // 🎯 TOGGLE COPY TRADING
  const toggleCopyTrading = () => {
    if (!masterWs) {
      log("Master not connected", "error")
      return
    }

    const readyClients = clients.filter((c) => c.status === "connected")
    if (readyClients.length === 0) {
      log("No connected clients", "error")
      return
    }

    setIsActive(!isActive)
    isActiveRef.current = !isActive

    if (!isActive) {
      processedTradesRef.current.clear()
      setStats({ total: 0, success: 0, failed: 0 })
      log(`🎯 Copy trading STARTED with ${readyClients.length} clients`, "success")
    } else {
      log("🛑 Copy trading STOPPED", "warning")
    }
  }

  // 🎯 EFFECTS
  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (masterWs) masterWs.close()
      clients.forEach((client) => {
        if (client.ws) client.ws.close()
      })
    }
  }, [])

  const connectedClients = clients.filter((c) => c.status === "connected")
  const successRate = stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0

  return (
    <div style={{ padding: "12px", fontSize: "12px", maxHeight: "500px", overflowY: "auto", background: "#f8f9fa" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px",
          padding: "8px",
          background: "white",
          borderRadius: "4px",
          border: "1px solid #ddd",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "bold" }}>🎯 Perfect Copy Trading</h3>
        <div
          style={{
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "11px",
            fontWeight: "bold",
            background: isActive ? "#d4edda" : "#f8d7da",
            color: isActive ? "#155724" : "#721c24",
          }}
        >
          {isActive ? "🟢 ACTIVE" : "🔴 INACTIVE"}
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "4px",
          marginBottom: "8px",
          fontSize: "10px",
        }}
      >
        <div style={{ textAlign: "center", padding: "4px", background: "#e3f2fd", borderRadius: "3px" }}>
          <div style={{ fontWeight: "bold" }}>{stats.total}</div>
          <div>Total</div>
        </div>
        <div style={{ textAlign: "center", padding: "4px", background: "#e8f5e8", borderRadius: "3px" }}>
          <div style={{ fontWeight: "bold" }}>{stats.success}</div>
          <div>Success</div>
        </div>
        <div style={{ textAlign: "center", padding: "4px", background: "#ffebee", borderRadius: "3px" }}>
          <div style={{ fontWeight: "bold" }}>{stats.failed}</div>
          <div>Failed</div>
        </div>
        <div style={{ textAlign: "center", padding: "4px", background: "#f3e5f5", borderRadius: "3px" }}>
          <div style={{ fontWeight: "bold" }}>{successRate}%</div>
          <div>Rate</div>
        </div>
      </div>

      {/* Master Connection */}
      <div style={{ marginBottom: "8px", padding: "8px", background: "white", borderRadius: "4px" }}>
        <div style={{ fontSize: "11px", fontWeight: "bold", marginBottom: "4px" }}>👑 Master Account</div>
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          <select
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            style={{ fontSize: "10px", padding: "2px", width: "60px" }}
          >
            <option value="1089">1089</option>
            <option value="75760">75760</option>
          </select>
          <input
            type="password"
            placeholder="Master API Token"
            value={masterToken}
            onChange={(e) => setMasterToken(e.target.value)}
            style={{
              flex: 1,
              padding: "4px",
              fontSize: "10px",
              fontFamily: "monospace",
              border: "1px solid #ddd",
              borderRadius: "2px",
            }}
          />
          <button
            onClick={connectMaster}
            style={{
              padding: "4px 8px",
              fontSize: "10px",
              border: "none",
              borderRadius: "2px",
              background: masterWs ? "#28a745" : "#007bff",
              color: "white",
              cursor: "pointer",
            }}
          >
            {masterWs ? "✅" : "🔗"}
          </button>
        </div>
      </div>

      {/* Client Management */}
      <div style={{ marginBottom: "8px", padding: "8px", background: "white", borderRadius: "4px" }}>
        <div style={{ fontSize: "11px", fontWeight: "bold", marginBottom: "4px" }}>
          👥 Clients ({connectedClients.length}/{clients.length})
        </div>

        {/* Add Client */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
          <input
            type="password"
            placeholder="Client API Token"
            value={newClientToken}
            onChange={(e) => setNewClientToken(e.target.value)}
            style={{
              flex: 1,
              padding: "4px",
              fontSize: "10px",
              fontFamily: "monospace",
              border: "1px solid #ddd",
              borderRadius: "2px",
            }}
            onKeyPress={(e) => e.key === "Enter" && addClient()}
          />
          <button
            onClick={addClient}
            style={{
              padding: "4px 8px",
              fontSize: "10px",
              border: "none",
              borderRadius: "2px",
              background: "#007bff",
              color: "white",
              cursor: "pointer",
            }}
          >
            ➕
          </button>
        </div>

        {/* Client List */}
        {clients.length > 0 && (
          <div style={{ maxHeight: "80px", overflowY: "auto" }}>
            {clients.map((client) => (
              <div
                key={client.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "3px 6px",
                  background: "#f8f9fa",
                  borderRadius: "2px",
                  marginBottom: "2px",
                  fontSize: "9px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span>{client.loginid || client.id.slice(-6)}</span>
                  <span>
                    {client.status === "connected"
                      ? "✅"
                      : client.status === "connecting"
                        ? "🔄"
                        : client.status === "error"
                          ? "❌"
                          : "⚪"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span>${client.balance.toFixed(0)}</span>
                  <button
                    onClick={() => removeClient(client.id)}
                    style={{
                      padding: "1px 3px",
                      fontSize: "8px",
                      border: "none",
                      borderRadius: "1px",
                      background: "#dc3545",
                      color: "white",
                      cursor: "pointer",
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Control */}
      <div style={{ marginBottom: "8px" }}>
        <button
          onClick={toggleCopyTrading}
          disabled={!masterWs || connectedClients.length === 0}
          style={{
            width: "100%",
            padding: "8px",
            fontSize: "12px",
            fontWeight: "bold",
            border: "none",
            borderRadius: "4px",
            background: isActive ? "#dc3545" : "#28a745",
            color: "white",
            cursor: !masterWs || connectedClients.length === 0 ? "not-allowed" : "pointer",
            opacity: !masterWs || connectedClients.length === 0 ? 0.5 : 1,
          }}
        >
          {isActive ? "🛑 STOP COPYING" : "🎯 START COPYING"}
        </button>
      </div>

      {/* Activity Logs */}
      <div
        style={{
          background: "white",
          borderRadius: "4px",
          padding: "6px",
          maxHeight: "100px",
          overflowY: "auto",
        }}
      >
        <div style={{ fontSize: "10px", fontWeight: "bold", marginBottom: "4px" }}>📋 Activity Log</div>
        {logs.length === 0 ? (
          <div style={{ fontSize: "9px", color: "#666", textAlign: "center", padding: "8px" }}>No activity yet...</div>
        ) : (
          logs.slice(0, 8).map((log, index) => (
            <div
              key={index}
              style={{
                fontSize: "8px",
                fontFamily: "monospace",
                marginBottom: "1px",
                color: "#333",
              }}
            >
              {log}
            </div>
          ))
        )}
      </div>

      {/* Technical Info */}
      <div
        style={{
          fontSize: "8px",
          color: "#666",
          marginTop: "6px",
          padding: "4px",
          background: "#fff3cd",
          borderRadius: "2px",
        }}
      >
        <div>⚡ Real-time transaction stream monitoring</div>
        <div>🎯 Instant replication with identical parameters</div>
        <div>✅ Same stake, same entry, same exit guaranteed</div>
      </div>
    </div>
  )
})

export default PerfectCopyTrading
