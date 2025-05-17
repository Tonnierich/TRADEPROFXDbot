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
    <div className="run-panel__mobile-header">
      <div className="run-panel__mobile-header-title">
        <Localize i18n_default_text="Trading Statistics" />
      </div>
      <Button
        id="db-run-panel__clear-button"
        className="run-panel__clear-button"
        disabled={is_clear_stat_disabled}
        text={localize("Reset")}
        onClick={onClearStatClick}
        secondary
      />
    </div>
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

// Mobile drawer state manager
const MobileDrawerManager = {
  // Create a toggle button for mobile
  createToggleButton: (isDrawerOpen, toggleDrawerFn) => {
    // Remove any existing toggle button
    const existingToggle = document.getElementById("mobile-drawer-toggle")
    if (existingToggle) {
      try {
        document.body.removeChild(existingToggle)
      } catch (e) {
        console.log("Toggle button not in DOM")
      }
    }

    // Create a new toggle button
    const toggle = document.createElement("div")
    toggle.id = "mobile-drawer-toggle"
    toggle.className = "mobile-drawer-toggle"

    // Set the arrow direction based on drawer state
    toggle.innerHTML = isDrawerOpen ? "▼" : "▲"

    // Add click handler
    toggle.addEventListener("click", (e) => {
      e.stopPropagation()
      e.preventDefault()

      if (typeof toggleDrawerFn === "function") {
        toggleDrawerFn()

        // Update the arrow direction after a short delay
        setTimeout(() => {
          toggle.innerHTML = !isDrawerOpen ? "▼" : "▲"
        }, 100)
      }
    })

    // Style the toggle button
    toggle.style.cssText = `
      display: flex !important;
      visibility: visible !important;
      opacity: 1 !important;
      position: fixed !important;
      bottom: ${isDrawerOpen ? "calc(80vh - 24px)" : "0"} !important;
      left: 0 !important;
      right: 0 !important;
      width: 100% !important;
      height: 24px !important;
      background-color: var(--general-main-1) !important;
      border-top: 1px solid var(--border-normal) !important;
      justify-content: center !important;
      align-items: center !important;
      cursor: pointer !important;
      font-size: 16px !important;
      z-index: 10001 !important;
      transition: bottom 0.3s ease !important;
    `

    // Add to the document body
    document.body.appendChild(toggle)

    return toggle
  },

  // Update the toggle button position
  updateTogglePosition: (isDrawerOpen) => {
    const toggle = document.getElementById("mobile-drawer-toggle")
    if (toggle) {
      toggle.style.bottom = isDrawerOpen ? "calc(80vh - 24px)" : "0"
      toggle.innerHTML = isDrawerOpen ? "▼" : "▲"
    }
  },

  // Position the drawer for mobile
  positionDrawer: (isDrawerOpen) => {
    const drawerElement = document.querySelector(".dc-drawer")
    if (drawerElement) {
      if (isDrawerOpen) {
        // Expanded state - cover 80% of the screen
        drawerElement.setAttribute(
          "style",
          "transform: none !important; visibility: visible !important; opacity: 1 !important; transition: height 0.3s ease !important; position: fixed !important; bottom: 0 !important; left: 0 !important; width: 100% !important; height: 80vh !important; z-index: 10000 !important; border-top: 1px solid var(--border-normal) !important;",
        )
      } else {
        // Collapsed state - show only a small strip
        drawerElement.setAttribute(
          "style",
          "transform: translateY(calc(100% - 50px)) !important; visibility: visible !important; opacity: 1 !important; transition: transform 0.3s ease !important; position: fixed !important; bottom: 0 !important; left: 0 !important; width: 100% !important; height: 80vh !important; z-index: 10000 !important; border-top: 1px solid var(--border-normal) !important;",
        )
      }
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

  // Add ref to track the toggle button
  const toggleButtonRef = React.useRef(null)

  // Add ref to track the last drawer state
  const lastDrawerStateRef = React.useRef(is_drawer_open)

  // Add ref to track if we're currently running the bot
  const isRunningRef = React.useRef(false)

  // Custom toggle function for mobile
  const handleMobileToggle = React.useCallback(() => {
    // Store the current state
    const wasOpen = is_drawer_open

    // Toggle the drawer
    toggleDrawer()

    // Update the last state
    lastDrawerStateRef.current = !wasOpen

    // Update the toggle button and drawer position
    setTimeout(() => {
      MobileDrawerManager.updateTogglePosition(!wasOpen)
      MobileDrawerManager.positionDrawer(!wasOpen)
    }, 50)
  }, [is_drawer_open, toggleDrawer])

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
        const toggle = document.getElementById("mobile-drawer-toggle")
        if (toggle) {
          try {
            document.body.removeChild(toggle)
          } catch (e) {
            console.log("Toggle button not in DOM during cleanup")
          }
        }
      }
    }
  }, [onMount, onUnmount, isMobile])

  // Effect to handle mobile drawer setup
  React.useEffect(() => {
    if (isMobile) {
      // Create the toggle button
      toggleButtonRef.current = MobileDrawerManager.createToggleButton(is_drawer_open, handleMobileToggle)

      // Position the drawer
      MobileDrawerManager.positionDrawer(is_drawer_open)

      // Update when drawer state changes
      if (lastDrawerStateRef.current !== is_drawer_open) {
        lastDrawerStateRef.current = is_drawer_open
        MobileDrawerManager.updateTogglePosition(is_drawer_open)
      }
    }
  }, [isMobile, is_drawer_open, handleMobileToggle])

  // Effect to handle tab changes
  React.useEffect(() => {
    // Add appropriate classes based on active tab
    document.body.classList.remove("dbot-bot-builder-active", "dbot-chart-active", "dbot-analysis-active")

    if (active_tab === BOT_BUILDER) {
      document.body.classList.add("dbot-bot-builder-active")
    } else if (active_tab === CHART) {
      document.body.classList.add("dbot-chart-active")
    } else if (active_tab === ANALYSIS) {
      document.body.classList.add("dbot-analysis-active")
    }

    // For mobile, ensure the drawer is properly positioned
    if (isMobile && [BOT_BUILDER, CHART, ANALYSIS].includes(active_tab)) {
      // Ensure drawer visibility
      MobileDrawerManager.positionDrawer(is_drawer_open)

      // Recreate the toggle button
      toggleButtonRef.current = MobileDrawerManager.createToggleButton(is_drawer_open, handleMobileToggle)
    }
  }, [active_tab, BOT_BUILDER, CHART, ANALYSIS, isMobile, is_drawer_open, handleMobileToggle])

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
          toggleDrawer={isMobile ? handleMobileToggle : toggleDrawer}
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
