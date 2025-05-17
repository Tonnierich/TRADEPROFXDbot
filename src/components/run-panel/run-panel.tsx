"use client"

import React from "react"
import classNames from "classnames"
import { observer } from "mobx-react-lite"
import Journal from "@/components/journal"
import SelfExclusion from "@/components/self-exclusion"
import Button from "@/components/shared_ui/button"
import Drawer from "@/components/shared_ui/drawer"
import Modal from "@/components/shared_ui/modal"
import Money from "@/components/shared_ui/money"
import Tabs from "@/components/shared_ui/tabs"
import Text from "@/components/shared_ui/text"
import Summary from "@/components/summary"
import TradeAnimation from "@/components/trade-animation"
import Transactions from "@/components/transactions"
import { DBOT_TABS } from "@/constants/bot-contents"
import { popover_zindex } from "@/constants/z-indexes"
import { useStore } from "@/hooks/useStore"
import { Localize, localize } from "@deriv-com/translations"
import { useDevice } from "@deriv-com/ui"
import ThemedScrollbars from "../shared_ui/themed-scrollbars"
import "./run-panel.scss"

type TStatisticsTile = {
  content: React.ElementType | string
  contentClassName: string
  title: string
}

type TStatisticsSummary = {
  currency: string
  is_mobile: boolean
  lost_contracts: number
  number_of_runs: number
  total_stake: number
  total_payout: number
  toggleStatisticsInfoModal: () => void
  total_profit: number
  won_contracts: number
}
type TDrawerHeader = {
  is_clear_stat_disabled: boolean
  is_mobile: boolean
  is_drawer_open: boolean
  onClearStatClick: () => void
}

type TDrawerContent = {
  active_index: number
  is_drawer_open: boolean
  active_tour: string
  setActiveTabIndex: () => void
}

type TDrawerFooter = {
  is_clear_stat_disabled: boolean
  onClearStatClick: () => void
}

type TStatisticsInfoModal = {
  is_mobile: boolean
  is_statistics_info_modal_open: boolean
  toggleStatisticsInfoModal: () => void
}

const StatisticsTile = ({ content, contentClassName, title }: TStatisticsTile) => (
  <div className="run-panel__tile">
    <div className="run-panel__tile-title">{title}</div>
    <div className={classNames("run-panel__tile-content", contentClassName)}>{content}</div>
  </div>
)

export const StatisticsSummary = ({
  currency,
  is_mobile,
  lost_contracts,
  number_of_runs,
  total_stake,
  total_payout,
  toggleStatisticsInfoModal,
  total_profit,
  won_contracts,
}: TStatisticsSummary) => (
  <div
    className={classNames("run-panel__stat", {
      "run-panel__stat--mobile": is_mobile,
    })}
  >
    <div className="run-panel__stat--info" onClick={toggleStatisticsInfoModal}>
      <div className="run-panel__stat--info-item">
        <Localize i18n_default_text="What's this?" />
      </div>
    </div>
    <div className="run-panel__stat--tiles">
      <StatisticsTile
        title={localize("Total stake")}
        alignment="top"
        content={<Money amount={total_stake} currency={currency} show_currency />}
      />
      <StatisticsTile
        title={localize("Total payout")}
        alignment="top"
        content={<Money amount={total_payout} currency={currency} show_currency />}
      />
      <StatisticsTile title={localize("No. of runs")} alignment="top" content={number_of_runs} />
      <StatisticsTile title={localize("Contracts lost")} alignment="bottom" content={lost_contracts} />
      <StatisticsTile title={localize("Contracts won")} alignment="bottom" content={won_contracts} />
      <StatisticsTile
        title={localize("Total profit/loss")}
        content={<Money amount={total_profit} currency={currency} has_sign show_currency />}
        alignment="bottom"
        contentClassName={classNames("run-panel__stat-amount", {
          "run-panel__stat-amount--positive": total_profit > 0,
          "run-panel__stat-amount--negative": total_profit < 0,
        })}
      />
    </div>
  </div>
)

