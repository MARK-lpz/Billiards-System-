import SalesPOSModule from "../../Elements/Global/SalesPOSModule";

export default function SalesPOS(props) {
  return <SalesPOSModule {...props} cashierLabel="Admin" storageKeyPrefix="admin-pos" />;
}
