import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";

import Badge from "../ui/badge/Badge";
import Image from "next/image";

interface Order {
  id: number;
  user: {
    image: string;
    name: string;
    role: string;
  };
  projectName: string;
  team: {
    images: string[];
  };
  status: string;
  budget: string;
}

// Define the table data using the interface
const tableData: Order[] = [
  {
    id: 1,
    user: {
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Lindsey",
      name: "Lindsey Curtis",
      role: "Web Designer",
    },
    projectName: "Agency Website",
    team: {
      images: [
        "https://api.dicebear.com/7.x/avataaars/svg?seed=team1",
        "https://api.dicebear.com/7.x/avataaars/svg?seed=team2",
        "https://api.dicebear.com/7.x/avataaars/svg?seed=team3",
      ],
    },
    budget: "3.9K",
    status: "Active",
  },
  {
    id: 2,
    user: {
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Kaiya",
      name: "Kaiya George",
      role: "Project Manager",
    },
    projectName: "Technology",
    team: {
      images: ["https://api.dicebear.com/7.x/avataaars/svg?seed=team4", "https://api.dicebear.com/7.x/avataaars/svg?seed=team5"],
    },
    budget: "24.9K",
    status: "Pending",
  },
  {
    id: 3,
    user: {
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Zain",
      name: "Zain Geidt",
      role: "Content Writing",
    },
    projectName: "Blog Writing",
    team: {
      images: ["https://api.dicebear.com/7.x/avataaars/svg?seed=team6"],
    },
    budget: "12.7K",
    status: "Active",
  },
  {
    id: 4,
    user: {
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Abram",
      name: "Abram Schleifer",
      role: "Digital Marketer",
    },
    projectName: "Social Media",
    team: {
      images: [
        "https://api.dicebear.com/7.x/avataaars/svg?seed=team7",
        "https://api.dicebear.com/7.x/avataaars/svg?seed=team8",
        "https://api.dicebear.com/7.x/avataaars/svg?seed=team9",
      ],
    },
    budget: "2.8K",
    status: "Cancel",
  },
  {
    id: 5,
    user: {
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Carla",
      name: "Carla George",
      role: "Front-end Developer",
    },
    projectName: "Website",
    team: {
      images: [
        "https://api.dicebear.com/7.x/avataaars/svg?seed=team10",
        "https://api.dicebear.com/7.x/avataaars/svg?seed=team11",
        "https://api.dicebear.com/7.x/avataaars/svg?seed=team12",
      ],
    },
    budget: "4.5K",
    status: "Active",
  },
];

export default function BasicTableOne() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="max-w-full overflow-x-auto">
        <div className="min-w-[1102px]">
          <Table>
            {/* Table Header */}
            <TableHeader className="border-b border-border">
              <TableRow>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-muted-foreground text-start text-theme-xs"
                >
                  User
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-muted-foreground text-start text-theme-xs"
                >
                  Project Name
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-muted-foreground text-start text-theme-xs"
                >
                  Team
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-muted-foreground text-start text-theme-xs"
                >
                  Status
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-muted-foreground text-start text-theme-xs"
                >
                  Budget
                </TableCell>
              </TableRow>
            </TableHeader>

            {/* Table Body */}
            <TableBody className="divide-y divide-border">
              {tableData.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="px-5 py-4 sm:px-6 text-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 overflow-hidden rounded-full">
                        <Image
                          width={40}
                          height={40}
                          src={order.user.image}
                          alt={order.user.name}
                        />
                      </div>
                      <div>
                        <span className="block font-medium text-foreground text-theme-sm">
                          {order.user.name}
                        </span>
                        <span className="block text-muted-foreground text-theme-xs">
                          {order.user.role}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground text-start text-theme-sm">
                    {order.projectName}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground text-start text-theme-sm">
                    <div className="flex -space-x-2">
                      {order.team.images.map((teamImage, index) => (
                        <div
                          key={index}
                          className="w-6 h-6 overflow-hidden border-2 border-background rounded-full"
                        >
                          <Image
                            width={24}
                            height={24}
                            src={teamImage}
                            alt={`Team member ${index + 1}`}
                            className="w-full"
                          />
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground text-start text-theme-sm">
                    <Badge
                      size="sm"
                      color={
                        order.status === "Active"
                          ? "success"
                          : order.status === "Pending"
                          ? "warning"
                          : "error"
                      }
                    >
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground text-theme-sm">
                    {order.budget}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
