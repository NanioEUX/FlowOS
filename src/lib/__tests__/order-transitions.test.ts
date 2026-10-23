import { describe, it, expect } from "vitest"
import {
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  KDS_ALLOWED_TARGETS,
  canTransition,
  isValidStatus,
  isRoleAllowedToSetStatus,
} from "@/lib/order-transitions"

describe("order-transitions (máquina de estados F5A-002/F5D-008)", () => {
  it("whitelist cobre os statuses reais do sistema", () => {
    for (const s of [
      "pending", "payment_pending", "new", "confirmed", "accepted", "preparing",
      "ready", "dispatched", "out_for_delivery", "delivered", "cancelled", "abandoned",
    ]) {
      expect(isValidStatus(s)).toBe(true)
    }
    expect(isValidStatus("hacked")).toBe(false)
    expect(isValidStatus("")).toBe(false)
  })

  it("fluxo principal do painel é válido", () => {
    expect(canTransition("pending", "accepted")).toBe(true)
    expect(canTransition("accepted", "preparing")).toBe(true)
    expect(canTransition("preparing", "ready")).toBe(true)
    expect(canTransition("ready", "out_for_delivery")).toBe(true)
    expect(canTransition("out_for_delivery", "delivered")).toBe(true)
    expect(canTransition("ready", "delivered")).toBe(true) // balcão/pickup
    expect(canTransition("new", "preparing")).toBe(true) // iFood 1-clique
  })

  it("bloqueia downgrade", () => {
    expect(canTransition("delivered", "preparing")).toBe(false)
    expect(canTransition("ready", "preparing")).toBe(false)
    expect(canTransition("out_for_delivery", "ready")).toBe(false)
    expect(canTransition("preparing", "accepted")).toBe(false)
  })

  it("terminais não voltam; mesmo status é idempotente", () => {
    expect(canTransition("delivered", "ready")).toBe(false)
    expect(canTransition("cancelled", "preparing")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(true)
    expect(canTransition("preparing", "preparing")).toBe(true)
  })

  it("cancelamento a partir de qualquer não-final; abandoned pode virar cancelled", () => {
    for (const from of ["pending", "payment_pending", "new", "confirmed", "accepted", "preparing", "ready", "dispatched", "out_for_delivery"]) {
      expect(canTransition(from, "cancelled")).toBe(true)
    }
    expect(canTransition("abandoned", "cancelled")).toBe(true)
    expect(canTransition("delivered", "cancelled")).toBe(false)
  })

  it("status desconhecido é recusado", () => {
    expect(canTransition("pending", "hacked")).toBe(false)
    expect(ORDER_TRANSITIONS["delivered"]).toEqual([])
    expect(ORDER_STATUSES.length).toBe(12)
  })

  it("papéis: kds só aceitação/produção/pronto; motoboy não muta; staff completo", () => {
    for (const to of KDS_ALLOWED_TARGETS) {
      expect(isRoleAllowedToSetStatus("kds", to)).toBe(true)
    }
    expect(isRoleAllowedToSetStatus("kds", "cancelled")).toBe(false)
    expect(isRoleAllowedToSetStatus("kds", "delivered")).toBe(false)
    expect(isRoleAllowedToSetStatus("motoboy", "delivered")).toBe(false)
    expect(isRoleAllowedToSetStatus("motoboy", "preparing")).toBe(false)
    expect(isRoleAllowedToSetStatus("admin", "delivered")).toBe(true)
    expect(isRoleAllowedToSetStatus("atendente", "cancelled")).toBe(true)
    expect(isRoleAllowedToSetStatus(undefined, "preparing")).toBe(true)
  })
})
