"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { observer } from "mobx-react-lite"
import { useStore } from "@/hooks/useStore"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Copy, Users, TrendingUp, Eye, Play, Square, Settings, AlertCircle, CheckCircle, Info } from "lucide-react"

interface TraderStats {
  trader_id: string
  total_trades: number
  winning_trades: number
  losing_trades: number
  total_profit_loss: number
  win_rate: number
  avg_profit: number
  avg_loss: number
  copiers_count: number
  last_trade_time: number
  performance_probability: number
}

interface CopyingSession {
  copier_token: string
  trader_token: string
  trader_id: string
  start_time: number
  total_profit_loss: number
  total_trades: number
  status: "active" | "stopped"
}

const CopyTrading: React.FC = observer(() => {
  const store = useStore()

  // State management
  const [activeTab, setActiveTab] = useState<"copier" | "trader">("copier")
  const [allowCopiers, setAllowCopiers] = useState(false)
  const [traderToken, setTraderToken] = useState("")
  const [apiToken, setApiToken] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [traderStats, setTraderStats] = useState<TraderStats | null>(null)
  const [copyingSessions, setCopyingSessions] = useState<CopyingSession[]>([])
  const [myStats, setMyStats] = useState<TraderStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Deriv API connection
  const [ws, setWs] = useState<WebSocket | null>(null)

  useEffect(() => {
    // Initialize WebSocket connection to Deriv API
    const websocket = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089")

    websocket.onopen = () => {
      console.log("Connected to Deriv API")
      setWs(websocket)
    }

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      handleApiResponse(data)
    }

    websocket.onerror = (error) => {
      console.error("WebSocket error:", error)
      setError("Failed to connect to Deriv API")
    }

    websocket.onclose = () => {
      console.log("Disconnected from Deriv API")
      setWs(null)
    }

    return () => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.close()
      }
    }
  }, [])

  const handleApiResponse = (data: any) => {
    if (data.error) {
      setError(data.error.message)
      setIsLoading(false)
      return
    }

    switch (data.msg_type) {
      case "set_settings":
        if (data.set_settings === 1) {
          setSuccess("Copy trading settings updated successfully!")
          setAllowCopiers(data.echo_req.allow_copiers === 1)
        }
        break

      case "copytrading_statistics":
        setTraderStats(data.copytrading_statistics)
        break

      case "copy_start":
        if (data.copy_start === 1) {
          setSuccess("Started copying trader successfully!")
          loadCopyingSessions()
        }
        break

      case "copy_stop":
        if (data.copy_stop === 1) {
          setSuccess("Stopped copying trader successfully!")
          loadCopyingSessions()
        }
        break

      case "copytrading_list":
        setCopyingSessions(data.copytrading_list || [])
        break
    }

    setIsLoading(false)
  }

  const sendApiRequest = (request: any) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(request))
      setIsLoading(true)
      setError(null)
      setSuccess(null)
    } else {
      setError("Not connected to Deriv API")
    }
  }

  // Trader functions
  const enableCopyTrading = () => {
    sendApiRequest({
      set_settings: 1,
      allow_copiers: allowCopiers ? 1 : 0,
      authorize: apiToken,
    })
  }

  const generateApiToken = () => {
    // This would typically redirect to Deriv's OAuth flow
    window.open("https://app.deriv.com/account/api-token", "_blank")
    setSuccess("Please create a read-only API token and paste it above")
  }

  const loadMyStats = () => {
    if (!apiToken) {
      setError("Please enter your API token first")
      return
    }

    sendApiRequest({
      copytrading_statistics: 1,
      authorize: apiToken,
    })
  }

  // Copier functions
  const startCopying = () => {
    if (!traderToken || !apiToken) {
      setError("Please enter both trader token and your API token")
      return
    }

    sendApiRequest({
      copy_start: 1,
      copy_start: traderToken,
      authorize: apiToken,
    })
  }

  const stopCopying = (traderToken: string) => {
    sendApiRequest({
      copy_stop: 1,
      copy_stop: traderToken,
      authorize: apiToken,
    })
  }

  const loadTraderStats = () => {
    if (!traderToken) {
      setError("Please enter trader token first")
      return
    }

    sendApiRequest({
      copytrading_statistics: 1,
      trader_id: traderToken,
    })
  }

  const loadCopyingSessions = () => {
    if (!apiToken) return

    sendApiRequest({
      copytrading_list: 1,
      authorize: apiToken,
    })
  }

  useEffect(() => {
    if (apiToken && activeTab === "copier") {
      loadCopyingSessions()
    }
  }, [apiToken, activeTab])

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Copy className="h-8 w-8 text-primary" />
          Copy Trading
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Copy trades from experienced traders or allow others to copy your trades. Available for Options trading only.
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* API Token Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            API Configuration
          </CardTitle>
          <CardDescription>Enter your Deriv API token to enable copy trading features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-token">Your API Token</Label>
            <div className="flex gap-2">
              <Input
                id="api-token"
                type="password"
                placeholder="Enter your read-only API token"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
              />
              <Button onClick={generateApiToken} variant="outline">
                Generate Token
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Create a read-only API token from your Deriv account settings
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "copier" | "trader")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="copier" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Be a Copier
          </TabsTrigger>
          <TabsTrigger value="trader" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Be a Trader
          </TabsTrigger>
        </TabsList>

        {/* Copier Tab */}
        <TabsContent value="copier" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Copy a Trader</CardTitle>
              <CardDescription>Enter a trader's token to start copying their trades</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="trader-token">Trader's Token</Label>
                <div className="flex gap-2">
                  <Input
                    id="trader-token"
                    placeholder="Enter trader's read-only token"
                    value={traderToken}
                    onChange={(e) => setTraderToken(e.target.value)}
                  />
                  <Button onClick={loadTraderStats} variant="outline" disabled={isLoading}>
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                </div>
              </div>

              {traderStats && (
                <Card className="bg-muted/50">
                  <CardHeader>
                    <CardTitle className="text-lg">Trader Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{traderStats.win_rate.toFixed(1)}%</div>
                        <div className="text-sm text-muted-foreground">Win Rate</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{traderStats.total_trades}</div>
                        <div className="text-sm text-muted-foreground">Total Trades</div>
                      </div>
                      <div className="text-center">
                        <div
                          className={`text-2xl font-bold ${traderStats.total_profit_loss >= 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          ${traderStats.total_profit_loss.toFixed(2)}
                        </div>
                        <div className="text-sm text-muted-foreground">Total P&L</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{traderStats.copiers_count}</div>
                        <div className="text-sm text-muted-foreground">Copiers</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={startCopying} disabled={!traderToken || !apiToken || isLoading} className="w-full">
                <Play className="h-4 w-4 mr-2" />
                Start Copying
              </Button>
            </CardFooter>
          </Card>

          {/* Active Copy Sessions */}
          <Card>
            <CardHeader>
              <CardTitle>Your Copy Sessions</CardTitle>
              <CardDescription>Manage your active copy trading sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {copyingSessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Copy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No active copy sessions</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {copyingSessions.map((session, index) => (
                    <Card key={index} className="bg-muted/50">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="font-medium">Trader: {session.trader_id}</div>
                            <div className="text-sm text-muted-foreground">
                              Started: {new Date(session.start_time * 1000).toLocaleDateString()}
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <span>Trades: {session.total_trades}</span>
                              <span className={session.total_profit_loss >= 0 ? "text-green-600" : "text-red-600"}>
                                P&L: ${session.total_profit_loss.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={session.status === "active" ? "default" : "secondary"}>
                              {session.status}
                            </Badge>
                            {session.status === "active" && (
                              <Button size="sm" variant="outline" onClick={() => stopCopying(session.trader_token)}>
                                <Square className="h-4 w-4 mr-2" />
                                Stop
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trader Tab */}
        <TabsContent value="trader" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Allow Others to Copy You</CardTitle>
              <CardDescription>Enable copy trading to let others copy your trades</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="allow-copiers">Allow Copiers</Label>
                  <div className="text-sm text-muted-foreground">Let other users copy your trades</div>
                </div>
                <Switch id="allow-copiers" checked={allowCopiers} onCheckedChange={setAllowCopiers} />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={enableCopyTrading} disabled={!apiToken || isLoading} className="w-full">
                <Settings className="h-4 w-4 mr-2" />
                Update Settings
              </Button>
            </CardFooter>
          </Card>

          {/* Share Your Token */}
          {allowCopiers && (
            <Card>
              <CardHeader>
                <CardTitle>Share Your Token</CardTitle>
                <CardDescription>Share this read-only token with potential copiers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Your Trader Token</Label>
                  <div className="flex gap-2">
                    <Input value={apiToken} readOnly className="font-mono" />
                    <Button onClick={() => navigator.clipboard.writeText(apiToken)} variant="outline">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Only share read-only tokens. Never share tokens with trading permissions.
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Your Trading Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Your Trading Statistics</CardTitle>
              <CardDescription>View your performance stats that copiers can see</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={loadMyStats} disabled={!apiToken || isLoading} className="mb-4">
                <TrendingUp className="h-4 w-4 mr-2" />
                Load Statistics
              </Button>

              {myStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-muted/50">
                    <CardContent className="pt-6 text-center">
                      <div className="text-2xl font-bold text-green-600">{myStats.win_rate.toFixed(1)}%</div>
                      <div className="text-sm text-muted-foreground">Win Rate</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="pt-6 text-center">
                      <div className="text-2xl font-bold">{myStats.total_trades}</div>
                      <div className="text-sm text-muted-foreground">Total Trades</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="pt-6 text-center">
                      <div
                        className={`text-2xl font-bold ${myStats.total_profit_loss >= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        ${myStats.total_profit_loss.toFixed(2)}
                      </div>
                      <div className="text-sm text-muted-foreground">Total P&L</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="pt-6 text-center">
                      <div className="text-2xl font-bold text-blue-600">{myStats.copiers_count}</div>
                      <div className="text-sm text-muted-foreground">Copiers</div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-800 flex items-center gap-2">
            <Info className="h-5 w-5" />
            Important Information
          </CardTitle>
        </CardHeader>
        <CardContent className="text-blue-700 space-y-2">
          <p>• Copy trading is available only for Options trading</p>
          <p>• Always use read-only API tokens for security</p>
          <p>• Past performance doesn't guarantee future results</p>
          <p>• You can stop copying at any time</p>
          <p>• For MT5 copy trading, use MetaQuotes Signals</p>
        </CardContent>
      </Card>
    </div>
  )
})

export default CopyTrading