const DrawerHeader = ({ is_clear_stat_disabled, is_mobile, is_drawer_open, onClearStatClick }: TDrawerHeader) =>
  is_mobile &&
  is_drawer_open && (
    <Button
      id="db-run-panel__clear-button"
      className="run-panel__clear-button"
      disabled={is_clear_stat_disabled}
      text={localize("Reset")}
      onClick={onClearStatClick}
      secondary
    />
  )

const DrawerContent = ({ active_index, is_drawer_open, active_tour, setActiveTabIndex, ...props }: TDrawerContent) => {
  const { isDesktop } = useDevice()
  // Use the useBlockScroll hook to prevent body scrolling when drawer is open on mobile

  React.useEffect(() => {
    if (!isDesktop && is_drawer_open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }

    return () => {
      document.body.style.overflow = ""
    }
  }, [is_drawer_open])

  return (
    <>
      <Tabs active_index={active_index} onTabItemClick={setActiveTabIndex} top>
        <div id="db-run-panel-tab__summary" label={<Localize i18n_default_text="Summary" />}>
          <Summary is_drawer_open={is_drawer_open} />
        </div>
        <div id="db-run-panel-tab__transactions" label={<Localize i18n_default_text="Transactions" />}>
          <Transactions is_drawer_open={is_drawer_open} />
        </div>
        <div id="db-run-panel-tab__journal" label={<Localize i18n_default_text="Journal" />}>
          <Journal />
        </div>
      </Tabs>
      {((is_drawer_open && active_index !== 2) || active_tour) && <StatisticsSummary {...props} />}
    </>
  )
}

const DrawerFooter = ({ is_clear_stat_disabled, onClearStatClick }: TDrawerFooter) => (
  <div className="run-panel__footer">
    <Button
      id="db-run-panel__clear-button"
      className="run-panel__footer-button"
      disabled={is_clear_stat_disabled}
      onClick={onClearStatClick}
      has_effect
      secondary
    >
      <span>
        <Localize i18n_default_text="Reset" />
      </span>
    </Button>
  </div>
)

const MobileDrawerFooter = () => {
  return (
    <div className="controls__section">
      <div className="controls__buttons">
        <TradeAnimation className="controls__animation" should_show_overlay />
      </div>
    </div>
  )
}

const StatisticsInfoModal = ({
  is_mobile,
  is_statistics_info_modal_open,
  toggleStatisticsInfoModal,
}: TStatisticsInfoModal) => {
  return (
    <Modal
      className={classNames("statistics__modal", { "statistics__modal--mobile": is_mobile })}
      title={localize("What's this?")}
      is_open={is_statistics_info_modal_open}
      toggleModal={toggleStatisticsInfoModal}
      width={"440px"}
    >
      <Modal.Body>
        <div className={classNames("statistics__modal-body", { "statistics__modal-body--mobile": is_mobile })}>
          <ThemedScrollbars className="statistics__modal-scrollbar">
            <Text as="p" weight="bold" className="statistics__modal-body--content no-margin">
              <Localize i18n_default_text="Total stake" />
            </Text>
            <Text as="p">
              <Localize i18n_default_text="Total stake since you last cleared your stats." />
            </Text>
            <Text as="p" weight="bold" className="statistics__modal-body--content">
              <Localize i18n_default_text="Total payout" />
            </Text>
            <Text as="p">{localize("Total payout since you last cleared your stats.")}</Text>
            <Text as="p" weight="bold" className="statistics__modal-body--content">
              <Localize i18n_default_text="No. of runs" />
            </Text>
            <Text as="p">
              <Localize i18n_default_text="The number of times your bot has run since you last cleared your stats. Each run includes the execution of all the root blocks." />
            </Text>
            <Text as="p" weight="bold" className="statistics__modal-body--content">
              <Localize i18n_default_text="Contracts lost" />
            </Text>
            <Text as="p">
              <Localize i18n_default_text="The number of contracts you have lost since you last cleared your stats." />
            </Text>
            <Text as="p" weight="bold" className="statistics__modal-body--content">
              <Localize i18n_default_text="Contracts won" />
            </Text>
            <Text as="p">
              <Localize i18n_default_text="The number of contracts you have won since you last cleared your stats." />
            </Text>
            <Text as="p" weight="bold" className="statistics__modal-body--content">
              <Localize i18n_default_text="Total profit/loss" />
            </Text>
            <Text as="p">
              <Localize i18n_default_text="Your total profit/loss since you last cleared your stats. It is the difference between your total payout and your total stake." />
            </Text>
          </ThemedScrollbars>
        </div>
      </Modal.Body>
    </Modal>
  )
}

