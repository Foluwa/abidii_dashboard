"use client";
import React from "react";
import Badge from "../ui/badge/Badge";
import { ArrowDownIcon, ArrowUpIcon, BoxIconLine, GroupIcon } from "@/icons";

export const EcommerceMetrics = () => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
      {/* <!-- Metric Item Start --> */}
      <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-muted rounded-xl">
          <GroupIcon className="text-foreground size-6" />
        </div>

        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-muted-foreground">
              Customers
            </span>
            <h4 className="mt-2 font-bold text-foreground text-title-sm">
              3,782
            </h4>
          </div>
          <Badge color="success">
            <ArrowUpIcon />
            11.01%
          </Badge>
        </div>
      </div>
      {/* <!-- Metric Item End --> */}

      {/* <!-- Metric Item Start --> */}
      <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-muted rounded-xl">
          <BoxIconLine className="text-foreground" />
        </div>
        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-muted-foreground">
              Orders
            </span>
            <h4 className="mt-2 font-bold text-foreground text-title-sm">
              5,359
            </h4>
          </div>

          <Badge color="error">
            <ArrowDownIcon className="text-error-500" />
            9.05%
          </Badge>
        </div>
      </div>
      {/* <!-- Metric Item End --> */}
    </div>
  );
};
