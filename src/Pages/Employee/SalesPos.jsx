import SalesPOSModule from "../../Elements/Global/SalesPOSModule";

export default function SalesPOS(props) {
  return <SalesPOSModule {...props} cashierLabel="Employee" storageKeyPrefix="employee-pos" />;
}