// Global toggle button manager
const GlobalToggleManager = {
  toggles: {},

  // Create a toggle button for a specific tab
  createToggle: (tabId, isDrawerOpen, toggleDrawerFn) => {
    // Remove existing toggle if any
    GlobalToggleManager.removeToggle(tabId)

    // Create new toggle
    const toggle = document.createElement("div")
    toggle.id = `mobile-toggle-${tabId}`
    toggle.className = "mobile-persistent-toggle"
    toggle.setAttribute("data-tab", tabId)

    // Set the arrow direction based on drawer state
    toggle.innerHTML = isDrawerOpen ? "▼" : "▲"

    // Add click handler
    toggle.addEventListener("click", (e) => {
      e.stopPropagation()
      e.preventDefault()

      if (typeof toggleDrawerFn === "function") {
        toggleDrawerFn()

        // Update the arrow direction
        setTimeout(() => {
          toggle.innerHTML = !isDrawerOpen ? "▼" : "▲"
        }, 100)
      }
    })

    // Style the toggle
    toggle.style.cssText = `
            display: flex !important;
            visibility: visible !important;
            opacity: 1 !important;
            position: fixed !important;
            top: 180px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            z-index: 10000 !important;
            width: 80px !important;
            height: 30px !important;
            background-color: var(--general-main-1) !important;
            border: 1px solid var(--border-normal) !important;
            border-radius: 4px !important;
            justify-content: center !important;
            align-items: center !important;
            cursor: pointer !important;
            font-size: 18px !important;
            font-weight: bold !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
        `

    // Add to the document body
    document.body.appendChild(toggle)

    // Store the toggle reference
    GlobalToggleManager.toggles[tabId] = toggle

    return toggle
  },

  // Remove a toggle button for a specific tab
  removeToggle: (tabId) => {
    const toggle = document.getElementById(`mobile-toggle-${tabId}`)
    if (toggle) {
      try {
        document.body.removeChild(toggle)
      } catch (e) {
        console.log(`Toggle for ${tabId} not in DOM`)
      }
      delete GlobalToggleManager.toggles[tabId]
    }
  },

  // Remove all toggle buttons
  removeAllToggles: () => {
    Object.keys(GlobalToggleManager.toggles).forEach((tabId) => {
      GlobalToggleManager.removeToggle(tabId)
    })
  },

  // Update a toggle button's state
  updateToggle: (tabId, isDrawerOpen) => {
    const toggle = document.getElementById(`mobile-toggle-${tabId}`)
    if (toggle) {
      toggle.innerHTML = isDrawerOpen ? "▼" : "▲"
    }
  },

  // Ensure a toggle button is visible
  ensureToggleVisible: (tabId) => {
    const toggle = document.getElementById(`mobile-toggle-${tabId}`)
    if (!toggle && GlobalToggleManager.toggles[tabId]) {
      document.body.appendChild(GlobalToggleManager.toggles[tabId])
    }
  },
}

