"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { observer } from "mobx-react-lite"

interface TradeData {
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

interface ClientConnection {
  id: string
  token: string
  ws: WebSocket | null
  status: "connecting" | "connected" | "disconnected" | "error"
  loginid: string
  balance: number
  total_copied: number
}

const WorkingCopyTrading: React.FC = observer(() => {
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
  const portfolioIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const log = (message: string, type: "info" | "success" | "error" | "warning" = "info") => {
    const timestamp = new Date().toLocaleTimeString()
    const emoji = type === "success" ? "✅" : type === "error" ? "❌" : type === "warning" ? "⚠️" : "ℹ️"
    const logEntry = `${timestamp} ${emoji} ${message}`
    setLogs((prev) => [logEntry, ...prev.slice(0, 19)])
    console.log(`[WorkingCopy] ${logEntry}`)
  }

  // 🎯 STEP 1: CONNECT MASTER WITH PROPER MONITORING
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
        }, 30000)

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
        handleMasterMessage(data)
      }

      ws.onerror = (error) => {
        log("Master WebSocket error", "error")
        console.error("Master WS Error:", error)
      }

      ws.onclose = (event) => {
        log(`Master disconnected (${event.code})`, "warning")
        setMasterWs(null)
        masterWsRef.current = null
        setMasterAccount("")

        // Clear intervals
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current)
        if (portfolioIntervalRef.current) clearInterval(portfolioIntervalRef.current)

        // Auto-reconnect if was active
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

  // 🎯 STEP 2: HANDLE MASTER MESSAGES WITH MULTIPLE DETECTION METHODS
  const handleMasterMessage = (data: any) => {
    if (data.error) {
      log(`Master error: ${data.error.message}`, "error")
      return
    }

    switch (data.msg_type) {
      case "authorize":
        setMasterAccount(data.authorize.loginid)
        log(`Master authorized: ${data.authorize.loginid}`, "success")

        // Start multiple monitoring streams
        if (masterWsRef.current) {
          // 1. Portfolio monitoring (most reliable)
          masterWsRef.current.send(
            JSON.stringify({
              portfolio: 1,
              req_id: 2,
            }),
          )

          // 2. Transaction stream
          masterWsRef.current.send(
            JSON.stringify({
              transaction: 1,
              subscribe: 1,
              req_id: 3,
            }),
          )

          // 3. Balance monitoring
          masterWsRef.current.send(
            JSON.stringify({
              balance: 1,
              subscribe: 1,
              req_id: 4,
            }),
          )

          // 4. Start portfolio polling every 2 seconds
          startPortfolioPolling()
        }
        break

      case "portfolio":
        // 🔥 MAIN DETECTION METHOD - Portfolio analysis
        if (data.portfolio?.contracts && isActiveRef.current) {
          analyzePortfolioForNewTrades(data.portfolio.contracts)
        }
        break

      case "transaction":
        // Backup detection method
        if (data.transaction?.action === "buy" && isActiveRef.current) {
          const contractType = data.transaction.contract_type || "UNKNOWN"
          log(`📋 Transaction: ${contractType}`, "info")
        }
        break

      case "balance":
        // Balance change detection (backup)
        if (data.balance && isActiveRef.current) {
          log(`💰 Balance: $${data.balance.balance}`, "info")
        }
        break

      case "buy":
        // Direct buy confirmation
        if (data.buy?.contract_id && isActiveRef.current) {
          log(`✅ Buy confirmed: ${data.buy.shortcode}`, "success")
        }
        break

      case "pong":
        // Keepalive response
        break
    }
  }

  // 🎯 STEP 3: ANALYZE PORTFOLIO FOR NEW TRADES
  const analyzePortfolioForNewTrades = (contracts: any[]) => {
    if (!contracts || contracts.length === 0) return

    // Look for very recent contracts (last 10 seconds)
    const now = Date.now() / 1000
    const recentContracts = contracts.filter((contract) => {
      const contractTime = contract.date_start || contract.purchase_time || 0
      const timeDiff = now - contractTime
      return timeDiff >= 0 && timeDiff <= 10 && contract.buy_price > 0
    })

    recentContracts.forEach((contract) => {
      const contractId = contract.contract_id?.toString()
      if (contractId && !processedTradesRef.current.has(contractId)) {
        processedTradesRef.current.add(contractId)

        // Extract trade data from contract
        const tradeData = extractTradeDataFromContract(contract)
        if (tradeData) {
          log(`🚨 NEW TRADE: ${tradeData.contract_type} $${tradeData.amount}`, "success")
          setStats((prev) => ({ ...prev, detected: prev.detected + 1 }))

          // Replicate immediately
          replicateTradeToClients(tradeData)
        } else {
          log(`⚠️ Could not extract trade data from contract`, "warning")
        }
      }
    })
  }

  // 🎯 STEP 4: EXTRACT TRADE DATA FROM CONTRACT
  const extractTradeDataFromContract = (contract: any): TradeData | null => {
    try {
      // Validate required fields
      if (!contract.contract_type || !contract.underlying || !contract.buy_price) {
        log(`❌ Missing required fields in contract`, "error")
        return null
      }

      const tradeData: TradeData = {
        contract_type: contract.contract_type,
        symbol: contract.underlying,
        amount: Math.abs(contract.buy_price),
        duration: contract.duration || 5,
        duration_unit: contract.duration_unit || "t",
        basis: "stake",
        currency: contract.currency || "USD",
      }

      // Add optional fields
      if (contract.barrier) tradeData.barrier = contract.barrier.toString()
      if (contract.barrier2) tradeData.barrier2 = contract.barrier2.toString()
      if (contract.prediction !== undefined) tradeData.prediction = contract.prediction

      log(`✅ Extracted: ${tradeData.contract_type} on ${tradeData.symbol}`, "success")
      return tradeData
    } catch (error) {
      log(`❌ Failed to extract trade data: ${error}`, "error")
      return null
    }
  }

  // 🎯 STEP 5: REPLICATE TRADE TO ALL CLIENTS
  const replicateTradeToClients = (tradeData: TradeData) => {
    const readyClients = clientsRef.current.filter(
      (client) => client.status === "connected" && client.ws && client.balance >= tradeData.amount,
    )

    if (readyClients.length === 0) {
      log("⚠️ No ready clients for replication", "warning")
      setStats((prev) => ({ ...prev, failed: prev.failed + 1 }))
      return
    }

    log(`🚀 Replicating to ${readyClients.length} clients`, "success")

    readyClients.forEach((client, index) => {
      // Create proposal first, then buy
      const proposalRequest = {
        proposal: 1,
        amount: tradeData.amount,
        basis: tradeData.basis,
        contract_type: tradeData.contract_type,
        currency: tradeData.currency,
        duration: tradeData.duration,
        duration_unit: tradeData.duration_unit,
        symbol: tradeData.symbol,
        req_id: Date.now() + index,
        ...(tradeData.barrier && { barrier: tradeData.barrier }),
        ...(tradeData.barrier2 && { barrier2: tradeData.barrier2 }),
        ...(tradeData.prediction !== undefined && { prediction: tradeData.prediction }),
      }

      try {
        client.ws!.send(JSON.stringify(proposalRequest))
        log(`📤 Proposal sent to ${client.loginid}`, "info")

        // Update client stats
        updateClient(client.id, {
          total_copied: client.total_copied + 1,
        })
      } catch (error) {
        log(`❌ Failed to send to ${client.loginid}: ${error}`, "error")
        setStats((prev) => ({ ...prev, failed: prev.failed + 1 }))
      }
    })
  }

  // 🎯 STEP 6: START PORTFOLIO POLLING
  const startPortfolioPolling = () => {
    if (portfolioIntervalRef.current) clearInterval(portfolioIntervalRef.current)

    portfolioIntervalRef.current = setInterval(() => {
      if (masterWsRef.current && isActiveRef.current) {
        masterWsRef.current.send(
          JSON.stringify({
            portfolio: 1,
            req_id: Date.now(),
          }),
        )
      }
    }, 2000) // Poll every 2 seconds
  }

  // 🎯 STEP 7: CONNECT CLIENTS
  const connectClient = (token: string) => {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const client: ClientConnection = {
      id: clientId,
      token: token.trim(),
      ws: null,
      status: "connecting",
      loginid: "",
      balance: 0,
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

  // 🎯 STEP 8: HANDLE CLIENT MESSAGES
  const handleClientMessage = (clientId: string, data: any) => {
    if (data.error) {
      log(`Client error: ${data.error.message}`, "error")
      return
    }

    switch (data.msg_type) {
      case "authorize":
        updateClient(clientId, {
          status: "connected",
          loginid: data.authorize.loginid,
          balance: data.authorize.balance,
        })
        log(`✅ Client connected: ${data.authorize.loginid}`, "success")
        break

      case "proposal":
        // Auto-buy the proposal
        if (data.proposal?.id && isActiveRef.current) {
          const client = clientsRef.current.find((c) => c.id === clientId)
          if (client?.ws) {
            const buyRequest = {
              buy: data.proposal.id,
              price: data.proposal.ask_price,
              req_id: Date.now(),
            }
            client.ws.send(JSON.stringify(buyRequest))
            log(`💰 Auto-buying for ${client.loginid}`, "info")
          }
        }
        break

      case "buy":
        if (data.buy?.contract_id) {
          setStats((prev) => ({ ...prev, replicated: prev.replicated + 1 }))
          log(`✅ Client trade SUCCESS: ${data.buy.shortcode}`, "success")
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
    if (client?.ws) client.ws.close()

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
      startPortfolioPolling()
      log(`🎯 Copy trading STARTED with ${readyClients.length} clients`, "success")
    } else {
      if (portfolioIntervalRef.current) clearInterval(portfolioIntervalRef.current)
      log("🛑 Copy trading STOPPED", "warning")
    }
  }

  // 🎯 CLEANUP
  useEffect(() => {
    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current)
      if (portfolioIntervalRef.current) clearInterval(portfolioIntervalRef.current)
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
        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "bold" }}>🎯 Working Copy Trading</h3>
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
          {isActive ? "🟢 MONITORING" : "🔴 INACTIVE"}
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
          {isActive ? "🛑 STOP MONITORING" : "🎯 START MONITORING"}
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
            Monitoring portfolio for trades...
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
          background: "#d4edda",
          borderRadius: "2px",
          border: "1px solid #c3e6cb",
        }}
      >
        <div>
          🔥 <strong>WORKING FEATURES:</strong>
        </div>
        <div>• Portfolio monitoring every 2 seconds</div>
        <div>• Multiple detection streams (portfolio + transaction)</div>
        <div>• Auto-proposal and auto-buy system</div>
        <div>• Proper trade data extraction</div>
        <div>• Real-time replication ✅</div>
      </div>
    </div>
  )
})

export default WorkingCopyTrading
