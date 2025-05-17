"use client"

import clsx from "clsx"
import { observer } from "mobx-react-lite"
import { useEffect } from "react"
import { useStore } from "@/hooks/useStore"
import { LegacyChevronRight1pxIcon } from "@deriv/quill-icons/Legacy"
import { MenuItem, Text, useDevice } from "@deriv-com/ui"
// Removed PlatformSwitcher import
// import PlatformSwitcher from '../platform-switcher';
import useMobileMenuConfig from "./use-mobile-menu-config"

type TMenuContentProps = {
  onOpenSubmenu?: (submenu: string) => void
}

const MenuContent = observer(({ onOpenSubmenu }: TMenuContentProps) => {
  const { isDesktop } = useDevice()
  const { client } = useStore()
  const textSize = isDesktop ? "sm" : "md"
  const { config } = useMobileMenuConfig(client)

  // Add effect to hide platform switcher elements
  useEffect(() => {
    // Add CSS to hide platform switcher and traders hub elements
    const style = document.createElement("style")
    style.innerHTML = `
            /* Hide platform switcher and Trader's Hub elements in mobile menu */
            .mobile-menu__content__platform,
            .platform-switcher,
            .platform-dropdown,
            .traders-hub-link,
            .platform-switcher__dropdown,
            [data-testid="dt_platform_switcher"],
            [data-testid="dt_traders_hub_link"],
            .app-header__traders-hub,
            .app-header__platform-switcher,
            .platform-switcher__list,
            .platform-switcher__list-item,
            .platform-switcher__button,
            a[href*="smarttrader"],
            a[href*="trader"],
            a[href*="traders-hub"],
            a[href*="derivtrader"] {
                display: none !important;
                visibility: hidden !important;
                height: 0 !important;
                width: 0 !important;
                overflow: hidden !important;
                position: absolute !important;
                z-index: -9999 !important;
            }
        `
    document.head.appendChild(style)

    return () => {
      document.head.removeChild(style)
    }
  }, [])

  return (
    <div className="mobile-menu__content">
      {/* Remove the platform switcher div */}
      {/* <div className='mobile-menu__content__platform'>
                <PlatformSwitcher />
            </div> */}

      <div className="mobile-menu__content__items">
        {config.map((item, index) => {
          const removeBorderBottom = item.find(({ removeBorderBottom }) => removeBorderBottom)

          return (
            <div
              className={clsx("mobile-menu__content__items--padding", {
                "mobile-menu__content__items--bottom-border": !removeBorderBottom,
              })}
              data-testid="dt_menu_item"
              key={index}
            >
              {item.map(({ LeftComponent, RightComponent, as, href, label, onClick, submenu, target, isActive }) => {
                // Skip rendering items related to other platforms
                if (
                  typeof label === "string" &&
                  (label.toLowerCase().includes("trader") ||
                    label.toLowerCase().includes("hub") ||
                    label.toLowerCase().includes("mt5") ||
                    label.toLowerCase().includes("deriv go") ||
                    label.toLowerCase().includes("deriv x"))
                ) {
                  return null
                }

                // Skip items with links to other platforms
                if (
                  href &&
                  (href.includes("smarttrader") ||
                    href.includes("trader") ||
                    href.includes("traders-hub") ||
                    href.includes("derivtrader"))
                ) {
                  return null
                }

                const is_deriv_logo = label === "Deriv.com"
                if (as === "a") {
                  return (
                    <MenuItem
                      as="a"
                      className={clsx("mobile-menu__content__items__item", {
                        "mobile-menu__content__items__icons": !is_deriv_logo,
                        "mobile-menu__content__items__item--active": isActive,
                      })}
                      disableHover
                      href={href}
                      key={label}
                      leftComponent={
                        <LeftComponent className="mobile-menu__content__items--right-margin" height={16} width={16} />
                      }
                      target={target}
                    >
                      <Text size={textSize}>{label}</Text>
                    </MenuItem>
                  )
                }
                return (
                  <MenuItem
                    as="button"
                    className={clsx("mobile-menu__content__items__item", {
                      "mobile-menu__content__items__icons": !is_deriv_logo,
                      "mobile-menu__content__items__item--active": isActive,
                    })}
                    disableHover
                    key={label}
                    leftComponent={
                      <LeftComponent className="mobile-menu__content__items--right-margin" iconSize="xs" />
                    }
                    onClick={() => {
                      if (submenu && onOpenSubmenu) {
                        onOpenSubmenu(submenu)
                      } else if (onClick) {
                        onClick()
                      }
                    }}
                    rightComponent={
                      submenu ? (
                        <LegacyChevronRight1pxIcon className="mobile-menu__content__items--chevron" iconSize="xs" />
                      ) : (
                        RightComponent
                      )
                    }
                  >
                    <Text size={textSize}>{label}</Text>
                  </MenuItem>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
})

export default MenuContent
