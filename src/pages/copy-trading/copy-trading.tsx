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
  proposal_id?: string
  ask_price?: number
}

// Contract types that CAN be copied via API
const COPYABLE_CONTRACTS = [
  "CALL",
  "PUT",
  "DIGITOVER",
  "DIGITUNDER",
  "DIGITMATCH",
  "DIGITDIFF",
  "HIGHER",
  "LOWER",
  "ONETOUCH",
  "NOTOUCH",
  "EXPIRYRANGE",
  "EXPIRYMISS",
  "ASIANU",
  "ASIAND",
  "LBFLOATCALL",
  "LBFLOATPUT",
  "LBHIGHLOW",
]

// Contract types that CANNOT be copied
const NON_COPYABLE_CONTRACTS = [
  "MULTUP",
  "MULTDOWN", // Multipliers
  "ACCU", // Accumulators
  "VANILLALONGCALL",
  "VANILLALONGPUT", // Vanilla Options
  "TURBOSLONG",
  "TURBOSSHORT", // Turbos
]

const CopyTrading: React.FC = observer(() => {
  const loadSavedData = () => {
    try {
      const savedMasterToken = localStorage.getItem("copytrading_master_token") || ""
      const savedClients = JSON.parse(localStorage.getItem("copytrading_clients") || "[]")
      const savedSettings = JSON.parse(
        localStorage.getItem("copytrading_settings") ||
          JSON.stringify({
            copyRatio: 1,
            maxAmount: 100,
            minAmount: 1,
            exactCopy: true,
          }),
      )
      const savedIsDemo = localStorage.getItem("copytrading_is_demo") === "true"

      return { savedMasterToken, savedClients, savedSettings, savedIsDemo }
    } catch (error) {
      console.error("Error loading saved data:", error)
      return {
        savedMasterToken: "",
        savedClients: [],
        savedSettings: { copyRatio: 1, maxAmount: 100, minAmount: 1, exactCopy: true },
        savedIsDemo: true,
      }
    }
  }

  const { savedMasterToken, savedClients, savedSettings, savedIsDemo } = loadSavedData()

  const [isActive, setIsActive] = useState(false)
  const [clientToken, setClientToken] = useState("")
  const [masterToken, setMasterToken] = useState(savedMasterToken)
  const [clients, setClients] = useState<ClientConnection[]>([])
  const [masterWs, setMasterWs] = useState<WebSocket | null>(null)
  const [masterBalance, setMasterBalance] = useState(0)
  const [masterAccount, setMasterAccount] = useState("")
  const [isDemo, setIsDemo] = useState(savedIsDemo)
  const [logs, setLogs] = useState<string[]>([])
  const [showLogs, setShowLogs] = useState(true)
  const [copySettings, setCopySettings] = useState(savedSettings)
  const [totalMasterTrades, setTotalMasterTrades] = useState(0)
  const [totalCopiedTrades, setTotalCopiedTrades] = useState(0)
  const [skippedTrades, setSkippedTrades] = useState(0)
  const [appId, setAppId] = useState("75760") // Default to your custom app_id
  const [isTestingConnection, setIsTestingConnection] = useState(false)

  const masterWsRef = useRef<WebSocket | null>(null)
  const clientsRef = useRef<ClientConnection[]>([])
  const isActiveRef = useRef(false)
  const lastBalanceRef = useRef<number>(0)
  const processedContractsRef = useRef<Set<string>>(new Set())
  const pendingProposalsRef = useRef<Map<string, TradeParams>>(new Map())
  const lastPortfolioCheckRef = useRef<number>(0)
  const portfolioPollingRef = useRef<NodeJS.Timeout | null>(null)

  // Save data to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem("copytrading_master_token", masterToken)
  }, [masterToken])

  useEffect(() => {
    localStorage.setItem("copytrading_clients", JSON.stringify(clients.map((c) => ({ token: c.token, id: c.id }))))
  }, [clients])

  useEffect(() => {
    localStorage.setItem("copytrading_settings", JSON.stringify(copySettings))
  }, [copySettings])

  useEffect(() => {
    localStorage.setItem("copytrading_is_demo", isDemo.toString())
  }, [isDemo])

  // Restore clients on component mount
  useEffect(() => {
    if (savedClients.length > 0) {
      const restoredClients = savedClients.map((savedClient: any) => ({
        id: savedClient.id,
        token: savedClient.token,
        ws: null,
        status: "disconnected" as const,
        balance: 0,
        accountInfo: null,
        lastTrade: null,
        totalCopiedTrades: 0,
        totalProfit: 0,
      }))
      setClients(restoredClients)
      addLog(`Restored ${restoredClients.length} saved clients`, "info")
    }
  }, [])

  // Auto-reconnect master if token exists
  useEffect(() => {
    if (masterToken && !masterWs) {
      addLog("Auto-connecting to saved master account...", "info")
      setTimeout(() => connectMaster(), 1000)
    }
  }, [masterToken])

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
    setLogs((prev) => [logMessage, ...prev.slice(0, 49)])
    console.log(`[CopyTrading] ${message}`)
  }

  // 🎯 UNIVERSAL PORTFOLIO POLLING - Catches ALL trades
  const startPortfolioPolling = () => {
    if (portfolioPollingRef.current) {
      clearInterval(portfolioPollingRef.current)
    }

    portfolioPollingRef.current = setInterval(() => {
      if (masterWsRef.current && isActiveRef.current) {
        masterWsRef.current.send(
          JSON.stringify({
            portfolio: 1,
            req_id: Math.floor(Math.random() * 1000000),
          }),
        )
      }
    }, 2000) // Check every 2 seconds for new trades

    addLog("🔄 Started universal portfolio polling (every 2s)", "success")
  }

  const stopPortfolioPolling = () => {
    if (portfolioPollingRef.current) {
      clearInterval(portfolioPollingRef.current)
      portfolioPollingRef.current = null
      addLog("⏹️ Stopped portfolio polling", "info")
    }
  }

  const connectMaster = async () => {
    if (!masterToken) {
      addLog("Please enter master API token", "error")
      return
    }

    try {
      addLog(`Connecting to master account with app_id=${appId}...`)
      // Use the configurable app_id
      const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${appId}`)

      ws.onopen = () => {
        addLog(`Master WebSocket connected (app_id=${appId}), authorizing...`)
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
        stopPortfolioPolling()
      }

      setMasterWs(ws)
    } catch (error) {
      addLog("Failed to connect master account", "error")
      console.error("Master connection error:", error)
    }
  }

  const isContractCopyable = (contractType: string): boolean => {
    return COPYABLE_CONTRACTS.includes(contractType)
  }

  const extractTradeParamsFromContract = (contract: any): TradeParams | null => {
    try {
      if (!contract.contract_type || !contract.symbol || !contract.buy_price) {
        return null
      }

      // Check if contract type is copyable
      if (!isContractCopyable(contract.contract_type)) {
        addLog(`❌ Contract type ${contract.contract_type} is NOT copyable via API`, "warning")
        setSkippedTrades((prev) => prev + 1)
        return null
      }

      const tradeParams: TradeParams = {
        contract_type: contract.contract_type,
        symbol: contract.symbol,
        amount: Math.abs(contract.buy_price),
        duration: contract.duration || 5,
        duration_unit: contract.duration_unit || "t",
        basis: "stake",
        currency: contract.currency || "USD",
      }

      // Extract barriers from contract details
      if (contract.barrier) tradeParams.barrier = contract.barrier.toString()
      if (contract.barrier2) tradeParams.barrier2 = contract.barrier2.toString()
      if (contract.prediction !== undefined) tradeParams.prediction = contract.prediction

      // Extract barriers from shortcode for digit contracts
      if (
        contract.shortcode &&
        ["DIGITOVER", "DIGITUNDER", "DIGITMATCH", "DIGITDIFF"].includes(contract.contract_type)
      ) {
        const shortcodeParts = contract.shortcode.split("_")
        const barrierPart = shortcodeParts[shortcodeParts.length - 1]
        if (/^\d$/.test(barrierPart)) {
          tradeParams.barrier = barrierPart
        }
      }

      return tradeParams
    } catch (error) {
      addLog(`Error extracting contract params: ${error.message}`, "error")
      return null
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

        // Subscribe to multiple streams
        if (masterWsRef.current) {
          // Get initial portfolio
          masterWsRef.current.send(
            JSON.stringify({
              portfolio: 1,
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

          // Subscribe to transaction stream
          masterWsRef.current.send(
            JSON.stringify({
              transaction: 1,
              subscribe: 1,
              req_id: 4,
            }),
          )

          addLog("Subscribed to portfolio, balance, and transaction streams", "success")
        }
        break

      case "balance":
        const newBalance = data.balance.balance
        const balanceChange = newBalance - lastBalanceRef.current

        if (Math.abs(balanceChange) > 0.01 && isActiveRef.current) {
          setMasterBalance(newBalance)
          lastBalanceRef.current = newBalance

          if (balanceChange < 0) {
            addLog(`💰 Balance decreased: $${balanceChange.toFixed(2)} - Trade detected!`, "info")
            // Trigger immediate portfolio check
            if (masterWsRef.current) {
              masterWsRef.current.send(
                JSON.stringify({
                  portfolio: 1,
                  req_id: 5,
                }),
              )
            }
          }
        }
        break

      case "portfolio":
        if (data.portfolio && data.portfolio.contracts && isActiveRef.current) {
          const contracts = data.portfolio.contracts
          const currentTime = Date.now()

          // Find NEW contracts (within last 30 seconds and not processed)
          const newContracts = contracts.filter((contract: any) => {
            const contractTime = new Date(contract.date_start * 1000).getTime()
            const timeDiff = currentTime - contractTime
            const contractId = contract.contract_id.toString()

            return (
              timeDiff < 30000 && // Within last 30 seconds
              timeDiff > 0 && // Not future contracts
              !processedContractsRef.current.has(contractId) && // Not already processed
              contract.buy_price > 0 // Valid trade
            )
          })

          if (newContracts.length > 0) {
            addLog(`🎯 Found ${newContracts.length} NEW trade(s) in portfolio`, "success")

            newContracts.forEach((contract: any) => {
              const contractId = contract.contract_id.toString()
              processedContractsRef.current.add(contractId)

              setTotalMasterTrades((prev) => prev + 1)

              addLog(
                `📋 Master trade: ${contract.contract_type} on ${contract.symbol} ($${contract.buy_price})`,
                "info",
              )

              const tradeParams = extractTradeParamsFromContract(contract)
              if (tradeParams) {
                addLog(`✅ COPYABLE: ${contract.contract_type} - Replicating now...`, "success")
                replicateExactTrade(tradeParams)
              } else {
                addLog(`❌ SKIPPED: ${contract.contract_type} - Not copyable or invalid`, "warning")
              }
            })
          }
        }
        break

      case "transaction":
        if (data.transaction && data.transaction.action === "buy" && isActiveRef.current) {
          const transaction = data.transaction
          const contractId = transaction.contract_id?.toString()

          if (contractId && !processedContractsRef.current.has(contractId)) {
            addLog(`🚨 Transaction stream trade: ${transaction.contract_type} on ${transaction.symbol}`, "info")

            // Mark as processed to avoid duplicates
            processedContractsRef.current.add(contractId)

            const tradeParams = extractTradeParamsFromContract(transaction)
            if (tradeParams) {
              replicateExactTrade(tradeParams)
            }
          }
        }
        break

      case "proposal":
        if (data.proposal && data.proposal.id && isActiveRef.current) {
          const proposalId = data.proposal.id
          const echoReq = data.echo_req

          if (echoReq && isContractCopyable(echoReq.contract_type)) {
            const tradeParams = extractTradeParamsFromContract(echoReq)
            if (tradeParams) {
              tradeParams.proposal_id = proposalId
              tradeParams.ask_price = data.proposal.ask_price
              pendingProposalsRef.current.set(proposalId, tradeParams)
              addLog(`📝 Stored proposal: ${proposalId} for ${tradeParams.contract_type}`, "info")
            }
          }
        }
        break

      case "buy":
        if (data.buy && data.buy.contract_id && isActiveRef.current) {
          const contractId = data.buy.contract_id.toString()
          addLog(`💰 Master executed trade: ${contractId}`, "success")

          // Check if we have stored proposal details
          const echoReq = data.echo_req
          if (echoReq && echoReq.buy) {
            const proposalId = echoReq.buy
            const storedParams = pendingProposalsRef.current.get(proposalId)

            if (storedParams && !processedContractsRef.current.has(contractId)) {
              processedContractsRef.current.add(contractId)
              addLog(`🎯 Replicating from stored proposal: ${proposalId}`, "info")
              replicateExactTrade(storedParams)
              pendingProposalsRef.current.delete(proposalId)
            }
          }
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
      addLog(`Connecting client ${client.id} with app_id=${appId}...`)
      // Use the configurable app_id
      const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${appId}`)

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
        if (data.buy && data.buy.contract_id) {
          updateClient(clientId, {
            lastTrade: data.buy,
            totalCopiedTrades: (clients.find((c) => c.id === clientId)?.totalCopiedTrades || 0) + 1,
          })
          setTotalCopiedTrades((prev) => prev + 1)
          addLog(`🎯 TRADE COPIED to client ${clientId}: ${data.buy.contract_id}`, "success")
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

  const validateTradeParams = (tradeParams: TradeParams): boolean => {
    const { contract_type, symbol, amount } = tradeParams

    // Basic validation
    if (!contract_type || !symbol || !amount || amount <= 0) {
      addLog(
        `ERROR: Invalid basic parameters - contract_type: ${contract_type}, symbol: ${symbol}, amount: ${amount}`,
        "error",
      )
      return false
    }

    // Check if copyable
    if (!isContractCopyable(contract_type)) {
      addLog(`ERROR: ${contract_type} is not copyable via API`, "error")
      return false
    }

    // Contract-specific validation
    if (["DIGITOVER", "DIGITUNDER", "DIGITMATCH", "DIGITDIFF"].includes(contract_type)) {
      if (!tradeParams.barrier) {
        addLog(`ERROR: ${contract_type} requires barrier parameter`, "error")
        return false
      }
    }

    if (["EXPIRYRANGE", "EXPIRYMISS"].includes(contract_type)) {
      if (!tradeParams.barrier || !tradeParams.barrier2) {
        addLog(`ERROR: ${contract_type} requires barrier and barrier2 parameters`, "error")
        return false
      }
    }

    if (["HIGHER", "LOWER", "ONETOUCH", "NOTOUCH"].includes(contract_type)) {
      if (!tradeParams.barrier) {
        addLog(`ERROR: ${contract_type} requires barrier parameter`, "error")
        return false
      }
    }

    return true
  }

  const replicateExactTrade = (tradeParams: TradeParams) => {
    const connectedClients = clientsRef.current.filter((c) => c.status === "connected" && c.ws)

    if (connectedClients.length === 0) {
      addLog("No connected clients to replicate trade", "warning")
      return
    }

    // Validate trade parameters
    if (!validateTradeParams(tradeParams)) {
      addLog(`❌ Trade validation failed: ${JSON.stringify(tradeParams)}`, "error")
      return
    }

    addLog(`🎯 REPLICATING to ${connectedClients.length} client(s): ${tradeParams.contract_type}`, "success")

    connectedClients.forEach((client, index) => {
      setTimeout(() => {
        try {
          // Calculate amount
          let amount = copySettings.exactCopy ? tradeParams.amount : tradeParams.amount * copySettings.copyRatio

          if (!copySettings.exactCopy) {
            amount = Math.max(copySettings.minAmount, Math.min(copySettings.maxAmount, amount))
          }

          amount = Math.abs(amount)
          if (amount <= 0) {
            addLog(`Client ${client.id} invalid amount: ${amount}`, "error")
            return
          }

          // Check client balance
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

          // Add required parameters
          if (tradeParams.barrier) {
            proposalRequest.barrier = tradeParams.barrier
          }
          if (tradeParams.barrier2) {
            proposalRequest.barrier2 = tradeParams.barrier2
          }
          if (tradeParams.prediction !== undefined) {
            proposalRequest.prediction = tradeParams.prediction
          }

          addLog(`🚀 SENDING to client ${client.id}: ${tradeParams.contract_type} $${amount}`)
          console.log(`📤 Proposal for client ${client.id}:`, proposalRequest)

          client.ws?.send(JSON.stringify(proposalRequest))
        } catch (error) {
          addLog(`Failed to replicate trade to client ${client.id}: ${error.message}`, "error")
        }
      }, index * 100)
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
    replicateExactTrade(testTrade)
  }

  const removeClient = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId)
    if (client?.ws) {
      client.ws.close()
    }
    setClients((prev) => prev.filter((c) => c.id !== clientId))
    addLog(`Client ${clientId} removed`)
  }

  const clearAllData = () => {
    localStorage.removeItem("copytrading_master_token")
    localStorage.removeItem("copytrading_clients")
    localStorage.removeItem("copytrading_settings")
    localStorage.removeItem("copytrading_is_demo")

    setMasterToken("")
    setClients([])
    setCopySettings({ copyRatio: 1, maxAmount: 100, minAmount: 1, exactCopy: true })
    setIsDemo(true)
    setIsActive(false)
    setTotalMasterTrades(0)
    setTotalCopiedTrades(0)
    setSkippedTrades(0)

    if (masterWs) masterWs.close()
    clients.forEach((client) => client.ws?.close())
    stopPortfolioPolling()

    addLog("All data cleared and connections closed", "info")
  }

  const reconnectAll = () => {
    addLog("Reconnecting all accounts...", "info")

    if (masterToken && !masterWs) {
      connectMaster()
    }

    clients.forEach((client) => {
      if (client.status !== "connected") {
        connectClient(client)
      }
    })
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
      addLog("🎯 UNIVERSAL COPY TRADING STARTED - All contract types monitored!", "success")
      processedContractsRef.current.clear()
      pendingProposalsRef.current.clear()
      lastPortfolioCheckRef.current = Date.now()
      startPortfolioPolling()

      // Reset counters
      setTotalMasterTrades(0)
      setTotalCopiedTrades(0)
      setSkippedTrades(0)
    } else {
      addLog("COPY TRADING STOPPED", "warning")
      stopPortfolioPolling()
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

  const testConnection = async () => {
    setIsTestingConnection(true)
    addLog(`Testing WebSocket connection with app_id=${appId}...`, "info")

    try {
      const testWs = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${appId}`)

      const timeout = setTimeout(() => {
        testWs.close()
        addLog(`❌ Connection test failed - timeout with app_id=${appId}`, "error")
        setIsTestingConnection(false)
      }, 10000)

      testWs.onopen = () => {
        clearTimeout(timeout)
        addLog(`✅ Connection test successful with app_id=${appId}`, "success")
        testWs.close()
        setIsTestingConnection(false)
      }

      testWs.onerror = () => {
        clearTimeout(timeout)
        addLog(`❌ Connection test failed with app_id=${appId}`, "error")
        setIsTestingConnection(false)
      }
    } catch (error) {
      addLog(`❌ Connection test error: ${error.message}`, "error")
      setIsTestingConnection(false)
    }
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
          {isActive ? "🎯 UNIVERSAL COPY MODE" : "🔴 INACTIVE"}
        </div>
      </div>

      {/* App ID Configuration */}
      <div className="ct-section">
        <h3>🔧 WebSocket Configuration</h3>
        <div className="ct-input-row">
          <select
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            className="ct-input"
            disabled={masterWs || clients.some((c) => c.ws)}
          >
            <option value="75760">app_id=75760 (Recommended - Better Detection)</option>
            <option value="1089">app_id=1089 (Default - Basic Access)</option>
            <option value="custom">Custom App ID</option>
          </select>
          {appId === "custom" && (
            <input
              type="text"
              placeholder="Enter custom app_id"
              onChange={(e) => setAppId(e.target.value)}
              className="ct-input"
            />
          )}
          <button onClick={testConnection} className="ct-btn ct-btn-secondary" disabled={isTestingConnection}>
            {isTestingConnection ? "🔄 Testing..." : "🧪 Test Connection"}
          </button>
        </div>
        <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.5rem" }}>
          <strong>app_id=75760:</strong> Higher rate limits, better real-time detection
          <br />
          <strong>app_id=1089:</strong> Basic access, may miss some trades
        </div>
      </div>

      {/* Statistics */}
      <div className="ct-section">
        <h3>📊 Copy Statistics</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: "1rem",
            fontSize: "0.9rem",
          }}
        >
          <div style={{ textAlign: "center", padding: "0.5rem", background: "#e3f2fd", borderRadius: "0.4rem" }}>
            <div style={{ fontWeight: "bold", fontSize: "1.2rem", color: "#1976d2" }}>{totalMasterTrades}</div>
            <div>Master Trades</div>
          </div>
          <div style={{ textAlign: "center", padding: "0.5rem", background: "#e8f5e8", borderRadius: "0.4rem" }}>
            <div style={{ fontWeight: "bold", fontSize: "1.2rem", color: "#388e3c" }}>{totalCopiedTrades}</div>
            <div>Copied Trades</div>
          </div>
          <div style={{ textAlign: "center", padding: "0.5rem", background: "#fff3e0", borderRadius: "0.4rem" }}>
            <div style={{ fontWeight: "bold", fontSize: "1.2rem", color: "#f57c00" }}>{skippedTrades}</div>
            <div>Skipped</div>
          </div>
          <div style={{ textAlign: "center", padding: "0.5rem", background: "#fce4ec", borderRadius: "0.4rem" }}>
            <div style={{ fontWeight: "bold", fontSize: "1.2rem", color: "#c2185b" }}>
              {totalMasterTrades > 0 ? Math.round((totalCopiedTrades / totalMasterTrades) * 100) : 0}%
            </div>
            <div>Success Rate</div>
          </div>
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
            <label>
              <input
                type="checkbox"
                checked={copySettings.exactCopy}
                onChange={(e) => setCopySettings((prev) => ({ ...prev, exactCopy: e.target.checked }))}
              />
              🎯 Exact Copy (Same Amount)
            </label>
          </div>
        </div>
        {!copySettings.exactCopy && (
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
        )}
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
          {isActive ? "⏹️ Stop Universal Copy" : "🎯 Start Universal Copy"}
        </button>
        <button onClick={sendTestTrade} className="ct-btn ct-btn-secondary" disabled={!isActive}>
          🧪 Test Trade
        </button>
        <button onClick={reconnectAll} className="ct-btn ct-btn-secondary">
          🔄 Reconnect All
        </button>
        <button onClick={() => setShowLogs(!showLogs)} className="ct-btn ct-btn-secondary">
          📋 {showLogs ? "Hide" : "Show"} Logs
        </button>
        <button onClick={clearAllData} className="ct-btn ct-btn-danger">
          🗑️ Clear All
        </button>
      </div>

      {/* Activity Log */}
      {showLogs && (
        <div className="ct-section">
          <h3>📋 Activity Log (Universal Detection)</h3>
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

      {/* Contract Type Support */}
      <div className="ct-section">
        <h3>📋 Contract Type Support</h3>
        <div style={{ fontSize: "0.8rem", lineHeight: "1.4" }}>
          <div style={{ marginBottom: "0.8rem" }}>
            <strong style={{ color: "#28a745" }}>✅ COPYABLE:</strong>
            <div style={{ marginLeft: "1rem", color: "#666" }}>
              CALL/PUT, DIGITOVER/DIGITUNDER, DIGITMATCH/DIGITDIFF, HIGHER/LOWER, ONETOUCH/NOTOUCH,
              EXPIRYRANGE/EXPIRYMISS
            </div>
          </div>
          <div>
            <strong style={{ color: "#dc3545" }}>❌ NOT COPYABLE:</strong>
            <div style={{ marginLeft: "1rem", color: "#666" }}>
              Multipliers (MULTUP/MULTDOWN), Accumulators (ACCU), Vanilla Options, Turbos
            </div>
          </div>
        </div>
      </div>

      {/* Debug Info */}
      <div className="ct-section">
        <h3>🔧 Debug Info</h3>
        <div style={{ fontSize: "0.8rem", fontFamily: "monospace" }}>
          <p>Master WS: {masterWs ? "✅ Connected" : "❌ Disconnected"}</p>
          <p>Universal Copy Mode: {isActive ? "🎯 Active" : "❌ Inactive"}</p>
          <p>Portfolio Polling: {portfolioPollingRef.current ? "✅ Running" : "❌ Stopped"}</p>
          <p>Connected Clients: {clients.filter((c) => c.status === "connected").length}</p>
          <p>Processed Contracts: {processedContractsRef.current.size}</p>
          <p>Pending Proposals: {pendingProposalsRef.current.size}</p>
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
