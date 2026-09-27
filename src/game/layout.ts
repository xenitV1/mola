// Shared physical dimensions: simulation seats and visible furniture must agree.
export const SEATING = {
  offset: 1, approach: .60, seatTop: .52, cushionTop: .5975,
  hipHeight: .51, thighHalfDepth: .11, standingFootBottom: .068, floorSurface: .06,
  sitSeconds: .36, standSeconds: .32, tableClearance: .90, chairClearance: .49,
} as const;
export const seatFacing = (seat:number) => seat % 2 ? -Math.PI / 2 : Math.PI / 2;
export const easeSeat = (t:number) => {const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x);};
