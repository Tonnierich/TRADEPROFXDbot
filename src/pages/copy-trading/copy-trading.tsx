"use client"

import type React from "react"
import { useState } from "react"
import { observer } from "mobx-react-lite"
import TraderManagement from "./trader-management"
import RealTimeCopyTrading from "./real-time-copy-trading"

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
