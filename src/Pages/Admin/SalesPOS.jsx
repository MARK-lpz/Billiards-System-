import "../../styles/Admin/SalesPOS.css";
import "../../styles/Admin/CartPanel.css";
import "../../styles/Admin/RecentTransac.css";
import BaseSalesPOS from "../../Elements/Admin/BaseSalesPOS";

export default function SalesPOS(props) {
  return <BaseSalesPOS {...props} cashierLabel="Admin" storageKeyPrefix="admin-pos" />;
}
