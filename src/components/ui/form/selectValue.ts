// Shared value mapping for Radix-based selects.
//
// Radix Select/Combobox treat an option value of "" as "no selection" and
// refuse to render it, but the dashboard uses value="" pervasively to mean
// "All"/"no filter" (a real, selectable option). These helpers map "" to a
// sentinel and back so callers keep passing and receiving value="" unchanged.

export const EMPTY_SELECT_VALUE = "__abidii_empty__";

export const toSelectValue = (value: string | number): string => {
  if (value === undefined || value === null) return EMPTY_SELECT_VALUE;
  const s = String(value);
  return s === "" ? EMPTY_SELECT_VALUE : s;
};

export const fromSelectValue = (value: string): string =>
  value === EMPTY_SELECT_VALUE ? "" : value;
