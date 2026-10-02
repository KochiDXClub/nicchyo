/** 右パネル（区画・道・建物の詳細、区画分け、移行）で共通に使う見た目 */
import type { CSSProperties } from "react";

export const panelWrap: CSSProperties = { padding: 16, borderBottom: "1px solid #F3EBD8" };
export const label: CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 700, color: "#9A8A6A", marginBottom: 5 };
export const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 11px",
  borderRadius: 9,
  border: "1px solid #E4D9BF",
  background: "#FDFBF5",
  fontSize: 13,
  outline: "none",
  marginBottom: 12,
};
export const buttonStyle: CSSProperties = {
  padding: "8px 13px",
  borderRadius: 9,
  fontSize: 12.5,
  fontWeight: 700,
  cursor: "pointer",
  border: "1px solid #E4D9BF",
  background: "#fff",
  color: "#57503F",
};
export const dangerButtonStyle: CSSProperties = {
  ...buttonStyle,
  border: "1px solid #F2C4B0",
  color: "#B4472C",
};

export const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  border: "1px solid #92400E",
  background: "#92400E",
  color: "#fff",
};

export const noteStyle: CSSProperties = { fontSize: 11.5, color: "#9A8A6A", margin: "0 0 12px", lineHeight: 1.6 };

export const errorNoteStyle: CSSProperties = { ...noteStyle, color: "#B4472C", fontWeight: 700 };
