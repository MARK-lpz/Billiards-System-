import { useContext } from "react";
import { OnlinePaymentsContext } from "./OnlinePaymentsContext";

const OUTSIDE_PROVIDER = { payments: [], loaded: false, applySaved: () => {}, refresh: () => {} };

/**
 * The website's GCash payments, for signed-in staff (see
 * OnlinePaymentsProvider): { payments, loaded, applySaved(payment), refresh() }.
 */
export function useOnlinePayments() {
  return useContext(OnlinePaymentsContext) || OUTSIDE_PROVIDER;
}
