// Recovered from the canonical Stock_Hunter_Eco_Bridge_v4.0.8.exe artifact.
// This file contains descriptive universe-label derivation only.
// It has no Hunt scoring authority.

export const ECO_V408_EXE_SHA256 =
  "0b80d20a349ca5d92acb7c61f4f23ab6a4dd747f33b1509f2fdf3d6f40abb8b4";

export function assetTypeFromYValV408(value: unknown): string {
  const yval=String(value ?? "").trim();
  switch(yval){
    case "300": return "سهام";
    case "301": return "حق تقدم";
    case "303":
    case "305":
    case "306": return "صندوق";
    case "400":
    case "403":
    case "404": return "اوراق بدهی";
    default: return "";
  }
}

export function inferAssetTypeV408(
  symbolValue: unknown,
  companyNameValue: unknown,
  fallbackValue: unknown,
): string {
  // The Eco caller already supplied trimmed symbol/company strings.
  const symbol=String(symbolValue ?? "");
  const companyName=String(companyNameValue ?? "");
  const fallback=String(fallbackValue ?? "");
  const text=(symbol+" "+companyName).replace(/\u200c/g," ");

  if(text.includes("اختیار") || symbol.startsWith("ض")){
    return "اختیار معامله";
  }

  if(
    symbol.startsWith("اخزا") ||
    symbol.startsWith("اراد") ||
    symbol.startsWith("گام") ||
    symbol.startsWith("افاد") ||
    symbol.startsWith("تسه")
  ){
    return "اوراق بدهی";
  }

  if(text.includes("درآمد ثابت") || text.includes("درآمدثابت")){
    return "صندوق درآمد ثابت";
  }

  if(text.includes("صندوق")){
    return "صندوق";
  }

  return fallback || "سهام";
}

export function marketFromFlowV408(flowValue: unknown): string {
  switch(Number(flowValue)){
    case 1: return "بورس";
    case 2: return "فرابورس";
    case 4: return "بازار پایه";
    case 6: return "بورس کالا";
    case 7: return "بورس انرژی";
    default: return "بازار سرمایه";
  }
}

export function classifyEcoUniverseLabelsV408(row: {
  symbol?: unknown;
  company_name?: unknown;
  yval?: unknown;
  flow?: unknown;
}){
  const fallback=assetTypeFromYValV408(row.yval);
  return {
    asset_type: inferAssetTypeV408(row.symbol,row.company_name,fallback),
    market: marketFromFlowV408(row.flow),
  };
}
