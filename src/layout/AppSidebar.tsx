"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import { useAuth } from "../context/AuthContext";
import { ChevronDownIcon, HorizontaLDots } from "../icons/index";
import {
  AdminNavItem,
  mainNavigationItems,
  personalNavigationItems,
} from "@/config/adminNavigation";

type MenuType = "main" | "others";

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const { checkPermission } = useAuth();
  const pathname = usePathname();

  const [manualOpenSubmenu, setManualOpenSubmenu] = useState<{ type: MenuType; index: number } | null>(null);
  const [manualOpenNestedSubmenuKey, setManualOpenNestedSubmenuKey] = useState<string | null>(null);
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isActive = (path: string) => pathname === path;
  const isRouteWithin = (path: string) => pathname === path || pathname.startsWith(`${path}/`);
  const getItemPaths = (item: AdminNavItem): string[] =>
    [item.path, ...(item.activePaths ?? [])].filter((path): path is string => Boolean(path));
  const isItemPathActive = (item: AdminNavItem, exact = false): boolean =>
    getItemPaths(item).some((path) => (exact ? isActive(path) : isRouteWithin(path)));

  const hasAccess = (item: AdminNavItem): boolean => {
    if (item.permission && !checkPermission(item.permission)) {
      return false;
    }

    if (!item.subItems || item.subItems.length === 0) {
      return true;
    }

    const visibleChildren = item.subItems.filter(hasAccess);
    return Boolean(item.path) || visibleChildren.length > 0;
  };

  const filterNavItems = (items: AdminNavItem[]): AdminNavItem[] => {
    return items
      .map((item) => {
        if (!hasAccess(item)) {
          return null;
        }

        if (!item.subItems || item.subItems.length === 0) {
          return item;
        }

        const visibleChildren = filterNavItems(item.subItems);
        if (!item.path && visibleChildren.length === 0) {
          return null;
        }

        return {
          ...item,
          subItems: visibleChildren,
        };
      })
      .filter((item): item is AdminNavItem => item !== null);
  };

  const filteredNavItems = filterNavItems(mainNavigationItems);
  const filteredOthersItems = filterNavItems(personalNavigationItems);

  const isItemActive = (item: AdminNavItem): boolean => {
    const ownActive = isItemPathActive(item);
    if (ownActive) return true;
    if (!item.subItems || item.subItems.length === 0) return false;
    return item.subItems.some(isItemActive);
  };

  const routeOpenSubmenuKey = (() => {
    const menuGroups: Array<{ type: MenuType; items: AdminNavItem[] }> = [
      { type: "main", items: filteredNavItems },
      { type: "others", items: filteredOthersItems },
    ];

    for (const group of menuGroups) {
      for (const [index, nav] of group.items.entries()) {
        if (nav.subItems && nav.subItems.some(isItemActive)) {
          return `${group.type}-${index}`;
        }
      }
    }

    return "";
  })();

  const manualOpenSubmenuKey = manualOpenSubmenu ? `${manualOpenSubmenu.type}-${manualOpenSubmenu.index}` : "";
  const openSubmenuKey = manualOpenSubmenuKey || routeOpenSubmenuKey;
  const openSubmenu = openSubmenuKey
    ? {
        type: openSubmenuKey.startsWith("main-") ? ("main" as const) : ("others" as const),
        index: Number(openSubmenuKey.split("-")[1] || "0"),
      }
    : null;

  const routeOpenNestedSubmenuKey = (() => {
    const menuGroups: Array<{ type: MenuType; items: AdminNavItem[] }> = [
      { type: "main", items: filteredNavItems },
      { type: "others", items: filteredOthersItems },
    ];

    for (const group of menuGroups) {
      for (const [index, nav] of group.items.entries()) {
        if (!nav.subItems) continue;
        for (const subItem of nav.subItems) {
          if (subItem.subItems && subItem.subItems.some(isItemActive)) {
            return `${group.type}-${index}-${subItem.name}`;
          }
        }
      }
    }

    return null;
  })();

  const openNestedSubmenuKey = manualOpenNestedSubmenuKey || routeOpenNestedSubmenuKey;

  const handleSubmenuToggle = (index: number, menuType: MenuType) => {
    setManualOpenSubmenu((prev) => {
      if (prev && prev.type === menuType && prev.index === index) {
        return null;
      }
      return { type: menuType, index };
    });
  };

  const renderMenuItems = (items: AdminNavItem[], menuType: MenuType) => (
    <ul className="flex flex-col gap-4">
      {items.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems && nav.subItems.length > 0 ? (
            <button
              type="button"
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group ${
                isItemActive(nav) ? "menu-item-active" : "menu-item-inactive"
              } cursor-pointer ${!isExpanded && !isHovered ? "lg:justify-center" : "lg:justify-start"}`}
            >
              <span className={`${isItemActive(nav) ? "menu-item-icon-active" : "menu-item-icon-inactive"}`}>
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && <span className="menu-item-text">{nav.name}</span>}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon
                  className={`ml-auto w-5 h-5 transition-transform duration-200 ${
                    openSubmenu?.type === menuType && openSubmenu?.index === index ? "rotate-180 text-brand-500" : ""
                  }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                href={nav.path}
                className={`menu-item group ${isItemPathActive(nav) ? "menu-item-active" : "menu-item-inactive"}`}
              >
                <span className={`${isItemPathActive(nav) ? "menu-item-icon-active" : "menu-item-icon-inactive"}`}>
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && <span className="menu-item-text">{nav.name}</span>}
              </Link>
            )
          )}

          {nav.subItems && nav.subItems.length > 0 && (isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              style={{
                maxHeight:
                  openSubmenu?.type === menuType && openSubmenu?.index === index ? "1000px" : "0px",
              }}
            >
              <ul className="mt-2 space-y-1 ml-9">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.name}>
                    {subItem.subItems && subItem.subItems.length > 0 ? (
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            const key = `${menuType}-${index}-${subItem.name}`;
                            setManualOpenNestedSubmenuKey((prev) => (prev === key ? null : key));
                          }}
                          className={`menu-dropdown-item w-full ${
                            isItemActive(subItem) ? "menu-dropdown-item-active" : "menu-dropdown-item-inactive"
                          }`}
                        >
                          {subItem.name}
                          <span className="flex items-center gap-1 ml-auto">
                            <ChevronDownIcon
                              className={`w-4 h-4 transition-transform duration-200 ${
                                openNestedSubmenuKey === `${menuType}-${index}-${subItem.name}`
                                  ? "rotate-180 text-brand-500"
                                  : ""
                              }`}
                            />
                          </span>
                        </button>
                        {openNestedSubmenuKey === `${menuType}-${index}-${subItem.name}` && (
                          <ul className="mt-1 space-y-1 ml-4">
                            {subItem.subItems.map((child) => (
                              <li key={child.name}>
                                {child.path && (
                                  <Link
                                    href={child.path}
                                    className={`menu-dropdown-item ${
                                      isItemPathActive(child) ? "menu-dropdown-item-active" : "menu-dropdown-item-inactive"
                                    }`}
                                  >
                                    {child.name}
                                  </Link>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : (
                      subItem.path && (
                        <Link
                          href={subItem.path}
                          className={`menu-dropdown-item ${
                            isItemPathActive(subItem) ? "menu-dropdown-item-active" : "menu-dropdown-item-inactive"
                          }`}
                        >
                          {subItem.name}
                        </Link>
                      )
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${
          isExpanded || isMobileOpen ? "w-[290px]" : isHovered ? "w-[290px]" : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`py-8 flex ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-start"}`}>
        <Link href="/dashboard">
          {isExpanded || isHovered || isMobileOpen ? (
            <>
              <Image
                className="dark:hidden"
                src="/images/logo/logo.svg"
                alt="Logo"
                width={150}
                height={40}
              />
              <Image
                className="hidden dark:block"
                src="/images/logo/logo-dark.svg"
                alt="Logo"
                width={150}
                height={40}
              />
            </>
          ) : (
            <Image
              src="/images/logo/logo-icon.svg"
              alt="Logo"
              width={32}
              height={32}
            />
          )}
        </Link>
      </div>

      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            {filteredNavItems.length > 0 && (
              <div>
                <h2
                  className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                    !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
                  }`}
                >
                  {isExpanded || isHovered || isMobileOpen ? "Workspace" : <HorizontaLDots />}
                </h2>
                {renderMenuItems(filteredNavItems, "main")}
              </div>
            )}

            {filteredOthersItems.length > 0 && (
              <div>
                <h2
                  className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                    !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
                  }`}
                >
                  {isExpanded || isHovered || isMobileOpen ? "Account" : <HorizontaLDots />}
                </h2>
                {renderMenuItems(filteredOthersItems, "others")}
              </div>
            )}
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;