const RunPanel = observer(() => {
  const { run_panel, dashboard, transactions } = useStore()
  const { client } = useStore()
  const { isDesktop } = useDevice()
  const { currency } = client
  const {
    active_index,
    is_drawer_open,
    is_statistics_info_modal_open,
    is_clear_stat_disabled,
    onClearStatClick,
    onMount,
    onRunButtonClick,
    onUnmount,
    setActiveTabIndex,
    toggleDrawer,
    toggleStatisticsInfoModal,
  } = run_panel
  const { statistics } = transactions
  const { active_tour, active_tab } = dashboard
  const { total_payout, total_profit, total_stake, won_contracts, lost_contracts, number_of_runs } = statistics
  const { BOT_BUILDER, CHART, ANALYSIS } = DBOT_TABS

  // Add state to track if we're in a mobile view
  const isMobile = !isDesktop

  // Add state to track if we should force the drawer to stay open
  const [forceDrawerOpen, setForceDrawerOpen] = React.useState(false)

  // Add ref to track the last active tab
  const lastActiveTabRef = React.useRef(active_tab)

  // Add ref to track if we're currently running the bot
  const isRunningRef = React.useRef(false)

  // Function to ensure the drawer is properly positioned for mobile
  const ensureMobileDrawerVisibility = React.useCallback(() => {
    if (!isMobile) return

    const drawerElement = document.querySelector(".dc-drawer")
    if (drawerElement && is_drawer_open) {
      drawerElement.setAttribute(
        "style",
        "transform: none !important; visibility: visible !important; opacity: 1 !important; transition: none !important; position: fixed !important; bottom: 0 !important; left: 0 !important; width: 100% !important; height: auto !important; max-height: 50vh !important; z-index: 9999 !important;",
      )
    }

    // Also ensure the tabs are visible
    const tabsList = document.querySelector(".dc-tabs__list")
    if (tabsList) {
      tabsList.setAttribute(
        "style",
        "display: flex !important; visibility: visible !important; opacity: 1 !important; z-index: 10000 !important;",
      )
    }

    // Ensure each tab item is visible
    const tabItems = document.querySelectorAll(".dc-tabs__item")
    tabItems.forEach((item) => {
      item.setAttribute(
        "style",
        "display: flex !important; visibility: visible !important; opacity: 1 !important; pointer-events: auto !important;",
      )
    })
  }, [isMobile, is_drawer_open])

  // Custom toggle function to handle mobile differently
  const handleToggleDrawer = React.useCallback(() => {
    if (isMobile) {
      // Store the current state of the drawer
      const wasOpen = is_drawer_open

      // Call the original toggleDrawer function
      toggleDrawer()

      // Update the toggle button
      setTimeout(() => {
        GlobalToggleManager.updateToggle(active_tab, !wasOpen)

        // If we're closing the drawer, make sure it stays visible but collapsed
        if (wasOpen) {
          const drawerElement = document.querySelector(".dc-drawer")
          if (drawerElement) {
            drawerElement.setAttribute(
              "style",
              "transform: translateY(80%) !important; visibility: visible !important; opacity: 1 !important; transition: transform 0.3s ease !important; position: fixed !important; bottom: 0 !important; left: 0 !important; width: 100% !important; height: auto !important; max-height: 50vh !important; z-index: 9999 !important;",
            )
          }
        } else {
          // If we're opening the drawer, ensure it's fully visible
          ensureMobileDrawerVisibility()
        }
      }, 50)

      // Prevent the toggle from disappearing
      setForceDrawerOpen(true)
      setTimeout(() => setForceDrawerOpen(false), 500)
    } else {
      // For desktop, use normal toggle
      toggleDrawer()
    }
  }, [isMobile, is_drawer_open, toggleDrawer, active_tab, ensureMobileDrawerVisibility])

  // Effect to handle component mount/unmount
  React.useEffect(() => {
    onMount()

    // Add global class for mobile
    if (isMobile) {
      document.body.classList.add("dbot-mobile")
    }

    return () => {
      onUnmount()

      // Clean up
      if (isMobile) {
        document.body.classList.remove("dbot-mobile")
        GlobalToggleManager.removeAllToggles()
      }
    }
  }, [onMount, onUnmount, isMobile])

  // Effect to handle tab changes
  React.useEffect(() => {
    // Track if the tab has changed
    const tabChanged = lastActiveTabRef.current !== active_tab
    lastActiveTabRef.current = active_tab

    // Add appropriate classes based on active tab
    document.body.classList.remove("dbot-bot-builder-active", "dbot-chart-active", "dbot-analysis-active")

    if (active_tab === BOT_BUILDER) {
      document.body.classList.add("dbot-bot-builder-active")
    } else if (active_tab === CHART) {
      document.body.classList.add("dbot-chart-active")
    } else if (active_tab === ANALYSIS) {
      document.body.classList.add("dbot-analysis-active")
    }

    // For mobile devices, handle the toggle button
    if (isMobile) {
      // If tab changed, create a new toggle for this tab
      if (tabChanged) {
        // Remove any existing toggles
        GlobalToggleManager.removeAllToggles()

        // Create a new toggle for this tab
        if ([BOT_BUILDER, CHART, ANALYSIS].includes(active_tab)) {
          GlobalToggleManager.createToggle(active_tab, is_drawer_open, handleToggleDrawer)
        }
      }

      // Ensure the drawer is properly positioned
      if ([BOT_BUILDER, CHART, ANALYSIS].includes(active_tab)) {
        // Keep drawer open on mobile
        if (!is_drawer_open && !isRunningRef.current) {
          toggleDrawer(true)
        }

        // Ensure drawer visibility
        ensureMobileDrawerVisibility()
        setTimeout(ensureMobileDrawerVisibility, 300)
        setTimeout(ensureMobileDrawerVisibility, 1000)
      }
    }
  }, [
    active_tab,
    BOT_BUILDER,
    CHART,
    ANALYSIS,
    isMobile,
    is_drawer_open,
    toggleDrawer,
    handleToggleDrawer,
    ensureMobileDrawerVisibility,
  ])

  // Effect to handle drawer state changes
  React.useEffect(() => {
    if (isMobile) {
      // Update the toggle button
      GlobalToggleManager.updateToggle(active_tab, is_drawer_open)

      // Ensure drawer visibility when open
      if (is_drawer_open) {
        ensureMobileDrawerVisibility()
      }
    }
  }, [is_drawer_open, isMobile, active_tab, ensureMobileDrawerVisibility])

  // Custom run button click handler to track when the bot is running
  const handleRunButtonClick = React.useCallback(() => {
    isRunningRef.current = true

    // Call the original handler
    if (typeof onRunButtonClick === "function") {
      onRunButtonClick()
    }
  }, [onRunButtonClick])

  const content = (
    <DrawerContent
      active_index={active_index}
      currency={currency}
      is_drawer_open={is_drawer_open}
      is_mobile={isMobile}
      lost_contracts={lost_contracts}
      number_of_runs={number_of_runs}
      setActiveTabIndex={setActiveTabIndex}
      toggleStatisticsInfoModal={toggleStatisticsInfoModal}
      total_payout={total_payout}
      total_profit={total_profit}
      total_stake={total_stake}
      won_contracts={won_contracts}
      active_tour={active_tour}
    />
  )

  const footer = <DrawerFooter is_clear_stat_disabled={is_clear_stat_disabled} onClearStatClick={onClearStatClick} />

  const header = (
    <DrawerHeader
      is_clear_stat_disabled={is_clear_stat_disabled}
      is_mobile={isMobile}
      is_drawer_open={is_drawer_open}
      onClearStatClick={onClearStatClick}
    />
  )

  // Show run panel for BOT_BUILDER, CHART, and ANALYSIS tabs
  const show_run_panel = [BOT_BUILDER, CHART, ANALYSIS].includes(active_tab) || active_tour
  if ((!show_run_panel && isDesktop) || active_tour === "bot_builder") return null

  return (
    <>
      <div className={!isDesktop && is_drawer_open ? "run-panel__container--mobile" : "run-panel"}>
        <Drawer
          anchor="right"
          className={classNames("run-panel", {
            "run-panel__container": isDesktop,
            "run-panel__container--tour-active": isDesktop && active_tour,
            "run-panel__container--analysis": active_tab === ANALYSIS,
            "run-panel__container--bot-builder": active_tab === BOT_BUILDER,
            "run-panel__container--chart": active_tab === CHART,
            "run-panel__container--mobile": isMobile,
          })}
          contentClassName="run-panel__content"
          header={header}
          footer={isDesktop && footer}
          is_open={is_drawer_open}
          toggleDrawer={handleToggleDrawer} // Use our custom toggle function
          width={366}
          zIndex={popover_zindex.RUN_PANEL}
        >
          {content}
        </Drawer>
        {!isDesktop && <MobileDrawerFooter />}
      </div>
      <SelfExclusion onRunButtonClick={handleRunButtonClick} />
      <StatisticsInfoModal
        is_mobile={isMobile}
        is_statistics_info_modal_open={is_statistics_info_modal_open}
        toggleStatisticsInfoModal={toggleStatisticsInfoModal}
      />
    </>
  )
})

export default RunPanel
