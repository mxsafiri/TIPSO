import type { Plan } from "./types";

export const PLANS: Plan[] = [
  {
    id: "daily",
    name: "Daily Plan",
    nameSw: "Kifurushi cha Siku",
    priceTzs: 2000,
    period: "day",
    durationDays: 1,
    popular: false,
    features: ["Unlock all daily tips", "1 Day Access"],
    featuresSw: ["Fungua tips zote za leo", "Matumizi ya siku 1"],
  },
  {
    id: "weekly",
    name: "Weekly Plan",
    nameSw: "Kifurushi cha Wiki",
    priceTzs: 10000,
    period: "week",
    durationDays: 7,
    popular: true,
    features: ["Unlock all weekly tips", "7 Days Access"],
    featuresSw: ["Fungua tips zote za wiki", "Matumizi ya siku 7"],
  },
  {
    id: "vip",
    name: "VIP Plan",
    nameSw: "Kifurushi cha VIP",
    priceTzs: 25000,
    period: "month",
    durationDays: 30,
    popular: false,
    features: ["Unlock all tips", "Priority tips", "30 Days Access"],
    featuresSw: ["Fungua tips zote", "Tips za kipaumbele", "Matumizi ya siku 30"],
  },
];

export function getPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}
