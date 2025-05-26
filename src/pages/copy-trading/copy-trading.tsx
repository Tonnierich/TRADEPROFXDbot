"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { observer } from "mobx-react-lite"

interface ClientConnection {
  id: string
  token: string
  ws: WebSocket | null
  status: "connecting" | "connected" | "disconnected" | "error"
  balance: number
  accountInfo: any
  totalCopiedTrades: number
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

const COPYABLE_CONTRACTS = ["CALL", "PUT", "DIGITOVER", "DIGITUNDER", "DIGITMATCH", "DIGITDIFF", "HIGHER", "LOWER"]

const CopyTrading: React.FC = observer(() => {
  const [isActive, setIsActive] = useState(false)
  const [clientToken, setClientToken] = useState("")
  const [masterToken, setMasterToken] = useState(localStorage.getItem("ct_master") || "")
  const [clients, setClients] = useState<ClientConnection[]>([])
  const [masterWs, setMasterWs] = useState<WebSocket | null>(null)
  const [masterBalance, setMasterBalance] = useState(0)
  const [masterAccount, setMasterAccount] = useState("")
  const [isDemo, setIsDemo] = useState(true)
  const [logs, setLogs] = useState<string[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const [exactCopy, setExactCopy] = useState(true)
  const [copyRatio, setCopyRatio] = useState(1)
  const [stats, setStats] = useState({ master: 0, copied: 0, skipped: 0 })
  const [appId, setAppId] = useState("75760")

  const masterWsRef = useRef<WebSocket | null>(null)
  const clientsRef = useRef<ClientConnection[]>([])
  const isActiveRef = useRef(false)
  const processedRef = useRef<Set<string>>(new Set())
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    localStorage.setItem("ct_master", masterToken)
  }, [masterToken])

  useEffect(() => {
    masterWsRef.current = masterWs
    clientsRef.current = clients
    isActiveRef.current = isActive
  }, [masterWs, clients, isActive])

  const log = (msg: string, type = "info") => {
    const emoji = type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️"
    setLogs((prev) => [`${emoji} ${msg}`, ...prev.slice(0, 4)])
  }

  const startPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current)
    pollingRef.current = setInterval(() => {
      if (masterWsRef.current && isActiveRef.current) {
        masterWsRef.current.send(JSON.stringify({ portfolio: 1, req_id: Date.now() }))
      }
    }, 3000)
  }

  const connectMaster = () => {
    if (!masterToken) return log("Enter master token", "error")
    try {
      const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${appId}`)
      ws.onopen = () => ws.send(JSON.stringify({ authorize: masterToken, req_id: 1 }))
      ws.onmessage = (e) => handleMasterMsg(JSON.parse(e.data))
      ws.onerror = () => log("Master error", "error")
      ws.onclose = () => setMasterWs(null)
      setMasterWs(ws)
    } catch {
      log("Connect failed", "error")
    }
  }

  const handleMasterMsg = (data: any) => {
    if (data.error) return log(data.error.message, "error")

    switch (data.msg_type) {
      case "authorize":
        setMasterAccount(data.authorize.loginid)
        setMasterBalance(data.authorize.balance)
        log(`Master: ${data.authorize.loginid}`, "success")
        if (masterWsRef.current) {
          masterWsRef.current.send(JSON.stringify({ portfolio: 1, req_id: 2 }))
          masterWsRef.current.send(JSON.stringify({ balance: 1, subscribe: 1, req_id: 3 }))
        }
        break

      case "portfolio":
        if (data.portfolio?.contracts && isActiveRef.current) {
          const newContracts = data.portfolio.contracts.filter((c: any) => {
            const timeDiff = Date.now() - new Date(c.date_start * 1000).getTime()
            return (
              timeDiff < 30000 && timeDiff > 0 && !processedRef.current.has(c.contract_id.toString()) && c.buy_price > 0
            )
          })

          newContracts.forEach((contract: any) => {
            processedRef.current.add(contract.contract_id.toString())
            setStats((prev) => ({ ...prev, master: prev.master + 1 }))

            if (COPYABLE_CONTRACTS.includes(contract.contract_type)) {
              log(`Copying ${contract.contract_type}`, "success")
              replicateTrade({
                contract_type: contract.contract_type,
                symbol: contract.symbol,
                amount: exactCopy ? contract.buy_price : contract.buy_price * copyRatio,
                duration: contract.duration || 5,
                duration_unit: contract.duration_unit || "t",
                basis: "stake",
                currency: contract.currency || "USD",
                barrier: contract.barrier?.toString(),
                prediction: contract.prediction,
              })
            } else {
              setStats((prev) => ({ ...prev, skipped: prev.skipped + 1 }))
            }
          })
        }
        break
    }
  }

  const addClient = () => {
    if (!clientToken.trim() || clients.find((c) => c.token === clientToken.trim())) return
    const client: ClientConnection = {
      id: `c${Date.now()}`,
      token: clientToken.trim(),
      ws: null,
      status: "connecting",
      balance: 0,
      accountInfo: null,
      totalCopiedTrades: 0,
    }
    setClients((prev) => [...prev, client])
    setClientToken("")
    connectClient(client)
  }

  const connectClient = (client: ClientConnection) => {
    try {
      const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${appId}`)
      ws.onopen = () => ws.send(JSON.stringify({ authorize: client.token, req_id: Date.now() }))
      ws.onmessage = (e) => handleClientMsg(client.id, JSON.parse(e.data))
      ws.onerror = () => updateClient(client.id, { status: "error" })
      ws.onclose = () => updateClient(client.id, { status: "disconnected" })
      setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, ws } : c)))
    } catch {
      updateClient(client.id, { status: "error" })
    }
  }

  const handleClientMsg = (id: string, data: any) => {
    if (data.error) return
    switch (data.msg_type) {
      case "authorize":
        updateClient(id, { status: "connected", balance: data.authorize.balance, accountInfo: data.authorize })
        break
      case "proposal":
        if (data.proposal?.id) {
          const client = clientsRef.current.find((c) => c.id === id)
          client?.ws?.send(
            JSON.stringify({ buy: data.proposal.id, price: data.proposal.ask_price, req_id: Date.now() }),
          )
        }
        break
      case "buy":
        if (data.buy?.contract_id) {
          updateClient(id, { totalCopiedTrades: (clients.find((c) => c.id === id)?.totalCopiedTrades || 0) + 1 })
          setStats((prev) => ({ ...prev, copied: prev.copied + 1 }))
        }
        break
    }
  }

  const updateClient = (id: string, updates: Partial<ClientConnection>) => {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)))
  }

  const replicateTrade = (params: TradeParams) => {
    const connected = clientsRef.current.filter((c) => c.status === "connected" && c.ws)
    connected.forEach((client) => {
      const req = {
        proposal: 1,
        amount: Math.max(1, params.amount),
        basis: params.basis,
        contract_type: params.contract_type,
        currency: params.currency,
        symbol: params.symbol,
        duration: params.duration,
        duration_unit: params.duration_unit,
        req_id: Date.now(),
        ...(params.barrier && { barrier: params.barrier }),
        ...(params.prediction !== undefined && { prediction: params.prediction }),
      }
      client.ws?.send(JSON.stringify(req))
    })
  }

  const toggle = () => {
    if (!masterWs || !clients.some((c) => c.status === "connected")) return
    setIsActive(!isActive)
    if (!isActive) {
      processedRef.current.clear()
      startPolling()
      setStats({ master: 0, copied: 0, skipped: 0 })
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }

  const connectedCount = clients.filter((c) => c.status === "connected").length

  return (
    <div style={{ padding: "8px", fontSize: "11px", lineHeight: "1.2", maxHeight: "400px", overflowY: "auto" }}>
      {/* Compact Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "6px",
          padding: "4px 8px",
          background: "white",
          borderRadius: "4px",
          border: "1px solid #ddd",
        }}
      >
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            style={{
              padding: "2px 6px",
              fontSize: "10px",
              border: "1px solid #ddd",
              borderRadius: "2px",
              background: isDemo ? "#007bff" : "white",
              color: isDemo ? "white" : "black",
            }}
            onClick={() => setIsDemo(true)}
          >
            📊
          </button>
          <button
            style={{
              padding: "2px 6px",
              fontSize: "10px",
              border: "1px solid #ddd",
              borderRadius: "2px",
              background: !isDemo ? "#007bff" : "white",
              color: !isDemo ? "white" : "black",
            }}
            onClick={() => setIsDemo(false)}
          >
            💰
          </button>
        </div>
        <div
          style={{
            padding: "2px 6px",
            fontSize: "10px",
            fontWeight: "bold",
            borderRadius: "2px",
            background: isActive ? "#d4edda" : "#f8d7da",
            color: isActive ? "#155724" : "#721c24",
          }}
        >
          {isActive ? "🎯 ON" : "🔴 OFF"}
        </div>
      </div>

      {/* Ultra Compact Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "3px",
          marginBottom: "6px",
          fontSize: "9px",
        }}
      >
        <div style={{ textAlign: "center", padding: "3px", background: "#e3f2fd", borderRadius: "2px" }}>
          <div style={{ fontWeight: "bold" }}>{stats.master}</div>
          <div>Master</div>
        </div>
        <div style={{ textAlign: "center", padding: "3px", background: "#e8f5e8", borderRadius: "2px" }}>
          <div style={{ fontWeight: "bold" }}>{stats.copied}</div>
          <div>Copied</div>
        </div>
        <div style={{ textAlign: "center", padding: "3px", background: "#fff3e0", borderRadius: "2px" }}>
          <div style={{ fontWeight: "bold" }}>{stats.skipped}</div>
          <div>Skip</div>
        </div>
        <div style={{ textAlign: "center", padding: "3px", background: "#fce4ec", borderRadius: "2px" }}>
          <div style={{ fontWeight: "bold" }}>
            {stats.master > 0 ? Math.round((stats.copied / stats.master) * 100) : 0}%
          </div>
          <div>Rate</div>
        </div>
      </div>

      {/* Inline Controls */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "6px", alignItems: "center" }}>
        <select
          value={appId}
          onChange={(e) => setAppId(e.target.value)}
          style={{ fontSize: "9px", padding: "1px", width: "60px" }}
        >
          <option value="75760">75760</option>
          <option value="1089">1089</option>
        </select>
        <input
          type="password"
          placeholder="Master Token"
          value={masterToken}
          onChange={(e) => setMasterToken(e.target.value)}
          style={{ flex: 1, padding: "2px", fontSize: "9px", fontFamily: "monospace" }}
        />
        <button
          onClick={connectMaster}
          style={{
            padding: "2px 4px",
            fontSize: "9px",
            border: "none",
            borderRadius: "2px",
            background: masterWs ? "#28a745" : "#007bff",
            color: "white",
          }}
        >
          {masterWs ? "✅" : "🔗"}
        </button>
      </div>

      {/* Master Info */}
      {masterWs && (
        <div
          style={{
            fontSize: "9px",
            padding: "3px 6px",
            background: "linear-gradient(90deg, #667eea, #764ba2)",
            color: "white",
            borderRadius: "2px",
            marginBottom: "6px",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>{masterAccount}</span>
          <span>${masterBalance.toFixed(0)}</span>
        </div>
      )}

      {/* Settings Row */}
      <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "6px", fontSize: "9px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "2px" }}>
          <input type="checkbox" checked={exactCopy} onChange={(e) => setExactCopy(e.target.checked)} />
          Exact
        </label>
        {!exactCopy && (
          <input
            type="number"
            min="0.1"
            max="10"
            step="0.1"
            value={copyRatio}
            onChange={(e) => setCopyRatio(Number.parseFloat(e.target.value))}
            style={{ width: "30px", padding: "1px", fontSize: "9px" }}
          />
        )}
      </div>

      {/* Client Management */}
      <div style={{ marginBottom: "6px" }}>
        <div style={{ fontSize: "10px", fontWeight: "bold", marginBottom: "3px" }}>
          👥 Clients ({connectedCount}/{clients.length})
        </div>
        <div style={{ display: "flex", gap: "3px", marginBottom: "3px" }}>
          <input
            type="password"
            placeholder="Client Token"
            value={clientToken}
            onChange={(e) => setClientToken(e.target.value)}
            style={{ flex: 1, padding: "2px", fontSize: "9px", fontFamily: "monospace" }}
            onKeyPress={(e) => e.key === "Enter" && addClient()}
          />
          <button
            onClick={addClient}
            style={{
              padding: "2px 4px",
              fontSize: "9px",
              border: "none",
              borderRadius: "2px",
              background: "#007bff",
              color: "white",
            }}
          >
            ➕
          </button>
        </div>

        {/* Client List */}
        {clients.length > 0 && (
          <div style={{ maxHeight: "60px", overflowY: "auto" }}>
            {clients.map((client) => (
              <div
                key={client.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "2px 4px",
                  background: "#f8f9fa",
                  borderRadius: "2px",
                  marginBottom: "2px",
                  fontSize: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                  <span>{client.accountInfo?.loginid || client.id.slice(-4)}</span>
                  <span>{client.status === "connected" ? "✅" : client.status === "connecting" ? "🔄" : "❌"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                  <span>${client.balance.toFixed(0)}</span>
                  <span>{client.totalCopiedTrades}</span>
                  <button
                    onClick={() => setClients((prev) => prev.filter((c) => c.id !== client.id))}
                    style={{
                      padding: "1px 2px",
                      fontSize: "7px",
                      border: "none",
                      borderRadius: "1px",
                      background: "#dc3545",
                      color: "white",
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

      {/* Main Controls */}
      <div style={{ display: "flex", gap: "3px", marginBottom: "6px" }}>
        <button
          onClick={toggle}
          style={{
            flex: 1,
            padding: "4px",
            fontSize: "10px",
            border: "none",
            borderRadius: "3px",
            fontWeight: "bold",
            background: isActive ? "#dc3545" : "#28a745",
            color: "white",
            opacity: !masterWs || connectedCount === 0 ? 0.5 : 1,
          }}
          disabled={!masterWs || connectedCount === 0}
        >
          {isActive ? "⏹️ Stop" : "🎯 Start"}
        </button>
        <button
          onClick={() => setShowLogs(!showLogs)}
          style={{
            padding: "4px 6px",
            fontSize: "10px",
            border: "1px solid #ddd",
            borderRadius: "3px",
            background: "white",
          }}
        >
          📋
        </button>
      </div>

      {/* Compact Logs */}
      {showLogs && (
        <div
          style={{
            maxHeight: "50px",
            overflowY: "auto",
            background: "#f8f9fa",
            padding: "3px",
            borderRadius: "2px",
            marginBottom: "6px",
          }}
        >
          {logs.length === 0 ? (
            <div style={{ fontSize: "8px", color: "#666", textAlign: "center" }}>No activity...</div>
          ) : (
            logs.slice(0, 5).map((log, i) => (
              <div key={i} style={{ fontSize: "8px", fontFamily: "monospace", marginBottom: "1px" }}>
                {log}
              </div>
            ))
          )}
        </div>
      )}

      {/* Contract Support */}
      <div style={{ fontSize: "8px", color: "#666", lineHeight: "1.1" }}>
        <div style={{ color: "#28a745" }}>✅ CALL/PUT, DIGITS, HIGHER/LOWER</div>
        <div style={{ color: "#dc3545" }}>❌ Multipliers, Accumulators</div>
      </div>
    </div>
  )
})

export default CopyTrading
