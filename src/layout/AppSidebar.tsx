"use client";
import React, { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import { useAuth } from "../context/AuthContext";
import {
  BoxCubeIcon,
  ChevronDownIcon,
  GridIcon,
  HorizontaLDots,
  ListIcon,
  PageIcon,
  PieChartIcon,
  TableIcon,
  UserCircleIcon,
} from "../icons/index";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: {
    name: string;
    path?: string;
    pro?: boolean;
    new?: boolean;
    subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
  }[];
  permission?: string; // Required permission to see this item
};

/**
 * Main navigation items
 * Organized by functionality with RBAC permissions
 */
const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    path: "/dashboard",
  },
  {
    icon: <UserCircleIcon />,
    name: "System",
    permission: "system:read", // Admin only
    subItems: [
      { name: "Status & Health", path: "/system/status" },
      { name: "Configuration", path: "/system/config" },
      { name: "Alert History", path: "/system/alerts" },
      { name: "System Metrics", path: "/system/metrics" },
      { name: "Idempotency", path: "/system/idempotency" },
      { name: "Cron Jobs", path: "/system/cron" },
    ],
  },
  {
    icon: <UserCircleIcon />,
    name: "Users",
    permission: "users:read", // Admin only
    subItems: [
      { name: "All Users", path: "/users" },
      { name: "Admin Users", path: "/users/admins" },
    ],
  },
  {
    icon: <TableIcon />,
    name: "Subscriptions",
    permission: "users:read", // Admin only
    subItems: [
      { name: "All Subscriptions", path: "/subscriptions" },
      { name: "Subscription Events", path: "/subscriptions/events" },
      { name: "Verification Attempts", path: "/subscriptions/attempts" },
    ],
  },
  {
    icon: <PieChartIcon />,
    name: "Analytics",
    permission: "users:read", // Admin only
    subItems: [
      { name: "Game Analytics", path: "/analytics" },
      { name: "Player Analytics", path: "/analytics/players" },
      { name: "Curriculum Ops", path: "/analytics/curriculum-ops" },
    ],
  },
  {
    name: "Content",
    icon: <ListIcon />,
    permission: "content:read", // Admin & Manager
    subItems: [
      { name: "Languages", path: "/content/languages" },
      { name: "Lessons", path: "/content/lessons" },
      { name: "Letters & Phonics", path: "/content/letters" },
      { name: "Words", path: "/content/words" },
      { name: "Numbers", path: "/content/numbers" },
      { name: "Sentences", path: "/content/sentences" },
      { name: "Phrases", path: "/content/phrases" },
      { name: "Proverbs", path: "/content/proverbs" },
    ],
  },
  {
    name: "Curriculum",
    icon: <PageIcon />,
    permission: "content:read",
    subItems: [
      { name: "Courses", path: "/content/curriculum/courses" },
      { name: "Curriculum Editor", path: "/content/curriculum/editor" },
      { name: "Asset Library", path: "/content/curriculum/assets" },
      { name: "Lesson Blueprints", path: "/content/curriculum/lesson-blueprints" },
    ],
  },
  {
    name: "Audit Log",
    icon: <TableIcon />,
    permission: "content:read",
    subItems: [
      { name: "Audit Log", path: "/content/audit-log" },
    ],
  },
  {
    name: "Games",
    icon: <BoxCubeIcon />,
    permission: "content:read",
    subItems: [
      { name: "Games", path: "/games" },
    ],
  },
  {
    name: "Audio",
    icon: <PieChartIcon />,
    permission: "audio:read", // Admin & Manager
    subItems: [
      { name: "Voices", path: "/audio/voices" },
      { name: "Generation Jobs", path: "/audio/jobs" },
    ],
  },
];

/**
 * Other/utility navigation items
 */
