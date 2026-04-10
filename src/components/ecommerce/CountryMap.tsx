"use client";

import React, { useMemo } from "react";
// import { VectorMap } from "@react-jvectormap/core";
import { worldMill } from "@react-jvectormap/world";
import dynamic from "next/dynamic";

import { useGeoDistributionLastKnown } from "@/hooks/useApi";

const VectorMap = dynamic(
  () => import("@react-jvectormap/core").then((mod) => mod.VectorMap),
  { ssr: false }
);

// Define the component props
interface CountryMapProps {
  mapColor?: string;
}

type MarkerStyle = {
  initial: {
    fill: string;
    r: number; // Radius for markers
  };
};

type Marker = {
  latLng: [number, number];
  name: string;
  style?: {
    fill: string;
    borderWidth: number;
    borderColor: string;
    stroke?: string;
    strokeOpacity?: number;
  };
};

const CountryMap: React.FC<CountryMapProps> = ({ mapColor }) => {
  const { data, isLoading, isError } = useGeoDistributionLastKnown(false);

  const regionValues = useMemo(() => {
    const values: Record<string, number> = {};
    (data || []).forEach((item: { country_code: string; count: number }) => {
      const code = (item.country_code || "").toUpperCase();
      if (code && code.length === 2) {
        values[code] = item.count;
      }
    });
    return values;
  }, [data]);

  const mapKey = useMemo(() => {
    const entries = Object.entries(regionValues).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    return entries.map(([code, count]) => `${code}:${count}`).join("|");
  }, [regionValues]);
  const hasRegionData = Object.keys(regionValues).length > 0;


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[320px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-[320px] text-red-500">
        Failed to load geographic distribution
      </div>
    );
  }

  if (!isLoading && !hasRegionData) {
    return (
      <div className="flex h-[320px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        No geographic distribution data available
      </div>
    );
  }

  return (
    <VectorMap
      key={mapKey}
      map={worldMill}
      className="h-[350px] w-full rounded-lg overflow-hidden"
      style={{ width: "100%", height: 350 }}
      backgroundColor="transparent"
      onRegionTipShow={(_event: any, labelElement: any, regionCode: string) => {
        const code = (regionCode || "").toUpperCase();
        const count = regionValues[code] ?? 0;

        const base = typeof labelElement?.html === "function" ? String(labelElement.html()) : code;
        const countText = `${count.toLocaleString()} user${count === 1 ? "" : "s"}`;

        if (typeof labelElement?.html === "function") {
          labelElement.html(`${base}<br/>${countText}`);
        }
      }}
      markerStyle={
        {
          initial: {
            fill: "#465FFF",
            r: 4, // Custom radius for markers
          }, // Type assertion to bypass strict CSS property checks
        } as MarkerStyle
      }
      markersSelectable={true}
      markers={[] as Marker[]}
      zoomOnScroll={false}
      zoomMax={12}
      zoomMin={1}
      zoomAnimate={true}
      zoomStep={1.5}
      series={{
        regions: [
          {
            attribute: "fill",
            values: regionValues,
            // Use existing palette already used elsewhere in this file
            scale: [mapColor || "#D0D5DD", "#465FFF"],
            // Linear provides clearer contrast for small count ranges (e.g. 1-5 users)
            normalizeFunction: "linear",
          },
        ],
      }}
      regionStyle={{
        initial: {
          fill: mapColor || "#D0D5DD",
          fillOpacity: 1,
          fontFamily: "Outfit",
          stroke: "none",
          strokeWidth: 0,
          strokeOpacity: 0,
        },
        hover: {
          fillOpacity: 0.7,
          cursor: "pointer",
          fill: "#465fff",
          stroke: "none",
        },
        selected: {
          fill: "#465FFF",
        },
        selectedHover: {},
      }}
      regionLabelStyle={{
        initial: {
          fill: "#35373e",
          fontWeight: 500,
          fontSize: "13px",
          stroke: "none",
        },
        hover: {},
        selected: {},
        selectedHover: {},
      }}
    />
  );
};

export default CountryMap;
