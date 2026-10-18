import { createContext } from "react";

// Admin > Website: each card tells the page whether it has unsaved changes
// (`report(section, dirty)`), so its tab can show a dot.
export const WebsiteTabsContext = createContext(null);

// Who the page is open for ("Admin" or "Employee"), named in the Audit Trail.
export const WebsiteStaffContext = createContext("Admin");
