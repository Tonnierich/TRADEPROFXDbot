"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { observer } from "mobx-react-lite"
import TraderManagement from "./trader-management"

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

const RealTimeCopyTrading: React.FC = observer(() => {
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
  const lastBalanceRef = useRef<number>(0)
  const balanceChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const log = (message: string, type: "info" | "success" | "error" | "warning" = "info") => {
    const timestamp = new Date().toLocaleTimeString()
    const emoji = type === "success" ? "✅" : type === "error" ? "❌" : type === "warning" ? "⚠️" : "ℹ️"
    const logEntry = `${timestamp} ${emoji} ${message}`
    setLogs((prev) => [logEntry, ...prev.slice(0, 19)])
    console.log(`[RealTimeCopy] ${logEntry}`)
  }

  // Connect master function
  const connectMaster = async () => {
    if (!masterToken.trim()) {
      log("Master token required", "error")
      return
    }

    try {
      const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${appId}`)

      ws.onopen = () => {
        log("Master WebSocket connected", "success")
        ws.send(JSON.stringify({ authorize: masterToken.trim(), req_id: 1 }))
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        handleMasterMessage(data)
      }

      ws.onerror = () => log("Master WebSocket error", "error")
      ws.onclose = () => {
        log("Master disconnected", "warning")
        setMasterWs(null)
        masterWsRef.current = null
        setMasterAccount("")
      }

      setMasterWs(ws)
      masterWsRef.current = ws
    } catch (error) {
      log(`Master connection failed: ${error}`, "error")
    }
  }

  const handleMasterMessage = (data: any) => {
    if (data.error) {
      log(`Master error: ${data.error.message}`, "error")
      return
    }

    switch (data.msg_type) {
      case "authorize":
        setMasterAccount(data.authorize.loginid)
        lastBalanceRef.current = data.authorize.balance
        log(`Master authorized: ${data.authorize.loginid}`, "success")

        if (masterWsRef.current) {
          masterWsRef.current.send(JSON.stringify({ balance: 1, subscribe: 1, req_id: 3 }))
        }
        break

      case "balance":
        if (isActiveRef.current) {
          const newBalance = data.balance.balance
          const balanceChange = newBalance - lastBalanceRef.current

          if (Math.abs(balanceChange) > 0.01) {
            log(`💰 Balance change: ${balanceChange > 0 ? "+" : ""}${balanceChange.toFixed(2)}`, "warning")
            lastBalanceRef.current = newBalance

            if (balanceChangeTimeoutRef.current) {
              clearTimeout(balanceChangeTimeoutRef.current)
            }

            balanceChangeTimeoutRef.current = setTimeout(() => {
              checkPortfolioForNewTrade()
            }, 500)
          }
        }
        break

      case "portfolio":
        if (data.portfolio?.contracts && isActiveRef.current) {
          findAndReplicateLatestTrade(data.portfolio.contracts)
        }
        break
    }
  }

  const checkPortfolioForNewTrade = () => {
    if (masterWsRef.current && isActiveRef.current) {
      log("🔍 Checking portfolio for new trade...", "info")
      masterWsRef.current.send(JSON.stringify({ portfolio: 1, req_id: Date.now() }))
    }
  }

  const findAndReplicateLatestTrade = (contracts: any[]) => {
    if (!contracts || contracts.length === 0) {
      log("❌ No contracts in portfolio", "error")
      return
    }

    const sortedContracts = contracts
      .filter((c) => c.date_start && c.buy_price > 0)
      .sort((a, b) => b.date_start - a.date_start)

    if (sortedContracts.length === 0) {
      log("❌ No valid contracts found", "error")
      return
    }

    const latestContract = sortedContracts[0]
    const contractTime = latestContract.date_start
    const now = Date.now() / 1000
    const timeDiff = now - contractTime

    log(`📊 Latest contract: ${latestContract.contract_type} (${timeDiff.toFixed(1)}s ago)`, "info")

    if (timeDiff <= 30) {
      const tradeData = extractTradeDataFromContract(latestContract)
      if (tradeData) {
        log(`🚨 REPLICATING: ${tradeData.contract_type} $${tradeData.amount}`, "success")
        setStats((prev) => ({ ...prev, detected: prev.detected + 1 }))
        replicateTradeToClients(tradeData)
      }
    } else {
      log(`⏰ Contract too old (${timeDiff.toFixed(1)}s), skipping`, "warning")
    }
  }

  const extractTradeDataFromContract = (contract: any): TradeData | null => {
    try {
      if (
        !contract.contract_type ||
        (!contract.underlying && !contract.symbol) ||
        !contract.buy_price ||
        contract.buy_price <= 0
      ) {
        return null
      }

      return {
        contract_type: contract.contract_type,
        symbol: contract.underlying || contract.symbol,
        amount: Math.abs(contract.buy_price),
        duration: contract.duration || 5,
        duration_unit: contract.duration_unit || "t",
        basis: "stake",
        currency: contract.currency || "USD",
        ...(contract.barrier && { barrier: contract.barrier.toString() }),
        ...(contract.barrier2 && { barrier2: contract.barrier2.toString() }),
        ...(contract.prediction !== undefined && { prediction: contract.prediction }),
      }
    } catch (error) {
      log(`❌ Failed to extract trade data: ${error}`, "error")
      return null
    }
  }

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
        log(`📤 Proposal sent to ${client.loginid}: ${tradeData.contract_type} $${tradeData.amount}`, "info")
        updateClient(client.id, { total_copied: client.total_copied + 1 })
      } catch (error) {
        log(`❌ Failed to send to ${client.loginid}: ${error}`, "error")
        setStats((prev) => ({ ...prev, failed: prev.failed + 1 }))
      }
    })
  }

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

      ws.onopen = () => ws.send(JSON.stringify({ authorize: token.trim(), req_id: 1 }))
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        handleClientMessage(clientId, data)
      }
      ws.onerror = () => updateClient(clientId, { status: "error" })
      ws.onclose = () => updateClient(clientId, { status: "disconnected", ws: null })

      updateClient(clientId, { ws })
    } catch (error) {
      log(`Client connection failed: ${error}`, "error")
      updateClient(clientId, { status: "error" })
    }
  }

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
        if (data.proposal?.id && isActiveRef.current) {
          const client = clientsRef.current.find((c) => c.id === clientId)
          if (client?.ws) {
            const buyRequest = { buy: data.proposal.id, price: data.proposal.ask_price, req_id: Date.now() }
            client.ws.send(JSON.stringify(buyRequest))
            log(`💰 Auto-buying for ${client.loginid}`, "info")
          }
        }
        break

      case "buy":
        if (data.buy?.contract_id) {
          setStats((prev) => ({ ...prev, replicated: prev.replicated + 1 }))
          log(`✅ CLIENT SUCCESS: ${data.buy.shortcode}`, "success")
        }
        break
    }
  }

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
      setStats({ detected: 0, replicated: 0, failed: 0 })
      log(`🎯 REAL-TIME COPY STARTED with ${readyClients.length} clients`, "success")
    } else {
      if (balanceChangeTimeoutRef.current) clearTimeout(balanceChangeTimeoutRef.current)
      log("🛑 Real-time copy STOPPED", "warning")
    }
  }

  useEffect(() => {
    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current)
      if (balanceChangeTimeoutRef.current) clearTimeout(balanceChangeTimeoutRef.current)
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
        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "bold" }}>⚡ Real-Time Copy Trading</h3>
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
          {isActive ? "🟢 LIVE" : "🔴 INACTIVE"}
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
          {isActive ? "🛑 STOP LIVE" : "⚡ START LIVE"}
        </button>
      </div>

      {/* Activity Logs */}
      <div style={{ background: "white", borderRadius: "4px", padding: "6px", maxHeight: "120px", overflowY: "auto" }}>
        <div style={{ fontSize: "10px", fontWeight: "bold", marginBottom: "4px" }}>📋 Activity Log</div>
        {logs.length === 0 ? (
          <div style={{ fontSize: "9px", color: "#666", textAlign: "center", padding: "8px" }}>
            Waiting for balance changes...
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
    </div>
  )
})

const CopyTrading: React.FC = observer(() => {
  const [activeMode, setActiveMode] = useState<"copier" | "trader">("copier")

  return (
    <div style={{ padding: "8px", fontSize: "12px", background: "#f8f9fa", minHeight: "100%" }}>
      {/* Mode Toggle */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "16px",
          padding: "4px",
          background: "white",
          borderRadius: "8px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        <button
          onClick={() => setActiveMode("copier")}
          style={{
            flex: 1,
            padding: "12px 24px",
            border: "none",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
            background: activeMode === "copier" ? "#007bff" : "transparent",
            color: activeMode === "copier" ? "white" : "#666",
            transition: "all 0.2s ease",
          }}
        >
          📈 Copy Trades
        </button>
        <button
          onClick={() => setActiveMode("trader")}
          style={{
            flex: 1,
            padding: "12px 24px",
            border: "none",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
            background: activeMode === "trader" ? "#28a745" : "transparent",
            color: activeMode === "trader" ? "white" : "#666",
            transition: "all 0.2s ease",
          }}
        >
          👑 Become Trader
        </button>
      </div>

      {/* Content */}
      {activeMode === "copier" ? <RealTimeCopyTrading /> : <TraderManagement />}
    </div>
  )
})

export default CopyTrading