const othersItems: NavItem[] = [
  {
    icon: <PieChartIcon />,
    name: "Testing",
    permission: "testing:access", // Admin only
    path: "/testing",
  },
  {
    icon: <BoxCubeIcon />,
    name: "Settings",
    subItems: [
      { name: "Language Settings", path: "/settings/language-settings" },
      { name: "App Config", path: "/settings/app-config" },
      { name: "Change Password", path: "/settings/change-password" },
      { name: "Profile", path: "/profile" },
    ],
  },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const { checkPermission } = useAuth();
  const pathname = usePathname();

  const [openNestedSubmenuKey, setOpenNestedSubmenuKey] = useState<string | null>(null);

  /**
   * Filter nav items based on user permissions
   */
  const filterNavItems = (items: NavItem[]): NavItem[] => {
    return items.filter((item) => {
      // If item has permission requirement, check it
      if (item.permission) {
        return checkPermission(item.permission);
      }
      // No permission required, show to everyone
      return true;
    });
  };

  const filteredNavItems = filterNavItems(navItems);
  const filteredOthersItems = filterNavItems(othersItems);

  const renderMenuItems = (
    navItems: NavItem[],
    menuType: "main" | "others"
  ) => (
    <ul className="flex flex-col gap-4">
      {navItems.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group  ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-active"
                  : "menu-item-inactive"
              } cursor-pointer ${
                !isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
              }`}
            >
              <span
                className={` ${
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className={`menu-item-text`}>{nav.name}</span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon
                  className={`ml-auto w-5 h-5 transition-transform duration-200  ${
                    openSubmenu?.type === menuType &&
                    openSubmenu?.index === index
                      ? "rotate-180 text-brand-500"
                      : ""
                  }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                href={nav.path}
                className={`menu-item group ${
                  isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                }`}
              >
                <span
                  className={`${
                    isActive(nav.path)
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                  }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className={`menu-item-text`}>{nav.name}</span>
                )}
              </Link>
            )
          )}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              style={{
                maxHeight:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? "1000px"
                    : "0px",
              }}
            >
              <ul className="mt-2 space-y-1 ml-9">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.name}>
                    {subItem.subItems ? (
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            const key = `${menuType}-${index}-${subItem.name}`;
                            setOpenNestedSubmenuKey((prev) => (prev === key ? null : key));
                          }}
                          className={`menu-dropdown-item w-full ${
                            subItem.subItems.some((child) => isActive(child.path))
                              ? "menu-dropdown-item-active"
                              : "menu-dropdown-item-inactive"
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
                                <Link
                                  href={child.path}
                                  className={`menu-dropdown-item ${
                                    isActive(child.path)
                                      ? "menu-dropdown-item-active"
                                      : "menu-dropdown-item-inactive"
                                  }`}
                                >
                                  {child.name}
                                  <span className="flex items-center gap-1 ml-auto">
                                    {child.new && (
                                      <span
                                        className={`ml-auto ${
                                          isActive(child.path)
                                            ? "menu-dropdown-badge-active"
                                            : "menu-dropdown-badge-inactive"
                                        } menu-dropdown-badge `}
                                      >
                                        new
                                      </span>
                                    )}
                                    {child.pro && (
                                      <span
                                        className={`ml-auto ${
                                          isActive(child.path)
                                            ? "menu-dropdown-badge-active"
                                            : "menu-dropdown-badge-inactive"
                                        } menu-dropdown-badge `}
                                      >
                                        pro
                                      </span>
                                    )}
                                  </span>
                                </Link>
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
                            isActive(subItem.path)
                              ? "menu-dropdown-item-active"
                              : "menu-dropdown-item-inactive"
                          }`}
                        >
                          {subItem.name}
                          <span className="flex items-center gap-1 ml-auto">
                            {subItem.new && (
                              <span
                                className={`ml-auto ${
                                  isActive(subItem.path)
                                    ? "menu-dropdown-badge-active"
                                    : "menu-dropdown-badge-inactive"
                                } menu-dropdown-badge `}
                              >
                                new
                              </span>
                            )}
                            {subItem.pro && (
                              <span
                                className={`ml-auto ${
                                  isActive(subItem.path)
                                    ? "menu-dropdown-badge-active"
                                    : "menu-dropdown-badge-inactive"
                                } menu-dropdown-badge `}
                              >
                                pro
                              </span>
                            )}
                          </span>
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

  const [manualOpenSubmenu, setManualOpenSubmenu] = useState<{
    type: "main" | "others";
    index: number;
  } | null>(null);
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isActive = (path: string) => path === pathname;

  const routeOpenSubmenuKey = (() => {
    const menuGroups: Array<{
      type: "main" | "others";
      items: NavItem[];
    }> = [
      { type: "main", items: filteredNavItems },
      { type: "others", items: filteredOthersItems },
    ];

    for (const group of menuGroups) {
      for (const [index, nav] of group.items.entries()) {
        if (!nav.subItems) continue;
        const hasActiveChild = nav.subItems.some((subItem) => {
          const isPathActive = subItem.path ? isActive(subItem.path) : false;
          const isNestedActive = subItem.subItems
            ? subItem.subItems.some((child) => isActive(child.path))
            : false;
          return isPathActive || isNestedActive;
        });

        if (hasActiveChild) {
          return `${group.type}-${index}`;
        }
      }
    }

    return "";
  })();

  const manualOpenSubmenuKey = manualOpenSubmenu
    ? `${manualOpenSubmenu.type}-${manualOpenSubmenu.index}`
    : "";
  const openSubmenuKey = routeOpenSubmenuKey || manualOpenSubmenuKey;
  const openSubmenu = openSubmenuKey
    ? {
        type: openSubmenuKey.startsWith("main-") ? ("main" as const) : ("others" as const),
        index: Number(openSubmenuKey.split("-")[1] || "0"),
      }
    : null;

  const handleSubmenuToggle = (index: number, menuType: "main" | "others") => {
    setManualOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        return null;
      }
      return { type: menuType, index };
    });
  };

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-8 flex  ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
        }`}
      >
        <Link href="/">
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
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Menu"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(filteredNavItems, "main")}
            </div>

            <div className="">
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Others"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(filteredOthersItems, "others")}
            </div>
          </div>
        </nav>
        {/* {isExpanded || isHovered || isMobileOpen ? <SidebarWidget /> : null} */}
      </div>
    </aside>
  );
};

export default AppSidebar;
