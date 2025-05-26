"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { observer } from "mobx-react-lite"

interface MasterBuyRequest {
  buy: number
  parameters: {
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
  }
  req_id: number
}

interface ClientConnection {
  id: string
  token: string
  ws: WebSocket | null
  status: "connecting" | "connected" | "disconnected" | "error"
  loginid: string
  balance: number
  currency: string
  last_trade_id: string | null
  total_copied: number
}

const BulletproofCopyTrading: React.FC = observer(() => {
  const [masterToken, setMasterToken] = useState("")
  const [clients, setClients] = useState<ClientConnection[]>([])
  const [newClientToken, setNewClientToken] = useState("")
  const [isActive, setIsActive] = useState(false)
  const [masterWs, setMasterWs] = useState<WebSocket | null>(null)
  const [masterAccount, setMasterAccount] = useState("")
  const [logs, setLogs] = useState<string[]>([])
  const [stats, setStats] = useState({ detected: 0, replicated: 0, failed: 0 })
  const [appId, setAppId] = useState("1089")

  // Refs for real-time access
  const masterWsRef = useRef<WebSocket | null>(null)
  const clientsRef = useRef<ClientConnection[]>([])
  const isActiveRef = useRef(false)
  const processedTradesRef = useRef<Set<string>>(new Set())
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastMasterBuyRef = useRef<MasterBuyRequest | null>(null)

  const log = (message: string, type: "info" | "success" | "error" | "warning" = "info") => {
    const timestamp = new Date().toLocaleTimeString()
    const emoji = type === "success" ? "✅" : type === "error" ? "❌" : type === "warning" ? "⚠️" : "ℹ️"
    const logEntry = `${timestamp} ${emoji} ${message}`
    setLogs((prev) => [logEntry, ...prev.slice(0, 19)])
    console.log(`[BulletproofCopy] ${logEntry}`)
  }

  // 🎯 STEP 1: CONNECT MASTER WITH KEEPALIVE
  const connectMaster = async () => {
    if (!masterToken.trim()) {
      log("Master token required", "error")
      return
    }

    try {
      const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${appId}`)

      ws.onopen = () => {
        log("Master WebSocket connected", "success")

        // Start keepalive ping
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current)
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ ping: 1 }))
          }
        }, 30000) // Ping every 30 seconds

        // Authorize master
        ws.send(
          JSON.stringify({
            authorize: masterToken.trim(),
            req_id: 1,
          }),
        )
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        handleMasterMessage(data, ws)
      }

      ws.onerror = (error) => {
        log("Master WebSocket error", "error")
        console.error("Master WS Error:", error)
      }

      ws.onclose = (event) => {
        log(`Master WebSocket disconnected (${event.code}: ${event.reason})`, "warning")
        setMasterWs(null)
        masterWsRef.current = null
        setMasterAccount("")

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current)
          pingIntervalRef.current = null
        }

        // Auto-reconnect after 3 seconds if was active
        if (isActiveRef.current) {
          setTimeout(() => {
            log("Auto-reconnecting master...", "info")
            connectMaster()
          }, 3000)
        }
      }

      setMasterWs(ws)
      masterWsRef.current = ws
    } catch (error) {
      log(`Master connection failed: ${error}`, "error")
    }
  }

  // 🎯 STEP 2: INTERCEPT OUTGOING BUY REQUESTS FROM MASTER
  const interceptMasterBuyRequest = (ws: WebSocket) => {
    // Store original send method
    const originalSend = ws.send.bind(ws)

    // Override send method to intercept buy requests
    ws.send = (data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
      try {
        if (typeof data === "string") {
          const parsed = JSON.parse(data)

          // 🔥 CAPTURE BUY REQUESTS BEFORE THEY'RE SENT!
          if (parsed.buy === 1 && parsed.parameters && isActiveRef.current) {
            log(`🚨 INTERCEPTED: ${parsed.parameters.contract_type} $${parsed.parameters.amount}`, "success")

            // Store the exact buy request
            lastMasterBuyRef.current = parsed as MasterBuyRequest

            // Immediately replicate to clients
            replicateExactBuyRequest(parsed.parameters)

            // Update stats
            setStats((prev) => ({ ...prev, detected: prev.detected + 1 }))
          }
        }
      } catch (error) {
        // If parsing fails, just continue with original send
      }

      // Always call original send
      return originalSend(data)
    }
  }

  // 🎯 STEP 3: HANDLE MASTER MESSAGES
  const handleMasterMessage = (data: any, ws: WebSocket) => {
    if (data.error) {
      log(`Master error: ${data.error.message}`, "error")
      return
    }

    switch (data.msg_type) {
      case "authorize":
        setMasterAccount(data.authorize.loginid)
        log(`Master authorized: ${data.authorize.loginid}`, "success")

        // 🔥 INTERCEPT OUTGOING MESSAGES FROM MASTER
        interceptMasterBuyRequest(ws)

        // Subscribe to necessary streams for backup detection
        ws.send(
          JSON.stringify({
            transaction: 1,
            subscribe: 1,
            req_id: 3,
          }),
        )
        break

      case "buy":
        // Backup confirmation that trade went through
        if (data.buy?.contract_id && isActiveRef.current) {
          log(`✅ Master trade confirmed: ${data.buy.shortcode}`, "success")
        }
        break

      case "transaction":
        // Additional backup detection
        if (data.transaction?.action === "buy" && isActiveRef.current) {
          const tradeId = data.transaction.transaction_id?.toString()
          if (tradeId && !processedTradesRef.current.has(tradeId)) {
            processedTradesRef.current.add(tradeId)
            log(`📋 Transaction logged: ${data.transaction.contract_type}`, "info")
          }
        }
        break

      case "pong":
        // Keepalive response
        break
    }
  }

  // 🎯 STEP 4: REPLICATE EXACT BUY REQUEST
  const replicateExactBuyRequest = (masterParameters: any) => {
    // Validate parameters first
    if (
      !masterParameters ||
      !masterParameters.contract_type ||
      !masterParameters.symbol ||
      !masterParameters.amount ||
      masterParameters.amount <= 0
    ) {
      log("❌ Invalid master parameters - skipping replication", "error")
      return
    }

    const readyClients = clientsRef.current.filter(
      (client) => client.status === "connected" && client.ws && client.balance >= masterParameters.amount,
    )

    if (readyClients.length === 0) {
      log("⚠️ No ready clients for replication", "warning")
      return
    }

    log(`🚀 Replicating to ${readyClients.length} clients`, "success")

    // 🔥 SEND IDENTICAL BUY REQUESTS TO ALL CLIENTS
    readyClients.forEach((client, index) => {
      const exactBuyRequest = {
        buy: 1,
        parameters: {
          // 🎯 EXACT SAME PARAMETERS - NO MODIFICATIONS!
          amount: masterParameters.amount,
          basis: masterParameters.basis,
          contract_type: masterParameters.contract_type,
          currency: masterParameters.currency,
          duration: masterParameters.duration,
          duration_unit: masterParameters.duration_unit,
          symbol: masterParameters.symbol,
          // Include all optional parameters exactly as master sent them
          ...(masterParameters.barrier && { barrier: masterParameters.barrier }),
          ...(masterParameters.barrier2 && { barrier2: masterParameters.barrier2 }),
          ...(masterParameters.prediction !== undefined && { prediction: masterParameters.prediction }),
        },
        req_id: Date.now() + index, // Unique request ID per client
      }

      try {
        // 🎯 SEND IMMEDIATELY - NO DELAYS!
        client.ws!.send(JSON.stringify(exactBuyRequest))

        log(`📤 Sent to ${client.loginid}: ${masterParameters.contract_type} $${masterParameters.amount}`, "info")

        // Update client stats
        updateClient(client.id, {
          total_copied: client.total_copied + 1,
          last_trade_id: `${Date.now()}_${index}`,
        })
      } catch (error) {
        log(`❌ Failed to send to ${client.loginid}: ${error}`, "error")
        setStats((prev) => ({ ...prev, failed: prev.failed + 1 }))
      }
    })
  }

  // 🎯 STEP 5: CONNECT CLIENTS
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
      last_trade_id: null,
      total_copied: 0,
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

      ws.onerror = (error) => {
        log(`Client ${clientId} error`, "error")
        updateClient(clientId, { status: "error" })
      }

      ws.onclose = () => {
        log(`Client ${clientId} disconnected`, "warning")
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
      log(`Client error: ${data.error.message}`, "error")
      setStats((prev) => ({ ...prev, failed: prev.failed + 1 }))
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
        log(`✅ Client connected: ${data.authorize.loginid}`, "success")
        break

      case "buy":
        if (data.buy?.contract_id) {
          updateClient(clientId, {
            last_trade_id: data.buy.contract_id.toString(),
          })
          setStats((prev) => ({ ...prev, replicated: prev.replicated + 1 }))
          log(`✅ Client trade success: ${data.buy.shortcode}`, "success")
        }
        break
    }
  }

  // 🎯 HELPER FUNCTIONS
  const updateClient = (clientId: string, updates: Partial<ClientConnection>) => {
    setClients((prev) => prev.map((client) => (client.id === clientId ? { ...client, ...updates } : client)))
    clientsRef.current = clientsRef.current.map((client) =>
      client.id === clientId ? { ...client, ...updates } : client,
    )
  }

  const addClient = () => {
    if (!newClientToken.trim()) return
    if (clients.some((c) => c.token === newClientToken.trim())) {
      log("Client token already added", "warning")
      return
    }

    connectClient(newClientToken.trim())
    setNewClientToken("")
  }

  const removeClient = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId)
    if (client?.ws) {
      client.ws.close()
    }

    setClients((prev) => prev.filter((c) => c.id !== clientId))
    clientsRef.current = clientsRef.current.filter((c) => c.id !== clientId)
  }

  const toggleCopyTrading = () => {
    if (!masterWs) {
      log("❌ Master not connected", "error")
      return
    }

    const readyClients = clients.filter((c) => c.status === "connected")
    if (readyClients.length === 0) {
      log("❌ No connected clients", "error")
      return
    }

    setIsActive(!isActive)
    isActiveRef.current = !isActive

    if (!isActive) {
      processedTradesRef.current.clear()
      setStats({ detected: 0, replicated: 0, failed: 0 })
      log(`🎯 Copy trading STARTED with ${readyClients.length} clients`, "success")
    } else {
      log("🛑 Copy trading STOPPED", "warning")
    }
  }

  // 🎯 CLEANUP
  useEffect(() => {
    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current)
      if (masterWs) masterWs.close()
      clients.forEach((client) => {
        if (client.ws) client.ws.close()
      })
    }
  }, [])

  const connectedClients = clients.filter((c) => c.status === "connected")
  const successRate = stats.detected > 0 ? Math.round((stats.replicated / stats.detected) * 100) : 0

  return (
    <div
      style={{
        padding: "12px",
        fontSize: "12px",
        maxHeight: "500px",
        overflowY: "auto",
        background: "#f8f9fa",
        fontFamily: "monospace",
      }}
    >
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
        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "bold" }}>🎯 Bulletproof Copy Trading</h3>
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
          {isActive ? "🟢 INTERCEPTING" : "🔴 INACTIVE"}
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
          <div style={{ fontWeight: "bold" }}>{stats.detected}</div>
          <div>Detected</div>
        </div>
        <div style={{ textAlign: "center", padding: "4px", background: "#e8f5e8", borderRadius: "3px" }}>
          <div style={{ fontWeight: "bold" }}>{stats.replicated}</div>
          <div>Replicated</div>
        </div>
        <div style={{ textAlign: "center", padding: "4px", background: "#ffebee", borderRadius: "3px" }}>
          <div style={{ fontWeight: "bold" }}>{stats.failed}</div>
          <div>Failed</div>
        </div>
        <div style={{ textAlign: "center", padding: "4px", background: "#f3e5f5", borderRadius: "3px" }}>
          <div style={{ fontWeight: "bold" }}>{successRate}%</div>
          <div>Success</div>
        </div>
      </div>

      {/* Master Connection */}
      <div style={{ marginBottom: "8px", padding: "8px", background: "white", borderRadius: "4px" }}>
        <div style={{ fontSize: "11px", fontWeight: "bold", marginBottom: "4px" }}>
          👑 Master: {masterAccount || "Not connected"}
        </div>
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
                  <span>({client.total_copied})</span>
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
          {isActive ? "🛑 STOP INTERCEPTING" : "🎯 START INTERCEPTING"}
        </button>
      </div>

      {/* Activity Logs */}
      <div
        style={{
          background: "white",
          borderRadius: "4px",
          padding: "6px",
          maxHeight: "120px",
          overflowY: "auto",
        }}
      >
        <div style={{ fontSize: "10px", fontWeight: "bold", marginBottom: "4px" }}>📋 Activity Log</div>
        {logs.length === 0 ? (
          <div style={{ fontSize: "9px", color: "#666", textAlign: "center", padding: "8px" }}>
            Waiting for master trades...
          </div>
        ) : (
          logs.slice(0, 10).map((log, index) => (
            <div
              key={index}
              style={{
                fontSize: "8px",
                fontFamily: "monospace",
                marginBottom: "1px",
                color: "#333",
                wordBreak: "break-all",
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
          background: "#d1ecf1",
          borderRadius: "2px",
          border: "1px solid #bee5eb",
        }}
      >
        <div>
          🔥 <strong>BULLETPROOF FEATURES:</strong>
        </div>
        <div>• Intercepts master's exact buy requests</div>
        <div>• Forwards identical parameters to clients</div>
        <div>• Auto-reconnect with 30s keepalive</div>
        <div>• Zero delays, zero modifications</div>
        <div>• Same stake, same entry, same exit ✅</div>
      </div>
    </div>
  )
})

export default BulletproofCopyTrading

